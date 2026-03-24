"use server";

import { logger } from "@/lib/logger";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { Database } from "@/lib/types/database.generated";

type UserHorseInsert = Database["public"]["Tables"]["user_horses"]["Insert"];

// ============================================================
// Help Me ID — Server Actions
// ============================================================

/**
 * Create a community Help ID request for model identification.
 * Accepts FormData with photos and description.
 * @param formData - Multipart form with photos and details
 */
export async function createIdRequest(formData: FormData): Promise<{ success: boolean; error?: string; id?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated." };

        const description = formData.get("description") as string;
        const identifyingMarks = formData.get("identifyingMarks") as string;
        const imageFile = formData.get("image") as File;

        if (!imageFile || imageFile.size === 0) {
            return { success: false, error: "Please upload a photo of the model." };
        }

        // Upload image to storage
        const safeFileName = `help-id_${Date.now()}.webp`;
        const filePath = `${user.id}/help-id/${safeFileName}`;

        const { error: uploadError } = await supabase.storage
            .from("horse-images")
            .upload(filePath, imageFile, {
                contentType: imageFile.type || "image/webp",
                upsert: false,
            });

        if (uploadError) {
            return { success: false, error: `Upload failed: ${uploadError.message}` };
        }

        // Store the path (we'll use signed URLs for rendering)
        const fullDescription = [description, identifyingMarks ? `Identifying marks: ${identifyingMarks}` : ""]
            .filter(Boolean)
            .join("\n\n");

        const { data: request, error } = await supabase
            .from("id_requests")
            .insert({
                user_id: user.id,
                image_url: filePath,
                description: fullDescription || null,
            })
            .select("id")
            .single<{ id: string }>();

        if (error) return { success: false, error: error.message };

        revalidatePath("/community/help-id");
        return { success: true, id: request.id };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to create request" };
    }
}

/**
 * Submit an identification suggestion for a Help ID request.
 * @param requestId - UUID of the Help ID request
 * @param suggestion - Suggested identification details
 */
export async function createSuggestion(
    requestId: string,
    data: {
        catalogId?: string;
        freeText?: string;
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated." };

        if (!data.catalogId && !data.freeText) {
            return { success: false, error: "Please provide a suggestion." };
        }

        const { error } = await supabase.from("id_suggestions").insert({
            request_id: requestId,
            user_id: user.id,
            catalog_id: data.catalogId || null,
            free_text: data.freeText || null,
        });

        if (error) return { success: false, error: error.message };

        // Notify request author that someone suggested an ID
        const suggesterUserId = user.id;
        after(async () => {
            try {
                const supabase2 = await createClient();
                // Get request author
                const { data: request } = await supabase2
                    .from("id_requests")
                    .select("user_id")
                    .eq("id", requestId)
                    .single();
                const authorId = (request as { user_id: string } | null)?.user_id;
                if (authorId && authorId !== suggesterUserId) {
                    const { data: suggester } = await supabase2
                        .from("users")
                        .select("alias_name")
                        .eq("id", suggesterUserId)
                        .single();
                    const alias = (suggester as { alias_name: string } | null)?.alias_name || "Someone";
                    const { createNotification } = await import("@/app/actions/notifications");
                    await createNotification({
                        userId: authorId,
                        type: "help_id",
                        actorId: suggesterUserId,
                        content: `@${alias} suggested an identification for your Help ID request!`,
                    });
                }
            } catch (err) { logger.error("HelpId", "Background task failed", err); }
        });

        revalidatePath(`/community/help-id/${requestId}`);
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to add suggestion" };
    }
}

/**
 * Upvote an identification suggestion.
 * @param suggestionId - UUID of the suggestion to upvote
 */
export async function upvoteSuggestion(
    suggestionId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated." };

        const { error } = await supabase.rpc("upvote_suggestion", {
            p_suggestion_id: suggestionId,
        });

        if (error) return { success: false, error: error.message };

        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to upvote" };
    }
}

/**
 * Accept a suggestion as the correct identification (requestor only).
 * @param suggestionId - UUID of the suggestion to accept
 */
