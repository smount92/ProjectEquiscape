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
        // Section scaffolding is always present (Horses + Hoofprint +
        // Qualification Cards headers); no data rows.
        expect(body).toContain("# Hoofprint Timeline");
        expect(body).toContain("# Qualification Cards");
        expect(body).toContain("Card Code");
        const lines = body.trim().split("\n");
        // headers/sections only — no data rows beyond the fixed scaffold
        expect(lines.length).toBeLessThanOrEqual(10);
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

    const horseWithNotes = (vault: Record<string, unknown>) => ({
        id: "h1",
        custom_name: "Dapple",
        finish_type: "OF",
        condition_grade: "Mint",
        sculptor: null,
        trade_status: null,
        listing_price: null,
        created_at: "2024-01-01T00:00:00Z",
        catalog_items: null,
        user_collections: null,
        financial_vault: {
            purchase_price: 85,
            estimated_current_value: null,
            insurance_notes: null,
            ...vault,
        },
    });

    it("exports purchase notes in their own column (241)", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "user-1", email: "t@test.com" } } });
        mockClient._setImplicitResolve({
            data: [horseWithNotes({ purchase_notes: "From the artist, BreyerFest\nhttps://example.com/r/1" })],
            error: null,
        });

        const body = await (await GET()).text();
        const header = body.split("\n")[1].split(",");
        expect(header).toContain("Purchase Notes");
        // Multi-line notes are quoted so they stay in one cell.
        expect(body).toContain('"From the artist, BreyerFest\nhttps://example.com/r/1"');
        const horseSelect = (mockClient._mockQuery.select as ReturnType<typeof vi.fn>).mock.calls
            .map((c) => c[0] as string)
            .find((s) => s.includes("financial_vault("));
        expect(horseSelect).toContain("purchase_notes");
    });

    it("still exports everything else before 241 is pasted", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "user-1", email: "t@test.com" } } });
        const then = mockClient._mockQuery.then as ReturnType<typeof vi.fn>;
        then.mockImplementationOnce((resolve: (v: unknown) => void) =>
            Promise.resolve({
                data: null,
                error: { code: "42703", message: "column financial_vault_1.purchase_notes does not exist" },
            }).then(resolve),
        );
        mockClient._setImplicitResolve({ data: [horseWithNotes({})], error: null });

        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body).toContain("Dapple");
        expect(body).toContain("Purchase Notes");
        const selects = (mockClient._mockQuery.select as ReturnType<typeof vi.fn>).mock.calls.map(
            (c) => c[0] as string,
        );
        const horseSelects = selects.filter((s) => s.includes("financial_vault("));
        expect(horseSelects).toHaveLength(2);
        expect(horseSelects[1]).not.toContain("purchase_notes");
        // The set columns (224) are kept; only the missing one is dropped.
        expect(horseSelects[1]).toContain("purchase_group_id");
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
