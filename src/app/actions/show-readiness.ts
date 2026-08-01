"use server";

/**
 * Batch 3 — the first-entry ramp. Scoped reads behind the
 * "Get show-ready" panel on the public show page.
 *
 * Deliberately self-contained: shows-v2.ts is under heavy parallel
 * edit, so this file owns its own small entrant-scoped queries
 * instead of importing from it (same query shapes; RLS + owner_id
 * filters do the guarding). Both actions take no input, so there is
 * no zod boundary to validate here.
 */

import { requireAuth } from "@/lib/auth";
import type { EntrantHorse } from "@/lib/shows/public";
import type { ShowReadiness } from "@/lib/shows/readiness";

type ActionResult<T = object> =
    | ({ success: true } & T)
    | { success: false; error: string };

/**
 * Cheap counts for the readiness panel: how many horses the viewer
 * owns, how many are public, how many have at least one photo, and
 * how many clear both bars (online-show eligible).
 */
export async function getMyShowReadiness(): Promise<ActionResult<{ readiness: ShowReadiness }>> {
    const { supabase, user } = await requireAuth();

    const { data: horseRows, error } = await supabase
        .from("user_horses")
        .select("id, is_public")
        .eq("owner_id", user.id)
        .is("deleted_at", null);
    if (error) return { success: false, error: error.message };

    const horses = (horseRows ?? []) as { id: string; is_public: boolean }[];
    if (horses.length === 0) {
        return {
            success: true,
            readiness: { totalHorses: 0, publicHorses: 0, horsesWithPhotos: 0, eligibleCount: 0 },
        };
    }

    // One photo-presence sweep (horse_id only) — the same shape the
    // entrant-horse thumbnail lookup already uses elsewhere.
    const { data: imageRows, error: iErr } = await supabase
        .from("horse_images")
        .select("horse_id")
        .in(
            "horse_id",
            horses.map((h) => h.id),
        );
    if (iErr) return { success: false, error: iErr.message };

    const withPhoto = new Set((imageRows ?? []).map((r) => r.horse_id as string));
    const publicHorses = horses.filter((h) => h.is_public);

    return {
        success: true,
        readiness: {
            totalHorses: horses.length,
            publicHorses: publicHorses.length,
            horsesWithPhotos: horses.filter((h) => withPhoto.has(h.id)).length,
            eligibleCount: publicHorses.filter((h) => withPhoto.has(h.id)).length,
        },
    };
}

/**
 * The viewer's enterable horses (public, not deleted) — a client
 * refetch for the entry flow so a horse added mid-visit shows up
 * without a full page reload. Same result shape the show page's
 * server render passes down.
 */
export async function listMyEntrantHorses(): Promise<ActionResult<{ horses: EntrantHorse[] }>> {
    const { supabase, user } = await requireAuth();

    const { data: horseRows, error } = await supabase
        .from("user_horses")
        .select("id, custom_name, finish_type, catalog_items:catalog_id(scale)")
        .eq("owner_id", user.id)
        .eq("is_public", true)
        .is("deleted_at", null)
        .order("custom_name", { ascending: true });
    if (error) return { success: false, error: error.message };
    const horses = horseRows ?? [];

    // Primary thumbnails, one sweep (legacy entry-form pattern).
    const horseIds = horses.map((h) => h.id as string);
    const thumbByHorse = new Map<string, string>();
    if (horseIds.length > 0) {
        const { data: images, error: iErr } = await supabase
            .from("horse_images")
            .select("horse_id, image_url, angle_profile")
            .in("horse_id", horseIds);
        if (iErr) return { success: false, error: iErr.message };
        for (const horseId of horseIds) {
            const mine = (images ?? []).filter((i) => i.horse_id === horseId);
            const primary = mine.find((i) => i.angle_profile === "Primary_Thumbnail") ?? mine[0];
            if (primary?.image_url) thumbByHorse.set(horseId, primary.image_url as string);
        }
    }

    return {
        success: true,
        horses: horses.map((h) => ({
            id: h.id as string,
            name: h.custom_name as string,
            thumbnailUrl: thumbByHorse.get(h.id as string) ?? null,
            // PostgREST returns the to-one catalog join as an object at
            // runtime; the client types it loosely, hence the cast.
            scale:
                ((h.catalog_items as unknown as { scale: string | null } | null)?.scale as
                    | string
                    | null) ?? null,
            finish: (h.finish_type as string | null) ?? null,
        })),
    };
}
