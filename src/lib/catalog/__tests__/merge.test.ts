import { describe, it, expect, vi } from "vitest";
import { MERGE_REPOINTS, mergeCatalogItemsCore, resolveCatalogRef, type MergeClient } from "@/lib/catalog/merge";

const DUP = { id: "11111111-1111-4111-8111-111111111111", title: "Adios (dup)", maker: "Breyer" };
const KEEP = { id: "22222222-2222-4222-8222-222222222222", title: "Adios", maker: "Breyer" };

/** A client that records every repoint and delete. */
function client(
    opts: { movedPerTable?: number; failTable?: string; wishlists?: { user_id: string; catalog_id: string }[] } = {},
) {
    const updates: [string, Record<string, unknown>, string][] = [];
    const inserted: Record<string, unknown>[] = [];
    const upserted: Record<string, unknown>[] = [];
    const deleted: string[] = [];
    const wishlistDeletes: { catalogId: string; userIds: string[] }[] = [];
    const done = { error: null };
    const admin: MergeClient = {
        from: (table) => ({
            select: () => ({
                eq: (col, val) => {
                    const rows =
                        table === "user_wishlists" ? (opts.wishlists ?? []).filter((w) => w.catalog_id === val) : [];
                    return {
                        then: (resolve: (v: { data: unknown }) => unknown) =>
                            Promise.resolve({ data: rows }).then(resolve),
                        maybeSingle: async () => ({ data: val === KEEP.id || val === "adios" ? KEEP : null }),
                    };
                },
            }),
            update: (row) => ({
                eq: (col, val) => ({
                    select: async () => {
                        updates.push([table, row, val]);
                        if (opts.failTable === table) return { data: null, error: { message: "boom" } };
                        return {
                            data: Array.from({ length: opts.movedPerTable ?? 1 }, (_, i) => ({ id: `${i}` })),
                            error: null,
                        };
                    },
                }),
            }),
            insert: async (row) => {
                inserted.push(row);
                return done;
            },
            upsert: async (row) => {
                upserted.push(row);
                return done;
            },
            delete: () => ({
                eq: (_col, val) => ({
                    then: (resolve: (v: typeof done) => unknown) => {
                        if (table === "catalog_items") deleted.push(val);
                        return Promise.resolve(done).then(resolve);
                    },
                    in: async (_c: string, userIds: string[]) => {
                        wishlistDeletes.push({ catalogId: val, userIds });
                        return done;
                    },
                }),
            }),
        }),
    };
    return { admin, updates, inserted, upserted, deleted, wishlistDeletes };
}

describe("mergeCatalogItemsCore", () => {
    it("repoints every reference table, logs, then deletes the duplicate", async () => {
        const c = client({ movedPerTable: 2 });
        const result = await mergeCatalogItemsCore(c.admin, DUP, KEEP, { userId: "u", alias: "Admin" });
        expect(result.success).toBe(true);
        // Every reference table, then the old-address history (migration 233).
        expect(c.updates.map(([t]) => t)).toEqual([...MERGE_REPOINTS.map(([t]) => t), "catalog_slug_history"]);
        for (const [, row, from] of c.updates) {
            expect(Object.values(row)).toEqual([KEEP.id]);
            expect(from).toBe(DUP.id);
        }
        expect(c.inserted[0]).toMatchObject({
            catalog_item_id: KEEP.id,
            change_type: "removal",
            contributor_alias: "Admin",
        });
        expect(c.deleted).toEqual([DUP.id]);
        if (result.success) expect(result.moved).toBe(2 * MERGE_REPOINTS.length);
    });

    it("records the duplicate's address so its old link forwards to the kept entry", async () => {
        const c = client();
        const dup = { ...DUP, maker_slug: "breyer", slug: "silky-sullivan" };
        const result = await mergeCatalogItemsCore(c.admin, dup, KEEP, { userId: "u", alias: "Admin" });
        expect(result.success).toBe(true);
        expect(c.upserted).toContainEqual({ old_maker_slug: "breyer", old_slug: "silky-sullivan", item_id: KEEP.id });
    });

    it("drops the duplicate's want-list row when the member already wants the kept entry", async () => {
        const c = client({
            wishlists: [
                { user_id: "both", catalog_id: DUP.id },
                { user_id: "both", catalog_id: KEEP.id },
                { user_id: "dup-only", catalog_id: DUP.id },
            ],
        });
        const result = await mergeCatalogItemsCore(c.admin, DUP, KEEP, { userId: "u", alias: "Admin" });
        expect(result.success).toBe(true);
        expect(c.wishlistDeletes).toEqual([{ catalogId: DUP.id, userIds: ["both"] }]);
    });

    it("records who approved the merge, not only who reported it (MHH-070)", async () => {
        const c = client();
        await mergeCatalogItemsCore(c.admin, DUP, KEEP, { userId: "reporter", alias: "Pat", approvedBy: "owner" });
        expect(c.inserted[0]).toMatchObject({ contributed_by: "reporter", approved_by: "owner" });
    });

    it("stops before deleting when a repoint fails", async () => {
        const c = client({ failTable: "user_wishlists" });
        const result = await mergeCatalogItemsCore(c.admin, DUP, KEEP, { userId: "u", alias: "Admin" });
        expect(result.success).toBe(false);
        expect(c.deleted).toEqual([]);
    });

    it("refuses to merge an entry into itself", async () => {
        const c = client();
        const result = await mergeCatalogItemsCore(c.admin, KEEP, KEEP, { userId: "u", alias: "Admin" });
        expect(result).toEqual({ success: false, error: "Those are the same entry." });
        expect(c.updates).toEqual([]);
    });

    it("resolves a uuid or a slug", async () => {
        const c = client();
        expect(await resolveCatalogRef(c.admin, KEEP.id)).toEqual(KEEP);
        expect(await resolveCatalogRef(c.admin, "Adios")).toEqual(KEEP);
        expect(await resolveCatalogRef(c.admin, "  ")).toBeNull();
    });
});
