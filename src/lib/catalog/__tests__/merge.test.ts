import { describe, it, expect, vi } from "vitest";
import { MERGE_REPOINTS, mergeCatalogItemsCore, resolveCatalogRef, type MergeClient } from "@/lib/catalog/merge";

const DUP = { id: "11111111-1111-4111-8111-111111111111", title: "Adios (dup)", maker: "Breyer" };
const KEEP = { id: "22222222-2222-4222-8222-222222222222", title: "Adios", maker: "Breyer" };

/** A client that records every repoint and delete. */
function client(opts: { movedPerTable?: number; failTable?: string } = {}) {
    const updates: [string, Record<string, unknown>, string][] = [];
    const inserted: Record<string, unknown>[] = [];
    const deleted: string[] = [];
    const admin: MergeClient = {
        from: (table) => ({
            select: () => ({
                eq: (col, val) => ({
                    maybeSingle: async () => ({ data: val === KEEP.id || val === "adios" ? KEEP : null }),
                }),
            }),
            update: (row) => ({
                eq: (col, val) => ({
                    select: async () => {
                        updates.push([table, row, val]);
                        if (opts.failTable === table) return { data: null, error: { message: "boom" } };
                        return { data: Array.from({ length: opts.movedPerTable ?? 1 }, (_, i) => ({ id: `${i}` })), error: null };
                    },
                }),
            }),
            insert: async (row) => {
                inserted.push(row);
                return { error: null };
            },
            delete: () => ({
                eq: async (_col, val) => {
                    deleted.push(val);
                    return { error: null };
                },
            }),
        }),
    };
    return { admin, updates, inserted, deleted };
}

describe("mergeCatalogItemsCore", () => {
    it("repoints every reference table, logs, then deletes the duplicate", async () => {
        const c = client({ movedPerTable: 2 });
        const result = await mergeCatalogItemsCore(c.admin, DUP, KEEP, { userId: "u", alias: "Admin" });
        expect(result.success).toBe(true);
        expect(c.updates.map(([t]) => t)).toEqual(MERGE_REPOINTS.map(([t]) => t));
        for (const [, row, from] of c.updates) {
            expect(Object.values(row)).toEqual([KEEP.id]);
            expect(from).toBe(DUP.id);
        }
        expect(c.inserted[0]).toMatchObject({ catalog_item_id: KEEP.id, change_type: "removal", contributor_alias: "Admin" });
        expect(c.deleted).toEqual([DUP.id]);
        if (result.success) expect(result.moved).toBe(2 * MERGE_REPOINTS.length);
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
