"use server";

/**
 * Batch 3 — "Upload a new photo" inside the entry dialog.
 *
 * The metadata half of the existing 2-step photo pipeline: the
 * browser compresses (imageCompression) and uploads directly to
 * Storage (uploadImageWithRetry), then this action records the
 * horse_images row — finalizeHorseImages' shape, scoped to a single
 * photo so the dialog can optimistically show and select it.
 *
 * Show photos are FREE for every tier and capped at 5 per horse —
 * the flaw-photo precedent copied exactly (trust/show features are
 * never paywalled; the cap is the only rule). See
 * src/lib/shows/entryPhoto.ts for why the angle lands on "Other"
 * (angle_profile is a constrained enum with no Show_Photo member and
 * migrations are out of scope for this batch).
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth";
import { SHOW_PHOTO_ANGLE, SHOW_PHOTO_CAP, isValidShowPhotoPath } from "@/lib/shows/entryPhoto";
import { firstZodError, uuidSchema } from "@/lib/shows/schemas";

const addShowPhotoSchema = z.object({
    horseId: uuidSchema,
    /** Storage path the client just uploaded to (horses/<id>/…webp). */
    path: z.string().min(1).max(300),
});

export type AddShowPhotoResult =
    | { success: true; photo: { id: string; publicUrl: string; angleProfile: string } }
    | { success: false; error: string };

/**
 * Attach a freshly-uploaded show photo to one of the caller's own
 * horses. requireAuth + explicit ownership check; the cap counts
 * existing rows on the same angle before inserting (flaw-cap
 * pattern) and removes the orphaned upload when it refuses.
 */
export async function addShowPhotoToHorse(
    input: z.input<typeof addShowPhotoSchema>,
): Promise<AddShowPhotoResult> {
    const parsed = addShowPhotoSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { horseId, path } = parsed.data;

    const { supabase, user } = await requireAuth();

    if (!isValidShowPhotoPath(path, horseId)) {
        return { success: false, error: "Invalid photo path." };
    }

    // Explicit ownership check — never attach photos to someone else's horse.
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id")
        .eq("id", horseId)
        .eq("owner_id", user.id)
        .is("deleted_at", null)
        .single();
    if (!horse) return { success: false, error: "Horse not found or not yours." };

    // Cap — the flaw-photo precedent: count first, refuse the overflow.
    const { count, error: countErr } = await supabase
        .from("horse_images")
        .select("id", { count: "exact", head: true })
        .eq("horse_id", horseId)
        .eq("angle_profile", SHOW_PHOTO_ANGLE);
    if (countErr) return { success: false, error: countErr.message };

    if ((count ?? 0) >= SHOW_PHOTO_CAP) {
        // The file already landed in Storage — don't leave an orphan.
        await supabase.storage.from("horse-images").remove([path]);
        return {
            success: false,
            error: `Show photo limit reached (${SHOW_PHOTO_CAP} per horse) — manage this horse's photos from its stable page.`,
        };
    }

    const {
        data: { publicUrl },
    } = supabase.storage.from("horse-images").getPublicUrl(path);

    const { data: inserted, error } = await supabase
        .from("horse_images")
        .insert({ horse_id: horseId, image_url: publicUrl, angle_profile: SHOW_PHOTO_ANGLE })
        .select("id")
        .single<{ id: string }>();
    if (error || !inserted) {
        return { success: false, error: error?.message ?? "Failed to attach the photo." };
    }

    revalidatePath(`/stable/${horseId}`);

    return {
        success: true,
        photo: { id: inserted.id, publicUrl, angleProfile: SHOW_PHOTO_ANGLE },
    };
}
