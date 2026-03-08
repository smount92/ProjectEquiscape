"use server";

import { createClient } from "@/lib/supabase/server";

export async function submitSuggestion(data: {
    suggestionType: "mold" | "release" | "resin";
    name: string;
    details?: string;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const { error } = await supabase.from("database_suggestions").insert({
        submitted_by: user.id,
        suggestion_type: data.suggestionType,
        name: data.name,
        details: data.details || null,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
}

// Admin: get all pending suggestions
export async function getPendingSuggestions() {
    const supabase = await createClient();
    const { data } = await supabase
        .from("database_suggestions")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
    return data || [];
}

// Admin: approve/reject a suggestion
export async function reviewSuggestion(
    id: string,
    status: "approved" | "rejected",
    adminNotes?: string
): Promise<{ success: boolean }> {
    const supabase = await createClient();
    const { error } = await supabase
        .from("database_suggestions")
        .update({ status, admin_notes: adminNotes || null })
        .eq("id", id);
    return { success: !error };
}
