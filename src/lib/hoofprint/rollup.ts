/**
 * The Hoofprint is the story of the horse; 112 show placings drown it.
 * The detail lives in Show Records, so the timeline rolls every placing
 * from one show into a single line — "4 placings at Spring Fling Live
 * 2024 — best 1st" — in the place of the first one. Pure.
 */
export interface RollupEvent {
    id: string;
    eventType: string;
    title: string;
    description: string | null;
    eventDate: string | null;
    metadata: Record<string, unknown>;
}

/** The number of events shown before "Show earlier". */
export const TIMELINE_PREVIEW = 12;

const PLACE_RANK: Record<string, number> = {
    "supreme champion": 0,
    "grand champion": 1,
    "reserve grand champion": 2,
    champion: 3,
    "reserve champion": 4,
};

/** Lower is better; unknown placings sort after numbered ones. */
export function placingRank(placing: string | null | undefined): number {
    const p = (placing ?? "").trim().toLowerCase();
    if (!p) return 999;
    if (p in PLACE_RANK) return PLACE_RANK[p];
    const n = p.match(/^(\d{1,2})/);
    if (n) return 10 + Number(n[1]);
    if (/honou?rable/.test(p)) return 60;
    if (/^top\s*(\d+)/.test(p)) return 50 + Number(p.match(/^top\s*(\d+)/)![1]);
    return 90;
}

function showKey(e: RollupEvent): string {
    const name = typeof e.metadata?.show_name === "string" ? e.metadata.show_name : e.title.replace(/^.*? at /, "");
    return `${name.trim().toLowerCase()}|${(e.eventDate ?? "").slice(0, 10)}`;
}

/**
 * Show results from the same show and date become one event, positioned
 * where the first of them was. Everything else passes through untouched.
 */
export function rollupShowResults<T extends RollupEvent>(events: readonly T[]): T[] {
    const groups = new Map<string, T[]>();
    for (const e of events) {
        if (e.eventType !== "show_result") continue;
        const k = showKey(e);
        groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    const out: T[] = [];
    const emitted = new Set<string>();
    for (const e of events) {
        if (e.eventType !== "show_result") {
            out.push(e);
            continue;
        }
        const k = showKey(e);
        if (emitted.has(k)) continue;
        emitted.add(k);
        const group = groups.get(k)!;
        if (group.length === 1) {
            out.push(e);
            continue;
        }
        const placings = group.map((g) => (typeof g.metadata?.placing === "string" ? g.metadata.placing : null)).filter((p): p is string => !!p);
        const best = placings.slice().sort((a, b) => placingRank(a) - placingRank(b))[0] ?? null;
        const name = typeof e.metadata?.show_name === "string" ? e.metadata.show_name : e.title.replace(/^.*? at /, "");
        const cards = group.filter((g) => g.metadata?.is_nan_qualifying === true).length;
        out.push({
            ...e,
            id: `rollup:${e.id}`,
            title: `${group.length} placings at ${name}`,
            description: [best ? `Best: ${best}` : null, cards ? `${cards} card${cards === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ") || null,
            metadata: { ...e.metadata, rolled_up: true, rolled_count: group.length, rolled_ids: group.map((g) => g.id) },
        });
    }
    return out;
}
