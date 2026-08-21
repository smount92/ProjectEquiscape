/**
 * First-party object metrics — the entity vocabulary.
 *
 * THE RULE THIS WHOLE SUBSYSTEM EXISTS TO KEEP: we count OBJECTS, not
 * people. Every write ends up as a row in `object_view_daily`
 * (entity_type, entity_id, day, views, unique_viewers). There is no table
 * anywhere that answers "what did member X look at" — the per-viewer state
 * needed to compute `unique_viewers` is a hashed, daily-salted scratch row
 * that the nightly GC deletes (see cleanup_system_garbage, migration 175).
 *
 * Adding a new entity type is a two-line change here PLUS a matching entry
 * in the CHECK constraint / allow-list inside migration 175 — the route
 * handler validates against this list and the RPC validates again, so a
 * type that is not in both places is simply dropped.
 */

/** The allow-list. Anything not in here is rejected by the beacon route. */
export const ENTITY_TYPES = [
    "horse",
    "listing",
    "show",
    "barn",
    "studio",
    "reference",
    "profile",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

/** Narrowing guard used by the beacon route before anything touches the DB. */
export function isEntityType(value: unknown): value is EntityType {
    return typeof value === "string" && (ENTITY_TYPES as readonly string[]).includes(value);
}

/**
 * Entity ids are stored as TEXT so one table can hold uuids (horses,
 * shows, barns, catalog items, profiles) and the odd stable non-uuid key
 * without a polymorphic mess. They are opaque to this module; the only
 * requirement is that the same object always sends the same string.
 *
 * Bounded on the way in — an id is a primary key, never a payload.
 */
export const MAX_ENTITY_ID_LENGTH = 64;

export function isValidEntityId(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value.length > 0 &&
        value.length <= MAX_ENTITY_ID_LENGTH &&
        // Keys only: uuids, slugs, numeric ids. No spaces, no punctuation
        // that could hint at free text being smuggled into the rollup.
        /^[A-Za-z0-9_-]+$/.test(value)
    );
}

/** Singular/plural labels for the admin Insights tab. */
export const ENTITY_LABELS: Record<EntityType, { one: string; many: string; emoji: string }> = {
    horse: { one: "Horse", many: "Horses", emoji: "🐴" },
    listing: { one: "Listing", many: "Listings", emoji: "🏷️" },
    show: { one: "Show", many: "Shows", emoji: "📸" },
    barn: { one: "Barn", many: "Barns", emoji: "🏚️" },
    studio: { one: "Studio", many: "Studios", emoji: "🎨" },
    reference: { one: "Reference", many: "Reference pages", emoji: "📚" },
    profile: { one: "Profile", many: "Profiles", emoji: "👤" },
};

/**
 * Where an entity lives, for the admin's "most viewed" links. `studio`
 * and `barn` are keyed by uuid but routed by slug, so the resolver in
 * lib/metrics/resolve.ts supplies the href for those two and this map
 * covers the rest.
 */
export function entityHref(type: EntityType, id: string): string | null {
    switch (type) {
        case "horse":
        case "listing":
            return `/community/${id}`;
        case "show":
            return `/shows/${id}`;
        default:
            // barn/studio/reference/profile need a slug or alias lookup.
            return null;
    }
}
