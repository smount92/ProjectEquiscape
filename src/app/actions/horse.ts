"use server";

import { z } from "zod";
import { catalogDisplayName } from "@/lib/catalog/displayName";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import type { Database } from "@/lib/types/database.generated";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { sanitizeText } from "@/lib/utils/validation";
import { decodeHtmlEntities } from "@/lib/utils/decodeEntities";
import { cleanAttributeBag } from "@/lib/forms/attributes";
import {
    firstProblemMessage,
    splitProblems,
    validateCreateInput,
    validateUpdateInput,
    type UpdateCategory,
} from "@/lib/forms/schema";
import type { FieldProblem } from "@/lib/forms/types";
import type { AssetCategory } from "@/lib/types/database";

/**
 * The server-side half of the form engine.
 *
 * `createHorseRecord` and `updateHorseAction` validated NOTHING before
 * this — just a column allow-list — so a hand-rolled call could write a
 * condition grade of "Sparkly", a 10,000-character name, or a negative
 * price. Every rule lived in the browser, where the caller controls it.
 *
 * Rollout follows COMMERCE_AND_COMMS_PLAN §4.3 step 6: values that no
 * rendered control could ever produce are rejected now; missing required
 * fields are logged, not refused, until the flag has soaked — a create
 * path older than the engine (Help-ID, for one) may simply not send them.
 */
function enforceValidation(
    where: string,
    horseId: string | null,
    problems: FieldProblem[],
): string | null {
    const { invalid, missing } = splitProblems(problems);
    if (missing.length > 0) {
        logger.warn(where, "Form-engine required-field gap (log-only during soak)", {
            horseId,
            fields: missing.map((p) => p.field),
        });
    }
    if (invalid.length === 0) return null;
    logger.warn(where, "Form-engine rejected an invalid value", {
        horseId,
        problems: invalid.map((p) => `${p.field}: ${p.message}`),
    });
    return firstProblemMessage(invalid);
}

type UserHorseInsert = Database["public"]["Tables"]["user_horses"]["Insert"];
type FinancialVaultInsert = Database["public"]["Tables"]["financial_vault"]["Insert"];

const ACTIVE_TRANSACTION_STATUSES = ["offer_made", "pending_payment", "funds_verified"];

/** Check if a horse has an active transaction that blocks mutations */
async function checkActiveTransaction(horseId: string): Promise<string | null> {
    const admin = getAdminClient();
    const { data } = await admin
        .from("transactions")
        .select("id")
        .eq("horse_id", horseId)
        .in("status", ACTIVE_TRANSACTION_STATUSES)
        .limit(1)
        .maybeSingle();

    if (data) {
        return "Cannot modify or delete a horse while an active transaction is pending. Please cancel the transaction first.";
    }
    return null;
}

/**
 * Soft-delete a horse — scrubs PII and hides it, but preserves the row for provenance chains.
 * Guards against deletion while an active Safe-Trade transaction is pending.
 * Cleans up Supabase Storage files to free storage costs.
 * @param horseId - UUID of the horse to delete (must be owned by caller)
 */
export async function deleteHorse(horseId: string): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    // Verify ownership
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id, owner_id")
        .eq("id", horseId)
        .eq("owner_id", user.id)
        .single();

    if (!horse) return { success: false, error: "Horse not found or not yours." };

    // Guard: check for active transactions (rug-pull prevention)
    const txnError = await checkActiveTransaction(horseId);
    if (txnError) return { success: false, error: txnError };

    // Get images to clean up storage
    const { data: images } = await supabase
        .from("horse_images")
        .select("image_url")
        .eq("horse_id", horseId);

    // Delete storage files
    if (images && images.length > 0) {
        const paths = images
            .map((img: { image_url: string }) => {
                const match = img.image_url.match(/horse-images\/(.+?)(\?|$)/);
                return match ? match[1] : null;
            })
            .filter(Boolean) as string[];
        if (paths.length > 0) {
            await supabase.storage.from("horse-images").remove(paths);
        }
        // The storage objects are gone — drop the rows too, or the
        // surviving provenance row keeps serving dead image URLs.
        await supabase.from("horse_images").delete().eq("horse_id", horseId);
    }

    // Soft-delete: scrub PII but preserve the row for provenance chains
    const { error } = await supabase
        .from("user_horses")
        .update({
            deleted_at: new Date().toISOString(),
            life_stage: "orphaned",
            visibility: "private",
            custom_name: "[Deleted]",
            trade_status: "Not for Sale",
        })
        .eq("id", horseId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    revalidatePath(`/stable/${horseId}`);
    revalidateTag("public_horses", "max");
    return { success: true };
}

