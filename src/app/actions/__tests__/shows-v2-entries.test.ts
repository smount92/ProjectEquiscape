/**
 * Phase D — enterClass / scratchEntry action tests.
 *
 * enterClass loads context through a fixed maybeSingle sequence
 * (class → section → division → show → horse → [photo]), one
 * implicit await (the show's existing entries, with each entry's
 * division axis nested), then INSERTs via .select().single().
 * The mocks below queue exactly that.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";
import { AuthError } from "@/lib/auth";

const mockClient = createMockSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

import { enterClass, scratchEntry } from "@/app/actions/shows-v2";

const SHOW_ID = "123e4567-e89b-42d3-a456-426614174000";
const CLASS_ID = "223e4567-e89b-42d3-a456-426614174000";
const OTHER_CLASS_ID = "323e4567-e89b-42d3-a456-426614174000";
const SECTION_ID = "423e4567-e89b-42d3-a456-426614174000";
const DIVISION_ID = "523e4567-e89b-42d3-a456-426614174000";
const HORSE_ID = "623e4567-e89b-42d3-a456-426614174000";
const OTHER_HORSE_ID = "723e4567-e89b-42d3-a456-426614174000";
const PHOTO_ID = "823e4567-e89b-42d3-a456-426614174000";
const HANDLER_ID = "923e4567-e89b-42d3-a456-426614174000";
const ENTRY_ID = "a23e4567-e89b-42d3-a456-426614174000";

// ── Context row factories (the maybeSingle sequence) ──

function classRow(overrides: Record<string, unknown> = {}) {
    return {
        id: CLASS_ID,
        section_id: SECTION_ID,
        status: "scheduled",
        max_per_entrant: null,
        allowed_scales: null,
        allowed_finishes: null,
        ...overrides,
    };
}

const sectionRow = { id: SECTION_ID, division_id: DIVISION_ID };

function divisionRow(overrides: Record<string, unknown> = {}) {
    return { id: DIVISION_ID, show_id: SHOW_ID, axis: "halter", ...overrides };
}

function showRow(overrides: Record<string, unknown> = {}) {
    return {
        id: SHOW_ID,
        mode: "live",
        status: "entries_open",
        entries_close_at: null,
        ...overrides,
    };
}

function horseRow(overrides: Record<string, unknown> = {}) {
    return {
        id: HORSE_ID,
        owner_id: "user-1",
        is_public: true,
        deleted_at: null,
        finish_type: "OF",
        catalog_items: { scale: "Traditional" },
        ...overrides,
    };
}

/** An existing entry at the show, in the nested-axis select shape. */
function existingEntry(overrides: Record<string, unknown> = {}, axis = "performance") {
    return {
        class_id: OTHER_CLASS_ID,
        horse_id: OTHER_HORSE_ID,
        owner_id: "user-2",
        status: "entered",
        entry_number: 4,
        show_classes: { show_sections: { show_divisions: { axis } } },
        ...overrides,
    };
}

/** Queue the standard context walk: class → section → division → show → horse. */
function queueEntryContext(opts: {
    cls?: Record<string, unknown>;
    division?: Record<string, unknown>;
    show?: Record<string, unknown>;
    horse?: Record<string, unknown>;
} = {}) {
    mockClient._mockQuery.maybeSingle
        .mockResolvedValueOnce({ data: classRow(opts.cls), error: null })
        .mockResolvedValueOnce({ data: sectionRow, error: null })
        .mockResolvedValueOnce({ data: divisionRow(opts.division), error: null })
        .mockResolvedValueOnce({ data: showRow(opts.show), error: null })
        .mockResolvedValueOnce({ data: horseRow(opts.horse), error: null });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockClient._mockQuery.single.mockReset();
    mockClient._mockQuery.single.mockResolvedValue({ data: null, error: null });
    mockClient._mockQuery.maybeSingle.mockReset();
    mockClient._mockQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockClient._mockQuery.then.mockReset();
    mockClient.rpc.mockReset();
    mockClient.rpc.mockResolvedValue({ data: null, error: null });
    mockClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-1", email: "entrant@test.com" } },
    });
    // Default: the show has no entries yet.
    mockClient._setImplicitResolve({ data: [], error: null });
});

