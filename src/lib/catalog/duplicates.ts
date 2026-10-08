/**
 * Duplicate reports — what one is, in one place.
 *
 * A duplicate report is a registry suggestion filed FROM the entry to
 * remove (catalog_item_id) that names the entry to keep
 * (field_changes.duplicate_of). Approving it merges the two: every
 * reference moves to the kept entry and the duplicate is deleted
 * (lib/catalog/merge). The suggestion form, the server action and the
 * review screens all read the shape through here.
 */

export const DUPLICATE_SUGGESTION_TYPE = "duplicate";

/** What a duplicate report carries in field_changes. */
export interface DuplicateFieldChanges {
    /** The entry to KEEP. */
    duplicate_of: string;
    /** Its title at the time of filing, for the review screens. */
    duplicate_of_title?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Read a duplicate report's target out of field_changes, or null. */
export function duplicateTarget(fieldChanges: unknown): DuplicateFieldChanges | null {
    if (!fieldChanges || typeof fieldChanges !== "object") return null;
    const f = fieldChanges as Record<string, unknown>;
    if (typeof f.duplicate_of !== "string" || !UUID.test(f.duplicate_of)) return null;
    return {
        duplicate_of: f.duplicate_of,
        duplicate_of_title: typeof f.duplicate_of_title === "string" ? f.duplicate_of_title : undefined,
    };
}

/**
 * Why a duplicate report cannot be filed, or null when it can. Pure;
 * existence of the two entries is the action's check.
 */
export function duplicateReportRefusal(input: {
    catalogItemId: string | null | undefined;
    fieldChanges: unknown;
}): string | null {
    if (!input.catalogItemId) return "Report a duplicate from the entry you think should go.";
    const target = duplicateTarget(input.fieldChanges);
    if (!target) return "Pick the entry this one duplicates.";
    if (target.duplicate_of === input.catalogItemId) return "Those are the same entry.";
    return null;
}

/** The "needs migration 228" notice when the database refuses the new type. */
export const DUPLICATE_MIGRATION_NOTICE =
    "Duplicate reports need a database update (migration 228) before they can be filed — message the owner for now.";

/** PostgREST surfaces a CHECK violation as 23514. */
export function isMissingDuplicateType(error: { code?: string; message?: string } | null | undefined): boolean {
    return !!error && error.code === "23514" && (error.message ?? "").includes("suggestion_type");
}
