import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";
import { AuthError } from "@/lib/auth";

const mockClient = createMockSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

import { getConditionHistory } from "@/app/actions/conditionHistory";

describe("getConditionHistory — the ledger nothing used to read", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: "user-1", email: "test@test.com" } },
        });
        mockClient._setImplicitResolve({ data: null, error: null });
    });

    it("rejects unauthenticated users", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        await expect(getConditionHistory("h1")).rejects.toThrow(AuthError);
    });

    it("maps a grade change with its note, newest first", async () => {
        mockClient._setImplicitResolve({
            data: [
                {
                    id: "c2",
                    old_condition: "Excellent",
                    new_condition: "Good",
                    note: "Rub on the near shoulder",
                    created_at: "2026-08-01T00:00:00.000Z",
                },
                {
                    id: "c1",
                    old_condition: null,
                    new_condition: "Excellent",
                    note: null,
                    created_at: "2026-01-01T00:00:00.000Z",
                },
            ],
            error: null,
        });

        const entries = await getConditionHistory("h1");

        expect(entries).toHaveLength(2);
        expect(entries[0]).toEqual({
            id: "c2",
            oldCondition: "Excellent",
            newCondition: "Good",
            note: "Rub on the near shoulder",
            changedAt: "2026-08-01T00:00:00.000Z",
        });
        // The first grade a horse was ever given has no "from".
        expect(entries[1].oldCondition).toBeNull();
    });

    it("scopes the read to the horse and orders newest first", async () => {
        mockClient._setImplicitResolve({ data: [], error: null });
        await getConditionHistory("h1");

        expect(mockClient.from).toHaveBeenCalledWith("condition_history");
        expect(mockClient._mockQuery.eq).toHaveBeenCalledWith("horse_id", "h1");
        expect(mockClient._mockQuery.order).toHaveBeenCalledWith("created_at", { ascending: false });
    });

    it("returns an empty ledger instead of throwing when the read fails", async () => {
        mockClient._setImplicitResolve({ data: null, error: { message: "boom" } });
        await expect(getConditionHistory("h1")).resolves.toEqual([]);
    });

    it("tolerates a null created_at", async () => {
        mockClient._setImplicitResolve({
            data: [{ id: "c1", old_condition: null, new_condition: "Mint", note: null, created_at: null }],
            error: null,
        });
        const entries = await getConditionHistory("h1");
        expect(entries[0].changedAt).toBe("");
    });
});
