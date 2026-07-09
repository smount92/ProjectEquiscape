import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";
import { AuthError } from "@/lib/auth";

const mockClient = createMockSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

import {
    addClass,
    addDivision,
    addSection,
    addShowStaff,
    combineClasses,
    createShow,
    loadNamhsaTemplate,
    removeShowStaff,
    reorderClasslist,
    splitClass,
    transitionShowStatus,
    updateClass,
    updateShowSettings,
} from "@/app/actions/shows-v2";

const SHOW_ID = "123e4567-e89b-42d3-a456-426614174000";
const OTHER_ID = "223e4567-e89b-42d3-a456-426614174000";
const CLASS_ID = "323e4567-e89b-42d3-a456-426614174000";
const SECTION_ID = "423e4567-e89b-42d3-a456-426614174000";
const DIVISION_ID = "523e4567-e89b-42d3-a456-426614174000";
const ENTRY_ID = "623e4567-e89b-42d3-a456-426614174000";
const CLASS_ID_2 = "723e4567-e89b-42d3-a456-426614174000";

/** shows row as loaded by getShowRole */
function showRow(overrides: Record<string, unknown> = {}) {
    return {
        id: SHOW_ID,
        host_id: "user-1",
        status: "draft",
        mode: "live",
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks does NOT drop unconsumed mockResolvedValueOnce
    // queues — hard-reset the chain terminals so tests never leak
    // into each other, then restore their defaults.
    mockClient._mockQuery.single.mockReset();
    mockClient._mockQuery.single.mockResolvedValue({ data: null, error: null });
    mockClient._mockQuery.maybeSingle.mockReset();
    mockClient._mockQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockClient._mockQuery.then.mockReset(); // vitest restores the original implementation
    mockClient.rpc.mockReset();
    mockClient.rpc.mockResolvedValue({ data: null, error: null });
    mockClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-1", email: "host@test.com" } },
    });
    mockClient._setImplicitResolve({ data: null, error: null });
});

describe("shows-v2 — createShow", () => {
    it("rejects invalid input before touching auth", async () => {
        const result = await createShow({ title: "ab", mode: "live" });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/at least 3/i);
        expect(mockClient.auth.getUser).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated users", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        await expect(createShow({ title: "Spring Fling", mode: "live" })).rejects.toThrow(AuthError);
    });

    it("creates a draft show and mirrors the host into show_staff", async () => {
        mockClient._mockQuery.single.mockResolvedValueOnce({ data: { id: SHOW_ID }, error: null });
        mockClient._setImplicitResolve({ data: null, error: null }); // staff insert
        const result = await createShow({ title: "Spring Fling", mode: "live" });
        expect(result).toEqual({ success: true, showId: SHOW_ID });
        expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
            host_id: "user-1",
            title: "Spring Fling",
            mode: "live",
            judging: "judged",
            status: "draft",
            is_mhh_qualifying: true,
        }));
        expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(
            expect.objectContaining({ show_id: SHOW_ID, user_id: "user-1", role: "host" }),
        );
    });

    it("surfaces insert errors", async () => {
        mockClient._mockQuery.single.mockResolvedValueOnce({
            data: null,
            error: { message: "insert denied" },
        });
        const result = await createShow({ title: "Spring Fling", mode: "online" });
        expect(result).toEqual({ success: false, error: "insert denied" });
    });
});

describe("shows-v2 — updateShowSettings", () => {
    it("rejects an empty patch via zod", async () => {
        const result = await updateShowSettings({ showId: SHOW_ID, patch: {} });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/nothing to update/i);
    });

    it("rejects a non-manager (steward)", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow({ host_id: "someone-else" }), error: null })
            .mockResolvedValueOnce({ data: { role: "steward" }, error: null });
        const result = await updateShowSettings({ showId: SHOW_ID, patch: { title: "New Title" } });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/host or a co-host/i);
    });

    it("rejects a total stranger", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow({ host_id: "someone-else" }), error: null })
            .mockResolvedValueOnce({ data: null, error: null });
        const result = await updateShowSettings({ showId: SHOW_ID, patch: { title: "Hijacked" } });
        expect(result.success).toBe(false);
    });

    it("refuses mode changes after draft", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow({ status: "published", mode: "live" }), error: null });
        const result = await updateShowSettings({ showId: SHOW_ID, patch: { mode: "online" } });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/draft/i);
    });

    it("maps camelCase patch to snake_case columns", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow(), error: null });
        mockClient._setImplicitResolve({ data: null, error: null });
        const result = await updateShowSettings({
            showId: SHOW_ID,
            patch: { title: "Renamed", feeInfo: "PayPal only", capacity: 40 },
        });
        expect(result).toEqual({ success: true });
        expect(mockClient._mockQuery.update).toHaveBeenCalledWith({
            title: "Renamed",
            fee_info: "PayPal only",
            capacity: 40,
        });
    });

    it("co-host may edit settings", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow({ host_id: "someone-else" }), error: null })
            .mockResolvedValueOnce({ data: { role: "co_host" }, error: null });
        mockClient._setImplicitResolve({ data: null, error: null });
        const result = await updateShowSettings({ showId: SHOW_ID, patch: { title: "Co-hosted" } });
        expect(result).toEqual({ success: true });
    });
});

