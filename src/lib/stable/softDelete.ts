/**
 * Soft-delete bookkeeping for the Recently Deleted shelf.
 *
 * `deleteHorse` scrubs `custom_name` to "[Deleted]" so the name can never
 * surface from the surviving provenance row. That scrub is deliberate and
 * stays — but it used to be irreversible, which is why deleting the wrong
 * horse had no recourse. The original name is now stashed in the
 * `attributes` JSONB bag under a namespaced key first, so `restoreHorse`
 * can put it back.
 *
 * The key is namespaced with `mhh:` precisely so it can never collide with
 * a category attribute: `cleanAttributeBag` strips every key the category
 * doesn't own, and no `FieldSpec.attributeKey` contains a colon. Nothing
 * renders it either — `AssetDetailRenderer` reads a fixed list of keys per
 * category, so an unknown key is invisible rather than leaked.
 */

/** Where `deleteHorse` parks the pre-scrub name. */
export const DELETED_NAME_KEY = "mhh:deleted_name";

/** The placeholder `deleteHorse` writes over `custom_name`. */
export const DELETED_NAME_PLACEHOLDER = "[Deleted]";

type Bag = Record<string, unknown> | null | undefined;

/**
 * Merge the pre-scrub name into the attributes bag. Returns a new object —
 * the caller writes it in the same UPDATE that performs the scrub, so the
 * name is never on disk unscrubbed-and-unreachable.
 */
export function stashDeletedName(attributes: Bag, name: string | null): Record<string, unknown> {
    const bag: Record<string, unknown> = { ...(attributes ?? {}) };
    const trimmed = (name ?? "").trim();
    // Nothing worth stashing: an already-scrubbed or empty name would only
    // restore to the same placeholder.
    if (trimmed && trimmed !== DELETED_NAME_PLACEHOLDER) {
        bag[DELETED_NAME_KEY] = trimmed;
    }
    return bag;
}

/**
 * Read the stashed name back. Returns null for horses deleted BEFORE this
 * shipped — there is nothing to recover and the UI says so rather than
 * pretending "[Deleted]" was a name.
 */
export function readStashedName(attributes: Bag): string | null {
    const raw = (attributes ?? {})[DELETED_NAME_KEY];
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    return trimmed ? trimmed : null;
}

/** Drop the stash — restore has consumed it and the row is live again. */
export function clearStashedName(attributes: Bag): Record<string, unknown> {
    const bag: Record<string, unknown> = { ...(attributes ?? {}) };
    delete bag[DELETED_NAME_KEY];
    return bag;
}
