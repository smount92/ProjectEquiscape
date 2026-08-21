import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";
import { AuthError } from "@/lib/auth";

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
    after: vi.fn((fn: () => void) => { /* no-op in tests */ }),
}));
vi.mock("@/lib/utils/validation", () => ({
    sanitizeText: vi.fn((s: string) => s.trim()),
}));
vi.mock("@/app/actions/activity", () => ({
    createActivityEvent: vi.fn().mockResolvedValue(undefined),
}));

import { bulkDeleteHorses, bulkUpdateHorses, createHorseRecord, deleteHorse, finalizeHorseImages, quickAddHorse, updateHorseAction } from "@/app/actions/horse";

describe("horse.ts — CRUD", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: "user-1", email: "test@test.com" } },
        });
    });

    // ── createHorseRecord ──
    describe("createHorseRecord", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(createHorseRecord({ customName: "Test", finishType: "OF", isPublic: true })).rejects.toThrow(AuthError);
        });

        it("rejects missing name", async () => {
            const result = await createHorseRecord({ customName: "", finishType: "OF", isPublic: true });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/missing required/i);
        });

        it("rejects model category without finishType", async () => {
            const result = await createHorseRecord({ customName: "Test", finishType: "", isPublic: true, assetCategory: "model" });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/finish type/i);
        });

        it("succeeds with valid data", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "horse-1" },
                error: null,
            });
            const result = await createHorseRecord({
                customName: "My Horse",
                finishType: "OF",
                isPublic: true,
            });
            expect(result.success).toBe(true);
            expect(result.horseId).toBe("horse-1");
        });

        it("calls sanitizeText on name", async () => {
            const { sanitizeText } = await import("@/lib/utils/validation");
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "horse-1" },
                error: null,
            });
            await createHorseRecord({
                customName: "  My Horse  ",
                finishType: "OF",
                isPublic: true,
            });
            expect(sanitizeText).toHaveBeenCalledWith("  My Horse  ");
        });

        it("clears condition grade when life stage is in_progress", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "horse-1" },
                error: null,
            });
            await createHorseRecord({
                customName: "My WIP Horse",
                finishType: "OF",
                isPublic: true,
                lifeStage: "in_progress",
                conditionGrade: "Mint",
            });
            expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
                condition_grade: null,
                life_stage: "in_progress",
            }));
        });
    });

    // ── updateHorseAction ──
    describe("updateHorseAction", () => {
        it("clears condition grade in horseUpdate when life stage is in_progress", async () => {
            mockClient._setImplicitResolve({ data: {}, error: null });
            await updateHorseAction("horse-1", {
                horseUpdate: {
                    life_stage: "in_progress",
                    condition_grade: "Mint",
                },
            });
            expect(mockClient._mockQuery.update).toHaveBeenCalledWith(expect.objectContaining({
                life_stage: "in_progress",
                condition_grade: null,
            }));
        });
    });

    // ── deleteHorse ──
    describe("deleteHorse", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(deleteHorse("h1")).rejects.toThrow(AuthError);
        });

        it("rejects non-owner", async () => {
            // Horse not found for this owner
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: null, error: null });
            const result = await deleteHorse("h1");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not found/i);
        });

        it("blocks deletion when active transaction exists", async () => {
            // Horse found
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "h1", owner_id: "user-1" },
                error: null,
            });
            // Active transaction check (admin) - returns an active transaction
            mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({
                data: { id: "txn-1" },
                error: null,
            });
            const result = await deleteHorse("h1");
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/active transaction/i);
        });

        it("succeeds when owner deletes own horse with no transactions", async () => {
            // Horse found
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "h1", owner_id: "user-1" },
                error: null,
            });
            // No active transactions
            mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

            const result = await deleteHorse("h1");
            expect(result.success).toBe(true);
        });
    });

    // ── bulkUpdateHorses ──
    describe("bulkUpdateHorses", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(bulkUpdateHorses(["h1"], { tradeStatus: "For Sale" })).rejects.toThrow(AuthError);
        });

        it("rejects an empty selection", async () => {
            const result = await bulkUpdateHorses([], { tradeStatus: "For Sale" });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/no horses/i);
        });

        it("rejects batches over the 500 cap (the select-all-matching cap)", async () => {
            const ids = Array.from({ length: 501 }, (_, i) => `h${i}`);
            const result = await bulkUpdateHorses(ids, { tradeStatus: "For Sale" });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/max 500/i);
        });

        it("refuses when ANY horse in the batch is not owned by the caller", async () => {
            // Ownership check finds only one of the two requested horses
            mockClient._setImplicitResolve({ data: [{ id: "h1" }], error: null });
            const result = await bulkUpdateHorses(["h1", "h2"], { tradeStatus: "For Sale" });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not yours|not found/i);
            expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
        });

        it("rejects when no updates are specified", async () => {
            mockClient._setImplicitResolve({ data: [{ id: "h1" }], error: null });
            const result = await bulkUpdateHorses(["h1"], {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/no updates/i);
        });

        it("applies a visibility change for owned horses (the new bulk toggle)", async () => {
            mockClient._setImplicitResolve({ data: [{ id: "h1" }], error: null });
            const result = await bulkUpdateHorses(["h1"], { visibility: "private" });
            expect(result.success).toBe(true);
            expect(result.count).toBe(1);
            expect(mockClient._mockQuery.update).toHaveBeenCalledWith({ visibility: "private" });
            expect(mockClient._mockQuery.eq).toHaveBeenCalledWith("owner_id", "user-1");
        });

        it("clears the collection when collectionId is null", async () => {
            mockClient._setImplicitResolve({ data: [{ id: "h1" }], error: null });
            const result = await bulkUpdateHorses(["h1"], { collectionId: null });
            expect(result.success).toBe(true);
            expect(mockClient._mockQuery.update).toHaveBeenCalledWith({ collection_id: null });
        });
    });

    // ── bulkDeleteHorses ──
    describe("bulkDeleteHorses", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(bulkDeleteHorses(["h1"])).rejects.toThrow(AuthError);
        });

        it("rejects an empty selection", async () => {
            const result = await bulkDeleteHorses([]);
            expect(result.success).toBe(false);
        });

        it("rejects batches over the 100 cap", async () => {
            const ids = Array.from({ length: 101 }, (_, i) => `h${i}`);
            const result = await bulkDeleteHorses(ids);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/max 100/i);
        });

        it("refuses when ANY horse in the batch is not owned by the caller", async () => {
            mockClient._setImplicitResolve({ data: [{ id: "h1" }], error: null });
            const result = await bulkDeleteHorses(["h1", "h2"]);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not yours|not found/i);
            expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
        });

        it("blocks deletion when any horse has an active transaction", async () => {
            mockClient._setImplicitResolve({ data: [{ id: "h1" }], error: null });
            mockAdmin._setImplicitResolve({ data: [{ horse_id: "h1" }], error: null });
            const result = await bulkDeleteHorses(["h1"]);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/active transaction/i);
            expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
        });

        it("soft-deletes owned horses with no active transactions", async () => {
            // One resolve serves the ownership check (id) AND the image
            // cleanup query (image_url) — the mock returns it for both.
            mockClient._setImplicitResolve({
                data: [{ id: "h1", image_url: "https://x/storage/v1/object/public/horse-images/a.webp" }],
                error: null,
            });
            mockAdmin._setImplicitResolve({ data: [], error: null });
            const result = await bulkDeleteHorses(["h1"]);
            expect(result.success).toBe(true);
            expect(result.count).toBe(1);
            expect(mockClient._mockQuery.update).toHaveBeenCalledWith(
                expect.objectContaining({ visibility: "private", custom_name: "[Deleted]" }),
            );
            expect(mockClient._mockQuery.update).toHaveBeenCalledWith(
                expect.objectContaining({ deleted_at: expect.any(String) }),
            );
        });
    });

    // ── quickAddHorse ──
    describe("quickAddHorse", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            await expect(quickAddHorse({ finishType: "OF", conditionGrade: "Mint" })).rejects.toThrow(AuthError);
        });

        it("auto-names from catalog when catalogId provided", async () => {
            // Catalog lookup
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { title: "Stablemate", maker: "Breyer" },
                error: null,
            });
            // Horse insert
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "horse-1" },
                error: null,
            });
            const result = await quickAddHorse({
                // Catalog ids are uuids — the zod boundary now enforces it.
                catalogId: "223e4567-e89b-42d3-a456-426614174001",
                finishType: "OF",
                conditionGrade: "Mint",
            });
            expect(result.success).toBe(true);
            expect(result.horseName).toBe("Breyer Stablemate");
        });

        it("uses 'Unnamed Horse' when no name or catalog", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "horse-1" },
                error: null,
            });
            const result = await quickAddHorse({
                finishType: "OF",
                conditionGrade: "Good",
            });
            expect(result.success).toBe(true);
            expect(result.horseName).toBe("Unnamed Horse");
        });

        it("rejects an invalid finish type at the zod boundary", async () => {
            const result = await quickAddHorse({
                finishType: "Chrome" as never,
                conditionGrade: "Mint",
            });
            expect(result.success).toBe(false);
            expect(mockClient._mockQuery.insert).not.toHaveBeenCalled();
        });

        it("defaults to PUBLIC so quick-added horses are show-eligible", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "horse-1" },
                error: null,
            });
            const result = await quickAddHorse({
                finishType: "OF",
                conditionGrade: "Mint",
            });
            expect(result.success).toBe(true);
            expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(
                expect.objectContaining({ is_public: true, visibility: "public" }),
            );
        });

        it("honors an explicit private choice", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({
                data: { id: "horse-1" },
                error: null,
            });
            const result = await quickAddHorse({
                finishType: "OF",
                conditionGrade: "Mint",
                isPublic: false,
            });
            expect(result.success).toBe(true);
            expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(
                expect.objectContaining({ is_public: false, visibility: "private" }),
            );
        });
    });
});