describe("shows-v2 — transitionShowStatus", () => {
    it("applies a legal transition", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow({ status: "draft" }), error: null });
        mockClient._setImplicitResolve({ data: null, error: null });
        const result = await transitionShowStatus({ showId: SHOW_ID, to: "published" });
        expect(result).toEqual({ success: true });
        expect(mockClient._mockQuery.update).toHaveBeenCalledWith({ status: "published" });
    });

    it("refuses an illegal jump with the state machine's reason", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow({ status: "draft" }), error: null });
        const result = await transitionShowStatus({ showId: SHOW_ID, to: "completed" });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/cannot go from draft/i);
        expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
    });

    it("enforces the mode gate (live show cannot enter judging)", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow({ status: "entries_closed", mode: "live" }), error: null });
        const result = await transitionShowStatus({ showId: SHOW_ID, to: "judging" });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/only online shows/i);
    });

    it("judges cannot transition the show", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow({ host_id: "someone-else" }), error: null })
            .mockResolvedValueOnce({ data: { role: "judge" }, error: null });
        const result = await transitionShowStatus({ showId: SHOW_ID, to: "published" });
        expect(result.success).toBe(false);
    });

    it("errors cleanly when the show does not exist", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
        const result = await transitionShowStatus({ showId: SHOW_ID, to: "published" });
        expect(result).toEqual({ success: false, error: "Show not found." });
    });
});

describe("shows-v2 — classlist structure", () => {
    it("addDivision inserts with axis for the manager", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow(), error: null });
        mockClient._mockQuery.single.mockResolvedValueOnce({ data: { id: DIVISION_ID }, error: null });
        const result = await addDivision({ showId: SHOW_ID, name: "OF Plastic Halter", axis: "halter" });
        expect(result).toEqual({ success: true, divisionId: DIVISION_ID });
        expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
            show_id: SHOW_ID,
            name: "OF Plastic Halter",
            axis: "halter",
        }));
    });

    it("addDivision refuses non-staff", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow({ host_id: "someone-else" }), error: null })
            .mockResolvedValueOnce({ data: null, error: null });
        const result = await addDivision({ showId: SHOW_ID, name: "Sneaky Division" });
        expect(result.success).toBe(false);
    });

    it("addSection resolves the show through its division", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: { id: DIVISION_ID, show_id: SHOW_ID }, error: null }) // division
            .mockResolvedValueOnce({ data: showRow(), error: null }); // show
        mockClient._mockQuery.single.mockResolvedValueOnce({ data: { id: SECTION_ID }, error: null });
        const result = await addSection({ divisionId: DIVISION_ID, name: "Stock Breeds" });
        expect(result).toEqual({ success: true, sectionId: SECTION_ID });
    });

    it("addSection errors when division is missing", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
        const result = await addSection({ divisionId: DIVISION_ID, name: "Orphan" });
        expect(result).toEqual({ success: false, error: "Division not found." });
    });

    it("addClass walks section → division → show and inserts scheduled", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: { id: SECTION_ID, division_id: DIVISION_ID }, error: null })
            .mockResolvedValueOnce({ data: { id: DIVISION_ID, show_id: SHOW_ID }, error: null })
            .mockResolvedValueOnce({ data: showRow(), error: null });
        mockClient._mockQuery.single.mockResolvedValueOnce({ data: { id: CLASS_ID }, error: null });
        const result = await addClass({
            sectionId: SECTION_ID,
            name: "Quarter Horse",
            classNumber: "110",
            maxPerEntrant: 2,
        });
        expect(result).toEqual({ success: true, classId: CLASS_ID });
        expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
            section_id: SECTION_ID,
            name: "Quarter Horse",
            class_number: "110",
            status: "scheduled",
            max_per_entrant: 2,
            is_qualifying: true,
        }));
    });

    it("reorderClasslist calls the batch RPC once (no per-row loop)", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow(), error: null });
        mockClient.rpc.mockResolvedValueOnce({ data: 2, error: null });
        const result = await reorderClasslist({
            showId: SHOW_ID,
            kind: "class",
            items: [
                { id: CLASS_ID, sortOrder: 1 },
                { id: OTHER_ID, sortOrder: 0 },
            ],
        });
        expect(result).toEqual({ success: true, updated: 2 });
        expect(mockClient.rpc).toHaveBeenCalledTimes(1);
        expect(mockClient.rpc).toHaveBeenCalledWith("reorder_show_nodes", {
            p_kind: "class",
            p_ids: [CLASS_ID, OTHER_ID],
            p_sort_orders: [1, 0],
        });
    });
});

