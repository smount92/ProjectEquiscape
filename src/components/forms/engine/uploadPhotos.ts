"use client";

/**
 * Compress, watermark and upload a form's photos — once.
 *
 * Lifted from the add form's submit handler, which was the stricter and
 * more careful of the two copies (the edit form's had no size cap and
 * silently dropped failed uploads until a fix went in). Failures are
 * COLLECTED and reported, never swallowed: "photos randomly don't save"
 * was a real user report born of an empty catch.
 *
 * The horse row already exists when this runs, so nothing in here may
 * fail the save — problems come back as warnings.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
    compressImage,
    compressImageWithWatermark,
    generateThumbnail,
    type UserTier,
} from "@/lib/utils/imageCompression";
import { uploadImageWithRetry } from "@/lib/utils/uploadWithRetry";
import { finalizeHorseImages } from "@/app/actions/horse";
import type { AngleProfile } from "@/lib/types/database";
import type { GallerySlot } from "@/lib/config/assetFields";
import type { PhotoStudioValue } from "./PhotoStudio";

export interface WatermarkPrefs {
    enabled: boolean;
    alias: string;
    text: string;
}

export interface UploadOutcome {
    uploaded: number;
    /** Human sentences to show on the completion leaf, or null when clean. */
    warning: string | null;
}

export async function uploadStudioPhotos({
    supabase,
    horseId,
    photos,
    gallerySlots,
    tier,
    watermark,
}: {
    supabase: SupabaseClient;
    horseId: string;
    photos: PhotoStudioValue;
    gallerySlots: readonly GallerySlot[];
    tier: UserTier;
    watermark: WatermarkPrefs;
}): Promise<UploadOutcome> {
    const uploaded: { path: string; angle: string }[] = [];
    const failed: string[] = [];

    const compress = (file: File) =>
        watermark.enabled && watermark.alias
            ? compressImageWithWatermark(file, watermark.alias, tier, watermark.text)
            : compressImage(file, tier);

    // ── Angle slots (+ a 400px thumbnail each) ──
    for (const [angle, slot] of Object.entries(photos.slots) as [
        AngleProfile,
        { file: File },
    ][]) {
        if (!slot) continue;
        const path = `horses/${horseId}/${angle}_${Date.now()}.webp`;
        const { error } = await uploadImageWithRetry(
            supabase,
            "horse-images",
            path,
            await compress(slot.file),
        );
        if (error) {
            failed.push(gallerySlots.find((s) => s.angle === angle)?.label ?? angle);
            continue;
        }
        uploaded.push({ path, angle });
        try {
            const thumb = await generateThumbnail(slot.file);
            await supabase.storage
                .from("horse-images")
                .upload(path.replace(/\.webp$/, "_thumb.webp"), thumb, {
                    contentType: "image/webp",
                });
        } catch {
            // Non-fatal — the grid falls back to full-res.
        }
    }

    // ── Extras and condition photos ──
    const strips: [typeof photos.extras, string, string][] = [
        [photos.extras, "extra_detail", "Extra photo"],
        [photos.flaws, "Flaw_Rub_Damage", "Condition photo"],
    ];
    for (const [items, angle, label] of strips) {
        for (let i = 0; i < items.length; i++) {
            const prefix = angle === "extra_detail" ? "extra_detail" : "flaw_rub_damage";
            const path = `horses/${horseId}/${prefix}_${Date.now()}_${i}.webp`;
            const { error } = await uploadImageWithRetry(
                supabase,
                "horse-images",
                path,
                await compress(items[i].file),
            );
            if (error) failed.push(`${label} ${i + 1}`);
            else uploaded.push({ path, angle });
        }
    }

    // ── Attach the metadata ──
    const problems: string[] = [];
    if (failed.length > 0) {
        const plural = failed.length === 1 ? "" : "s";
        problems.push(
            `${failed.length} photo${plural} (${failed.join(", ")}) failed to upload — you can add ${
                failed.length === 1 ? "it" : "them"
            } again from this horse's Edit page.`,
        );
    }
    if (uploaded.length > 0) {
        const result = await finalizeHorseImages(horseId, uploaded);
        if (!result.success) {
            problems.push(
                `The uploaded photos could not be attached: ${result.error ?? "unknown error"}`,
            );
        } else if (result.skippedReason) {
            problems.push(result.skippedReason);
        }
    }

    return {
        uploaded: uploaded.length,
        warning: problems.length > 0 ? problems.join(" ") : null,
    };
}
