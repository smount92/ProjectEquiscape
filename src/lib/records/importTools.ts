/**
 * The two things a professional importer adds around the parser:
 * header mapping (someone else's spreadsheet, not our template) and
 * duplicate detection (the same placing imported twice). Pure.
 */
import { type ImportedRecord, matchHeader, TEMPLATE_COLUMNS } from "@/lib/records/import";

/** File header → template key, or "" for "ignore this column". */
export type HeaderMap = Record<string, keyof ImportedRecord | "">;

/** Our best guess for each header in the file; "" when nothing matches. */
export function guessHeaderMap(headers: readonly string[]): HeaderMap {
    const map: HeaderMap = {};
    const taken = new Set<keyof ImportedRecord>();
    for (const h of headers) {
        const key = matchHeader(h);
        if (key && !taken.has(key)) {
            map[h] = key;
            taken.add(key);
        } else {
            map[h] = "";
        }
    }
    return map;
}

/** Rewrite rows so their keys are the template's own headers, per the map. */
export function applyHeaderMap(rows: Record<string, string>[], map: HeaderMap): Record<string, string>[] {
    const headerFor = new Map<keyof ImportedRecord, string>(TEMPLATE_COLUMNS.map((c) => [c.key, c.header]));
    return rows.map((row) => {
        const out: Record<string, string> = {};
        for (const [fileHeader, key] of Object.entries(map)) {
            if (!key) continue;
            const header = headerFor.get(key);
            if (!header) continue;
            const value = row[fileHeader];
            if (value !== undefined && value !== null && String(value).trim() !== "") out[header] = String(value);
            else if (!(header in out)) out[header] = "";
        }
        return out;
    });
}

/** True when every required template column has a source in the map. */
export function mapHasRequired(map: HeaderMap): boolean {
    const mapped = new Set(Object.values(map).filter(Boolean));
    return TEMPLATE_COLUMNS.filter((c) => c.required).every((c) => mapped.has(c.key));
}

/** What makes two placings "the same": show, date, class and placing, case- and space-insensitive. */
export interface RecordFingerprintInput {
    showName: string | null | undefined;
    showDate: string | null | undefined;
    className: string | null | undefined;
    placing: string | null | undefined;
}

const fold = (v: string | null | undefined) => (v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function recordFingerprint(r: RecordFingerprintInput): string {
    return [fold(r.showName), (r.showDate ?? "").slice(0, 10), fold(r.className), fold(r.placing)].join("|");
}

/** Row numbers of the parsed records that already exist on the horse, or repeat within the file. */
export function findDuplicates(
    parsed: readonly { rowNumber: number; record: ImportedRecord }[],
    existing: readonly RecordFingerprintInput[],
): Set<number> {
    const seen = new Set(existing.map(recordFingerprint));
    const dupes = new Set<number>();
    for (const { rowNumber, record } of parsed) {
        const fp = recordFingerprint(record);
        if (seen.has(fp)) dupes.add(rowNumber);
        else seen.add(fp);
    }
    return dupes;
}

/** localStorage key for a remembered mapping, keyed by the file's header set. */
export function headerMapStorageKey(headers: readonly string[]): string {
    return `mhh.results-import.map:${[...headers].map((h) => h.trim().toLowerCase()).sort().join("|")}`;
}
