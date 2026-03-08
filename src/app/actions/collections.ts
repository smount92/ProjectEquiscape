"use server";

import { createClient } from "@/lib/supabase/server";

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
