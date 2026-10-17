import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.generated";
import { orderForAnchor, readRegistryTerm, searchRegistry, type RegistryRow } from "@/lib/catalog/registrySearch";

function row(over: Partial<RegistryRow> & { id: string; title: string }): RegistryRow {
    return {
        item_type: "plastic_release",
        parent_id: null,
        maker: "Breyer",
        scale: "Stablemate (1:32)",
        attributes: null,
        parent_title: null,
        ...over,
    };
}

/** A client whose RPC returns `rpcRows` and whose catalog_items read returns `kids`. */
function fakeClient(rpcRows: RegistryRow[] | null, kids: RegistryRow[] = []) {
    const rpc = vi.fn(async () => (rpcRows ? { data: rpcRows, error: null } : { data: null, error: { message: "x" } }));
    const chain = {
        select: () => chain,
        in: () => chain,
        eq: () => chain,
        limit: async () => ({ data: kids, error: null }),
    };
    const client = { rpc, from: () => chain } as unknown as SupabaseClient<Database>;
    return { client, rpc };
}

describe("searchRegistry (MHH-076)", () => {
    it("reads the term the way the Registry page does", () => {
        expect(readRegistryTerm("SM G1 Arabian Stallion").term).toBe("Arabian Stallion");
        expect(readRegistryTerm("Breyer Adios")).toMatchObject({ term: "Adios", maker: "Breyer" });
        expect(readRegistryTerm('"Horspital" Play Set').term).toBe('"Horspital" Play Set');
    });

    it("sends the name as typed, brings a named mold's releases under it, and puts roster-only sets last", async () => {
        const { client, rpc } = fakeClient(
            [
                row({
                    id: "set",
                    title: "Stablemates Assortment With Arabian Mare, Arabian Stallion",
                    parent_title: "Arabian Mare",
                }),
                row({ id: "sm", item_type: "plastic_mold", title: "Arabian Stallion" }),
                row({ id: "near", title: "Arabian Mare" }),
            ],
            [
                row({ id: "sultan", title: "Sultan", parent_id: "sm", attributes: { release_year_start: 1999 } }),
                row({
                    id: "r5010",
                    title: "#5010 Arabian Stallion",
                    parent_id: "sm",
                    attributes: { release_year_start: 1975 },
                }),
            ],
        );
        const out = await searchRegistry(client, "SM Arabian Stallion");
        expect(rpc).toHaveBeenCalledWith("search_catalog_fuzzy", { search_term: "Arabian Stallion", max_results: 200 });
        expect(out?.rows.map((r) => r.id)).toEqual(["sm", "r5010", "sultan", "near", "set"]);
        expect(out?.rows.find((r) => r.id === "sultan")?.parent_title).toBe("Arabian Stallion");
        expect([...(out?.rosterIds ?? [])]).toEqual(["set"]);
    });

    it("lists the same mold first, then the same scale, never the entry itself", () => {
        // "Black and White Saddlebred", reported from #5904 (a Stablemate on
        // the American Saddlebred mold): Pinto Saddlebred #5002 sat 32nd of
        // the search and the picker showed 8.
        const rows = [
            row({ id: "fb01", title: "#5904 Black and White Saddlebred", parent_id: "asb" }),
            row({ id: "bhr", title: "Black Horse Ranch Saddlebred", scale: "Traditional (1:9)" }),
            row({ id: "cl", title: "Saddlebred", scale: "Classic (1:12)", parent_id: "asb-classic" }),
            row({ id: "pp", title: "American Saddlebred", scale: "Paddock Pal (1:24)", parent_id: "asb-pp" }),
            row({ id: "pinto", title: "Pinto Saddlebred", parent_id: "sb" }),
            row({ id: "6029", title: "#6029 American Saddlebred", parent_id: "asb" }),
        ];
        const anchor = { id: "fb01", moldId: "asb", scale: "Stablemate (1:32)" };
        // Nothing typed (the same-mold list): same mold, then same scale.
        const ordered = orderForAnchor(rows, anchor);
        expect(ordered.map((r) => r.id)).toEqual(["6029", "pinto", "bhr", "cl", "pp"]);
        expect(ordered.map((r) => r.sameMold)).toEqual([true, false, false, false, false]);
        expect(orderForAnchor(rows, null).map((r) => r.id)).toEqual(["fb01", "bhr", "cl", "pp", "pinto", "6029"]);
        // A name typed leads; the same mold leads only among equally good answers.
        expect(orderForAnchor(rows, anchor, "Pinto Saddlebred").map((r) => r.id)).toEqual([
            "pinto",
            "6029",
            "bhr",
            "cl",
            "pp",
        ]);
        // A typed number that is a row's model number counts as naming it.
        const numbered = [...rows, row({ id: "5002", title: "Saddlebred", attributes: { model_number: "5002" } })];
        expect(orderForAnchor(numbered, anchor, "Saddlebred 5002")[0].id).toBe("5002");
    });

    it("returns null when the RPC is unavailable, and nothing for an empty term", async () => {
        expect(await searchRegistry(fakeClient(null).client, "Saddlebred")).toBeNull();
        expect((await searchRegistry(fakeClient([]).client, "  "))?.rows).toEqual([]);
    });
});
