"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================
// Help Me ID — Server Actions
// ============================================================

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

export async function createSuggestion(
    requestId: string,
    data: {
        referenceReleaseId?: string;
        artistResinId?: string;
        freeText?: string;
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated." };

        if (!data.referenceReleaseId && !data.artistResinId && !data.freeText) {
            return { success: false, error: "Please provide a suggestion." };
        }

        const { error } = await supabase.from("id_suggestions").insert({
            request_id: requestId,
            user_id: user.id,
            reference_release_id: data.referenceReleaseId || null,
            artist_resin_id: data.artistResinId || null,
            catalog_id: data.referenceReleaseId || data.artistResinId || null,
            free_text: data.freeText || null,
        });

        if (error) return { success: false, error: error.message };

        revalidatePath(`/community/help-id/${requestId}`);
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to add suggestion" };
    }
}

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

export async function addIdentifiedHorse(
    suggestionId: string
): Promise<{ success: boolean; error?: string; horseId?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated." };

        // Get the suggestion with reference data
        const { data: suggestion } = await supabase
            .from("id_suggestions")
            .select(`
        id, reference_release_id, artist_resin_id, free_text,
        reference_releases:reference_release_id(release_name, mold_id, reference_molds(mold_name, manufacturer)),
        artist_resins:artist_resin_id(resin_name, sculptor_alias)
      `)
            .eq("id", suggestionId)
            .single();

        if (!suggestion) return { success: false, error: "Suggestion not found." };

        // Build horse insert data
        interface SuggestionWithRefs {
            reference_release_id: string | null;
            artist_resin_id: string | null;
            free_text: string | null;
            reference_releases: { release_name: string; mold_id: string; reference_molds: { mold_name: string; manufacturer: string } | null } | null;
            artist_resins: { resin_name: string; sculptor_alias: string } | null;
        }
        const s = suggestion as unknown as SuggestionWithRefs;

        let customName = "Identified Model";
        const horseInsert: Record<string, unknown> = {
            owner_id: user.id,
            finish_type: "OF",
            condition_grade: "Not Graded",
            is_public: false,
            trade_status: "Not for Sale",
        };

        if (s.reference_release_id && s.reference_releases) {
            customName = s.reference_releases.release_name;
            horseInsert.release_id = s.reference_release_id;
            horseInsert.catalog_id = s.reference_release_id;
            if (s.reference_releases.mold_id) {
                horseInsert.reference_mold_id = s.reference_releases.mold_id;
            }
        } else if (s.artist_resin_id && s.artist_resins) {
            customName = s.artist_resins.resin_name;
            horseInsert.artist_resin_id = s.artist_resin_id;
            horseInsert.catalog_id = s.artist_resin_id;
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
        } catch { /* Photo transfer is best-effort */ }

        revalidatePath("/dashboard");
        return { success: true, horseId: horse.id };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to add horse" };
    }
}

/** Delete an ID request (creator only) */
export async function deleteIdRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

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
        } catch { /* best effort */ }
    }

    revalidatePath("/community/help-id");
    return { success: true };
}
