/**
 * The read that fetches a mold's candidate set rows (review of MHH-074).
 * It stops at 400 rows, so the words must sit after "with" (in the roster,
 * not anywhere in the title) and the order must be fixed: unordered, the
 * 400 kept for a common one-word mold were whichever the database met first.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = [string, ...unknown[]];
const db = vi.hoisted(() => ({ queries: [] as { table: string; calls: Call[] }[] }));

function builder(table: string) {
    const q = { table, calls: [] as Call[] };
    db.queries.push(q);
    const chain: Record<string, unknown> = {};
    for (const k of ["select", "eq", "neq", "ilike", "in", "or", "limit", "order"])
        chain[k] = (...args: unknown[]) => {
            q.calls.push([k, ...args]);
            return chain;
        };
    chain.maybeSingle = async () => ({ data: null, error: null });
    chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
    return chain;
}

const MOLD = {
    id: "sb",
    item_type: "plastic_mold",
    parent_id: null,
    title: "Saddlebred",
    maker: "Breyer",
    scale: "Stablemate (1:32)",
    attributes: {},
};

vi.mock("@/lib/supabase/server", () => ({
    createClient: async () => ({
        from: (t: string) => builder(t),
        rpc: async (fn: string) => ({ data: fn === "search_catalog_fuzzy" ? [MOLD] : [], error: null }),
    }),
}));
vi.mock("@/lib/supabase/anon", () => ({
    createAnonClient: () => ({ from: (t: string) => builder(t) }),
}));
vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));
vi.mock("@/app/actions/catalog-suggestions", () => ({ createSuggestion: vi.fn() }));

import { searchLinker } from "@/app/actions/linker";
import { getMoldSetMentions } from "@/app/actions/reference-pages";

/** The query that reads set rows: the one with a "with" pattern. */
function setQuery() {
    const q = db.queries.find((x) => x.calls.some(([k, , p]) => k === "ilike" && String(p).startsWith("%with%")));
    expect(q).toBeTruthy();
    return q!.calls;
}

beforeEach(() => {
    db.queries = [];
});

describe("set-candidate prefilter", () => {
    it("the linker anchors each word after 'with' and orders by id", async () => {
        await searchLinker("Saddlebred", null);
        const calls = setQuery();
        expect(calls).toContainEqual(["ilike", "title", "%with%Saddlebred%"]);
        // No word is matched anywhere in the title any more.
        expect(calls).not.toContainEqual(["ilike", "title", "%Saddlebred%"]);
        expect(calls).toContainEqual(["order", "id"]);
    });

    it("the mold page's 'sets that include it' does the same", async () => {
        await getMoldSetMentions("sb", "Morgan Stallion (G1)", "Stablemate (1:32)");
        const calls = setQuery();
        expect(calls).toContainEqual(["ilike", "title", "%with%Morgan%"]);
        expect(calls).toContainEqual(["ilike", "title", "%with%Stallion%"]);
        expect(calls).not.toContainEqual(["ilike", "title", "%Morgan%"]);
        expect(calls).toContainEqual(["order", "id"]);
    });
});
