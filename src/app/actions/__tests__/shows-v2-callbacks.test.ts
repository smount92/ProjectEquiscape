/**
 * Phase E2 — recordCallback ladder validation (candidate must be
 * 1st in scope, division candidates must be section champions,
 * wrong-role/status refusals, upsert semantics) plus the ring
 * console/board gate checks.
 *
 * Mock notes: maybeSingle calls are queued per action's fixed load
 * order; list reads (implicit awaits) are queued via queueList().
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";
import { AuthError } from "@/lib/auth";

const mockClient = createMockSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

import {
    getRingBoard,
    getRingConsole,
    recordCallback,
} from "@/app/actions/shows-v2-ring";

const SHOW_ID = "123e4567-e89b-42d3-a456-426614174000";
const DIVISION_ID = "523e4567-e89b-42d3-a456-426614174000";
const SECTION_ID = "423e4567-e89b-42d3-a456-426614174000";
const CLASS_1 = "223e4567-e89b-42d3-a456-426614174001";
const CLASS_2 = "223e4567-e89b-42d3-a456-426614174002";
const ENTRY_1 = "623e4567-e89b-42d3-a456-426614174001"; // 1st in class 1
const ENTRY_2 = "623e4567-e89b-42d3-a456-426614174002"; // 1st in class 2
const ENTRY_3 = "623e4567-e89b-42d3-a456-426614174003"; // 2nd in class 1

/** Queue ONE list-read result (implicit await) in call order. */
function queueList(data: unknown, error: unknown = null) {
    mockClient._mockQuery.then.mockImplementationOnce(((
        resolve: (value: unknown) => unknown,
    ) => Promise.resolve({ data, error }).then(resolve)) as never);
}

beforeEach(() => {
    vi.clearAllMocks();
    mockClient._mockQuery.single.mockReset();
    mockClient._mockQuery.single.mockResolvedValue({ data: null, error: null });
    mockClient._mockQuery.maybeSingle.mockReset();
    mockClient._mockQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockClient._mockQuery.then.mockReset();
    mockClient._setImplicitResolve({ data: null, error: null });
    mockClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-1", email: "steward@test.com" } },
    });
});

const HOSTED_LIVE_SHOW = {
    id: SHOW_ID,
    host_id: "user-1",
    status: "running",
    mode: "live",
    judging: "judged",
};

/**
 * Queue the full recordCallback load chain AFTER getShowRole:
 * divisions → sections → classes → entries → placings → callbacks,
 * then the existing-row maybeSingle.
 */
function mockLadderLoads({
    classStatuses = { [CLASS_1]: "placed", [CLASS_2]: "placed" } as Record<string, string>,
    callbacks = [] as Record<string, unknown>[],
    existingCallbackRow = null as Record<string, unknown> | null,
} = {}) {
    queueList([{ id: DIVISION_ID, name: "OF Plastic Halter", sort_order: 0 }]);
    queueList([
        { id: SECTION_ID, name: "Stock", division_id: DIVISION_ID, sort_order: 0 },
    ]);
    queueList([
        {
            id: CLASS_1,
            name: "OF Stock Foals",
            class_number: "14",
            status: classStatuses[CLASS_1],
            section_id: SECTION_ID,
            sort_order: 0,
        },
        {
            id: CLASS_2,
            name: "OF Stock Mares",
            class_number: "15",
            status: classStatuses[CLASS_2],
            section_id: SECTION_ID,
            sort_order: 1,
        },
    ]);
    queueList([
        {
            id: ENTRY_1,
            class_id: CLASS_1,
            horse_id: "h1",
            owner_id: "o1",
            entry_number: 7,
            status: "entered",
            created_at: "2026-07-01T00:00:00Z",
        },
        {
            id: ENTRY_2,
            class_id: CLASS_2,
            horse_id: "h2",
            owner_id: "o2",
            entry_number: 12,
            status: "entered",
            created_at: "2026-07-01T00:01:00Z",
        },
        {
            id: ENTRY_3,
            class_id: CLASS_1,
            horse_id: "h3",
            owner_id: "o3",
            entry_number: 9,
            status: "entered",
            created_at: "2026-07-01T00:02:00Z",
        },
    ]);
    queueList([
        { entry_id: ENTRY_1, class_id: CLASS_1, place: 1, created_at: "2026-07-10T10:00:00Z" },
        { entry_id: ENTRY_3, class_id: CLASS_1, place: 2, created_at: "2026-07-10T10:00:00Z" },
        { entry_id: ENTRY_2, class_id: CLASS_2, place: 1, created_at: "2026-07-10T10:05:00Z" },
    ]);
    queueList(callbacks);
    // The existing-row lookup for the upsert.
    mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
        data: existingCallbackRow,
        error: null,
    });
}

