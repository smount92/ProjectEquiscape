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

// Real (top-level) columns on catalog_items. Anything else in a correction's
// field_changes is an `attributes` JSONB key.
export const CATALOG_REAL_COLUMNS = new Set([
    "title",
    "maker",
    "scale",
    "item_type",
    "parent_id",
]);

// Attribute keys a Silver curator (50+ approved) may auto-approve corrections
// to. These are the exact `attributes` JSONB keys SuggestEditModal emits in
// field_changes (SuggestEditModal keys attribute edits by their raw attribute
// name) — NOT human labels like "color"/"year".
export const SILVER_AUTO_FIELDS = new Set([
    "color_description",
    "release_year_start",
    "production_run",
    "release_date",
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
