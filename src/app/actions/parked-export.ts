"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { getPublicImageUrl } from "@/lib/utils/storage";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { randomInt } from "crypto";

// ============================================================
// PARKED EXPORT — Server Actions
// ============================================================

/** Generate a unique 6-char PIN (no ambiguous chars: 0/O, 1/I/L) */
function generatePin(): string {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let pin = "";
    for (let i = 0; i < 6; i++) {
        pin += chars[randomInt(chars.length)];
    }
    return pin;
}

/** Park a horse for off-platform sale and generate a claim PIN */
export async function parkHorse(horseId: string): Promise<{
    success: boolean;
    pin?: string;
    transferId?: string;
    error?: string;
}> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated." };

        // Verify ownership
        const { data: horse } = await supabase
            .from("user_horses")
            .select("id, owner_id, custom_name, life_stage, trade_status")
            .eq("id", horseId)
            .single();

        if (!horse || (horse as { owner_id: string }).owner_id !== user.id) {
            return { success: false, error: "You don't own this horse." };
        }
        if ((horse as { trade_status: string }).trade_status === "Stolen/Missing") {
            return { success: false, error: "Cannot park a horse flagged as Stolen/Missing." };
        }

        const h = horse as { id: string; custom_name: string; life_stage: string };

        // Cancel any existing pending transfers for this horse
        await supabase
            .from("horse_transfers")
            .update({ status: "cancelled" })
            .eq("horse_id", horseId)
            .eq("sender_id", user.id)
            .eq("status", "pending");

        // Generate unique PIN (retry up to 5 times for uniqueness)
        let pin = "";
        for (let attempt = 0; attempt < 5; attempt++) {
            pin = generatePin();
            const { data: existing } = await supabase
                .from("horse_transfers")
                .select("id")
                .eq("claim_pin", pin)
                .maybeSingle();
            if (!existing) break;
        }

        // Set horse to parked
        await supabase
            .from("user_horses")
            .update({ life_stage: "parked" })
            .eq("id", horseId);

        // Create transfer with long expiry (30 days for off-platform sales)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        const { data: transfer, error: transferError } = await supabase
            .from("horse_transfers")
            .insert({
                horse_id: horseId,
                sender_id: user.id,
                transfer_code: `PARK-${pin}`,
                claim_pin: pin,
                acquisition_type: "purchase",
                notes: "Parked for off-platform sale",
                expires_at: expiresAt.toISOString(),
            })
            .select("id")
            .single<{ id: string }>();

        if (transferError) return { success: false, error: transferError.message };

        // ⚡ REMOVED: horse_timeline INSERT — now derived from v_horse_hoofprint view

        revalidatePath(`/stable/${horseId}`);
        revalidatePath("/dashboard");
        return { success: true, pin, transferId: transfer.id };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to park horse" };
    }
}

/** Unpark a horse — cancel the pending transfer, restore life_stage */
export async function unparkHorse(horseId: string): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated." };

        // Verify ownership
        const { data: horse } = await supabase
            .from("user_horses")
            .select("id, owner_id")
            .eq("id", horseId)
            .single();

        if (!horse || (horse as { owner_id: string }).owner_id !== user.id) {
            return { success: false, error: "You don't own this horse." };
        }

        // Guard: check for active commerce transactions (rug-pull prevention)
        const admin = getAdminClient();
        const { data: activeTxn } = await admin
            .from("transactions")
            .select("id")
            .eq("horse_id", horseId)
            .in("status", ["offer_made", "pending_payment", "funds_verified"])
            .limit(1)
            .maybeSingle();

        if (activeTxn) {
            return { success: false, error: "Cannot unpark a horse while an active transaction is pending. Please cancel the transaction first." };
        }

        // Cancel pending transfers with claim_pin
        await supabase
            .from("horse_transfers")
            .update({ status: "cancelled" })
            .eq("horse_id", horseId)
            .eq("sender_id", user.id)
            .eq("status", "pending")
            .not("claim_pin", "is", null);

        // Restore life_stage
        await supabase
            .from("user_horses")
            .update({ life_stage: "completed" })
            .eq("id", horseId);

        revalidatePath(`/stable/${horseId}`);
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to unpark horse" };
    }
}

