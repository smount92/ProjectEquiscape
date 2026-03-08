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
                const match = img.image_url.match(/horse-images\/(.+)$/);
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

                const filePath = `${user.id}/${horseId}/${safeFileName}.webp`;

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

export async function updateHorseAction(horseId: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not logged in" };

        const horseUpdateStr = formData.get("horseUpdate") as string;
        const vaultDataStr = formData.get("vaultData") as string;
        const hasExistingVault = formData.get("hasExistingVault") === "true";
        const deleteVault = formData.get("deleteVault") === "true";

        const horseUpdate = horseUpdateStr ? JSON.parse(horseUpdateStr) : null;
        const vaultData = vaultDataStr ? JSON.parse(vaultDataStr) : null;

        if (horseUpdate) {
            const { error: updErr } = await supabase.from("user_horses").update(horseUpdate).eq("id", horseId).eq("owner_id", user.id);
            if (updErr) throw new Error(updErr.message);
        }

        if (deleteVault) {
            await supabase.from("financial_vault").delete().eq("horse_id", horseId);
        } else if (vaultData) {
            vaultData.horse_id = horseId; // Ensure horse_id is set
            if (hasExistingVault) {
                await supabase.from("financial_vault").update(vaultData).eq("horse_id", horseId);
            } else {
                await supabase.from("financial_vault").insert(vaultData);
            }
        }

        const slotsMetadataStr = formData.get("slotsMetadata") as string;
        const slotsMetadata = slotsMetadataStr ? JSON.parse(slotsMetadataStr) : {};

        // Process new files
        const entries = Array.from(formData.entries());
        let extraIndex = 0;

        for (const [key, value] of entries) {
            if (value instanceof File && value.size > 0 && value.name) {
                let angle: string | null = null;

                if (key.startsWith("slotFile_")) {
                    angle = key.replace("slotFile_", "");
                } else if (key.startsWith("extraFile_")) {
                    angle = "extra_detail";
                } else {
                    continue; // skip other files if any
                }

                let safeFileName = `${angle}_${Date.now()}`;
                if (angle === "extra_detail") {
                    safeFileName = `extra_detail_${Date.now()}_${extraIndex++}`;
                }

                const filePath = `${user.id}/${horseId}/${safeFileName}.webp`;
                const { error: uploadErr } = await supabase.storage.from("horse-images").upload(filePath, value, {
                    contentType: value.type || "image/webp",
                    upsert: false,
                });

                if (!uploadErr) {
                    const { data: { publicUrl } } = supabase.storage.from("horse-images").getPublicUrl(filePath);

                    if (angle !== "extra_detail" && slotsMetadata[angle]) {
                        const existing = slotsMetadata[angle];
                        if (existing.storagePath) {
                            await supabase.storage.from("horse-images").remove([existing.storagePath]);
                        }
                        if (existing.recordId) {
                            await supabase.from("horse_images").update({ image_url: publicUrl }).eq("id", existing.recordId);
                            continue;
                        }
                    }

                    await supabase.from("horse_images").insert({
                        horse_id: horseId,
                        image_url: publicUrl,
                        angle_profile: angle,
                    });
                }
            }
        }

        revalidatePath(`/stable/${horseId}`);
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to update horse" };
    }
}
