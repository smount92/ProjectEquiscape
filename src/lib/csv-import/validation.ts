/**
 * CSV import — client-side pre-validation.
 *
 * The batch import used to round-trip every mistake to Postgres, where a
 * single bad enum value ("Original Finish") aborted the whole transaction
 * with a raw SQL error. These pure helpers validate (and where safe,
 * normalize) rows in the browser BEFORE upload, with the user's own
 * spreadsheet row numbers, so most errors never leave the machine.
 *
 * Messages here intentionally mirror batch_import_horses_v2 (migration
 * 144), which re-validates server-side — same truth, either side.
 *
 * Pure functions only (no Supabase, no React) — unit-tested in
 * __tests__/validation.test.ts, mirrors src/lib/catalog/corrections.ts.
 */

/** Canonical finish_type enum values (migration 001). */
export const FINISH_TYPES = ["OF", "Custom", "Artist Resin"] as const;

/** Known condition grades (add-horse's CONDITION_GRADES + the default). */
export const CONDITION_GRADES = [
    "Mint",
    "Near Mint",
    "Excellent",
    "Very Good",
    "Good",
    "Body Quality",
    "Fair",
    "Poor",
    "Not Graded",
] as const;

// Common spreadsheet spellings → canonical enum value. Lowercased keys.
const FINISH_SYNONYMS: Record<string, (typeof FINISH_TYPES)[number]> = {
    of: "OF",
    "original finish": "OF",
    original: "OF",
    factory: "OF",
    custom: "Custom",
    cm: "Custom",
    customized: "Custom",
    repaint: "Custom",
    "artist resin": "Artist Resin",
    resin: "Artist Resin",
    ar: "Artist Resin",
};

const CONDITION_SYNONYMS: Record<string, (typeof CONDITION_GRADES)[number]> = {
    nm: "Near Mint",
    ex: "Excellent",
    vg: "Very Good",
    body: "Body Quality",
    ungraded: "Not Graded",
};

/**
 * Normalize a raw CSV finish value to the canonical enum.
 * Empty → "OF" (the import default). Unmappable → null (invalid).
 */
export function normalizeFinishType(raw: string): string | null {
    const trimmed = (raw ?? "").trim();
    if (!trimmed) return "OF";
    const lower = trimmed.toLowerCase();
    const exact = FINISH_TYPES.find((f) => f.toLowerCase() === lower);
    if (exact) return exact;
    return FINISH_SYNONYMS[lower] ?? null;
}

/**
 * Normalize a raw CSV condition to a known grade.
 * Empty → "Not Graded". Unmappable → null (invalid).
 */
export function normalizeCondition(raw: string): string | null {
    const trimmed = (raw ?? "").trim();
    if (!trimmed) return "Not Graded";
    const lower = trimmed.toLowerCase();
    const exact = CONDITION_GRADES.find((c) => c.toLowerCase() === lower);
    if (exact) return exact;
    return CONDITION_SYNONYMS[lower] ?? null;
}

/**
 * Normalize a raw CSV price ("$1,200.50 " → "1200.50").
 * Empty → ok with null. Non-numeric or negative → not ok.
 */
export function normalizePrice(raw: string): { ok: boolean; value: string | null } {
    const stripped = (raw ?? "").replace(/[$,\s]/g, "");
    if (!stripped) return { ok: true, value: null };
    // Two flat patterns (int / decimal) — keeps security/detect-unsafe-regex quiet.
    const isNumeric = /^-?\d+$/.test(stripped) || /^-?\d+\.\d+$/.test(stripped);
    if (!isNumeric || parseFloat(stripped) < 0) {
        return { ok: false, value: null };
    }
    return { ok: true, value: stripped };
}

export interface CsvRowInput {
    name: string;
    finish_type: string;
    condition: string;
    purchase_price: string;
    estimated_value: string;
}

export interface CsvRowError {
    /** The user's spreadsheet row number (header = row 1, first data row = 2). */
    rowNumber: number;
    name: string;
    message: string;
}

/**
 * Pre-validate mapped CSV rows. Returns plain-English errors keyed by the
 * user's spreadsheet row number (index 0 = spreadsheet row 2, after the
 * header). An empty array means every row would import cleanly.
 */
export function validateCsvRows(rows: CsvRowInput[]): CsvRowError[] {
    const errors: CsvRowError[] = [];
    rows.forEach((row, i) => {
        const rowNumber = i + 2; // header is row 1
        const name = row.name.trim() || `Row ${rowNumber}`;

        if (!row.name.trim()) {
            errors.push({ rowNumber, name, message: "Name is required — this row has no name." });
        }
        if (normalizeFinishType(row.finish_type) === null) {
            errors.push({
                rowNumber,
                name,
                message: `Finish Type must be OF, Custom, or Artist Resin — got '${row.finish_type.trim()}'.`,
            });
        }
        if (normalizeCondition(row.condition) === null) {
            errors.push({
                rowNumber,
                name,
                message: `Condition must be one of ${CONDITION_GRADES.join(", ")} — got '${row.condition.trim()}'.`,
            });
        }
        if (!normalizePrice(row.purchase_price).ok) {
            errors.push({
                rowNumber,
                name,
                message: `Purchase Price must be a number — got '${row.purchase_price.trim()}'.`,
            });
        }
        if (!normalizePrice(row.estimated_value).ok) {
            errors.push({
                rowNumber,
                name,
                message: `Estimated Value must be a number — got '${row.estimated_value.trim()}'.`,
            });
        }
    });
    return errors;
}

/**
 * Human label for a fuzzysort match score (scores are ≤ 0; 0 is exact).
 * Replaces the raw "Score: -1207" the review step used to print.
 */
export function matchScoreLabel(score: number): "Strong match" | "Possible match" {
    return score >= -50 ? "Strong match" : "Possible match";
}

/**
 * Names in the incoming CSV that already exist in the user's stable
 * (case-insensitive, trimmed). Returns each duplicated name once, in CSV
 * order, plus how many CSV rows collide — powers the "N rows match horses
 * already in your stable" warning.
 */
export function findDuplicateNames(
    csvNames: string[],
    existingNames: string[],
): { names: string[]; rowCount: number } {
    const existing = new Set(
        existingNames.map((n) => n.trim().toLowerCase()).filter(Boolean),
    );
    const seen = new Set<string>();
    const names: string[] = [];
    let rowCount = 0;
    for (const raw of csvNames) {
        const key = raw.trim().toLowerCase();
        if (!key || !existing.has(key)) continue;
        rowCount++;
        if (!seen.has(key)) {
            seen.add(key);
            names.push(raw.trim());
        }
    }
    return { names, rowCount };
}
