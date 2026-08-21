import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";
import { AuthError } from "@/lib/auth";
import { DELETED_NAME_KEY } from "@/lib/stable/softDelete";

const mockClient = createMockSupabaseClient();
const mockAdmin = createMockSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));
vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => mockAdmin),
}));
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
}));
vi.mock("next/server", () => ({
    after: vi.fn(),
}));
vi.mock("@/lib/utils/validation", () => ({
    sanitizeText: vi.fn((s: string) => s.trim()),
}));

import { deleteHorse, listDeletedHorses, restoreHorse } from "@/app/actions/horse";

/** The payload of the last `.update()` call on the user-scoped client. */
function lastUpdate(): Record<string, unknown> {
    const calls = mockClient._mockQuery.update.mock.calls;
    return calls[calls.length - 1][0] as Record<string, unknown>;
}

describe("Recently Deleted — delete stashes, restore recovers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: "user-1", email: "test@test.com" } },
        });
        mockClient._setImplicitResolve({ data: null, error: null });
        mockAdmin._setImplicitResolve({ data: null, error: null });
    });

    // ── deleteHorse: the stash ──
    describe("deleteHorse", () => {
        it("stashes the pre-scrub name while still scrubbing custom_name", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: {
                    id: "h1",
                    owner_id: "user-1",
                    custom_name: "Midnight Star",
                    attributes: { discipline: "Dressage" },
                },
                error: null,
            });
            mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

            const result = await deleteHorse("h1");

            expect(result.success).toBe(true);
            const payload = lastUpdate();
            // The scrub is UNCHANGED — the name still never survives on the
            // column any surface reads.
            expect(payload.custom_name).toBe("[Deleted]");
            expect(payload.visibility).toBe("private");
            expect(payload.life_stage).toBe("orphaned");
            expect(payload.deleted_at).toEqual(expect.any(String));
            // …but it is now recoverable.
            expect(payload.attributes).toEqual({
                discipline: "Dressage",
                [DELETED_NAME_KEY]: "Midnight Star",
            });
        });

        it("keeps the existing active-transaction guard", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "h1", owner_id: "user-1", custom_name: "Midnight Star", attributes: {} },
                error: null,
            });
            mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({ data: { id: "txn-1" }, error: null });

            const result = await deleteHorse("h1");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/active transaction/i);
            expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
        });
    });

    // ── restoreHorse ──
    describe("restoreHorse", () => {
        const deletedRow = (over: Record<string, unknown> = {}) => ({
            data: {
                id: "h1",
                owner_id: "user-1",
                custom_name: "[Deleted]",
                attributes: { discipline: "Dressage", [DELETED_NAME_KEY]: "Midnight Star" },
                deleted_at: "2026-08-01T00:00:00.000Z",
                ...over,
            },
            error: null,
        });

        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(restoreHorse("h1")).rejects.toThrow(AuthError);
        });

        it("rejects a horse that isn't the caller's", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
            const result = await restoreHorse("h1");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not found/i);
        });

        it("refuses a horse that isn't deleted", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce(deletedRow({ deleted_at: null }));
            const result = await restoreHorse("h1");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/isn't deleted/i);
            expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
        });

        it("respects the active-transaction guard", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce(deletedRow());
            mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({ data: { id: "txn-1" }, error: null });

            const result = await restoreHorse("h1");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/active transaction/i);
            expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
        });

        it("clears deleted_at and lands private, completed and not-for-sale", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce(deletedRow());
            mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

            const result = await restoreHorse("h1");

            expect(result.success).toBe(true);
            const payload = lastUpdate();
            expect(payload.deleted_at).toBeNull();
            // Private, never the pre-delete visibility — that value is gone.
            expect(payload.visibility).toBe("private");
            // A sane stage the life_stage CHECK accepts, and what the
            // hoofprint view already COALESCEs a null stage to.
            expect(payload.life_stage).toBe("completed");
            // A restore must never put a horse back on the market.
            expect(payload.trade_status).toBe("Not for Sale");
        });

        it("puts the stashed name back and drops the stash", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce(deletedRow());
            mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

            const result = await restoreHorse("h1");

            expect(result.success).toBe(true);
            expect(result.name).toBe("Midnight Star");
            const payload = lastUpdate();
            expect(payload.custom_name).toBe("Midnight Star");
            expect(payload.attributes).toEqual({ discipline: "Dressage" });
        });

        it("falls back to the placeholder for horses deleted before the stash shipped", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce(deletedRow({ attributes: {} }));
            mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

            const result = await restoreHorse("h1");

            expect(result.success).toBe(true);
            expect(result.name).toBe("[Deleted]");
        });

        it("accepts a caller-supplied name for those rows", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce(deletedRow({ attributes: {} }));
            mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

            const result = await restoreHorse("h1", "  Second Chance  ");

            expect(result.success).toBe(true);
            expect(result.name).toBe("Second Chance");
            expect(lastUpdate().custom_name).toBe("Second Chance");
        });

        it("prefers a supplied name over the stash", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce(deletedRow());
            mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

            const result = await restoreHorse("h1", "Renamed");
            expect(result.name).toBe("Renamed");
        });

        it("rejects an over-long name", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce(deletedRow());
            mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

            const result = await restoreHorse("h1", "x".repeat(101));
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/too long/i);
            expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
        });

        it("surfaces a write failure instead of claiming success", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce(deletedRow());
            mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
            mockClient._setImplicitResolve({ data: null, error: { message: "boom" } });

            const result = await restoreHorse("h1");
            expect(result.success).toBe(false);
            expect(result.error).toBe("boom");
        });
    });

    // ── listDeletedHorses ──
    describe("listDeletedHorses", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(listDeletedHorses()).rejects.toThrow(AuthError);
        });

        it("reports the recovered name, the catalog reference and the deleted date", async () => {
            mockClient._setImplicitResolve({
                data: [
                    {
                        id: "h1",
                        custom_name: "[Deleted]",
                        attributes: { [DELETED_NAME_KEY]: "Midnight Star" },
                        asset_category: "model",
                        deleted_at: "2026-08-01T00:00:00.000Z",
                        catalog_items: { title: "Adios", maker: "Breyer" },
                    },
                ],
                error: null,
            });

            const rows = await listDeletedHorses();

            expect(rows).toHaveLength(1);
            expect(rows[0].recoveredName).toBe("Midnight Star");
            expect(rows[0].referenceName).toContain("Adios");
            expect(rows[0].deletedAt).toBe("2026-08-01T00:00:00.000Z");
        });

        it("reports a null name for rows with no stash rather than '[Deleted]'", async () => {
            mockClient._setImplicitResolve({
                data: [
                    {
                        id: "h2",
                        custom_name: "[Deleted]",
                        attributes: {},
                        asset_category: "model",
                        deleted_at: "2026-07-01T00:00:00.000Z",
                        catalog_items: null,
                    },
                ],
                error: null,
            });

            const rows = await listDeletedHorses();
            expect(rows[0].recoveredName).toBeNull();
            expect(rows[0].referenceName).toBeNull();
        });

        it("returns an empty shelf instead of throwing when the read fails", async () => {
            mockClient._setImplicitResolve({ data: null, error: { message: "boom" } });
            await expect(listDeletedHorses()).resolves.toEqual([]);
        });
    });
});
