/**
 * CSV import starts horses where the member chose (MHH-005): all three
 * visibilities through batch_import_horses_v3 (migration 234), and before
 * 234 is pasted, v2 with Unlisted landing Private, never more visible.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/auth", () => ({
    requireAuth: vi.fn(async () => ({ supabase: { rpc }, user: { id: "user-1" } })),
}));

import { executeBatchImport } from "@/app/actions/csv-import";

const row = {
    rowNumber: 2,
    customName: "Montana Harvest",
    condition: "Mint",
    finishType: "OF",
    purchasePrice: "",
    estimatedValue: "",
    notes: "",
    catalogId: null,
};
const ok = { data: { inserted: 1, errors: [] }, error: null };
const missing = {
    data: null,
    error: { code: "PGRST202", message: "Could not find the function public.batch_import_horses_v3" },
};

describe("executeBatchImport visibility", () => {
    beforeEach(() => rpc.mockReset());

    it("sends the chosen visibility to v3", async () => {
        rpc.mockResolvedValueOnce(ok);
        const result = await executeBatchImport({ rows: [row], visibility: "unlisted" });
        expect(result.success).toBe(true);
        expect(rpc).toHaveBeenCalledTimes(1);
        expect(rpc.mock.calls[0][0]).toBe("batch_import_horses_v3");
        expect(rpc.mock.calls[0][1]).toMatchObject({ p_visibility: "unlisted" });
    });

    it("before 234, falls back to v2 and an Unlisted import lands Private", async () => {
        rpc.mockResolvedValueOnce(missing).mockResolvedValueOnce(ok);
        const result = await executeBatchImport({ rows: [row], visibility: "unlisted" });
        expect(result.success).toBe(true);
        expect(rpc.mock.calls[1][0]).toBe("batch_import_horses_v2");
        expect(rpc.mock.calls[1][1]).toMatchObject({ p_is_public: false });
    });

    it("a Public import stays public on the v2 fallback", async () => {
        rpc.mockResolvedValueOnce(missing).mockResolvedValueOnce(ok);
        await executeBatchImport({ rows: [row], visibility: "public" });
        expect(rpc.mock.calls[1][1]).toMatchObject({ p_is_public: true });
    });

    it("older callers that send publish still work", async () => {
        rpc.mockResolvedValueOnce(ok);
        await executeBatchImport({ rows: [row], publish: false });
        expect(rpc.mock.calls[0][1]).toMatchObject({ p_visibility: "private" });
    });
});
