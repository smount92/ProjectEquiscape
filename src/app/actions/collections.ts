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

    // Unassign horses from collection first
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
