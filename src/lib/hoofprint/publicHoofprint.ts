/**
 * The logged-out Hoofprint read path (migration 177).
 *
 * docs/MARKETING_PLAN_2026.md §1.3 names this the highest-value
 * marketing unblock on its list, and the reason is worth restating:
 * the public passport is the page a seller links to from a Facebook
 * group, and its entire job is to convince a stranger that the horse's
 * history is real. Until now the provenance timeline on that page
 * rendered NOTHING for anyone not signed in — v_horse_hoofprint is
 * granted TO authenticated (050), so getHoofprint() came back empty and
 * the section silently vanished. The skeptical buyer the passport
 * exists for saw a passport with no provenance on it.
 *
 * get_public_hoofprint (177) is the anon-safe read. It is SECURITY
 * DEFINER and guarded to PUBLIC, non-deleted horses, and it withholds
 * condition history and followers-only notes — see that migration's
 * header for the audit of every branch.
 *
 * Graceful degradation is the contract, exactly as in
 * src/lib/shows/publicRecords.ts: the owner applies migrations by hand,
 * so until 177 lands the function does not exist. ANY failure returns
 * null, the section renders nothing, and the passport is unchanged.
 */

import { createAnonClient } from "@/lib/supabase/anon";
import type { OwnershipRecord, TimelineEvent } from "@/app/actions/hoofprint";

export interface PublicHoofprint {
    timeline: TimelineEvent[];
    ownershipChain: OwnershipRecord[];
    lifeStage: string;
}

/** One row of get_public_hoofprint: three columns, two of them JSONB. */
interface PublicHoofprintRow {
    timeline: unknown;
    ownership: unknown;
    life_stage: unknown;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);

/**
 * Pure mapping of the RPC row onto the same view model getHoofprint()
 * returns, so the member timeline component renders anon data without
 * knowing where it came from. Tolerant of junk: an event with no id or
 * no title is dropped rather than rendered as a blank rail entry.
 */
export function mapPublicHoofprint(row: unknown): PublicHoofprint | null {
    if (row === null || typeof row !== "object") return null;
    const r = row as PublicHoofprintRow;

    const timeline: TimelineEvent[] = [];
    if (Array.isArray(r.timeline)) {
        for (const raw of r.timeline) {
            if (raw === null || typeof raw !== "object") continue;
            const e = raw as Record<string, unknown>;
            const id = str(e.source_id);
            const title = str(e.title);
            if (!id || !title) continue;
            timeline.push({
                id,
                eventType: str(e.event_type),
                title,
                description: strOrNull(e.description),
                eventDate: strOrNull(e.event_date),
                metadata:
                    e.metadata !== null && typeof e.metadata === "object"
                        ? (e.metadata as Record<string, unknown>)
                        : {},
                // The RPC only ever returns public rows, so this is true by
                // construction — mapped rather than assumed so the "🔒
                // Private" marker can never appear on an anon passport.
                isPublic: true,
                createdAt: str(e.created_at),
                userAlias: str(e.user_alias) || "Unknown",
                userId: str(e.user_id),
                sourceTable: strOrNull(e.source_table) ?? undefined,
            });
        }
    }

    const ownershipChain: OwnershipRecord[] = [];
    if (Array.isArray(r.ownership)) {
        for (const raw of r.ownership) {
            if (raw === null || typeof raw !== "object") continue;
            const o = raw as Record<string, unknown>;
            const id = str(o.id);
            const ownerAlias = str(o.owner_alias);
            if (!id || !ownerAlias) continue;
            const isPricePublic = o.is_price_public === true;
            ownershipChain.push({
                id,
                ownerAlias,
                ownerId: strOrNull(o.owner_id),
                acquiredAt: str(o.acquired_at),
                releasedAt: strOrNull(o.released_at),
                acquisitionType: str(o.acquisition_type),
                // Belt and braces over the RPC's own CASE: a price the
                // seller did not publish never reaches a stranger, even if
                // the shape of the row changes underneath us.
                salePrice: isPricePublic && typeof o.sale_price === "number" ? o.sale_price : null,
                isPricePublic,
                notes: strOrNull(o.notes),
            });
        }
    }

    return {
        timeline,
        ownershipChain,
        lifeStage: str(r.life_stage) || "completed",
    };
}

/**
 * A public horse's Hoofprint for a logged-out visitor, or null on any
 * failure — including "migration 177 is not applied yet" and "this
 * horse is not public", which are both normal answers here.
 */
export async function getPublicHoofprint(horseId: string): Promise<PublicHoofprint | null> {
    try {
        const supabase = createAnonClient();
        // get_public_hoofprint ships in migration 177 (not yet in the
        // generated types → cast, same idiom as publicRecords.ts / 146).
        const rpc = supabase.rpc.bind(supabase) as unknown as (
            fn: string,
            args: { p_horse_id: string },
        ) => Promise<{ data: unknown; error: unknown }>;
        const { data, error } = await rpc("get_public_hoofprint", { p_horse_id: horseId });
        if (error || !Array.isArray(data) || data.length === 0) return null;
        return mapPublicHoofprint(data[0]);
    } catch {
        return null;
    }
}
