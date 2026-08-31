/**
 * Shows domain — SCORED JUDGING rubrics (205). Pure, no I/O.
 *
 * The owner's brief: entries "graded on a scale, not on a judge's
 * whim." A rubric is five weighted criteria; a score sheet is
 * {criterionKey: 1..10}; the weighted total is 0–100. Totals PRE-SORT
 * the ribbon tray — scores inform, the judge places. Ties are
 * flagged, never coin-flipped.
 *
 * Templates follow the class's division axis (the vocabulary the
 * show system already speaks) plus a Themed ladder for specials.
 * They are STARTING POINTS: the chosen template is denormalized onto
 * the class row, so what a class was judged against never changes
 * underneath it.
 */

import type { DivisionAxis } from "./types";

export interface RubricCriterion {
    key: string;
    label: string;
    /** Percent, all criteria in a rubric sum to 100. */
    weight: number;
    help?: string;
}

export interface Rubric {
    key: string;
    name: string;
    criteria: RubricCriterion[];
}

/** Tap-scale bounds. */
export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

/**
 * The anchor bands — what each number MEANS, so a 7 at entry #2 is a
 * 7 at entry #38. Rendered beside every score pad.
 */
export const SCORE_ANCHORS = [
    { from: 1, to: 3, label: "Developing", help: "the fundamentals aren't there yet" },
    { from: 4, to: 6, label: "Solid", help: "competent work with visible gaps" },
    { from: 7, to: 8, label: "Excellent", help: "holds up under close inspection" },
    { from: 9, to: 10, label: "Exceptional", help: "among the best you've judged" },
] as const;

export function anchorFor(score: number): (typeof SCORE_ANCHORS)[number] | null {
    return SCORE_ANCHORS.find((a) => score >= a.from && score <= a.to) ?? null;
}

/** The templates, in the hobby's own words. */
export const RUBRIC_TEMPLATES: readonly Rubric[] = [
    {
        key: "halter",
        name: "Halter (breed)",
        criteria: [
            { key: "breed_type", label: "Breed type & character", weight: 25, help: "does the model read as the breed" },
            { key: "conformation", label: "Conformation & anatomy", weight: 20 },
            { key: "color", label: "Color & markings realism", weight: 20 },
            { key: "condition", label: "Condition & finish", weight: 15 },
            { key: "presentation", label: "Presentation (photo)", weight: 20, help: "focus, lighting, footing, the horse shown to advantage" },
        ],
    },
    {
        key: "workmanship",
        name: "Workmanship",
        criteria: [
            { key: "paintwork", label: "Paintwork & realism", weight: 30 },
            { key: "pattern", label: "Color / pattern accuracy", weight: 20 },
            { key: "prep", label: "Prep & smoothness", weight: 20 },
            { key: "detail", label: "Detailing (eyes, hooves, shading)", weight: 20 },
            { key: "presentation", label: "Presentation (photo)", weight: 10 },
        ],
    },
    {
        key: "performance",
        name: "Performance",
        criteria: [
            { key: "setup", label: "Setup correctness & believability", weight: 30 },
            { key: "tack", label: "Tack fit & appropriateness", weight: 25 },
            { key: "suitability", label: "Horse suitability & position", weight: 20 },
            { key: "scene", label: "Doll, props & scene", weight: 15 },
            { key: "documentation", label: "Documentation & photo", weight: 10 },
        ],
    },
    {
        key: "collectibility",
        name: "Collectibility",
        criteria: [
            { key: "rarity", label: "Rarity & desirability", weight: 30 },
            { key: "condition", label: "Condition", weight: 30 },
            { key: "provenance", label: "Provenance & completeness", weight: 20, help: "a verified Hoofprint counts" },
            { key: "presentation", label: "Presentation (photo)", weight: 20 },
        ],
    },
    {
        key: "themed",
        name: "Themed / specials",
        criteria: [
            { key: "theme", label: "Theme & imagination", weight: 30 },
            { key: "execution", label: "Concept execution", weight: 25 },
            { key: "craft", label: "Craftsmanship", weight: 20 },
            { key: "presentation", label: "Presentation & story", weight: 15 },
            { key: "condition", label: "Finish & condition", weight: 10 },
        ],
    },
] as const;

