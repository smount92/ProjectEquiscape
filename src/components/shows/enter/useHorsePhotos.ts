"use client";

/**
 * The selected horses' stable photos, loaded on demand (online shows
 * judge a photo). Same client-side read the old entry dialog used:
 * horse_images for the horse, ordered by uploaded_at; the primary is
 * the default judged photo (see defaultPhotoId).
 */

import { useCallback, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { getPublicImageUrl } from "@/lib/utils/storage";
import type { EntryPhoto } from "./shared";

export function useHorsePhotos() {
    const [photos, setPhotos] = useState<Record<string, EntryPhoto[]>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    // Stale-response guard per horse (fast refresh clicks).
    const seq = useRef<Record<string, number>>({});

    const load = useCallback(async (horseId: string): Promise<EntryPhoto[]> => {
        const mine = (seq.current[horseId] ?? 0) + 1;
        seq.current[horseId] = mine;
        setLoading((prev) => ({ ...prev, [horseId]: true }));
        const supabase = createClient();
        const { data } = await supabase
            .from("horse_images")
            .select("id, image_url, angle_profile")
            .eq("horse_id", horseId)
            .order("uploaded_at");
        const rows = (data ?? []) as { id: string; image_url: string; angle_profile: string }[];
        const mapped = rows.map((r) => ({
            id: r.id,
            publicUrl: getPublicImageUrl(r.image_url),
            angleProfile: r.angle_profile,
        }));
        if (seq.current[horseId] === mine) {
            setPhotos((prev) => ({ ...prev, [horseId]: mapped }));
            setLoading((prev) => ({ ...prev, [horseId]: false }));
        }
        return mapped;
    }, []);

    /** A fresh upload joins the list straight away. */
    const add = useCallback((horseId: string, photo: EntryPhoto) => {
        setPhotos((prev) => ({ ...prev, [horseId]: [...(prev[horseId] ?? []), photo] }));
    }, []);

    return { photos, loading, load, add };
}