describe("shows-v2 — updateClass (steward limits + class state machine)", () => {
    function mockClassChain(clsOverrides: Record<string, unknown>, role: string | null, hostId = "someone-else") {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({
                data: { id: CLASS_ID, section_id: SECTION_ID, status: "scheduled", ...clsOverrides },
                error: null,
            })
            .mockResolvedValueOnce({ data: { id: SECTION_ID, division_id: DIVISION_ID }, error: null })
            .mockResolvedValueOnce({ data: { id: DIVISION_ID, show_id: SHOW_ID }, error: null })
            .mockResolvedValueOnce({ data: showRow({ host_id: hostId }), error: null });
        if (hostId !== "user-1") {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
                data: role ? { role } : null,
                error: null,
            });
        }
    }

    it("steward may flip status", async () => {
        mockClassChain({ status: "called" }, "steward");
        mockClient._setImplicitResolve({ data: null, error: null });
        const result = await updateClass({ classId: CLASS_ID, patch: { status: "judging" } });
        expect(result).toEqual({ success: true });
        expect(mockClient._mockQuery.update).toHaveBeenCalledWith({ status: "judging" });
    });

    it("steward may NOT edit structure", async () => {
        mockClassChain({}, "steward");
        const result = await updateClass({ classId: CLASS_ID, patch: { name: "Renamed" } });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/stewards can update class status/i);
    });

    it("judge may not update classes at all", async () => {
        mockClassChain({}, "judge");
        const result = await updateClass({ classId: CLASS_ID, patch: { status: "judging" } });
        expect(result.success).toBe(false);
    });

    it("host edits structure freely", async () => {
        mockClassChain({}, null, "user-1");
        mockClient._setImplicitResolve({ data: null, error: null });
        const result = await updateClass({
            classId: CLASS_ID,
            patch: { name: "Appaloosa", maxPerEntrant: null },
        });
        expect(result).toEqual({ success: true });
        expect(mockClient._mockQuery.update).toHaveBeenCalledWith({
            name: "Appaloosa",
            max_per_entrant: null,
        });
    });

    it("illegal class status jumps are refused via the state machine", async () => {
        mockClassChain({ status: "placed" }, null, "user-1");
        const result = await updateClass({ classId: CLASS_ID, patch: { status: "scheduled" } });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/cannot go from placed/i);
    });
});

describe("shows-v2 — splitClass", () => {
    function mockSplitContext(status = "scheduled") {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({
                data: {
                    id: CLASS_ID, section_id: SECTION_ID, name: "Other Stock",
                    class_number: "114", status, max_per_entrant: null,
                    allowed_scales: null, allowed_finishes: null,
                    is_qualifying: true, sort_order: 4,
                },
                error: null,
            })
            .mockResolvedValueOnce({ data: { id: SECTION_ID, division_id: DIVISION_ID }, error: null })
            .mockResolvedValueOnce({ data: { id: DIVISION_ID, show_id: SHOW_ID }, error: null })
            .mockResolvedValueOnce({ data: showRow(), error: null });
    }

    it("refuses splitting a class already judging", async () => {
        mockSplitContext("judging");
        const result = await splitClass({
            classId: CLASS_ID,
            newClassName: "Other Stock B",
            entryIdsToMove: [ENTRY_ID],
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/scheduled or called/i);
    });

    it("refuses when a selected entry is not in the class", async () => {
        mockSplitContext();
        mockClient._setImplicitResolve({ data: [], error: null }); // entries lookup finds none
        const result = await splitClass({
            classId: CLASS_ID,
            newClassName: "Other Stock B",
            entryIdsToMove: [ENTRY_ID],
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/do not belong/i);
    });

    it("creates the split class with lineage and moves entries in one batch", async () => {
        mockSplitContext();
        mockClient._setImplicitResolve({ data: [{ id: ENTRY_ID }], error: null });
        mockClient._mockQuery.single.mockResolvedValueOnce({ data: { id: CLASS_ID_2 }, error: null });
        const result = await splitClass({
            classId: CLASS_ID,
            newClassName: "Other Stock B",
            entryIdsToMove: [ENTRY_ID],
        });
        expect(result).toEqual({ success: true, newClassId: CLASS_ID_2 });
        expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
            section_id: SECTION_ID,
            name: "Other Stock B",
            split_from_class_id: CLASS_ID,
            status: "scheduled",
            is_qualifying: true,
        }));
        expect(mockClient._mockQuery.update).toHaveBeenCalledWith({ class_id: CLASS_ID_2 });
        expect(mockClient._mockQuery.in).toHaveBeenCalledWith("id", [ENTRY_ID]);
    });
});

