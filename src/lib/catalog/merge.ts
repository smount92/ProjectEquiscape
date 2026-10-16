/**
 * Finding the two entries of a merge from what a person typed: an id or a
 * page slug.
 *
 * The merge itself lives in src/lib/catalog/write.ts (requestMerge), the
 * only writer of the Registry: with update 243 it runs as one database
 * transaction (registry_merge) that saves every moved link so the merge
 * can be undone for 30 days; before 243 the owner gets the old one-way
 * merge there (legacyMerge).
 */

export interface MergeClient {
    from: (table: string) => {
        select: (cols: string) => {
            eq: (
                col: string,
                val: string,
            ) => {
                maybeSingle: () => PromiseLike<{ data: unknown; error?: unknown }>;
            };
        };
    };
}

export interface MergeRef {
    id: string;
    title: string;
    maker: string | null;
    /** The page address, so the duplicate's old link can forward (migration 233). */
    maker_slug?: string | null;
    slug?: string | null;
}

/** Resolve a UUID or slug to a catalog row, or null. */
export async function resolveCatalogRef(admin: MergeClient, ref: string): Promise<MergeRef | null> {
    const clean = ref.trim();
    if (!clean) return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
    const { data } = await admin
        .from("catalog_items")
        .select("id, title, maker, maker_slug, slug")
        .eq(isUuid ? "id" : "slug", isUuid ? clean : clean.toLowerCase())
        .maybeSingle();
    return (data as MergeRef | null) ?? null;
}