/**
 * Delete a horse image record and its associated storage file.
 * @param recordId - UUID of the horse_images row
 * @param storagePath - Storage path to clean up (nullable)
 * @param horseId - UUID of the horse to delete (must be owned by caller)
 */
export async function deleteHorseImageAction(recordId: string, storagePath: string | null): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not logged in" };

        if (storagePath) {
            const { error: storageError } = await supabase.storage.from("horse-images").remove([storagePath]);
            if (storageError) logger.error("Horse", "Storage cleanup failed", storageError);
        }

        const { error } = await supabase.from("horse_images").delete().eq("id", recordId);
        if (error) throw new Error(error.message);

        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to delete image" };
    }
}

/**
 * Update a horse's details, financial vault, and/or condition grade.
 * Applies field whitelisting to prevent column injection.
 * Guards against mutation during active transactions (rug-pull prevention).
 * Auto-unparks horses with expired transfers so they become editable.
 * @param horseId - UUID of the horse to update
 * @param data - Update payload with whitelisted horse fields, vault data, and condition change
 */
export async function updateHorseAction(horseId: string, data: {
    horseUpdate: Record<string, unknown> | null;
    vaultData: Record<string, unknown> | null;
    hasExistingVault: boolean;
    deleteVault: boolean;
    conditionChange: { newCondition: string; note: string | null } | null;
    /**
     * The horse's asset category, so the form engine can apply that
     * category's rules. Optional: the legacy edit form doesn't know it
     * (asset_category is immutable after create and never rendered), and
     * fetching it would cost a query on every save. Absent means "any" —
     * every value still gets a type, enum and length check; only the
     * per-category required rules are skipped. See `UpdateCategory`.
     */
    assetCategory?: AssetCategory;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not logged in" };

        // Guard: check for active transactions (rug-pull prevention)
        const txnError = await checkActiveTransaction(horseId);
        if (txnError) {
            // If the only change is trade_status, give a specific error
            if (data.horseUpdate && Object.keys(data.horseUpdate).length === 1 && data.horseUpdate.trade_status) {
                return { success: false, error: "This horse is locked in an active transaction. Cancel the transaction before changing its marketplace status." };
            }
            return { success: false, error: txnError };
        }

        // Auto-unpark: if horse has an expired transfer, revert it so it's editable
        try {
            const admin = getAdminClient();
            const { data: expiredTransfer } = await admin
                .from("horse_transfers")
                .select("id")
                .eq("horse_id", horseId)
                .eq("status", "pending")
                .lt("expires_at", new Date().toISOString())
                .maybeSingle();

            if (expiredTransfer) {
                await admin.from("horse_transfers")
                    .update({ status: "expired" })
                    .eq("id", (expiredTransfer as { id: string }).id);
                await admin.from("user_horses")
                    .update({ life_stage: "completed" })
                    .eq("id", horseId)
                    .eq("life_stage", "parked");
            }
        } catch (err) { Sentry.captureException(err, { tags: { domain: "horse" } }); logger.error("Horse", "Auto-unpark expired transfer failed", err); }

        // ── Security: whitelist allowed fields to prevent column injection ──
        const HORSE_ALLOWED = [
            'custom_name', 'sculptor', 'finishing_artist', 'finishing_artist_verified', 'finish_type',
            'condition_grade', 'is_public', 'visibility', 'trade_status', 'listing_price',
            'marketplace_notes', 'collection_id', 'catalog_id', 'life_stage',
            'edition_number', 'edition_size', 'asset_category',
            'finish_details', 'public_notes', 'assigned_breed', 'assigned_gender',
            'assigned_age', 'regional_id', 'attributes',
        ];
        const VAULT_ALLOWED = [
            'purchase_price', 'purchase_date', 'estimated_current_value',
            'insurance_notes', 'horse_id', 'purchase_date_text', 'is_trade',
        ];

        const horseUpdate = data.horseUpdate
            ? Object.fromEntries(Object.entries(data.horseUpdate).filter(([k]) => HORSE_ALLOWED.includes(k)))
            : null;

        if (horseUpdate) {
            // Guard: condition_grade should be null if life_stage is WIP (in_progress)
            if (horseUpdate.life_stage === "in_progress") {
                horseUpdate.condition_grade = null;
            }
            // Decode any HTML entities that leaked in from copy/paste or imports
            if (typeof horseUpdate.custom_name === "string") {
                horseUpdate.custom_name = decodeHtmlEntities(horseUpdate.custom_name);
            }
            if (typeof horseUpdate.public_notes === "string") {
                horseUpdate.public_notes = decodeHtmlEntities(horseUpdate.public_notes);
            }
        }

        const vaultData = data.vaultData
            ? Object.fromEntries(Object.entries(data.vaultData).filter(([k]) => VAULT_ALLOWED.includes(k)))
            : null;

        if (vaultData && vaultData.is_trade) {
            vaultData.purchase_price = null;
            vaultData.estimated_current_value = null;
        }

        // ── Form-engine validation (the boundary this action never had) ──
        // Runs after the allow-list so it judges exactly what will be
        // written, and after the WIP/trade nulling so a deliberate null
        // isn't misread as a cleared required field.
        const updateCategory: UpdateCategory = data.assetCategory ?? "any";
        const check = validateUpdateInput(updateCategory, horseUpdate, vaultData);
        if (!check.ok) {
            const refusal = enforceValidation("Horse", horseId, check.problems);
            if (refusal) return { success: false, error: refusal };
        }

        // Same JSONB hardening as the create path — but ONLY when the
        // caller told us the category. Guessing "model" here would clean a
        // tack horse's bag against an empty key set and wipe it.
        if (
            data.assetCategory &&
            horseUpdate?.attributes &&
            typeof horseUpdate.attributes === "object"
        ) {
            const { cleaned } = cleanAttributeBag(
                data.assetCategory,
                horseUpdate.attributes as Record<string, unknown>,
            );
            horseUpdate.attributes = cleaned;
        }

        if (horseUpdate) {
            // ── Bait & Switch detection: log catalog_id changes ──
            if (horseUpdate.catalog_id !== undefined) {
                try {
                    const { data: existing } = await supabase
                        .from("user_horses")
                        .select("catalog_id")
                        .eq("id", horseId)
                        .eq("owner_id", user.id)
                        .single();

                    const oldCatalogId = (existing as { catalog_id: string | null } | null)?.catalog_id;
                    const newCatalogId = horseUpdate.catalog_id as string | null;

                    if (oldCatalogId !== newCatalogId && (oldCatalogId || newCatalogId)) {
                        let oldName = "Unlinked";
                        let newName = "Unlinked";

                        if (oldCatalogId) {
                            const { data: oldItem } = await supabase
                                .from("catalog_items")
                                .select("title, maker")
                                .eq("id", oldCatalogId)
                                .maybeSingle();
                            if (oldItem) oldName = catalogDisplayName((oldItem as { maker: string }).maker, (oldItem as { title: string }).title);
                        }
                        if (newCatalogId) {
                            const { data: newItem } = await supabase
                                .from("catalog_items")
                                .select("title, maker")
                                .eq("id", newCatalogId)
                                .maybeSingle();
                            if (newItem) newName = catalogDisplayName((newItem as { maker: string }).maker, (newItem as { title: string }).title);
                        }

                        // kind='audit' keeps this provenance note off the
                        // feed once 166 lands; pre-166 the feed matches
                        // its prefix instead (lib/feed/stream.ts).
                        const { getPostColumnSupport } = await import("@/lib/feed/columnSupport");
                        const support = await getPostColumnSupport(supabase as never);
                        await supabase.from("posts").insert({
                            author_id: user.id,
                            horse_id: horseId,
                            content: `📋 Reference identity updated from "${oldName}" to "${newName}".`,
                            ...(support.kind ? { kind: "audit" } : {}),
                        });
                    }
                } catch (err) { Sentry.captureException(err, { tags: { domain: "horse" } }); logger.error("Horse", "Catalog identity audit log failed", err); }
            }

            const { error: updErr } = await supabase.from("user_horses").update(horseUpdate).eq("id", horseId).eq("owner_id", user.id);
            if (updErr) throw new Error(updErr.message);
        }

        if (data.deleteVault) {
            await supabase.from("financial_vault").delete().eq("horse_id", horseId);
        } else if (vaultData) {
            vaultData.horse_id = horseId;
            if (data.hasExistingVault) {
                await supabase.from("financial_vault").update(vaultData).eq("horse_id", horseId);
            } else {
                await supabase.from("financial_vault").insert(vaultData as unknown as FinancialVaultInsert);
            }
        }

        // ── Condition History Ledger ──
        // condition_history INSERT is handled by Postgres trigger (trg_user_horses_condition).
        // v_horse_hoofprint view derives timeline events from condition_history automatically.
        // No manual timeline insert needed.

        revalidatePath(`/stable/${horseId}`);
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to update horse" };
    }
}