describe("shows-v2-ring — recordCallback input + gates", () => {
    it("rejects invalid input before touching auth", async () => {
        const result = await recordCallback({
            showId: "nope",
            scope: "section",
            scopeId: SECTION_ID,
            championEntryId: ENTRY_1,
        });
        expect(result.success).toBe(false);
        expect(mockClient.auth.getUser).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated users", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        await expect(
            recordCallback({
                showId: SHOW_ID,
                scope: "show",
                championEntryId: ENTRY_1,
            }),
        ).rejects.toThrow(AuthError);
    });

    it("zod: section scope requires its scopeId; show scope refuses one", async () => {
        const missing = await recordCallback({
            showId: SHOW_ID,
            scope: "section",
            championEntryId: ENTRY_1,
        });
        expect(missing.success).toBe(false);
        if (!missing.success) expect(missing.error).toMatch(/section and division/i);

        const extra = await recordCallback({
            showId: SHOW_ID,
            scope: "show",
            scopeId: SECTION_ID,
            championEntryId: ENTRY_1,
        });
        expect(extra.success).toBe(false);
    });

    it("zod: champion and reserve must differ", async () => {
        const result = await recordCallback({
            showId: SHOW_ID,
            scope: "section",
            scopeId: SECTION_ID,
            championEntryId: ENTRY_1,
            reserveEntryId: ENTRY_1,
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/different entries/i);
    });

    it("refuses viewers without a staff role", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({
                data: { ...HOSTED_LIVE_SHOW, host_id: "someone-else" },
                error: null,
            })
            .mockResolvedValueOnce({ data: null, error: null }); // no staff row
        const result = await recordCallback({
            showId: SHOW_ID,
            scope: "section",
            scopeId: SECTION_ID,
            championEntryId: ENTRY_1,
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/only show staff/i);
    });

    it("refuses a live show that isn't running", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: { ...HOSTED_LIVE_SHOW, status: "entries_closed" },
            error: null,
        });
        const result = await recordCallback({
            showId: SHOW_ID,
            scope: "section",
            scopeId: SECTION_ID,
            championEntryId: ENTRY_1,
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/while the show is running/i);
    });

    it("refuses an online show outside judging", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: { ...HOSTED_LIVE_SHOW, mode: "online", status: "results_review" },
            error: null,
        });
        const result = await recordCallback({
            showId: SHOW_ID,
            scope: "section",
            scopeId: SECTION_ID,
            championEntryId: ENTRY_1,
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/while the show is judging/i);
    });
});

