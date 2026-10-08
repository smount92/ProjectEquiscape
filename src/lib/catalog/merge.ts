/**
 * Merging two registry entries — the one procedure, whoever triggers
 * it: the admin "merge" button (actions/admin.ts) or an approved
 * duplicate report (actions/catalog-suggestions.ts).
 *
 * Repoints every reference (horses, wishlists, id-suggestions, catalog
 * suggestions, changelog, child molds) from the duplicate to the kept
 * entry, logs to the changelog, then deletes the duplicate. Runs on the
 * service-role client the caller has already authorised.
 */

export interface MergeClient {
    from: (table: string) => {
        select: (cols: string) => {
            eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: unknown; error?: unknown }> };
        };
        update: (row: Record<string, unknown>) => {
            eq: (col: string, val: string) => { select: (cols: string) => Promise<{ data: unknown; error: { message: string } | null }> };
        };
        insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
        delete: () => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> };
    };
}

export interface MergeRef {
    id: string;
    title: string;
    maker: string | null;
}

export type MergeResult =
    | { success: true; summary: string; moved: number; kept: MergeRef; removed: MergeRef }
    | { success: false; error: string };

/** Tables whose rows point at a catalog item, in the order they are moved. */
export const MERGE_REPOINTS: [table: string, column: string][] = [
    ["user_horses", "catalog_id"],
    ["user_wishlists", "catalog_id"],
    ["id_suggestions", "catalog_id"],
    ["catalog_suggestions", "catalog_item_id"],
    ["catalog_changelog", "catalog_item_id"],
    ["catalog_items", "parent_id"],
];

/** Resolve a UUID or slug to a catalog row, or null. */
export async function resolveCatalogRef(admin: MergeClient, ref: string): Promise<MergeRef | null> {
    const clean = ref.trim();
    if (!clean) return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
    const { data } = await admin
        .from("catalog_items")
        .select("id, title, maker, slug")
        .eq(isUuid ? "id" : "slug", isUuid ? clean : clean.toLowerCase())
        .maybeSingle();
    return (data as MergeRef | null) ?? null;
}

export async function mergeCatalogItemsCore(
    admin: MergeClient,
    dup: MergeRef,
    canonical: MergeRef,
    actor: { userId: string; alias: string },
    onLogError?: (error: { message: string }) => void,
): Promise<MergeResult> {
    if (dup.id === canonical.id) return { success: false, error: "Those are the same entry." };

    let moved = 0;
    for (const [table, column] of MERGE_REPOINTS) {
        const { data, error } = await admin
            .from(table)
            .update({ [column]: canonical.id })
            .eq(column, dup.id)
            .select("id");
        if (error) return { success: false, error: `Repointing ${table}.${column} failed: ${error.message}` };
        moved += Array.isArray(data) ? data.length : 0;
    }

    const { error: logError } = await admin.from("catalog_changelog").insert({
        catalog_item_id: canonical.id,
        change_type: "removal",
        change_summary: `Merged duplicate "${dup.title}" (${dup.maker ?? "unknown"}) into "${canonical.title}" — references repointed.`,
        contributed_by: actor.userId,
        contributor_alias: actor.alias,
        approved_by: actor.userId,
    });
    if (logError) onLogError?.(logError);

    const { error: deleteError } = await admin.from("catalog_items").delete().eq("id", dup.id);
    if (deleteError) return { success: false, error: `Delete failed: ${deleteError.message}` };

    return {
        success: true,
        moved,
        kept: canonical,
        removed: dup,
        summary: `Merged "${dup.title}" into "${canonical.title}" — ${moved} reference${moved === 1 ? "" : "s"} repointed.`,
    };
}
