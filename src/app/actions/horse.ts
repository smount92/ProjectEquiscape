"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function deleteHorse(horseId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Verify ownership
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id, owner_id")
        .eq("id", horseId)
        .eq("owner_id", user.id)
        .single();

    if (!horse) return { success: false, error: "Horse not found or not yours." };

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
    }

    // Delete the horse (cascades to horse_images, financial_vault, etc.)
    const { error } = await supabase
        .from("user_horses")
        .delete()
        .eq("id", horseId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    return { success: true };
}

export async function addHorseAction(formData: FormData): Promise<{ success: boolean; error?: string; horseId?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "You must be logged in." };

        // Parse main fields
        const customName = formData.get("customName") as string;
        const finishType = formData.get("finishType") as string;
        const conditionGrade = formData.get("conditionGrade") as string;
        const isPublic = formData.get("isPublic") === "true";
        const tradeStatus = formData.get("tradeStatus") as string;
        const lifeStage = formData.get("lifeStage") as string;

        const selectedMoldId = formData.get("selectedMoldId") as string || null;
        const selectedResinId = formData.get("selectedResinId") as string || null;
        const selectedReleaseId = formData.get("selectedReleaseId") as string || null;
        const selectedCollectionId = formData.get("selectedCollectionId") as string || null;
        const sculptor = formData.get("sculptor") as string || null;
        const finishingArtist = formData.get("finishingArtist") as string || null;
        const editionNumber = formData.get("editionNumber") as string || null;
        const editionSize = formData.get("editionSize") as string || null;

        const listingPrice = formData.get("listingPrice") as string || null;
        const marketplaceNotes = formData.get("marketplaceNotes") as string || null;

        // Financial Vault
        const purchasePrice = formData.get("purchasePrice") as string || null;
        const purchaseDate = formData.get("purchaseDate") as string || null;
        const estimatedValue = formData.get("estimatedValue") as string || null;
        const insuranceNotes = formData.get("insuranceNotes") as string || null;

        if (!customName || !finishType) {
            return { success: false, error: "Missing required fields." };
        }

        const horseInsert: Record<string, unknown> = {
            owner_id: user.id,
            custom_name: customName,
            finish_type: finishType,
            condition_grade: conditionGrade || null,
            is_public: isPublic,
            trade_status: tradeStatus || null,
            life_stage: lifeStage || 'Living',
        };

        if (selectedMoldId) horseInsert.reference_mold_id = selectedMoldId;
        if (selectedResinId) horseInsert.artist_resin_id = selectedResinId;
        if (selectedReleaseId) horseInsert.release_id = selectedReleaseId;
        if (selectedCollectionId) horseInsert.collection_id = selectedCollectionId;
        if (sculptor) horseInsert.sculptor = sculptor;
        if (finishingArtist) horseInsert.finishing_artist = finishingArtist;
        if (editionNumber) horseInsert.edition_number = parseInt(editionNumber);
        if (editionSize) horseInsert.edition_size = parseInt(editionSize);

        // Marketplace fields
        if (tradeStatus && tradeStatus !== "Not for Sale") {
            if (listingPrice) horseInsert.listing_price = parseFloat(listingPrice);
            if (marketplaceNotes) horseInsert.marketplace_notes = marketplaceNotes;
        }

        const { data: horse, error: horseError } = await supabase
            .from("user_horses")
            .insert(horseInsert)
            .select("id")
            .single<{ id: string }>();

        if (horseError || !horse) {
            return { success: false, error: horseError?.message || "Failed to save horse." };
        }

        const horseId = horse.id;

        // Handle File Uploads
        // imageSlots arrive as `imageSlot_{angle}`
        // extraFiles arrive as `extraFile_{index}`

        // We upload files on Server Side using File objects extracted from FormData
        const entries = Array.from(formData.entries());
        let extraIndex = 0; // if the client didn't index them safely, we do
        for (const [key, value] of entries) {
            if (value instanceof File && value.size > 0 && value.name) {
                let angle = "extra_detail";

                if (key.startsWith("imageSlot_")) {
                    angle = key.replace("imageSlot_", "");
                } else if (key.startsWith("extraFile_")) {
                    angle = "extra_detail";
                } else {
                    continue; // not an image file key we process
                }

                let safeFileName = `${angle}_${Date.now()}`;
                if (angle === "extra_detail") {
                    safeFileName = `extra_detail_${Date.now()}_${extraIndex++}`;
                }

                const filePath = `horses/${horseId}/${safeFileName}.webp`;

                const { error: uploadError } = await supabase.storage
                    .from("horse-images")
                    .upload(filePath, value, {
                        contentType: value.type || "image/webp",
                        upsert: false,
                    });

                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage.from("horse-images").getPublicUrl(filePath);
                    await supabase.from("horse_images").insert({
                        horse_id: horseId,
                        image_url: publicUrl,
                        angle_profile: angle,
                    });
                }
            }
        }

        // Financial Vault
        const hasVaultData = purchasePrice || purchaseDate || estimatedValue || insuranceNotes;
        if (hasVaultData) {
            const vaultInsert: Record<string, unknown> = { horse_id: horseId };
            if (purchasePrice) vaultInsert.purchase_price = parseFloat(purchasePrice);
            if (purchaseDate) vaultInsert.purchase_date = purchaseDate;
            if (estimatedValue) vaultInsert.estimated_current_value = parseFloat(estimatedValue);
            if (insuranceNotes) vaultInsert.insurance_notes = insuranceNotes;

            await supabase.from("financial_vault").insert(vaultInsert);
        }

        revalidatePath("/dashboard");
        return { success: true, horseId };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown server error." };
    }
}