// ============================================================
// V2 DIRECT-UPLOAD API: 2-Step Save Pattern
// Step 1: createHorseRecord() — DB only, no images
// Step 2: finalizeHorseImages() — metadata after client upload
// ============================================================

/**
 * Step 1 of 2-step save: Create the horse DB record WITHOUT images.
 * Returns the horseId so the client can upload images directly to Storage.
 */
export async function createHorseRecord(data: {
    customName: string;
    finishType: string;
    conditionGrade?: string;
    isPublic: boolean;
    /** Authoritative three-state visibility. When present it wins over
     * isPublic — the old mapping silently turned "unlisted" into fully
     * public (audit collection M1). */
    visibility?: "public" | "unlisted" | "private";
    tradeStatus?: string;
    lifeStage?: string;
    catalogId?: string;
    selectedCollectionId?: string;
    sculptor?: string;
    finishingArtist?: string;
    editionNumber?: number;
    editionSize?: number;
    listingPrice?: number;
    marketplaceNotes?: string;
    purchasePrice?: number;
    purchaseDate?: string;
    estimatedValue?: number;
    insuranceNotes?: string;
    assetCategory?: string;
    finishDetails?: string;
    publicNotes?: string;
    assignedBreed?: string;
    assignedGender?: string;
    assignedAge?: string;
    regionalId?: string;
    purchaseDateText?: string;
    isTrade?: boolean;
    attributes?: Record<string, unknown>;
}): Promise<{ success: boolean; horseId?: string; error?: string }> {
    const { supabase, user } = await requireAuth();

    if (!data.customName?.trim()) {
        return { success: false, error: "Missing required fields." };
    }

    // Non-model categories don't require finishType
    const category = data.assetCategory || 'model';
    if (category === 'model' && !data.finishType) {
        return { success: false, error: "Finish type is required for model horses." };
    }

    // ── Form-engine validation (the boundary this action never had) ──
    const check = validateCreateInput({ ...data, assetCategory: category });
    if (!check.ok) {
        const refusal = enforceValidation("Horse", null, check.problems);
        if (refusal) return { success: false, error: refusal };
    }

    const isModel = category === 'model';
    const horseInsert: UserHorseInsert = {
        owner_id: user.id,
        custom_name: sanitizeText(decodeHtmlEntities(data.customName)),
        asset_category: category,
        finish_type: (data.finishType || null) as UserHorseInsert["finish_type"],
        condition_grade: isModel && data.lifeStage !== "in_progress" ? data.conditionGrade || null : null,
        // visibility is authoritative; the 109 trigger derives is_public
        // (true only for 'public' — unlisted is link-only by design).
        visibility: data.visibility ?? (data.isPublic ? "public" : "private"),
        is_public: (data.visibility ?? (data.isPublic ? "public" : "private")) === "public",
        trade_status: (data.tradeStatus || null) as UserHorseInsert["trade_status"],
        life_stage: data.lifeStage || "completed",
    };

    // Set unified catalog_id
    if (data.catalogId) {
        horseInsert.catalog_id = data.catalogId;
    }
    if (data.selectedCollectionId) horseInsert.collection_id = data.selectedCollectionId;
    if (data.sculptor) horseInsert.sculptor = data.sculptor;
    if (data.finishingArtist) horseInsert.finishing_artist = data.finishingArtist;
    if (data.editionNumber) horseInsert.edition_number = data.editionNumber;
    if (data.editionSize) horseInsert.edition_size = data.editionSize;
    if (data.finishDetails) horseInsert.finish_details = data.finishDetails.trim();
    if (data.publicNotes) horseInsert.public_notes = decodeHtmlEntities(data.publicNotes.trim());
    if (data.assignedBreed) horseInsert.assigned_breed = data.assignedBreed.trim();
    if (data.assignedGender) horseInsert.assigned_gender = data.assignedGender.trim();
    if (data.assignedAge) horseInsert.assigned_age = data.assignedAge.trim();
    if (data.regionalId) horseInsert.regional_id = data.regionalId.trim();
    // The attributes bag is on the column allow-list, so an unfiltered call
    // could write arbitrary JSONB. Clean it against the category's own key
    // set — what assetFields' docstring always claimed happened here.
    if (data.attributes && Object.keys(data.attributes).length > 0) {
        const { cleaned } = cleanAttributeBag(category as AssetCategory, data.attributes);
        if (Object.keys(cleaned).length > 0) {
            (horseInsert as Record<string, unknown>).attributes = cleaned;
        }
    }

    if (data.tradeStatus && data.tradeStatus !== "Not for Sale") {
        if (data.listingPrice) horseInsert.listing_price = data.listingPrice;
        if (data.marketplaceNotes) horseInsert.marketplace_notes = data.marketplaceNotes;
    }

    const { data: horse, error } = await supabase
        .from("user_horses")
        .insert(horseInsert)
        .select("id")
        .single<{ id: string }>();

    if (error || !horse) return { success: false, error: error?.message || "Failed to save horse." };

    // Insert financial vault if any data provided
    const hasVault = data.purchasePrice || data.purchaseDate || data.estimatedValue || data.insuranceNotes || data.purchaseDateText || data.isTrade;
    if (hasVault) {
        const vaultInsert: FinancialVaultInsert = { horse_id: horse.id };
        vaultInsert.is_trade = !!data.isTrade;
        if (data.isTrade) {
            vaultInsert.purchase_price = null;
            vaultInsert.estimated_current_value = null;
        } else {
            if (data.purchasePrice) vaultInsert.purchase_price = data.purchasePrice;
            if (data.estimatedValue) vaultInsert.estimated_current_value = data.estimatedValue;
        }
        if (data.purchaseDate) vaultInsert.purchase_date = data.purchaseDate;
        if (data.insuranceNotes) vaultInsert.insurance_notes = data.insuranceNotes;
        if (data.purchaseDateText) vaultInsert.purchase_date_text = data.purchaseDateText.trim();
        await supabase.from("financial_vault").insert(vaultInsert);
    }

    revalidatePath("/dashboard");
    revalidateTag("public_horses", "max");

    // Deferred: evaluate achievements
    const finalUserId = user.id;
    after(async () => {
        try {
            const { evaluateUserAchievements } = await import("@/lib/utils/achievements");
            await evaluateUserAchievements(finalUserId, "horse_added");
        } catch (err) { Sentry.captureException(err, { tags: { domain: "horse" } }); logger.error("Horse", "Achievement evaluation failed after horse add", err); }
    });

    return { success: true, horseId: horse.id };
}

