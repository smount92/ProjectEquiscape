"use server";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * Submit a suggestion for a missing catalog entry.
 * Goes to admin review queue.
 * @param data - Suggestion details: maker, title, description
 */
export async function submitSuggestion(data: {
    suggestionType: "mold" | "release" | "resin";
    name: string;
    details?: string;
}): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

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
/**
 * Get pending catalog suggestions (admin only).
 * @returns Array of unreviewed suggestions
 */
export async function getPendingSuggestions() {
    const supabase = await createClient();
    const { data } = await supabase
        .from("database_suggestions")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
    return data || [];
}

// Admin: approve/reject a suggestion — executes DB insertion on approve
/**
 * Approve or reject a catalog suggestion (admin only).
 * @param suggestionId - UUID of the suggestion
 * @param action - "approve" or "reject"
 */
export async function reviewSuggestion(
    id: string,
    status: "approved" | "rejected",
    adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
    const admin = getAdminClient();

    // Fetch the suggestion
    const { data: suggestion } = await admin
        .from("database_suggestions")
        .select("*")
        .eq("id", id)
        .single();

    if (!suggestion) return { success: false, error: "Suggestion not found." };

    const s = suggestion as Record<string, unknown>;

    if (status === "approved") {
        // Execute the actual database insertion based on suggestion_type
        const details = (s.details as string) || "";
        // Try to extract maker from details (first line or first segment before comma)
        const makerGuess = details.split(/[,\n]/)[0]?.trim() || "Unknown";

        if (s.suggestion_type === "mold") {
            const { error: insertError } = await admin.from("catalog_items").insert({
                item_type: "plastic_mold",
                title: s.name as string,
                maker: makerGuess,
            });
            if (insertError) {
                return { success: false, error: `Failed to insert mold: ${insertError.message}` };
            }
        } else if (s.suggestion_type === "release") {
            // Releases need a parent_id — try inserting without one (admin can fix later)
            const { error: insertError } = await admin.from("catalog_items").insert({
                item_type: "plastic_release",
                title: s.name as string,
                maker: makerGuess,
            });
            if (insertError) {
                return { success: false, error: `Failed to insert release: ${insertError.message}. You may need to set the parent_id manually.` };
            }
        } else if (s.suggestion_type === "resin") {
            const { error: insertError } = await admin.from("catalog_items").insert({
                item_type: "artist_resin",
                title: s.name as string,
                maker: makerGuess,
            });
            if (insertError) {
                return { success: false, error: `Failed to insert resin: ${insertError.message}` };
            }
        }
    }

    // Update suggestion status
    const { error } = await admin.from("database_suggestions").update({
        status,
        admin_notes: adminNotes || null,
        reviewed_at: new Date().toISOString(),
    }).eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/admin");
    return { success: true };
}