export async function acceptSuggestion(
    requestId: string,
    suggestionId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated." };

        // Verify ownership of the request
        const { data: request } = await supabase
            .from("id_requests")
            .select("id, user_id")
            .eq("id", requestId)
            .single<{ id: string; user_id: string }>();

        if (!request || request.user_id !== user.id) {
            return { success: false, error: "Only the requester can accept suggestions." };
        }

        const { error } = await supabase
            .from("id_requests")
            .update({
                status: "resolved",
                accepted_suggestion_id: suggestionId,
            })
            .eq("id", requestId);

        if (error) return { success: false, error: error.message };

        revalidatePath(`/community/help-id/${requestId}`);
        revalidatePath("/community/help-id");
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to accept suggestion" };
    }
}

/**
 * Link a horse to a Help ID request after identification.
 * @param requestId - UUID of the Help ID request
 * @param horseId - UUID of the identified horse
 */
export async function addIdentifiedHorse(
    suggestionId: string
): Promise<{ success: boolean; error?: string; horseId?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated." };

        // Get the suggestion with catalog item reference
        const { data: suggestion } = await supabase
            .from("id_suggestions")
            .select(`
                id, catalog_id, free_text,
                catalog_items:catalog_id(id, title, maker, item_type)
            `)
            .eq("id", suggestionId)
            .single();

        if (!suggestion) return { success: false, error: "Suggestion not found." };

        // Build horse insert data
        interface SuggestionWithCatalog {
            catalog_id: string | null;
            free_text: string | null;
            catalog_items: { id: string; title: string; maker: string; item_type: string } | null;
        }
        const s = suggestion;

        let customName = "Identified Model";
        const horseInsert: UserHorseInsert = {
            owner_id: user.id,
            custom_name: "Identified Model",
            finish_type: "OF",
            condition_grade: "Not Graded",
            is_public: false,
            trade_status: "Not for Sale",
        };

        if (s.catalog_id && s.catalog_items) {
            customName = s.catalog_items.title;
            horseInsert.catalog_id = s.catalog_id;
        } else if (s.free_text) {
            customName = s.free_text;
        }

        horseInsert.custom_name = customName;

        const { data: horse, error } = await supabase
            .from("user_horses")
            .insert(horseInsert)
            .select("id")
            .single<{ id: string }>();

        if (error) return { success: false, error: error.message };

        // Transfer the photo from the Help ID request to the new horse
        try {
            const { data: request } = await supabase.from('id_requests').select('image_url').eq('accepted_suggestion_id', suggestionId).single();
            if (request?.image_url) {
                const { getAdminClient } = await import("@/lib/supabase/admin");
                const admin = getAdminClient();
                const ext = request.image_url.split('.').pop() || 'webp';
                const newPath = `horses/${horse.id}/Primary_Thumbnail_${Date.now()}.${ext}`;

                const { data: copyData } = await admin.storage.from("horse-images").copy(request.image_url, newPath);
                if (copyData) {
                    await admin.from("horse_images").insert({
                        horse_id: horse.id,
                        image_url: newPath,
                        angle_profile: 'Primary_Thumbnail'
                    });
                }
            }
        } catch (err) { logger.error("HelpId", "Background task failed", err); }

        revalidatePath("/dashboard");
        return { success: true, horseId: horse.id };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to add horse" };
    }
}

/** Delete an ID request (creator only) */
export async function deleteIdRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    const { data: request } = await supabase
        .from("id_requests")
        .select("id, image_url")
        .eq("id", requestId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (!request) return { success: false, error: "Request not found or not yours." };

    const r = request as { id: string; image_url: string | null };

    // Delete suggestions first
    await supabase.from("id_suggestions").delete().eq("request_id", requestId);

    // Delete the request
    const { error } = await supabase.from("id_requests").delete().eq("id", requestId);
    if (error) return { success: false, error: error.message };

    // Clean up uploaded image (best effort)
    if (r.image_url) {
        try {
            await supabase.storage.from("horse-images").remove([r.image_url]);
        } catch (err) { logger.error("HelpId", "Background task failed", err); }
    }

    revalidatePath("/community/help-id");
    return { success: true };
}