/**
 * Step 2 of 2-step save: Record image metadata after client-side upload.
 * Called AFTER the browser has uploaded files directly to Supabase Storage.
 */
export async function finalizeHorseImages(
    horseId: string,
    images: { path: string; angle: string }[]
): Promise<{ success: boolean; error?: string; skippedExtraDetail?: number; skippedReason?: string }> {
    const { supabase, user } = await requireAuth();

    // Verify ownership
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id")
        .eq("id", horseId)
        .eq("owner_id", user.id)
        .single();
    if (!horse) return { success: false, error: "Horse not found or not yours." };

    if (images.length === 0) return { success: true };

    // Enforce tier-based photo limits.
    // Free: 5 standard LSQ angles + up to 5 flaw photos (condition
    //       documentation is trust infrastructure — never Pro-gated;
    //       owner decision 2026-07-15)
    // Pro:  the same + up to 30 extra_detail photos
    //
    // NEVER reject the whole batch: standard gallery-slot photos must
    // save even when a subset is over a limit — an all-or-nothing
    // rejection here once silently ate every photo a free user
    // attached (the caller showed success regardless).
    let skippedCount = 0;
    const skipReasons: string[] = [];

    // Flaw photos: capped at 5 per horse for every tier — the cap is
    // the only rule; flaws are never Pro-gated.
    const flawImages = images.filter((img) => img.angle === "Flaw_Rub_Damage");
    if (flawImages.length > 0) {
        const { count: flawCount } = await supabase
            .from("horse_images")
            .select("id", { count: "exact", head: true })
            .eq("horse_id", horseId)
            .eq("angle_profile", "Flaw_Rub_Damage");
        const room = Math.max(0, 5 - (flawCount ?? 0));
        if (flawImages.length > room) {
            const keep = new Set(flawImages.slice(0, room));
            const overflow = flawImages.length - room;
            images = images.filter((img) => img.angle !== "Flaw_Rub_Damage" || keep.has(img));
            skippedCount += overflow;
            skipReasons.push(
                `Flaw photo limit reached (5 per horse) — ${overflow} flaw photo${overflow === 1 ? " was" : "s were"} not attached.`,
            );
        }
    }

    const extraDetailImages = images.filter(img => img.angle === "extra_detail");
    if (extraDetailImages.length > 0) {
        const { getUserTier } = await import("@/lib/auth");
        const tier = await getUserTier();

        let dropExtras = false;
        if (tier === "free") {
            dropExtras = true;
            skipReasons.push(
                "Extra detail photos are an MHH Pro feature — your other photos were saved, but the extra shots were not. Upgrade to add close-ups and detail shots (up to 30 per horse).",
            );
        } else {
            // Pro users: enforce 30 extra_detail limit
            const { count } = await supabase
                .from("horse_images")
                .select("id", { count: "exact", head: true })
                .eq("horse_id", horseId)
                .eq("angle_profile", "extra_detail");

            const currentCount = count ?? 0;
            if (currentCount + extraDetailImages.length > 30) {
                dropExtras = true;
                skipReasons.push(
                    `Extra detail photo limit reached (${currentCount}/30) — your other photos were saved, but the extra shots were not.`,
                );
            }
        }
        if (dropExtras) {
            skippedCount += extraDetailImages.length;
            images = images.filter((img) => img.angle !== "extra_detail");
        }
    }

    const skippedExtraDetail = skippedCount;
    const skippedReason = skipReasons.length > 0 ? skipReasons.join(" ") : undefined;
    if (images.length === 0) {
        return { success: true, skippedExtraDetail, skippedReason };
    }

    // Build public URLs and insert image records
    const inserts = images.map((img) => {
        const { data: { publicUrl } } = supabase.storage.from("horse-images").getPublicUrl(img.path);
        return {
            horse_id: horseId,
            image_url: publicUrl,
            angle_profile: img.angle,
        };
    });

    const { error } = await supabase.from("horse_images").insert(inserts);
    if (error) return { success: false, error: error.message, skippedExtraDetail, skippedReason };

    revalidatePath("/dashboard");
    revalidatePath(`/stable/${horseId}`);

    // Deferred: evaluate photo achievements
    const finalUserId = user.id;
    after(async () => {
        try {
            const { evaluateUserAchievements } = await import("@/lib/utils/achievements");
            await evaluateUserAchievements(finalUserId, "photo_uploaded");
        } catch (err) { Sentry.captureException(err, { tags: { domain: "horse" } }); logger.error("Horse", "Achievement evaluation failed after photo upload", err); }
    });

    return skippedExtraDetail > 0
        ? { success: true, skippedExtraDetail, skippedReason }
        : { success: true };
}