describe("shows-v2 — combineClasses", () => {
    it("refuses when any source class is not combinable", async () => {
        mockClient._setImplicitResolve({
            data: [
                { id: CLASS_ID, section_id: SECTION_ID, status: "scheduled", is_qualifying: true },
                { id: CLASS_ID_2, section_id: SECTION_ID, status: "placed", is_qualifying: true },
            ],
            error: null,
        });
        const result = await combineClasses({
            classIds: [CLASS_ID, CLASS_ID_2],
            newClassName: "Combined Stock",
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/scheduled or called/i);
    });

    it("refuses when a class id is missing", async () => {
        mockClient._setImplicitResolve({
            data: [{ id: CLASS_ID, section_id: SECTION_ID, status: "scheduled", is_qualifying: true }],
            error: null,
        });
        const result = await combineClasses({
            classIds: [CLASS_ID, CLASS_ID_2],
            newClassName: "Combined Stock",
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/not found/i);
    });

    it("combines: creates the target, moves live entries, closes sources with lineage", async () => {
        mockClient._setImplicitResolve({
            data: [
                { id: CLASS_ID, section_id: SECTION_ID, status: "scheduled", is_qualifying: true },
                { id: CLASS_ID_2, section_id: SECTION_ID, status: "called", is_qualifying: false },
            ],
            error: null,
        });
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: { id: SECTION_ID, division_id: DIVISION_ID }, error: null })
            .mockResolvedValueOnce({ data: { id: DIVISION_ID, show_id: SHOW_ID }, error: null })
            .mockResolvedValueOnce({ data: showRow(), error: null });
        mockClient._mockQuery.single.mockResolvedValueOnce({ data: { id: OTHER_ID }, error: null });

        const result = await combineClasses({
            classIds: [CLASS_ID, CLASS_ID_2],
            newClassName: "Combined Stock",
        });
        expect(result).toEqual({ success: true, newClassId: OTHER_ID });
        // combined class only qualifies if EVERY source did
        expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
            name: "Combined Stock",
            is_qualifying: false,
            status: "scheduled",
        }));
        // live entries moved, scratched left behind
        expect(mockClient._mockQuery.update).toHaveBeenCalledWith({ class_id: OTHER_ID });
        expect(mockClient._mockQuery.neq).toHaveBeenCalledWith("status", "scratched");
        // sources closed with lineage
        expect(mockClient._mockQuery.update).toHaveBeenCalledWith({
            status: "combined",
            combined_into_class_id: OTHER_ID,
        });
    });
});