describe("shows-v2-ring — recordCallback ladder rules", () => {
    beforeEach(() => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: HOSTED_LIVE_SHOW,
            error: null,
        });
    });

    it("refuses a section callback while a class is still unplaced", async () => {
        mockLadderLoads({ classStatuses: { [CLASS_1]: "placed", [CLASS_2]: "judging" } });
        const result = await recordCallback({
            showId: SHOW_ID,
            scope: "section",
            scopeId: SECTION_ID,
            championEntryId: ENTRY_1,
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/opens when every class/i);
        expect(mockClient._mockQuery.insert).not.toHaveBeenCalled();
    });

    it("refuses a champion that did not place 1st in the section", async () => {
        mockLadderLoads();
        const result = await recordCallback({
            showId: SHOW_ID,
            scope: "section",
            scopeId: SECTION_ID,
            championEntryId: ENTRY_3, // placed 2nd
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/1st-place entries/i);
    });

    it("refuses a reserve from outside the candidate pool", async () => {
        mockLadderLoads();
        const result = await recordCallback({
            showId: SHOW_ID,
            scope: "section",
            scopeId: SECTION_ID,
            championEntryId: ENTRY_1,
            reserveEntryId: ENTRY_3,
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/same callback candidates/i);
    });

    it("refuses an unknown section", async () => {
        mockLadderLoads();
        const result = await recordCallback({
            showId: SHOW_ID,
            scope: "section",
            scopeId: "423e4567-e89b-42d3-a456-426614179999",
            championEntryId: ENTRY_1,
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/does not belong to this show/i);
    });

    it("records a section champion + reserve (insert path)", async () => {
        mockLadderLoads();
        const result = await recordCallback({
            showId: SHOW_ID,
            scope: "section",
            scopeId: SECTION_ID,
            championEntryId: ENTRY_1,
            reserveEntryId: ENTRY_2,
        });
        expect(result).toEqual({ success: true });
        expect(mockClient._mockQuery.insert).toHaveBeenCalledWith({
            show_id: SHOW_ID,
            scope: "section",
            scope_id: SECTION_ID,
            champion_entry_id: ENTRY_1,
            reserve_entry_id: ENTRY_2,
            judge_id: "user-1",
        });
    });

    it("re-recording updates the existing row in place", async () => {
        mockLadderLoads({
            callbacks: [
                {
                    scope: "section",
                    scope_id: SECTION_ID,
                    champion_entry_id: ENTRY_2,
                    reserve_entry_id: null,
                },
            ],
            existingCallbackRow: { id: "cb-1" },
        });
        const result = await recordCallback({
            showId: SHOW_ID,
            scope: "section",
            scopeId: SECTION_ID,
            championEntryId: ENTRY_1,
        });
        expect(result).toEqual({ success: true });
        expect(mockClient._mockQuery.update).toHaveBeenCalledWith({
            champion_entry_id: ENTRY_1,
            reserve_entry_id: null,
            judge_id: "user-1",
        });
        expect(mockClient._mockQuery.insert).not.toHaveBeenCalled();
    });

    it("division champion must be a section champion", async () => {
        // Section decided: champion ENTRY_1 → division candidates = [ENTRY_1].
        mockLadderLoads({
            callbacks: [
                {
                    scope: "section",
                    scope_id: SECTION_ID,
                    champion_entry_id: ENTRY_1,
                    reserve_entry_id: null,
                },
            ],
        });
        const wrong = await recordCallback({
            showId: SHOW_ID,
            scope: "division",
            scopeId: DIVISION_ID,
            championEntryId: ENTRY_2, // 1st in its class, but NOT the section champion
        });
        expect(wrong.success).toBe(false);
        if (!wrong.success) expect(wrong.error).toMatch(/section champions/i);
    });

    it("division callback waits until every section is decided", async () => {
        mockLadderLoads(); // no section callbacks recorded yet
        const result = await recordCallback({
            showId: SHOW_ID,
            scope: "division",
            scopeId: DIVISION_ID,
            championEntryId: ENTRY_1,
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/every section champion/i);
    });

    it("grand champion must be a division champion", async () => {
        mockLadderLoads({
            callbacks: [
                {
                    scope: "section",
                    scope_id: SECTION_ID,
                    champion_entry_id: ENTRY_1,
                    reserve_entry_id: null,
                },
                {
                    scope: "division",
                    scope_id: DIVISION_ID,
                    champion_entry_id: ENTRY_1,
                    reserve_entry_id: null,
                },
            ],
        });
        const wrong = await recordCallback({
            showId: SHOW_ID,
            scope: "show",
            championEntryId: ENTRY_2,
        });
        expect(wrong.success).toBe(false);
        if (!wrong.success) expect(wrong.error).toMatch(/division champions/i);
    });

    it("records the grand champion once divisions are decided", async () => {
        mockLadderLoads({
            callbacks: [
                {
                    scope: "section",
                    scope_id: SECTION_ID,
                    champion_entry_id: ENTRY_1,
                    reserve_entry_id: null,
                },
                {
                    scope: "division",
                    scope_id: DIVISION_ID,
                    champion_entry_id: ENTRY_1,
                    reserve_entry_id: null,
                },
            ],
        });
        const result = await recordCallback({
            showId: SHOW_ID,
            scope: "show",
            championEntryId: ENTRY_1,
        });
        expect(result).toEqual({ success: true });
        expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(
            expect.objectContaining({ scope: "show", scope_id: null }),
        );
    });
});

describe("shows-v2-ring — getRingConsole gates", () => {
    it("refuses online shows (the queue is their surface)", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: { ...HOSTED_LIVE_SHOW, mode: "online" },
            error: null,
        });
        const result = await getRingConsole({ showId: SHOW_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/judge queue/i);
    });

    it("refuses non-staff viewers", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({
                data: { ...HOSTED_LIVE_SHOW, host_id: "someone-else" },
                error: null,
            })
            .mockResolvedValueOnce({ data: null, error: null });
        const result = await getRingConsole({ showId: SHOW_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/only show staff/i);
    });
});

describe("shows-v2-ring — getRingBoard gates", () => {
    it("is public but refuses online shows", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: { id: SHOW_ID, title: "July Live", mode: "online", status: "judging" },
            error: null,
        });
        const result = await getRingBoard({ showId: SHOW_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/live shows/i);
        expect(mockClient.auth.getUser).not.toHaveBeenCalled();
    });

    it("hides drafts", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: { id: SHOW_ID, title: "Draft", mode: "live", status: "draft" },
            error: null,
        });
        const result = await getRingBoard({ showId: SHOW_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/not found/i);
    });
});