describe("shows-v2 — enterClass", () => {
    it("rejects invalid input before touching auth", async () => {
        const result = await enterClass({ classId: "not-a-uuid", horseId: HORSE_ID });
        expect(result.success).toBe(false);
        expect(mockClient.auth.getUser).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated users", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        await expect(enterClass({ classId: CLASS_ID, horseId: HORSE_ID })).rejects.toThrow(
            AuthError,
        );
    });

    it("surfaces ALL validateEntry violations verbatim, and does not insert", async () => {
        // Two independent violations: entries not open AND not the owner's horse.
        queueEntryContext({
            show: { status: "published" },
            horse: { owner_id: "someone-else" },
        });

        const result = await enterClass({ classId: CLASS_ID, horseId: HORSE_ID });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.violations).toHaveLength(2);
            expect(result.violations?.[0]).toMatch(/entries are not open/i);
            expect(result.violations?.[1]).toMatch(/only enter horses you own/i);
            expect(result.error).toMatch(/entries are not open/i);
        }
        expect(mockClient._mockQuery.insert).not.toHaveBeenCalled();
    });

    it("refuses a private horse with a stable-first pointer", async () => {
        queueEntryContext({ horse: { is_public: false } });
        const result = await enterClass({ classId: CLASS_ID, horseId: HORSE_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/public horses/i);
        expect(mockClient._mockQuery.insert).not.toHaveBeenCalled();
    });

    it("online shows require an entry photo", async () => {
        queueEntryContext({ show: { mode: "online" } });
        const result = await enterClass({ classId: CLASS_ID, horseId: HORSE_ID });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.violations).toEqual([
                expect.stringMatching(/online shows judge a photo/i),
            ]);
        }
        expect(mockClient._mockQuery.insert).not.toHaveBeenCalled();
    });

    it("refuses a photo that belongs to another horse", async () => {
        queueEntryContext({ show: { mode: "online" } });
        // Sixth maybeSingle: the photo row.
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: { id: PHOTO_ID, horse_id: OTHER_HORSE_ID },
            error: null,
        });
        const result = await enterClass({
            classId: CLASS_ID,
            horseId: HORSE_ID,
            photoId: PHOTO_ID,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.violations).toEqual([
                expect.stringMatching(/does not belong to the selected horse/i),
            ]);
        }
        expect(mockClient._mockQuery.insert).not.toHaveBeenCalled();
    });

    it("enters a live show: max+1 entry number, no photo, no handler", async () => {
        queueEntryContext();
        mockClient._setImplicitResolve({ data: [existingEntry()], error: null });
        mockClient._mockQuery.single.mockResolvedValueOnce({
            data: { id: ENTRY_ID },
            error: null,
        });

        const result = await enterClass({ classId: CLASS_ID, horseId: HORSE_ID });
        expect(result).toEqual({ success: true, entryId: ENTRY_ID, entryNumber: 5 });
        expect(mockClient._mockQuery.insert).toHaveBeenCalledWith({
            show_id: SHOW_ID,
            class_id: CLASS_ID,
            horse_id: HORSE_ID,
            owner_id: "user-1",
            handler_id: null,
            entry_number: 5,
            photo_id: null,
            status: "entered",
        });
    });

    it("the same horse keeps its leg-tag number across classes", async () => {
        queueEntryContext();
        mockClient._setImplicitResolve({
            data: [
                existingEntry({ horse_id: HORSE_ID, owner_id: "user-1", entry_number: 2 }),
                existingEntry({ entry_number: 7 }),
            ],
            error: null,
        });
        mockClient._mockQuery.single.mockResolvedValueOnce({
            data: { id: ENTRY_ID },
            error: null,
        });

        const result = await enterClass({ classId: CLASS_ID, horseId: HORSE_ID });
        expect(result).toEqual({ success: true, entryId: ENTRY_ID, entryNumber: 2 });
        expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(
            expect.objectContaining({ entry_number: 2 }),
        );
    });

    it("enforces the one-breed-halter-class declaration", async () => {
        queueEntryContext(); // target division axis = halter
        mockClient._setImplicitResolve({
            data: [
                existingEntry(
                    { horse_id: HORSE_ID, owner_id: "user-1", entry_number: 2 },
                    "halter",
                ),
            ],
            error: null,
        });

        const result = await enterClass({ classId: CLASS_ID, horseId: HORSE_ID });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.violations).toEqual([
                expect.stringMatching(/already entered in a breed halter class/i),
            ]);
        }
        expect(mockClient._mockQuery.insert).not.toHaveBeenCalled();
    });

    it("proxy showing: the handler travels on the entry", async () => {
        queueEntryContext({ show: { mode: "online" } });
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: { id: PHOTO_ID, horse_id: HORSE_ID },
            error: null,
        });
        mockClient._mockQuery.single.mockResolvedValueOnce({
            data: { id: ENTRY_ID },
            error: null,
        });

        const result = await enterClass({
            classId: CLASS_ID,
            horseId: HORSE_ID,
            photoId: PHOTO_ID,
            handlerId: HANDLER_ID,
        });
        expect(result).toEqual({ success: true, entryId: ENTRY_ID, entryNumber: 1 });
        expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(
            expect.objectContaining({ handler_id: HANDLER_ID, photo_id: PHOTO_ID }),
        );
    });

    it("naming yourself as handler stores no proxy", async () => {
        // Auth as a uuid user so handlerId === user.id can be expressed.
        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: HANDLER_ID, email: "self@test.com" } },
        });
        queueEntryContext({ horse: { owner_id: HANDLER_ID } });
        mockClient._mockQuery.single.mockResolvedValueOnce({
            data: { id: ENTRY_ID },
            error: null,
        });

        const result = await enterClass({
            classId: CLASS_ID,
            horseId: HORSE_ID,
            handlerId: HANDLER_ID,
        });
        expect(result.success).toBe(true);
        expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(
            expect.objectContaining({ handler_id: null, owner_id: HANDLER_ID }),
        );
    });

    it("maps the partial-unique race to a friendly duplicate message", async () => {
        queueEntryContext();
        mockClient._mockQuery.single.mockResolvedValueOnce({
            data: null,
            error: { code: "23505", message: "duplicate key value" },
        });

        const result = await enterClass({ classId: CLASS_ID, horseId: HORSE_ID });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toMatch(/already entered in this class/i);
        }
    });
});