/** Public lookup — find a parked horse by PIN (no auth required for preview) */
export async function getParkedHorseByPin(pin: string): Promise<{
    success: boolean;
    horse?: {
        name: string;
        photo: string | null;
        finish: string;
        condition: string;
        timelineCount: number;
        ownerCount: number;
        transferId: string;
    };
    error?: string;
}> {
    try {
        const admin = getAdminClient();

        // 1. Look up transfer by claim_pin
        const { data: transfer, error: tErr } = await admin
            .from("horse_transfers")
            .select("id, horse_id, sender_id, expires_at")
            .eq("claim_pin", pin.toUpperCase().trim())
            .eq("status", "pending")
            .maybeSingle();

        if (tErr || !transfer) {
            return { success: false, error: "Invalid or expired PIN." };
        }

        const t = transfer as { id: string; horse_id: string; sender_id: string; expires_at: string };

        // 2. Check expiration
        if (new Date(t.expires_at) < new Date()) {
            // Expire the transfer AND revert the horse
            await admin.from("horse_transfers").update({ status: "expired" }).eq("id", t.id);
            await admin.from("user_horses").update({ life_stage: "completed" }).eq("id", t.horse_id);

            // System note about expired transfer
            try {
                await admin.from("posts").insert({
                    author_id: t.sender_id,
                    horse_id: t.horse_id,
                    content: "⏰ Parked transfer expired. Horse has been automatically unparked and returned to your stable.",
                });
            } catch { /* best effort */ }

            return { success: false, error: "This claim PIN has expired." };
        }

        // 3. Get horse details — NO PostgREST join (separate query for images)
        const { data: horse, error: hErr } = await admin
            .from("user_horses")
            .select("id, custom_name, finish_type, condition_grade")
            .eq("id", t.horse_id)
            .maybeSingle();

        if (hErr || !horse) return { success: false, error: "Horse not found." };

        const h = horse as { id: string; custom_name: string; finish_type: string; condition_grade: string };

        // 4. Get photo separately (non-blocking)
        let photo: string | null = null;
        try {
            const { data: images } = await admin
                .from("horse_images")
                .select("image_url, angle_profile")
                .eq("horse_id", t.horse_id)
                .limit(5);

            const imgList = (images ?? []) as { image_url: string; angle_profile: string }[];
            const thumb = imgList.find((img) => img.angle_profile === "Primary_Thumbnail");
            const imageUrl = thumb?.image_url || imgList[0]?.image_url;
            if (imageUrl) {
                photo = getPublicImageUrl(imageUrl);
            }
        } catch { /* photo is optional for preview */ }

        // 5. Get counts (non-blocking)
        let timelineCount = 0;
        let ownerCount = 1;
        try {
            const { count: tc } = await admin
                .from("v_horse_hoofprint")
                .select("source_id", { count: "exact", head: true })
                .eq("horse_id", t.horse_id)
                .eq("is_public", true);
            timelineCount = tc || 0;

            const { count: oc } = await admin
                .from("horse_ownership_history")
                .select("id", { count: "exact", head: true })
                .eq("horse_id", t.horse_id);
            ownerCount = (oc || 0) + 1;
        } catch { /* counts are optional */ }

        return {
            success: true,
            horse: {
                name: h.custom_name,
                photo,
                finish: h.finish_type,
                condition: h.condition_grade,
                timelineCount,
                ownerCount,
                transferId: t.id,
            },
        };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to look up PIN" };
    }
}

