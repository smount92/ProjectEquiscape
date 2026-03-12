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
            'condition_grade', 'is_public', 'visibility', 'trade_status', 'listing_price',
            'marketplace_notes', 'collection_id', 'catalog_id', 'life_stage',
            'edition_number', 'edition_size', 'asset_category',
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
}): Promise<{ success: boolean; horseId?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    if (!data.customName?.trim()) {
        return { success: false, error: "Missing required fields." };
    }

    // Non-model categories don't require finishType
    const category = data.assetCategory || 'model';
    if (category === 'model' && !data.finishType) {
        return { success: false, error: "Finish type is required for model horses." };
    }

    const horseInsert: Record<string, unknown> = {
        owner_id: user.id,
        custom_name: data.customName.trim(),
        asset_category: category,
        finish_type: data.finishType || null,
        condition_grade: data.conditionGrade || null,
        is_public: data.isPublic,
        visibility: data.isPublic ? "public" : "private",
        trade_status: data.tradeStatus || null,
        life_stage: data.lifeStage || "Living",
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

// ============================================================
// BULK OPERATIONS
// ============================================================

export async function bulkUpdateHorses(
    horseIds: string[],
    updates: {
        collectionId?: string | null;
        tradeStatus?: string;
    }
): Promise<{ success: boolean; count?: number; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };
    if (horseIds.length === 0) return { success: false, error: "No horses selected." };
    if (horseIds.length > 200) return { success: false, error: "Too many items (max 200)." };

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

export async function bulkDeleteHorses(
    horseIds: string[]
): Promise<{ success: boolean; count?: number; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };
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

    const { error } = await supabase
        .from("user_horses")
        .delete()
        .in("id", horseIds)
        .eq("owner_id", user.id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    return { success: true, count: horseIds.length };
}

// ============================================================
// QUICK ADD (Frictionless Intake)
// ============================================================

export async function quickAddHorse(data: {
    catalogId?: string;
    customName?: string;
    finishType: string;
    conditionGrade: string;
    collectionId?: string;
}): Promise<{ success: boolean; horseId?: string; horseName?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // If catalogId provided, auto-name from catalog
    let horseName = data.customName?.trim() || "";
    if (data.catalogId && !horseName) {
        const { data: catalog } = await supabase
            .from("catalog_items")
            .select("title, maker")
            .eq("id", data.catalogId)
            .single<{ title: string; maker: string }>();
        if (catalog) {
            horseName = `${catalog.maker} ${catalog.title}`;
        }
    }
    if (!horseName) horseName = "Unnamed Horse";

    const horseInsert: Record<string, unknown> = {
        owner_id: user.id,
        custom_name: horseName,
        finish_type: data.finishType,
        condition_grade: data.conditionGrade,
        is_public: false,
        trade_status: "Not for Sale",
        asset_category: "model",
    };
    if (data.catalogId) horseInsert.catalog_id = data.catalogId;
    if (data.collectionId) horseInsert.collection_id = data.collectionId;

    const { data: horse, error } = await supabase
        .from("user_horses")
        .insert(horseInsert)
        .select("id")
        .single<{ id: string }>();

    if (error || !horse) return { success: false, error: error?.message || "Failed to add." };

    revalidatePath("/dashboard");
    return { success: true, horseId: horse.id, horseName };
}

// ============================================================
// PHOTO REORDERING
// ============================================================

export async function reorderHorseImages(
    horseId: string,
    imageIds: string[]
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };
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
