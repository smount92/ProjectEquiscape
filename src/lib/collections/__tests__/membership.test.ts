import { describe, it, expect, vi } from "vitest";
import { folderHorseIds, horseFolderIds, setHorsesFolders, unionIds } from "@/lib/collections/membership";

/** A chainable stand-in for the Supabase query builder that resolves to `result`. */
function chain(result: unknown) {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "in", "limit", "delete", "insert", "update", "upsert"]) b[m] = vi.fn(() => b);
    b.maybeSingle = vi.fn(() => Promise.resolve(result));
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return b;
}

describe("folder membership", () => {
    it("unions id lists, dropping blanks and repeats, keeping order", () => {
        expect(unionIds(["a", "b"], ["b", "c", null, undefined], [])).toEqual(["a", "b", "c"]);
    });

    it("a folder's horses are the junction's AND the legacy column's", async () => {
        const supabase = {
            from: vi.fn((table: string) =>
                table === "horse_collections"
                    ? chain({ data: [{ horse_id: "h1" }, { horse_id: "h2" }] })
                    : chain({ data: [{ id: "h2" }, { id: "h3" }] }),
            ),
        };
        expect(await folderHorseIds(supabase as never, "owner", "folder")).toEqual(["h1", "h2", "h3"]);
    });

    it("a horse's folders are the junction's AND its legacy column", async () => {
        const supabase = {
            from: vi.fn((table: string) =>
                table === "horse_collections"
                    ? chain({ data: [{ collection_id: "f1" }] })
                    : chain({ data: { collection_id: "f2" } }),
            ),
        };
        expect(await horseFolderIds(supabase as never, "h")).toEqual(["f1", "f2"]);
    });

    it("writing folders updates the junction and the mirror together", async () => {
        const junction = chain({ error: null });
        const horses = chain({ error: null });
        const supabase = { from: vi.fn((table: string) => (table === "horse_collections" ? junction : horses)) };
        const result = await setHorsesFolders(supabase as never, ["h1", "h2"], ["f1"]);
        expect(result).toEqual({});
        expect(junction.delete).toHaveBeenCalled();
        expect(junction.insert).toHaveBeenCalledWith([
            { horse_id: "h1", collection_id: "f1" },
            { horse_id: "h2", collection_id: "f1" },
        ]);
        expect(horses.update).toHaveBeenCalledWith({ collection_id: "f1" });
    });

    it("clearing folders empties the junction and nulls the mirror", async () => {
        const junction = chain({ error: null });
        const horses = chain({ error: null });
        const supabase = { from: vi.fn((table: string) => (table === "horse_collections" ? junction : horses)) };
        await setHorsesFolders(supabase as never, ["h1"], []);
        expect(junction.insert).not.toHaveBeenCalled();
        expect(horses.update).toHaveBeenCalledWith({ collection_id: null });
    });
});
