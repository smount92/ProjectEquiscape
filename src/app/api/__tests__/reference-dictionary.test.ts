import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

let mockClient: ReturnType<typeof createMockSupabaseClient>;

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

import { GET } from "@/app/api/reference-dictionary/route";

describe("GET /api/reference-dictionary", () => {
    beforeEach(() => {
        mockClient = createMockSupabaseClient();
    });

    it("returns releases and resins arrays", async () => {
        // The route paginates — first page returns data, second returns empty
        mockClient._setImplicitResolve({
            data: [
                { id: "r1", item_type: "plastic_release", parent_id: "m1", title: "Adios", maker: "Breyer", scale: "Traditional", attributes: { model_number: "30", color_description: "Palomino" } },
                { id: "m1", item_type: "plastic_mold", parent_id: null, title: "Adios", maker: "Breyer", scale: "Traditional", attributes: {} },
                { id: "a1", item_type: "artist_resin", parent_id: null, title: "Fjord", maker: "Jane Smith", scale: "1:9", attributes: {} },
            ],
            error: null,
        });

        const res = await GET();
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(Array.isArray(json.releases)).toBe(true);
        expect(Array.isArray(json.resins)).toBe(true);
        expect(json.releases.length).toBeGreaterThan(0);
        expect(json.resins.length).toBeGreaterThan(0);
    });

    it("releases have compressed keys (i, n, m, c, mn, mf)", async () => {
        mockClient._setImplicitResolve({
            data: [
                { id: "r1", item_type: "plastic_release", parent_id: "m1", title: "Adios Release", maker: "Breyer", scale: "Traditional", attributes: { model_number: "30", color_description: "Palomino" } },
                { id: "m1", item_type: "plastic_mold", parent_id: null, title: "Adios Mold", maker: "Breyer", scale: "Traditional", attributes: {} },
            ],
            error: null,
        });

        const res = await GET();
        const json = await res.json();
        const release = json.releases[0];
        expect(release).toBeDefined();
        expect(release).toHaveProperty("i");
        expect(release).toHaveProperty("n");
        expect(release).toHaveProperty("m");
        expect(release).toHaveProperty("c");
        expect(release).toHaveProperty("mn");
        expect(release).toHaveProperty("mf");
    });

    it("resins have compressed keys (i, n, s)", async () => {
        mockClient._setImplicitResolve({
            data: [
                { id: "a1", item_type: "artist_resin", parent_id: null, title: "Fjord", maker: "Jane Smith", scale: "1:9", attributes: {} },
            ],
            error: null,
        });

        const res = await GET();
        const json = await res.json();
        const resin = json.resins[0];
        expect(resin).toBeDefined();
        expect(resin).toHaveProperty("i");
        expect(resin).toHaveProperty("n");
        expect(resin).toHaveProperty("s");
    });

    it("sets Cache-Control header to 1 day", async () => {
        mockClient._setImplicitResolve({ data: [], error: null });

        const res = await GET();
        expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400, s-maxage=86400");
    });

    it("returns empty arrays for empty catalog", async () => {
        mockClient._setImplicitResolve({ data: [], error: null });

        const res = await GET();
        const json = await res.json();
        expect(json.releases).toEqual([]);
        expect(json.resins).toEqual([]);
    });
});