/**
 * The form engine's server boundary. Before it, these two actions applied
 * a column allow-list and nothing else: every rule lived in the browser,
 * where the caller controls it. A raw action call could write a condition
 * grade of "Sparkly", a 10,000-character name, or a negative price.
 *
 * Rollout is COMMERCE_AND_COMMS_PLAN §4.3 step 6 — impossible VALUES are
 * refused immediately; missing required fields only warn until the flag
 * has soaked, so a create path older than the engine keeps working.
 */
describe("server-side validation — the boundary that wasn't there", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: "user-1", email: "test@test.com" } },
        });
    });

    function willInsert() {
        mockClient._mockQuery.single.mockResolvedValueOnce({
            data: { id: "horse-1" },
            error: null,
        });
    }

    describe("createHorseRecord", () => {
        it("refuses a condition grade that isn't on the ladder", async () => {
            const result = await createHorseRecord({
                customName: "Forged",
                finishType: "OF",
                conditionGrade: "Sparkly",
                isPublic: true,
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Condition Grade must be one of/);
        });

        it("refuses a finish type outside the enum", async () => {
            const result = await createHorseRecord({
                customName: "Forged",
                finishType: "Original Finish",
                conditionGrade: "Mint",
                isPublic: true,
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Finish Type must be one of/);
        });

        it("refuses a name past the length cap the browser enforced alone", async () => {
            const result = await createHorseRecord({
                customName: "x".repeat(5000),
                finishType: "OF",
                conditionGrade: "Mint",
                isPublic: true,
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/too long/);
        });

        it("refuses a negative price", async () => {
            const result = await createHorseRecord({
                customName: "Star",
                finishType: "OF",
                conditionGrade: "Mint",
                isPublic: true,
                purchasePrice: -100,
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/cannot be negative/);
        });

        it("still accepts a model with no condition grade — log-only during the soak", async () => {
            willInsert();
            const result = await createHorseRecord({
                customName: "Ungraded",
                finishType: "OF",
                isPublic: true,
            });
            expect(result.success).toBe(true);
        });

        it("accepts a condition grade on tack — owner decision 6", async () => {
            willInsert();
            const result = await createHorseRecord({
                customName: "Show Halter",
                finishType: "",
                conditionGrade: "Very Good",
                assetCategory: "tack",
                isPublic: true,
            });
            expect(result.success).toBe(true);
            expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(
                expect.objectContaining({ asset_category: "tack" }),
            );
        });

        it("accepts every grade the dropdown offers, Play Grade included", async () => {
            for (const grade of ["Mint", "Body Quality", "Play Grade", "Not Graded"]) {
                willInsert();
                const result = await createHorseRecord({
                    customName: `Horse ${grade}`,
                    finishType: "OF",
                    conditionGrade: grade,
                    isPublic: true,
                });
                expect(result.success, grade).toBe(true);
            }
        });

        it("strips attribute keys the category does not own", async () => {
            willInsert();
            await createHorseRecord({
                customName: "Show Halter",
                finishType: "",
                assetCategory: "tack",
                isPublic: true,
                attributes: { tack_type: "Halter", prop_category: "Fence/Gate", evil: "payload" },
            });
            expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(
                expect.objectContaining({ attributes: { tack_type: "Halter" } }),
            );
        });

        it("writes no attributes at all for a model, whatever it is handed", async () => {
            willInsert();
            await createHorseRecord({
                customName: "Star",
                finishType: "OF",
                conditionGrade: "Mint",
                isPublic: true,
                attributes: { smuggled: "value" },
            });
            const insert = mockClient._mockQuery.insert.mock.calls.at(-1)?.[0] as Record<
                string,
                unknown
            >;
            expect(insert.attributes).toBeUndefined();
        });
    });

    describe("updateHorseAction", () => {
        it("refuses a forged condition grade", async () => {
            mockClient._setImplicitResolve({ data: {}, error: null });
            const result = await updateHorseAction("horse-1", {
                horseUpdate: { condition_grade: "Pristine Platinum" },
                vaultData: null,
                hasExistingVault: false,
                deleteVault: false,
                conditionChange: null,
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Condition Grade must be one of/);
        });

        it("refuses a trade status the database constraint would reject anyway", async () => {
            mockClient._setImplicitResolve({ data: {}, error: null });
            const result = await updateHorseAction("horse-1", {
                horseUpdate: { trade_status: "Auction" },
                vaultData: null,
                hasExistingVault: false,
                deleteVault: false,
                conditionChange: null,
            });
            expect(result.success).toBe(false);
        });

        it("refuses a negative vault value", async () => {
            mockClient._setImplicitResolve({ data: {}, error: null });
            const result = await updateHorseAction("horse-1", {
                horseUpdate: null,
                vaultData: { estimated_current_value: -1 },
                hasExistingVault: true,
                deleteVault: false,
                conditionChange: null,
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/cannot be negative/);
        });

        it("allows a normal partial edit through untouched", async () => {
            mockClient._setImplicitResolve({ data: {}, error: null });
            const result = await updateHorseAction("horse-1", {
                horseUpdate: { public_notes: "Comes with original box" },
                vaultData: null,
                hasExistingVault: false,
                deleteVault: false,
                conditionChange: null,
            });
            expect(result.success).toBe(true);
        });

        it("does not touch a tack horse's attributes when the category is unknown", async () => {
            // Guessing "model" here would clean the bag against an empty key
            // set and silently wipe it.
            mockClient._setImplicitResolve({ data: {}, error: null });
            await updateHorseAction("horse-1", {
                horseUpdate: { attributes: { tack_type: "Saddle" } },
                vaultData: null,
                hasExistingVault: false,
                deleteVault: false,
                conditionChange: null,
            });
            expect(mockClient._mockQuery.update).toHaveBeenCalledWith(
                expect.objectContaining({ attributes: { tack_type: "Saddle" } }),
            );
        });

        it("cleans the bag once the caller names the category", async () => {
            mockClient._setImplicitResolve({ data: {}, error: null });
            await updateHorseAction("horse-1", {
                horseUpdate: { attributes: { tack_type: "Saddle", prop_category: "Fence/Gate" } },
                vaultData: null,
                hasExistingVault: false,
                deleteVault: false,
                conditionChange: null,
                assetCategory: "tack",
            });
            expect(mockClient._mockQuery.update).toHaveBeenCalledWith(
                expect.objectContaining({ attributes: { tack_type: "Saddle" } }),
            );
        });

        // ── The condition note the action used to throw away ──
        // Both edit forms ask "What happened?" on a grade change; the value
        // arrived here and was never written anywhere. The Postgres trigger
        // logs the grades but can't see the note, so the action attaches it
        // to the row the trigger just wrote.
        describe("condition note", () => {
            const NOW = new Date().toISOString();

            /** The active-transaction guard reads the admin client first. */
            const noActiveTransaction = () =>
                mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

            it("attaches the note to the row the trigger just logged", async () => {
                mockClient._setImplicitResolve({ data: {}, error: null });
                noActiveTransaction();
                mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({
                    data: { id: "ch-1", new_condition: "Good", created_at: NOW },
                    error: null,
                });

                await updateHorseAction("horse-1", {
                    horseUpdate: { condition_grade: "Good" },
                    vaultData: null,
                    hasExistingVault: false,
                    deleteVault: false,
                    conditionChange: { newCondition: "Good", note: "  Rub on the near shoulder  " },
                });

                expect(mockAdmin._mockQuery.update).toHaveBeenCalledWith({
                    note: "Rub on the near shoulder",
                });
            });

            it("writes nothing when no note was given", async () => {
                mockClient._setImplicitResolve({ data: {}, error: null });
                noActiveTransaction();
                await updateHorseAction("horse-1", {
                    horseUpdate: { condition_grade: "Good" },
                    vaultData: null,
                    hasExistingVault: false,
                    deleteVault: false,
                    conditionChange: { newCondition: "Good", note: null },
                });
                expect(mockAdmin._mockQuery.update).not.toHaveBeenCalled();
            });

            it("refuses to attach the note to somebody else's log row", async () => {
                // A different grade means the newest note-less row is not the
                // one this save produced.
                mockClient._setImplicitResolve({ data: {}, error: null });
                noActiveTransaction();
                mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({
                    data: { id: "ch-old", new_condition: "Fair", created_at: NOW },
                    error: null,
                });

                await updateHorseAction("horse-1", {
                    horseUpdate: { condition_grade: "Good" },
                    vaultData: null,
                    hasExistingVault: false,
                    deleteVault: false,
                    conditionChange: { newCondition: "Good", note: "Rub" },
                });

                expect(mockAdmin._mockQuery.update).not.toHaveBeenCalled();
            });

            it("refuses to attach the note to a stale log row", async () => {
                mockClient._setImplicitResolve({ data: {}, error: null });
                noActiveTransaction();
                mockAdmin._mockQuery.maybeSingle.mockResolvedValueOnce({
                    data: {
                        id: "ch-old",
                        new_condition: "Good",
                        created_at: new Date(Date.now() - 10 * 60_000).toISOString(),
                    },
                    error: null,
                });

                await updateHorseAction("horse-1", {
                    horseUpdate: { condition_grade: "Good" },
                    vaultData: null,
                    hasExistingVault: false,
                    deleteVault: false,
                    conditionChange: { newCondition: "Good", note: "Rub" },
                });

                expect(mockAdmin._mockQuery.update).not.toHaveBeenCalled();
            });

            it("still saves the edit when the note can't be attached", async () => {
                mockClient._setImplicitResolve({ data: {}, error: null });
                noActiveTransaction();
                mockAdmin._mockQuery.maybeSingle.mockRejectedValueOnce(new Error("boom"));

                const result = await updateHorseAction("horse-1", {
                    horseUpdate: { condition_grade: "Good" },
                    vaultData: null,
                    hasExistingVault: false,
                    deleteVault: false,
                    conditionChange: { newCondition: "Good", note: "Rub" },
                });

                expect(result.success).toBe(true);
            });
        });
    });
});

describe("finalizeHorseImages — tier limits never eat the batch", () => {
    const HORSE_ID = "123e4567-e89b-42d3-a456-426614174000";

    /** Queue ONE implicit-await result (count reads, inserts) in order. */
    function queueThen(result: Record<string, unknown>) {
        mockClient._mockQuery.then.mockImplementationOnce(((
            resolve: (value: unknown) => unknown,
        ) => Promise.resolve({ error: null, ...result }).then(resolve)) as never);
    }

    function asUser(tier?: string) {
        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: "user-1", email: "t@test.com", app_metadata: tier ? { tier } : {} } },
        });
    }

    function mockOwnership() {
        mockClient._mockQuery.single.mockResolvedValueOnce({ data: { id: HORSE_ID }, error: null });
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mockClient._mockQuery.single.mockReset();
        mockClient._mockQuery.then.mockReset();
        mockClient._setImplicitResolve({ data: null, error: null, count: 0 });
        asUser();
    });

    it("free tier: standard + flaw photos all save (flaws are never Pro-gated)", async () => {
        mockOwnership();
        queueThen({ count: 0 }); // existing flaw count
        queueThen({ data: null }); // insert
        const result = await finalizeHorseImages(HORSE_ID, [
            { path: "p1", angle: "Primary_Thumbnail" },
            { path: "f1", angle: "Flaw_Rub_Damage" },
            { path: "f2", angle: "Flaw_Rub_Damage" },
        ]);
        expect(result.success).toBe(true);
        expect(result.skippedReason).toBeUndefined();
        const inserted = mockClient._mockQuery.insert.mock.calls.at(-1)?.[0] as { angle_profile: string }[];
        expect(inserted).toHaveLength(3);
    });

    it("flaw overflow past 5 skips only the overflow, with a reason", async () => {
        mockOwnership();
        queueThen({ count: 4 }); // 4 existing flaws → room for 1
        queueThen({ data: null }); // insert
        const result = await finalizeHorseImages(HORSE_ID, [
            { path: "p1", angle: "Primary_Thumbnail" },
            { path: "f1", angle: "Flaw_Rub_Damage" },
            { path: "f2", angle: "Flaw_Rub_Damage" },
            { path: "f3", angle: "Flaw_Rub_Damage" },
        ]);
        expect(result.success).toBe(true);
        expect(result.skippedExtraDetail).toBe(2);
        expect(result.skippedReason).toMatch(/flaw photo limit/i);
        const inserted = mockClient._mockQuery.insert.mock.calls.at(-1)?.[0] as { angle_profile: string }[];
        expect(inserted).toHaveLength(2); // primary + 1 flaw
    });

    it("free tier: extras skip but standard photos still save", async () => {
        mockOwnership();
        queueThen({ data: null }); // insert (no flaw count read — no flaws)
        const result = await finalizeHorseImages(HORSE_ID, [
            { path: "p1", angle: "Primary_Thumbnail" },
            { path: "e1", angle: "extra_detail" },
            { path: "e2", angle: "extra_detail" },
        ]);
        expect(result.success).toBe(true);
        expect(result.skippedExtraDetail).toBe(2);
        expect(result.skippedReason).toMatch(/pro feature/i);
        const inserted = mockClient._mockQuery.insert.mock.calls.at(-1)?.[0] as { angle_profile: string }[];
        expect(inserted).toHaveLength(1);
    });

    it("free tier: flaw overflow + extras produce a combined reason", async () => {
        mockOwnership();
        queueThen({ count: 5 }); // flaws full
        queueThen({ data: null }); // insert
        const result = await finalizeHorseImages(HORSE_ID, [
            { path: "p1", angle: "Primary_Thumbnail" },
            { path: "f1", angle: "Flaw_Rub_Damage" },
            { path: "e1", angle: "extra_detail" },
        ]);
        expect(result.success).toBe(true);
        expect(result.skippedExtraDetail).toBe(2);
        expect(result.skippedReason).toMatch(/flaw photo limit/i);
        expect(result.skippedReason).toMatch(/pro feature/i);
        const inserted = mockClient._mockQuery.insert.mock.calls.at(-1)?.[0] as { angle_profile: string }[];
        expect(inserted).toHaveLength(1);
    });

    it("pro tier: extras save under the 30 cap and skip over it", async () => {
        asUser("pro");
        mockOwnership();
        queueThen({ count: 29 }); // existing extras
        queueThen({ data: null }); // insert
        const result = await finalizeHorseImages(HORSE_ID, [
            { path: "e1", angle: "extra_detail" },
            { path: "e2", angle: "extra_detail" },
        ]);
        expect(result.success).toBe(true);
        expect(result.skippedExtraDetail).toBe(2);
        expect(result.skippedReason).toMatch(/limit reached \(29\/30\)/i);
    });
});