export async function deleteHorseImageAction(recordId: string, storagePath: string | null): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not logged in" };

        if (storagePath) {
            const { error: storageError } = await supabase.storage.from("horse-images").remove([storagePath]);
            if (storageError) console.error("Storage cleanup failed:", storageError);
        }

        const { error } = await supabase.from("horse_images").delete().eq("id", recordId);
        if (error) throw new Error(error.message);

        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to delete image" };
    }
}

export async function updateHorseAction(horseId: string, data: {
    horseUpdate: Record<string, unknown> | null;
    vaultData: Record<string, unknown> | null;
    hasExistingVault: boolean;
    deleteVault: boolean;
    conditionChange: { newCondition: string; note: string | null } | null;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not logged in" };

        // ── Security: whitelist allowed fields to prevent column injection ──
        const HORSE_ALLOWED = [
            'custom_name', 'sculptor', 'finishing_artist', 'finish_type',
            'condition_grade', 'is_public', 'trade_status', 'listing_price',
            'marketplace_notes', 'collection_id', 'reference_mold_id',
            'artist_resin_id', 'release_id', 'life_stage',
            'edition_number', 'edition_size',
        ];
        const VAULT_ALLOWED = [
            'purchase_price', 'purchase_date', 'estimated_current_value',
            'insurance_notes', 'horse_id',
        ];

        const horseUpdate = data.horseUpdate
            ? Object.fromEntries(Object.entries(data.horseUpdate).filter(([k]) => HORSE_ALLOWED.includes(k)))
            : null;

        const vaultData = data.vaultData
            ? Object.fromEntries(Object.entries(data.vaultData).filter(([k]) => VAULT_ALLOWED.includes(k)))
            : null;

        if (horseUpdate) {
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
                await supabase.from("financial_vault").insert(vaultData);
            }
        }

        // ── Condition History Ledger ──
        // NOTE: condition_history INSERT is now handled by Postgres trigger
        // (trg_user_horses_condition). We only add the Hoofprint timeline event.
        if (data.conditionChange) {
            try {
                await supabase.from("horse_timeline").insert({
                    horse_id: horseId,
                    user_id: user.id,
                    event_type: "condition_change",
                    title: `Condition updated to ${data.conditionChange.newCondition}`,
                    description: data.conditionChange.note || undefined,
                });
            } catch { /* Non-blocking — don't fail the save */ }
        }

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
    tradeStatus?: string;
    lifeStage?: string;
    selectedMoldId?: string;
    selectedResinId?: string;
    selectedReleaseId?: string;
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
}): Promise<{ success: boolean; horseId?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    if (!data.customName?.trim() || !data.finishType) {
        return { success: false, error: "Missing required fields." };
    }

    const horseInsert: Record<string, unknown> = {
        owner_id: user.id,
        custom_name: data.customName.trim(),
        finish_type: data.finishType,
        condition_grade: data.conditionGrade || null,
        is_public: data.isPublic,
        trade_status: data.tradeStatus || null,
        life_stage: data.lifeStage || "Living",
    };

    if (data.selectedMoldId) horseInsert.reference_mold_id = data.selectedMoldId;
    if (data.selectedResinId) horseInsert.artist_resin_id = data.selectedResinId;
    if (data.selectedReleaseId) horseInsert.release_id = data.selectedReleaseId;
    if (data.selectedCollectionId) horseInsert.collection_id = data.selectedCollectionId;
    if (data.sculptor) horseInsert.sculptor = data.sculptor;
    if (data.finishingArtist) horseInsert.finishing_artist = data.finishingArtist;
    if (data.editionNumber) horseInsert.edition_number = data.editionNumber;
    if (data.editionSize) horseInsert.edition_size = data.editionSize;

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
    const hasVault = data.purchasePrice || data.purchaseDate || data.estimatedValue || data.insuranceNotes;
    if (hasVault) {
        const vaultInsert: Record<string, unknown> = { horse_id: horse.id };
        if (data.purchasePrice) vaultInsert.purchase_price = data.purchasePrice;
        if (data.purchaseDate) vaultInsert.purchase_date = data.purchaseDate;
        if (data.estimatedValue) vaultInsert.estimated_current_value = data.estimatedValue;
        if (data.insuranceNotes) vaultInsert.insurance_notes = data.insuranceNotes;
        await supabase.from("financial_vault").insert(vaultInsert);
    }

    revalidatePath("/dashboard");
    return { success: true, horseId: horse.id };
}

/**
 * Step 2 of 2-step save: Record image metadata after client-side upload.
 * Called AFTER the browser has uploaded files directly to Supabase Storage.
 */
export async function finalizeHorseImages(
    horseId: string,
    images: { path: string; angle: string }[]
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Verify ownership
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id")
        .eq("id", horseId)
        .eq("owner_id", user.id)
        .single();
    if (!horse) return { success: false, error: "Horse not found or not yours." };

    if (images.length === 0) return { success: true };

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
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    revalidatePath(`/stable/${horseId}`);
    return { success: true };
}
