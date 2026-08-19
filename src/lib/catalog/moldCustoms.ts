/**
 * Reference pages — "Customs of this mold" (Taxonomy v2).
 *
 * The community's answer to "should customs be catalog entries?" is
 * NO — a custom is a horse (finish_type = 'Custom'), not a catalog
 * row. Instead, a mold's reference page gathers the public customs
 * made FROM it: horses linked to the mold itself or to any of its
 * releases, via the anon-granted get_mold_customs DEFINER RPC
 * (migration 154).
 *
 * Graceful degradation, same contract as publicCards.ts: until the
 * owner applies 154 the RPC does not exist — ANY error returns []
 * and the section renders nothing.
 */

import { createAnonClient } from "@/lib/supabase/anon";

export interface MoldCustom {
    horseId: string;
    customName: string;
    finishingArtist: string | null;
    finishingArtistVerified: boolean;
    imageUrl: string | null;
}

/** Raw row shape returned by get_mold_customs (migration 154). */
interface MoldCustomRow {
    horse_id: string;
    custom_name: string;
    finishing_artist: string | null;
    finishing_artist_verified: boolean | null;
    image_url: string | null;
}

/** Pure mapping RPC rows → gallery shape. Junk rows are dropped. */
export function mapMoldCustomRows(rows: unknown): MoldCustom[] {
    if (!Array.isArray(rows)) return [];
    const customs: MoldCustom[] = [];
    for (const raw of rows) {
        if (raw === null || typeof raw !== "object") continue;
        const row = raw as Partial<MoldCustomRow>;
        if (typeof row.horse_id !== "string" || row.horse_id.length === 0) continue;
        if (typeof row.custom_name !== "string" || row.custom_name.length === 0) continue;
        customs.push({
            horseId: row.horse_id,
            customName: row.custom_name,
            finishingArtist:
                typeof row.finishing_artist === "string" && row.finishing_artist.trim()
                    ? row.finishing_artist
                    : null,
            finishingArtistVerified: row.finishing_artist_verified === true,
            imageUrl: typeof row.image_url === "string" && row.image_url ? row.image_url : null,
        });
    }
    return customs;
}

/**
 * Public customs of a mold (or [] on any failure). Cookie-less anon
 * client: the RPC is visibility-guarded server-side, so the same
 * call serves logged-in and logged-out reference views.
 */
export async function getMoldCustoms(catalogId: string, limit = 24): Promise<MoldCustom[]> {
    try {
        const supabase = createAnonClient();
        const rpc = supabase.rpc.bind(supabase) as unknown as (
            fn: string,
            args: { p_catalog_id: string; p_limit: number },
        ) => Promise<{ data: unknown; error: unknown }>;
        const { data, error } = await rpc("get_mold_customs", {
            p_catalog_id: catalogId,
            p_limit: limit,
        });
        if (error || !data) return [];
        return mapMoldCustomRows(data);
    } catch {
        return [];
    }
}