export function rubricTemplate(key: string): Rubric | null {
    return RUBRIC_TEMPLATES.find((r) => r.key === key) ?? null;
}

/** The default template for a class, by its division axis. */
export function templateForAxis(axis: DivisionAxis): Rubric {
    const direct = rubricTemplate(axis);
    if (direct) return direct;
    // "other" and anything unknown: the themed ladder generalizes best.
    return rubricTemplate("themed")!;
}

/** Runtime shape-check for a rubric read back from the class row. */
export function parseRubric(raw: unknown): Rubric | null {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as { key?: unknown; name?: unknown; criteria?: unknown };
    if (typeof r.key !== "string" || typeof r.name !== "string" || !Array.isArray(r.criteria)) {
        return null;
    }
    const criteria: RubricCriterion[] = [];
    for (const c of r.criteria) {
        const cc = c as { key?: unknown; label?: unknown; weight?: unknown; help?: unknown };
        if (typeof cc.key !== "string" || typeof cc.label !== "string" || typeof cc.weight !== "number") {
            return null;
        }
        criteria.push({
            key: cc.key,
            label: cc.label,
            weight: cc.weight,
            help: typeof cc.help === "string" ? cc.help : undefined,
        });
    }
    if (criteria.length < 3) return null;
    return { key: r.key, name: r.name, criteria };
}

export type ScoreSheet = Record<string, number>;

/** Only the rubric's keys, only integers in band. */
export function cleanScores(rubric: Rubric, raw: Record<string, unknown>): ScoreSheet {
    const out: ScoreSheet = {};
    for (const c of rubric.criteria) {
        const v = raw[c.key];
        if (typeof v === "number" && Number.isInteger(v) && v >= SCORE_MIN && v <= SCORE_MAX) {
            out[c.key] = v;
        }
    }
    return out;
}

export function isComplete(rubric: Rubric, scores: ScoreSheet): boolean {
    return rubric.criteria.every((c) => typeof scores[c.key] === "number");
}

/**
 * Weighted total on the 0–100 scale, one decimal. Null until every
 * criterion is scored — a partial sheet must never rank.
 */
export function weightedTotal(rubric: Rubric, scores: ScoreSheet): number | null {
    if (!isComplete(rubric, scores)) return null;
    let sum = 0;
    for (const c of rubric.criteria) sum += scores[c.key] * c.weight;
    // Integer scores × integer weights: sum/10 is exact to one decimal.
    return sum / 10;
}

export interface ScoredEntry {
    entryId: string;
    total: number;
}

/**
 * The tray suggestion: entries ranked by total, descending, with tie
 * groups marked. Ties are the JUDGE's to break — the suggestion
 * carries the flag so the UI can say so.
 */
export function orderByScore(
    entries: readonly { entryId: string; total: number | null }[],
): { entryId: string; total: number; tiedWithPrev: boolean }[] {
    const scored = entries
        .filter((e): e is ScoredEntry => e.total != null)
        .sort((a, b) => b.total - a.total || a.entryId.localeCompare(b.entryId));
    return scored.map((e, i) => ({
        entryId: e.entryId,
        total: e.total,
        tiedWithPrev: i > 0 && scored[i - 1].total === e.total,
    }));
}

/** Per-criterion class averages, for the scorecard's dashed polygon. */
export function classAverages(
    rubric: Rubric,
    sheets: readonly ScoreSheet[],
): Record<string, number> {
    const out: Record<string, number> = {};
    for (const c of rubric.criteria) {
        const vals = sheets.map((s) => s[c.key]).filter((v): v is number => typeof v === "number");
        if (vals.length > 0) {
            out[c.key] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
        }
    }
    return out;
}
