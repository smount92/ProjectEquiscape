"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getCollectionsAction() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
        .from("user_collections")
        .select("id, name, description")
        .eq("user_id", user.id)
        .order("name");

    return data || [];
}

export async function createCollectionAction(name: string, description: string | null, isPublic: boolean) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data, error } = await supabase
        .from("user_collections")
        .insert({
            user_id: user.id,
            name,
            description,
            is_public: isPublic,
        } as Record<string, unknown>)
        .select("id, name, description")
        .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
}

export async function updateCollectionAction(
    collectionId: string,
    data: { name?: string; description?: string; isPublic?: boolean }
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name.trim();
    if (data.description !== undefined) update.description = data.description.trim() || null;
    if (data.isPublic !== undefined) update.is_public = data.isPublic;

    const { error } = await supabase
        .from("user_collections")
        .update(update)
        .eq("id", collectionId)
        .eq("user_id", user.id);

    if (error) return { success: false, error: error.message };
    revalidatePath(`/stable/collection/${collectionId}`);
    return { success: true };
}

export async function deleteCollectionAction(
    collectionId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Clean up junction table (cascade should handle this, but be explicit)
    await supabase
        .from("horse_collections")
        .delete()
        .eq("collection_id", collectionId);

    // Also unassign from legacy FK column
    await supabase
        .from("user_horses")
        .update({ collection_id: null })
        .eq("collection_id", collectionId)
        .eq("owner_id", user.id);

    const { error } = await supabase
        .from("user_collections")
        .delete()
        .eq("id", collectionId)
        .eq("user_id", user.id);

    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard");
    return { success: true };
}

/**
 * Get all collection IDs a horse belongs to (via junction table).
 */
export async function getHorseCollections(horseId: string): Promise<string[]> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("horse_collections")
        .select("collection_id")
        .eq("horse_id", horseId);

    return (data || []).map((r: { collection_id: string }) => r.collection_id);
}

/**
 * Set the collections a horse belongs to (replaces all existing assignments).
 */
export async function setHorseCollections(
    horseId: string,
    collectionIds: string[]
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Verify horse ownership
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id")
        .eq("id", horseId)
        .eq("owner_id", user.id)
        .maybeSingle();

    if (!horse) return { success: false, error: "Horse not found or not yours." };

    // Delete all existing assignments
    await supabase
        .from("horse_collections")
        .delete()
        .eq("horse_id", horseId);

    // Insert new assignments
    if (collectionIds.length > 0) {
        const inserts = collectionIds.map(cid => ({
            horse_id: horseId,
            collection_id: cid,
        }));

        const { error } = await supabase
            .from("horse_collections")
            .insert(inserts);

        if (error) return { success: false, error: error.message };
    }

    // Also update legacy FK to first collection (for backward compat reads)
    await supabase
        .from("user_horses")
        .update({ collection_id: collectionIds[0] || null })
        .eq("id", horseId);

    revalidatePath("/dashboard");
    return { success: true };
}
