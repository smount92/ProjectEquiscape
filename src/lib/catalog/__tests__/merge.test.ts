import { describe, it, expect } from "vitest";
import { resolveCatalogRef, type MergeClient } from "@/lib/catalog/merge";
import { MERGE_REPOINTS } from "@/lib/catalog/write";

/**
 * merge.ts now only finds the two entries; the merge itself is
 * requestMerge in write.ts (tested in write.test.ts) and, with update 243,
 * registry_merge in the database (migration-242-243.test.ts).
 */

const KEEP = { id: "22222222-2222-4222-8222-222222222222", title: "Adios", maker: "Breyer" };

function client(): MergeClient {
    return {
        from: () => ({
            select: () => ({
                eq: (_col: string, val: string) => ({
                    maybeSingle: async () => ({ data: val === KEEP.id || val === "adios" ? KEEP : null }),
                }),
            }),
        }),
    };
}

describe("resolveCatalogRef", () => {
    it("resolves a uuid or a slug", async () => {
        expect(await resolveCatalogRef(client(), KEEP.id)).toEqual(KEEP);
        expect(await resolveCatalogRef(client(), "Adios")).toEqual(KEEP);
        expect(await resolveCatalogRef(client(), "  ")).toBeNull();
    });
});

describe("the one-way merge's list of links (before 243)", () => {
    it("moves member sale reports and price flags too, which the old merge deleted", () => {
        const tables = MERGE_REPOINTS.map(([t]) => t);
        expect(tables).toContain("catalog_sale_reports");
        expect(tables).toContain("catalog_price_signal_flags");
        expect(tables).toEqual(
            expect.arrayContaining([
                "user_horses",
                "user_wishlists",
                "id_suggestions",
                "catalog_suggestions",
                "catalog_changelog",
                "catalog_items",
            ]),
        );
    });
});