describe("shows-v2 — scratchEntry", () => {
    it("rejects invalid input before touching auth", async () => {
        const result = await scratchEntry({ entryId: "nope" });
        expect(result.success).toBe(false);
        expect(mockClient.auth.getUser).not.toHaveBeenCalled();
    });

    it("errors when the entry is missing", async () => {
        const result = await scratchEntry({ entryId: ENTRY_ID });
        expect(result).toEqual({ success: false, error: "Entry not found." });
    });

    it("only the owner can scratch", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: { id: ENTRY_ID, owner_id: "user-2", status: "entered", show_id: SHOW_ID },
            error: null,
        });
        const result = await scratchEntry({ entryId: ENTRY_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/owner/i);
        expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
    });

    it("refuses a double scratch", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: { id: ENTRY_ID, owner_id: "user-1", status: "scratched", show_id: SHOW_ID },
            error: null,
        });
        const result = await scratchEntry({ entryId: ENTRY_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/already scratched/i);
    });

    it("refuses once entries have closed", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({
                data: { id: ENTRY_ID, owner_id: "user-1", status: "entered", show_id: SHOW_ID },
                error: null,
            })
            .mockResolvedValueOnce({
                data: { id: SHOW_ID, status: "entries_closed" },
                error: null,
            });
        const result = await scratchEntry({ entryId: ENTRY_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/entries are closed/i);
        expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
    });

    it("scratches the owner's entry while entries are open", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({
                data: { id: ENTRY_ID, owner_id: "user-1", status: "entered", show_id: SHOW_ID },
                error: null,
            })
            .mockResolvedValueOnce({
                data: { id: SHOW_ID, status: "entries_open" },
                error: null,
            });
        mockClient._setImplicitResolve({ data: null, error: null }); // the UPDATE

        const result = await scratchEntry({ entryId: ENTRY_ID });
        expect(result).toEqual({ success: true });
        expect(mockClient._mockQuery.update).toHaveBeenCalledWith({ status: "scratched" });
        expect(mockClient._mockQuery.eq).toHaveBeenCalledWith("owner_id", "user-1");
    });
});