describe("shows-v2 — loadNamhsaTemplate", () => {
    it("refuses unknown template keys", async () => {
        const result = await loadNamhsaTemplate({ showId: SHOW_ID, templateKey: "mystery" });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/unknown template/i);
    });

    it("refuses once entries are open", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow({ status: "entries_open" }), error: null });
        const result = await loadNamhsaTemplate({ showId: SHOW_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/before entries open/i);
    });

    it("inserts divisions → sections → classes as three batches", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow(), error: null });

        const divisionRows = [
            { id: "d1", name: "Breed Halter" },
            { id: "d2", name: "Performance" },
            { id: "d3", name: "Collectibility & Fun" },
        ];
        const sectionRows = [
            { id: "s1", name: "Light Breeds", division_id: "d1" },
            { id: "s2", name: "Sport Breeds", division_id: "d1" },
            { id: "s3", name: "Stock Breeds", division_id: "d1" },
            { id: "s4", name: "Draft & Pony", division_id: "d1" },
            { id: "s5", name: "Other", division_id: "d1" },
            { id: "s6", name: "Western", division_id: "d2" },
            { id: "s7", name: "English", division_id: "d2" },
            { id: "s8", name: "Other Performance", division_id: "d2" },
            { id: "s9", name: "Breyer Collectibility", division_id: "d3" },
            { id: "s10", name: "Fun Classes", division_id: "d3" },
        ];
        mockClient._mockQuery.then
            .mockImplementationOnce((resolve: (v: unknown) => void) =>
                Promise.resolve({ data: divisionRows, error: null }).then(resolve))
            .mockImplementationOnce((resolve: (v: unknown) => void) =>
                Promise.resolve({ data: sectionRows, error: null }).then(resolve))
            .mockImplementationOnce((resolve: (v: unknown) => void) =>
                Promise.resolve({ data: null, error: null }).then(resolve));

        const result = await loadNamhsaTemplate({ showId: SHOW_ID });
        expect(result).toEqual({ success: true, divisions: 3, sections: 10, classes: 41 });
        expect(mockClient._mockQuery.insert).toHaveBeenCalledTimes(3);
        // classes batch contains all 41 rows
        const classBatch = mockClient._mockQuery.insert.mock.calls[2][0];
        expect(Array.isArray(classBatch)).toBe(true);
        expect(classBatch).toHaveLength(41);
        expect(classBatch[0]).toEqual(expect.objectContaining({
            section_id: "s1",
            name: "Arabian",
            class_number: "101",
            status: "scheduled",
        }));
    });
});

describe("shows-v2 — staff management (host only)", () => {
    it("co-host may NOT manage staff", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow({ host_id: "someone-else" }), error: null })
            .mockResolvedValueOnce({ data: { role: "co_host" }, error: null });
        const result = await addShowStaff({ showId: SHOW_ID, userId: OTHER_ID, role: "steward" });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/only the show host/i);
    });

    it("host adds a judge", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow(), error: null });
        mockClient._mockQuery.single.mockResolvedValueOnce({ data: { id: "staff-1" }, error: null });
        const result = await addShowStaff({
            showId: SHOW_ID,
            userId: OTHER_ID,
            role: "judge",
            coiFlag: true,
            coiNote: "Also entering the OF division",
        });
        expect(result).toEqual({ success: true, staffId: "staff-1" });
        expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
            show_id: SHOW_ID,
            user_id: OTHER_ID,
            role: "judge",
            coi_flag: true,
            coi_note: "Also entering the OF division",
        }));
    });

    it("zod refuses granting the host role", async () => {
        const result = await addShowStaff({
            showId: SHOW_ID,
            userId: OTHER_ID,
            role: "host" as never,
        });
        expect(result.success).toBe(false);
    });

    it("host cannot add themself", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow(), error: null });
        const result = await addShowStaff({ showId: SHOW_ID, userId: "user-1" as never, role: "steward" });
        expect(result.success).toBe(false);
    });

    it("duplicate staff insert maps the unique violation to a friendly error", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow(), error: null });
        mockClient._mockQuery.single.mockResolvedValueOnce({
            data: null,
            error: { code: "23505", message: "duplicate key value" },
        });
        const result = await addShowStaff({ showId: SHOW_ID, userId: OTHER_ID, role: "steward" });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/already has a role/i);
    });

    it("removeShowStaff refuses to remove the host row", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow({ host_id: "user-1" }), error: null });
        // removing self-as-host: userId must be a uuid, so use a uuid host
        const result = await removeShowStaff({ showId: SHOW_ID, userId: OTHER_ID });
        // OTHER_ID is not the host — allowed path; now test the host-protection path
        expect(result).toEqual({ success: true });

        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow({ host_id: OTHER_ID }), error: null })
            .mockResolvedValueOnce({ data: { role: "host" }, error: null });
        const blocked = await removeShowStaff({ showId: SHOW_ID, userId: OTHER_ID });
        expect(blocked.success).toBe(false);
    });

    it("steward cannot remove staff", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow({ host_id: "someone-else" }), error: null })
            .mockResolvedValueOnce({ data: { role: "steward" }, error: null });
        const result = await removeShowStaff({ showId: SHOW_ID, userId: OTHER_ID });
        expect(result.success).toBe(false);
    });
});
