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

type Done = { error: { message: string } | null };

export interface MergeClient {
    from: (table: string) => {
        select: (cols: string) => {
            eq: (
                col: string,
                val: string,
            ) => PromiseLike<{ data: unknown; error?: unknown }> & {
                maybeSingle: () => Promise<{ data: unknown; error?: unknown }>;
            };
        };
        update: (row: Record<string, unknown>) => {
            eq: (
                col: string,
                val: string,
            ) => { select: (cols: string) => Promise<{ data: unknown; error: { message: string } | null }> };
        };
        insert: (row: Record<string, unknown>) => Promise<Done>;
        upsert: (row: Record<string, unknown>, options: { onConflict: string }) => PromiseLike<Done>;
        delete: () => {
            eq: (
                col: string,
                val: string,
            ) => PromiseLike<Done> & { in: (col: string, vals: string[]) => PromiseLike<Done> };
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
        .select("id, title, maker, maker_slug, slug")
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

    // A member who wants both entries would end up with two want-list rows
    // for one model, which the database refuses (migration 233). Their row
    // on the kept entry stays; the duplicate's goes.
    const wanters = async (id: string) => {
        const { data } = await admin.from("user_wishlists").select("user_id").eq("catalog_id", id);
        return new Set(((data as { user_id: string }[] | null) ?? []).map((r) => r.user_id));
    };
    const keepWanters = await wanters(canonical.id);
    const both = [...(await wanters(dup.id))].filter((u) => keepWanters.has(u));
    if (both.length > 0) {
        const { error } = await admin.from("user_wishlists").delete().eq("catalog_id", dup.id).in("user_id", both);
        if (error) return { success: false, error: `Folding want lists failed: ${error.message}` };
    }

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

    // The duplicate's address, and any older addresses that led to it, now
    // forward to the kept entry (owner ruling Q1). Best effort: before
    // migration 233 the table is missing and the merge goes on without it.
    await admin.from("catalog_slug_history").update({ item_id: canonical.id }).eq("item_id", dup.id).select("item_id");
    if (dup.maker_slug && dup.slug) {
        await admin
            .from("catalog_slug_history")
            .upsert(
                { old_maker_slug: dup.maker_slug, old_slug: dup.slug, item_id: canonical.id },
                { onConflict: "old_maker_slug,old_slug" },
            );
    }

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