/**
 * The caller's subscription tier — lets client forms gate Pro-only
 * inputs (e.g. the extra-detail photo dropzone) honestly instead of
 * accepting uploads that the finalize step would skip.
 */
export async function getMyTier(): Promise<string> {
    await requireAuth();
    const { getUserTier } = await import("@/lib/auth");
    return getUserTier();
}

// ============================================================
// BULK OPERATIONS
// ============================================================

/**
 * Bulk update collection, trade status, or visibility for up to 500 horses.
 * (500 matches the Stable v2 "Select all matching" cap.)
 * Verifies ownership of every horse in the batch before applying changes.
 * @param horseIds - Array of horse UUIDs to update (max 500)
 * @param updates - Fields to set across all selected horses
 */
export async function bulkUpdateHorses(
    horseIds: string[],
    updates: {
        collectionId?: string | null;
        tradeStatus?: string;
        visibility?: "public" | "unlisted" | "private";
    }
): Promise<{ success: boolean; count?: number; error?: string }> {
    const { supabase, user } = await requireAuth();
    if (horseIds.length === 0) return { success: false, error: "No horses selected." };
    if (horseIds.length > 500) return { success: false, error: "Too many items (max 500)." };

    // Verify ownership of ALL horses
    const { data: owned } = await supabase
        .from("user_horses")
        .select("id")
        .eq("owner_id", user.id)
        .in("id", horseIds);

    const ownedIds = (owned ?? []).map((h: { id: string }) => h.id);
    if (ownedIds.length !== horseIds.length) {
        return { success: false, error: "Some horses not found or not yours." };
    }

    const updateObj: Record<string, unknown> = {};
    if (updates.collectionId !== undefined) updateObj.collection_id = updates.collectionId;
    if (updates.tradeStatus) updateObj.trade_status = updates.tradeStatus;
    if (updates.visibility) updateObj.visibility = updates.visibility;

    if (Object.keys(updateObj).length === 0) {
        return { success: false, error: "No updates specified." };
    }

    const { error } = await supabase
        .from("user_horses")
        .update(updateObj)
        .in("id", horseIds)
        .eq("owner_id", user.id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    return { success: true, count: horseIds.length };
}

/**
 * Bulk delete up to 100 horses and their Storage files.
 * Guards against deletion of horses with active transactions.
 * Verifies ownership of every horse in the batch.
 * @param horseIds - Array of horse UUIDs to delete (max 100)
 */
export async function bulkDeleteHorses(
    horseIds: string[]
): Promise<{ success: boolean; count?: number; error?: string }> {
    const { supabase, user } = await requireAuth();
    if (horseIds.length === 0) return { success: false, error: "No horses selected." };
    if (horseIds.length > 100) return { success: false, error: "Too many items (max 100)." };

    // Verify ownership
    const { data: owned } = await supabase
        .from("user_horses")
        .select("id")
        .eq("owner_id", user.id)
        .in("id", horseIds);

    const ownedIds = (owned ?? []).map((h: { id: string }) => h.id);
    if (ownedIds.length !== horseIds.length) {
        return { success: false, error: "Some horses not found or not yours." };
    }

    // Guard: check for active transactions on any horse in the batch
    const admin = getAdminClient();
    const { data: activeTxns } = await admin
        .from("transactions")
        .select("horse_id")
        .in("horse_id", horseIds)
        .in("status", ACTIVE_TRANSACTION_STATUSES)
        .limit(1);

    if (activeTxns && activeTxns.length > 0) {
        return { success: false, error: "One or more horses have active transactions. Cancel them before deleting." };
    }

    // Clean up storage for all images
    const { data: images } = await supabase
        .from("horse_images")
        .select("image_url")
        .in("horse_id", horseIds);

    if (images && images.length > 0) {
        const paths = images
            .map((img: { image_url: string }) => {
                const match = img.image_url.match(/horse-images\/(.+?)(\?|$)/);
                return match ? match[1] : null;
            })
            .filter(Boolean) as string[];
        if (paths.length > 0) {
            await supabase.storage.from("horse-images").remove(paths);
        }
    }

    // Soft-delete: scrub PII but preserve rows for provenance chains
    const { error } = await supabase
        .from("user_horses")
        .update({
            deleted_at: new Date().toISOString(),
            life_stage: "orphaned",
            visibility: "private",
            custom_name: "[Deleted]",
            trade_status: "Not for Sale",
        })
        .in("id", horseIds)
        .eq("owner_id", user.id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    return { success: true, count: horseIds.length };
}

// ============================================================
// QUICK ADD (Frictionless Intake)
// ============================================================

const quickAddHorseSchema = z.object({
    catalogId: z.uuid().optional(),
    customName: z.string().trim().max(100).optional(),
    finishType: z.enum(["OF", "Custom", "Artist Resin"]),
    conditionGrade: z.string().trim().min(1).max(50),
    collectionId: z.uuid().optional(),
    /** Public by default (Batch 3): Quick Add horses used to be
     *  hardcoded private, which silently made them un-enterable in
     *  shows (eligibility needs is_public). */
    isPublic: z.boolean().optional().default(true),
});

/**
 * Quick-add a horse with minimal fields (used by /add-horse/quick).
 * Auto-names the horse from the catalog reference if no custom name provided.
 * Defaults to PUBLIC (show-eligible), not-for-sale, and model category.
 * @param data - Quick-add fields: catalogId, customName, finishType, conditionGrade, collectionId, isPublic
 */
export async function quickAddHorse(data: {
    catalogId?: string;
    customName?: string;
    finishType: string;
    conditionGrade: string;
    collectionId?: string;
    isPublic?: boolean;
}): Promise<{ success: boolean; horseId?: string; horseName?: string; error?: string }> {
    const parsed = quickAddHorseSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }
    const input = parsed.data;

    const { supabase, user } = await requireAuth();

    // If catalogId provided, auto-name from catalog
    let horseName = decodeHtmlEntities(input.customName?.trim() || "");
    if (input.catalogId && !horseName) {
        const { data: catalog } = await supabase
            .from("catalog_items")
            .select("title, maker")
            .eq("id", input.catalogId)
            .single<{ title: string; maker: string }>();
        if (catalog) {
            horseName = catalogDisplayName(catalog.maker, catalog.title);
        }
    }
    if (!horseName) horseName = "Unnamed Horse";

    const horseInsert: UserHorseInsert = {
        owner_id: user.id,
        custom_name: horseName,
        finish_type: input.finishType as UserHorseInsert["finish_type"],
        condition_grade: input.conditionGrade,
        is_public: input.isPublic,
        visibility: input.isPublic ? "public" : "private",
        trade_status: "Not for Sale",
        asset_category: "model",
    };
    if (input.catalogId) horseInsert.catalog_id = input.catalogId;
    if (input.collectionId) horseInsert.collection_id = input.collectionId;

    const { data: horse, error } = await supabase
        .from("user_horses")
        .insert(horseInsert)
        .select("id")
        .single<{ id: string }>();

    if (error || !horse) return { success: false, error: error?.message || "Failed to add." };

    revalidatePath("/dashboard");
    if (input.isPublic) revalidateTag("public_horses", "max");
    return { success: true, horseId: horse.id, horseName };
}

// ============================================================
// PHOTO REORDERING
// ============================================================

/**
 * Reorder images for a horse by setting sort_order on each image.
 * @param horseId - UUID of the horse (must be owned by caller)
 * @param imageIds - Image UUIDs in desired display order
 */
export async function reorderHorseImages(
    horseId: string,
    imageIds: string[]
): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();
    if (imageIds.length === 0) return { success: false, error: "No images." };

    // Verify ownership
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id")
        .eq("id", horseId)
        .eq("owner_id", user.id)
        .single();
    if (!horse) return { success: false, error: "Horse not found or not yours." };

    // Update sort_order for each image
    const updates = imageIds.map((id, index) =>
        supabase.from("horse_images")
            .update({ sort_order: index })
            .eq("id", id)
            .eq("horse_id", horseId)
    );

    const results = await Promise.all(updates);
    const failed = results.find(r => r.error);
    if (failed?.error) return { success: false, error: failed.error.message };

    revalidatePath(`/stable/${horseId}/edit`);
    revalidatePath(`/stable/${horseId}`);
    return { success: true };
}

/**
 * Search public horses by name — used for relational pedigree lookups.
 */
export async function searchPublicHorses(query: string): Promise<{ id: string; custom_name: string; finish_type: string }[]> {
    if (!query || query.length < 2) return [];
    const supabase = await createClient();
    const { data } = await supabase
        .from("user_horses")
        .select("id, custom_name, finish_type")
        .eq("is_public", true)
        .is("deleted_at", null)
        .ilike("custom_name", `%${query}%`)
        .limit(10);
    return (data ?? []) as { id: string; custom_name: string; finish_type: string }[];
}
