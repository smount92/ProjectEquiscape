/**
 * The show record as a ledger, not a list. A horse with 112 placings
 * (first bulk import, 2026-09-21) needs a summary a buyer can read in a
 * second, the newest few in view, and the rest folded by season. Pure.
 */
import { isChampionshipRecord } from "@/lib/market/recordSummary";

export interface LedgerRecord {
    id: string;
    showName: string;
    showDate: string | null;
    showDateText?: string | null;
    division?: string | null;
    className?: string | null;
    placing: string | null;
    ribbonColor?: string | null;
    judgeName?: string | null;
    showLocation?: string | null;
    sectionName?: string | null;
    awardCategory?: string | null;
    notes?: string | null;
    isNan?: boolean;
    qualifierProgram?: string | null;
}

export interface LedgerSummary {
    total: number;
    firsts: number;
    championships: number;
    cards: number;
    shows: number;
    /** "2019–2024", "2024", or null when nothing is dated. */
    span: string | null;
}

/** How many records show before the ledger folds. */
export const LEDGER_PREVIEW = 8;
/** From this many records on, a filter box appears. */
export const LEDGER_FILTER_FROM = 20;

const FIRST = /^(1st|1|first|blue)$/i;

export function isFirstPlace(placing: string | null | undefined, ribbonColor?: string | null): boolean {
    if (placing && FIRST.test(placing.trim())) return true;
    return !placing && (ribbonColor ?? "").toLowerCase() === "blue";
}

export function recordYear(r: Pick<LedgerRecord, "showDate" | "showDateText">): number | null {
    const fromDate = r.showDate?.match(/^(\d{4})/)?.[1];
    if (fromDate) return Number(fromDate);
    const fromText = r.showDateText?.match(/\b(19|20)\d{2}\b/)?.[0];
    return fromText ? Number(fromText) : null;
}

export function summarizeLedger(records: readonly LedgerRecord[]): LedgerSummary {
    let firsts = 0;
    let championships = 0;
    let cards = 0;
    const shows = new Set<string>();
    const years: number[] = [];
    for (const r of records) {
        if (isChampionshipRecord(r.placing, r.ribbonColor ?? null)) championships += 1;
        else if (isFirstPlace(r.placing, r.ribbonColor)) firsts += 1;
        if (r.isNan || r.qualifierProgram) cards += 1;
        shows.add(`${r.showName.trim().toLowerCase()}|${(r.showDate ?? r.showDateText ?? "").slice(0, 10)}`);
        const y = recordYear(r);
        if (y) years.push(y);
    }
    let span: string | null = null;
    if (years.length) {
        const min = Math.min(...years);
        const max = Math.max(...years);
        span = min === max ? String(min) : `${min}–${max}`;
    }
    return { total: records.length, firsts, championships, cards, shows: shows.size, span };
}

export interface LedgerYearGroup {
    /** The year, or null for undated records (listed last). */
    year: number | null;
    label: string;
    records: LedgerRecord[];
}

/** Newest year first, undated last; records inside keep the order given. */
export function groupByYear<T extends LedgerRecord>(records: readonly T[]): { year: number | null; label: string; records: T[] }[] {
    const buckets = new Map<number | null, T[]>();
    for (const r of records) {
        const y = recordYear(r);
        buckets.set(y, [...(buckets.get(y) ?? []), r]);
    }
    return [...buckets.entries()]
        .sort((a, b) => (b[0] ?? -1) - (a[0] ?? -1))
        .map(([year, list]) => ({ year, label: year ? String(year) : "Undated", records: list }));
}

/** Free-text filter over the fields a member remembers a placing by. */
export function filterLedger<T extends LedgerRecord>(records: readonly T[], query: string): T[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...records];
    const hit = (v: string | null | undefined) => !!v && v.toLowerCase().includes(q);
    return records.filter(
        (r) =>
            hit(r.showName) ||
            hit(r.className) ||
            hit(r.division) ||
            hit(r.placing) ||
            hit(r.judgeName) ||
            hit(r.showLocation) ||
            hit(r.sectionName) ||
            hit(r.awardCategory) ||
            hit(r.notes) ||
            hit(r.showDateText) ||
            hit(r.showDate) ||
            (q === "nan" && !!(r.isNan || r.qualifierProgram === "nan")) ||
            (q === "card" && !!(r.isNan || r.qualifierProgram)),
    );
}
