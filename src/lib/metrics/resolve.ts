/**
 * Turning "top object" ids back into names, in one read per entity type.
 *
 * `metrics_top_objects` returns ids and counts and nothing else — that is
 * on purpose: the rollup table stores no names, so there is no denormalised
 * copy of a horse's name to go stale, and the counting path never has to
 * know what an entity IS. The cost is this module, which does the joins
 * afterwards for the admin console only.
 *
 * The rule that matters for cost: one query per entity type present, never
 * one per row. A week of leaderboards across seven types is at most eight
 * reads (shows needs two, v2 and legacy), all issued together.
 */

import { isMissingMetricsSchema, metricsDb } from "@/lib/metrics/db";
import type { EntityType } from "@/lib/metrics/entities";

export interface ResolvedEntity {
    /** Best available human name. Falls back to a truncated id. */
    name: string;
    /** Where to go to look at it, when we can build a link. */
    href: string | null;
}

export type EntityNameMap = Record<string, ResolvedEntity>;

/** `type:id` — flat key so one map covers every type without nesting. */
export function entityKey(type: EntityType, id: string): string {
    return `${type}:${id}`;
}

/** What a row shows when the object has been deleted since it was viewed. */
function fallback(id: string): ResolvedEntity {
    return { name: `${id.slice(0, 8)}…`, href: null };
}

interface Row {
    [key: string]: unknown;
}

/** A read that answers [] instead of throwing when the table isn't there. */
async function safeRead(
    client: unknown,
    table: string,
    columns: string,
    column: string,
    ids: string[],
): Promise<Row[]> {
    if (ids.length === 0) return [];
    try {
        const { data, error } = await metricsDb(client)
            .from(table)
            .select(columns)
            .in(column, ids);
        if (error) {
            if (!isMissingMetricsSchema(error)) {
                console.error(`[Insights] name lookup on ${table} failed:`, error.message);
            }
            return [];
        }
        return (data ?? []) as unknown as Row[];
    } catch {
        return [];
    }
}

const str = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;

/**
 * Resolve every id in one batch. Anything that cannot be resolved — a
 * deleted horse, a barn that was renamed away — degrades to a truncated
 * id with no link rather than dropping the row, because the VIEW still
 * happened and the count is still true.
 */
export async function resolveEntityNames(
    client: unknown,
    wanted: { type: EntityType; id: string }[],
): Promise<EntityNameMap> {
    const byType = new Map<EntityType, string[]>();
    for (const { type, id } of wanted) {
        const list = byType.get(type) ?? [];
        if (!list.includes(id)) list.push(id);
        byType.set(type, list);
    }

    const horseIds = [...(byType.get("horse") ?? []), ...(byType.get("listing") ?? [])];
    const showIds = byType.get("show") ?? [];
    const barnIds = byType.get("barn") ?? [];
    const studioIds = byType.get("studio") ?? [];
    const referenceIds = byType.get("reference") ?? [];
    const profileIds = byType.get("profile") ?? [];

    // One round of reads, all in flight together.
    const [horses, showsV2, showsLegacy, barns, studios, references, profiles] =
        await Promise.all([
            safeRead(client, "user_horses", "id, custom_name", "id", [...new Set(horseIds)]),
            safeRead(client, "shows", "id, title", "id", showIds),
            safeRead(client, "events", "id, name", "id", showIds),
            safeRead(client, "groups", "id, name, slug", "id", barnIds),
            safeRead(
                client,
                "artist_profiles",
                "user_id, studio_name, studio_slug",
                "user_id",
                studioIds,
            ),
            safeRead(
                client,
                "catalog_items",
                "id, title, maker, maker_slug, slug",
                "id",
                referenceIds,
            ),
            safeRead(client, "users", "id, alias_name", "id", profileIds),
        ]);

    const map: EntityNameMap = {};

    for (const r of horses) {
        const id = str(r.id);
        if (!id) continue;
        const entry: ResolvedEntity = {
            name: str(r.custom_name) ?? fallback(id).name,
            href: `/community/${id}`,
        };
        // The same horse can top both leaderboards; register it under each.
        map[entityKey("horse", id)] = entry;
        map[entityKey("listing", id)] = entry;
    }

    for (const r of showsV2) {
        const id = str(r.id);
        if (!id) continue;
        map[entityKey("show", id)] = {
            name: str(r.title) ?? fallback(id).name,
            href: `/shows/${id}`,
        };
    }
    // Legacy events only fill gaps — a v2 show wins if both answer.
    for (const r of showsLegacy) {
        const id = str(r.id);
        if (!id || map[entityKey("show", id)]) continue;
        map[entityKey("show", id)] = {
            name: str(r.name) ?? fallback(id).name,
            href: `/shows/${id}`,
        };
    }

    for (const r of barns) {
        const id = str(r.id);
        if (!id) continue;
        const slug = str(r.slug);
        map[entityKey("barn", id)] = {
            name: str(r.name) ?? fallback(id).name,
            href: slug ? `/community/groups/${encodeURIComponent(slug)}` : null,
        };
    }

    for (const r of studios) {
        const id = str(r.user_id);
        if (!id) continue;
        const slug = str(r.studio_slug);
        map[entityKey("studio", id)] = {
            name: str(r.studio_name) ?? fallback(id).name,
            href: slug ? `/studio/${encodeURIComponent(slug)}` : null,
        };
    }

    for (const r of references) {
        const id = str(r.id);
        if (!id) continue;
        const maker = str(r.maker);
        const makerSlug = str(r.maker_slug);
        const slug = str(r.slug);
        const title = str(r.title) ?? fallback(id).name;
        map[entityKey("reference", id)] = {
            name: maker ? `${maker} — ${title}` : title,
            href: makerSlug && slug ? `/reference/${makerSlug}/${slug}` : null,
        };
    }

    for (const r of profiles) {
        const id = str(r.id);
        if (!id) continue;
        const alias = str(r.alias_name);
        map[entityKey("profile", id)] = {
            name: alias ? `@${alias}` : fallback(id).name,
            href: alias ? `/profile/${encodeURIComponent(alias)}` : null,
        };
    }

    // Everything asked for that nothing answered.
    for (const { type, id } of wanted) {
        if (!map[entityKey(type, id)]) map[entityKey(type, id)] = fallback(id);
    }

    return map;
}
