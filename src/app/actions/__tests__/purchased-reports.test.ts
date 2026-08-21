import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

const mockClient = createMockSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

import { getMyPurchasedReports } from "@/app/actions/purchased-reports";

/** Sequence the two implicit-await reads the action performs. */
function queueReads(...results: { data: unknown; error: unknown }[]) {
    let i = 0;
    mockClient._mockQuery.then = vi.fn((resolve: (value: unknown) => void) =>
        Promise.resolve(results[Math.min(i++, results.length - 1)]).then(resolve)
    );
}

describe("getMyPurchasedReports", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: "user-1", email: "test@test.com" } },
        });
    });

    it("returns an empty list for signed-out visitors", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        await expect(getMyPurchasedReports()).resolves.toEqual([]);
    });

    it("returns an empty list when nothing was ever purchased", async () => {
        queueReads({ data: [], error: null });
        await expect(getMyPurchasedReports()).resolves.toEqual([]);
    });

    it("scopes the read to the signed-in buyer (RLS belt-and-braces)", async () => {
        queueReads({ data: [], error: null });
        await getMyPurchasedReports();
        expect(mockClient.from).toHaveBeenCalledWith("purchased_reports");
        expect(mockClient._mockQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    });

    it("joins each purchase to its horse name and catalog reference", async () => {
        queueReads(
            {
                data: [
                    {
                        id: "pr-1",
                        horse_id: "h-1",
                        report_type: "insurance",
                        purchased_at: "2026-07-04T12:00:00Z",
                    },
                ],
                error: null,
            },
            {
                data: [
                    {
                        id: "h-1",
                        custom_name: "Salinero",
                        deleted_at: null,
                        catalog_items: { title: "Salinero", maker: "Breyer" },
                    },
                ],
                error: null,
            }
        );

        const reports = await getMyPurchasedReports();
        expect(reports).toHaveLength(1);
        expect(reports[0]).toMatchObject({
            id: "pr-1",
            horseId: "h-1",
            horseName: "Salinero",
            horseReference: "Breyer Salinero",
            horseMissing: false,
            reportType: "insurance",
        });
    });

    it("flags a purchase whose horse was deleted rather than dropping it", async () => {
        queueReads(
            {
                data: [
                    {
                        id: "pr-2",
                        horse_id: "h-2",
                        report_type: "insurance",
                        purchased_at: "2026-07-04T12:00:00Z",
                    },
                ],
                error: null,
            },
            {
                data: [
                    {
                        id: "h-2",
                        custom_name: "Old Friend",
                        deleted_at: "2026-08-01T00:00:00Z",
                        catalog_items: null,
                    },
                ],
                error: null,
            }
        );

        const reports = await getMyPurchasedReports();
        expect(reports).toHaveLength(1);
        expect(reports[0].horseMissing).toBe(true);
        expect(reports[0].horseReference).toBeNull();
    });

    it("survives a horse row that is no longer readable at all", async () => {
        queueReads(
            {
                data: [
                    {
                        id: "pr-3",
                        horse_id: "h-gone",
                        report_type: "insurance",
                        purchased_at: "2026-07-04T12:00:00Z",
                    },
                ],
                error: null,
            },
            { data: [], error: null }
        );

        const reports = await getMyPurchasedReports();
        expect(reports[0]).toMatchObject({ horseName: null, horseMissing: true });
    });
});
