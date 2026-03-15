import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

let mockClient: ReturnType<typeof createMockSupabaseClient>;

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

import { GET } from "@/app/api/export/route";

describe("GET /api/export (CSV)", () => {
    beforeEach(() => {
        mockClient = createMockSupabaseClient();
    });

    it("returns 401 for unauthenticated user", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        const res = await GET();
        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.error).toBe("Unauthorized");
    });

    it("returns CSV with headers for authenticated user with horses", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({
            data: { user: { id: "user-1", email: "t@test.com" } },
        });
        // Set implicit resolve for the query chain (no .single() call)
        mockClient._setImplicitResolve({
            data: [
                {
                    id: "h1",
                    custom_name: "Trigger",
                    finish_type: "OF",
                    condition_grade: "Mint",
                    sculptor: "Chris Hess",
                    trade_status: "Not for Sale",
                    listing_price: null,
                    created_at: "2024-01-01T00:00:00Z",
                    catalog_items: null,
                    user_collections: null,
                    financial_vault: [],
                },
            ],
            error: null,
        });

        const res = await GET();
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toContain("text/csv");
        const body = await res.text();
        expect(body).toContain("Custom Name");
        expect(body).toContain("Condition");
        expect(body).toContain("Trigger");
    });

    it("returns CSV with only headers when user has no horses", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({
            data: { user: { id: "user-1", email: "t@test.com" } },
        });
        mockClient._setImplicitResolve({ data: [], error: null });

        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body).toContain("Custom Name");
        const lines = body.trim().split("\n");
        expect(lines.length).toBe(1); // just headers
    });

    it("escapes commas in values", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({
            data: { user: { id: "user-1", email: "t@test.com" } },
        });
        mockClient._setImplicitResolve({
            data: [
                {
                    id: "h1",
                    custom_name: "Value, with, commas",
                    finish_type: "OF",
                    condition_grade: "Good",
                    sculptor: null,
                    trade_status: null,
                    listing_price: null,
                    created_at: "2024-01-01T00:00:00Z",
                    catalog_items: null,
                    user_collections: null,
                    financial_vault: [],
                },
            ],
            error: null,
        });

        const res = await GET();
        const body = await res.text();
        expect(body).toContain('"Value, with, commas"');
    });

    it("escapes quotes in values", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({
            data: { user: { id: "user-1", email: "t@test.com" } },
        });
        mockClient._setImplicitResolve({
            data: [
                {
                    id: "h1",
                    custom_name: 'Horse "Special"',
                    finish_type: "OF",
                    condition_grade: "Good",
                    sculptor: null,
                    trade_status: null,
                    listing_price: null,
                    created_at: "2024-01-01T00:00:00Z",
                    catalog_items: null,
                    user_collections: null,
                    financial_vault: [],
                },
            ],
            error: null,
        });

        const res = await GET();
        const body = await res.text();
        expect(body).toContain('""Special""');
    });
});
