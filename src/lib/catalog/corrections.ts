/**
 * Reference Catalog — applying approved corrections.
 *
 * catalog_items is polymorphic: only a handful of real columns exist on the
 * table; every other descriptive field (color_description, model_number,
 * cast_medium, release_year_start, material, …) lives inside the `attributes`
 * JSONB (see migration 048). An approved correction's field_changes therefore
 * has to be split: real columns are set top-level, attribute keys are merged
 * into the existing attributes JSONB — never written as unknown top-level
 * columns (which errors or silently misses the intended attribute).
 *
 * Pure functions only (no Supabase) so they are directly unit-testable and
 * shared by the server action. Mirrors src/lib/catalog/filterParams.ts.
 */

import { CATALOG_GENDERS, RUN_TYPES } from "@/lib/catalog/taxonomy";
import { MATERIAL_OPTIONS } from "@/lib/catalog/editableFields";

// Real (top-level) columns on catalog_items. Anything else in a correction's
// field_changes is an `attributes` JSONB key.
export const CATALOG_REAL_COLUMNS = new Set([
    "title",
    "maker",
    "scale",
    "item_type",
    "parent_id",
    // Attribution split (migration 156).
    "artist",
    "manufacturer",
]);

/**
 * The curator ladder's thresholds — exported so tests and UI copy read the
 * same numbers as the decision itself.
 *
 * RECALIBRATED 2026-08-23. The original bars were 50 and 200, set against
 * an imagined community: after months live, the top contributor (the
 * co-owner) had 30 approvals and the best outside contributor 15, so the
 * ladder had never fired once and, at observed rates, never would this
 * year. A trust system nobody can reach is indistinguishable from no
 * trust system. 10 makes Silver a real milestone an active member reaches
 * in weeks (the best outside contributor qualifies today at 15); 50 makes
 * Gold a long-haul earned rank. Ten HUMAN-approved suggestions is still a
 * real bar on a site this size — every one was reviewed by an admin.
 */
export const CONTRIBUTOR_THRESHOLD = 1;
export const BRONZE_THRESHOLD = 5;
export const SILVER_THRESHOLD = 10;
export const GOLD_THRESHOLD = 50;

// Attribute keys a Silver curator may auto-approve corrections to. These
// are the exact `attributes` JSONB keys SuggestEditModal emits in
// field_changes — NOT human labels like "color"/"year".
//
// REBUILT 2026-08-23: the previous list was half dead keys. It named
// `production_run` and `release_date`, which exist on zero of 10,945 rows
// — the real keys are `run_count` and `release_year_start/_end` — so half
// of the allowlist could never match a real correction. Nothing catches a
// Set of strings going stale; the test now cross-checks this list against
// the editable-field registry.
//
// Deliberately NOT listed: the identity fields (title, maker, scale,
// item_type — real columns, so they fail the every() anyway), and
// mold_name/sculptor, which re-attribute the sculpture itself. Facts get
// the fast path; identity waits for a human.
export const SILVER_AUTO_FIELDS = new Set([
    "color_description",
    "model_number",
    "release_year_start",
    "release_year_end",
    "run_type",
    "run_count",
    "retail_price",
    "material",
    "breed",
    "gender",
]);

type FieldChange = { from?: unknown; to: unknown };

/**
 * Split an approved correction's field_changes into real-column updates and a
 * merged attributes object.
 *
 * `existingAttributes` is the item's current attributes JSONB (read before
 * calling); attribute changes are merged on top of it so untouched keys are
 * preserved. Returns `attributes: null` when the correction touches no
 * attribute keys, so the caller can skip reading/writing the JSONB entirely.
 */
export function buildCorrectionUpdate(
    fieldChanges: Record<string, unknown>,
    existingAttributes: Record<string, unknown> | null | undefined
): {
    columnUpdates: Record<string, unknown>;
    attributes: Record<string, unknown> | null;
} {
    const columnUpdates: Record<string, unknown> = {};
    const attributeUpdates: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(fieldChanges)) {
        if (typeof value === "object" && value !== null && "to" in value) {
            const to = (value as FieldChange).to;
            if (CATALOG_REAL_COLUMNS.has(key)) {
                columnUpdates[key] = to;
            } else {
                attributeUpdates[key] = to;
            }
        }
    }

    const attributes =
        Object.keys(attributeUpdates).length > 0
            ? { ...(existingAttributes ?? {}), ...attributeUpdates }
            : null;

    return { columnUpdates, attributes };
}

/** Does this correction touch any attribute key (i.e. needs the JSONB merge)? */
export function correctionTouchesAttributes(
    fieldChanges: Record<string, unknown>
): boolean {
    return Object.keys(fieldChanges).some((k) => !CATALOG_REAL_COLUMNS.has(k));
}

// ── Silver auto-approval: field AND value ──

/**
 * Per-field value checks for the Silver fast path.
 *
 * These exist because the CORRECTION apply path does no vocabulary
 * validation — that lives on the addition path only. While every
 * correction waited for an admin, a human was the value check; with
 * Silver auto-approval landing edits instantly, a crafted request (the
 * form itself now uses selects) could write "run_type": "whatever"
 * straight into a facet field. Auto-approval therefore requires the value
 * to be well-formed, not just the field to be trusted.
 */
const SILVER_VALUE_CHECKS: Record<string, (to: string) => boolean> = {
    color_description: (v) => v.length > 0 && v.length <= 300,
    model_number: (v) => /^[A-Za-z0-9#/\- .]{1,24}$/.test(v),
    release_year_start: (v) => /^[0-9]{4}$/.test(v) && Number(v) >= 1950 && Number(v) <= 2030,
    release_year_end: (v) => /^[0-9]{4}$/.test(v) && Number(v) >= 1950 && Number(v) <= 2030,
    run_type: (v) => (RUN_TYPES as readonly string[]).includes(v),
    run_count: (v) => /^[0-9]{1,7}$/.test(v) && Number(v) > 0,
    retail_price: (v) => /^[0-9]{1,5}([.][0-9]{1,2})?$/.test(v),
    material: (v) => (MATERIAL_OPTIONS as readonly string[]).includes(v),
    breed: (v) => v.length > 0 && v.length <= 100,
    gender: (v) => CATALOG_GENDERS.includes(v),
};

/**
 * May this correction take the Silver fast path? Every changed field must
 * be on the allowlist AND carry a value its check accepts. A failure here
 * is not a rejection — the caller files the suggestion for human review,
 * exactly as it would for an untrusted member.
 */
export function silverAutoApprovable(
    fieldChanges: Record<string, unknown>
): boolean {
    const entries = Object.entries(fieldChanges);
    if (entries.length === 0) return false;
    return entries.every(([key, value]) => {
        const check = SILVER_VALUE_CHECKS[key];
        if (!check || !SILVER_AUTO_FIELDS.has(key)) return false;
        if (typeof value !== "object" || value === null || !("to" in value)) return false;
        const to = (value as FieldChange).to;
        return typeof to === "string" && check(to.trim());
    });
}