/** Claim a parked horse — transfer ownership to the authenticated user */
export async function claimParkedHorse(pin: string): Promise<{
    success: boolean;
    horseName?: string;
    horseId?: string;
    error?: string;
}> {
    try {
        // Rate limit: 5 attempts per 15 minutes per IP
        const allowed = await checkRateLimit("claim_pin", 5, 15);
        if (!allowed) {
            return { success: false, error: "Too many attempts. Please wait 15 minutes before trying again." };
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated. Please log in or create an account first." };

        // Single atomic RPC — locks, validates, swaps ownership, clears vault
        const admin = getAdminClient();
        const { data, error } = await admin.rpc("claim_parked_horse_atomic", {
            p_pin: pin,
            p_claimant_id: user.id,
        });

        if (error) return { success: false, error: error.message };

        const result = data as {
            success: boolean;
            error?: string;
            horse_id?: string;
            horse_name?: string;
            sender_id?: string;
            sender_alias?: string;
            receiver_alias?: string;
            sale_price?: number;
        };

        if (!result.success) {
            return { success: false, error: result.error || "Claim failed." };
        }

        // Create a completed transaction for this parked sale (enables reviews)
        try {
            const { createTransaction } = await import("@/app/actions/transactions");
            await createTransaction({
                type: "parked_sale",
                partyAId: result.sender_id!,
                partyBId: user.id,
                horseId: result.horse_id,
                status: "completed",
                metadata: {
                    pin,
                    sale_price: result.sale_price || null,
                },
            });
        } catch { /* Non-blocking */ }

        // Close state machine: if this claim came from a commerce offer flow,
        // complete the funds_verified transaction
        try {
            if (result.horse_id) {
                const admin2 = getAdminClient();
                const { data: offerTxn } = await admin2
                    .from("transactions")
                    .select("id")
                    .eq("horse_id", result.horse_id)
                    .eq("status", "funds_verified")
                    .maybeSingle();

                if (offerTxn) {
                    await admin2
                        .from("transactions")
                        .update({ status: "completed", completed_at: new Date().toISOString() })
                        .eq("id", (offerTxn as { id: string }).id);
                }
            }
        } catch { /* Non-blocking: state machine closure is best-effort */ }

        // Notification (non-critical)
        try {
            if (result.sender_id) {
                await admin.from("notifications").insert({
                    user_id: result.sender_id,
                    type: "transfer_claimed",
                    actor_id: user.id,
                    content: `@${result.receiver_alias} claimed ${result.horse_name} via PIN!`,
                    horse_id: result.horse_id,
                });
            }
        } catch { /* Non-blocking */ }

        revalidatePath("/dashboard");
        revalidatePath(`/stable/${result.horse_id}`);

        return {
            success: true,
            horseName: result.horse_name,
            horseId: result.horse_id,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "An unexpected error occurred.",
        };
    }
}

/** Get CoA data for a parked horse (owner only) */
export async function getCoaData(horseId: string): Promise<{
    success: boolean;
    data?: {
        horseName: string;
        reference: string;
        finish: string;
        condition: string;
        pin: string;
        timelineCount: number;
        ownerCount: number;
        ownerAlias: string;
        generatedAt: string;
        photoUrl: string | null;
    };
    error?: string;
}> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated." };

        // Verify ownership and get horse data
        const { data: horse } = await supabase
            .from("user_horses")
            .select(`
                id, owner_id, custom_name, finish_type, condition_grade,
                catalog_items:catalog_id(title, maker, item_type),
                horse_images(image_url, angle_profile)
            `)
            .eq("id", horseId)
            .single();

        if (!horse) return { success: false, error: "Horse not found." };

        const h = horse;

        if (h.owner_id !== user.id) return { success: false, error: "You don't own this horse." };

        // Get active PIN
        const { data: transfer } = await supabase
            .from("horse_transfers")
            .select("claim_pin")
            .eq("horse_id", horseId)
            .eq("sender_id", user.id)
            .eq("status", "pending")
            .not("claim_pin", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (!transfer || !(transfer as { claim_pin: string }).claim_pin) {
            return { success: false, error: "No active claim PIN found. Park the horse first." };
        }

        const pin = (transfer as { claim_pin: string }).claim_pin;

        // Build reference string
        let reference = "Unlisted";
        if (h.catalog_items) {
            reference = `${h.catalog_items.maker} ${h.catalog_items.title}`;
        }

        // Counts
        const { count: timelineCount } = await supabase
            .from("v_horse_hoofprint")
            .select("source_id", { count: "exact", head: true })
            .eq("horse_id", horseId)
            .eq("is_public", true);

        const { count: ownerCount } = await supabase
            .from("horse_ownership_history")
            .select("id", { count: "exact", head: true })
            .eq("horse_id", horseId);

        // Owner alias
        const { data: profile } = await supabase
            .from("users")
            .select("alias_name")
            .eq("id", user.id)
            .single<{ alias_name: string }>();

        // Photo as signed URL (NO base64 — defuses payload bomb)
        let photoUrl: string | null = null;
        const thumb = h.horse_images?.find((img) => img.angle_profile === "Primary_Thumbnail");
        const imageUrl = thumb?.image_url || h.horse_images?.[0]?.image_url;
        if (imageUrl) {
            const signedUrl = getPublicImageUrl(imageUrl);
            photoUrl = signedUrl || null;
        }

        return {
            success: true,
            data: {
                horseName: h.custom_name,
                reference,
                finish: h.finish_type ?? "OF",
                condition: h.condition_grade ?? "Not Graded",
                pin,
                timelineCount: timelineCount || 0,
                ownerCount: (ownerCount || 0) + 1,
                ownerAlias: profile?.alias_name || "Collector",
                generatedAt: new Date().toLocaleDateString("en-US", {
                    year: "numeric", month: "long", day: "numeric",
                }),
                photoUrl,
            },
        };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to get CoA data" };
    }
}
