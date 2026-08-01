import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabaseClient, createMockAdminClient } from "@/__tests__/mocks/supabase";

const mockClient = createMockSupabaseClient();
const mockAdmin = createMockAdminClient();
/** Typed view of the shared query mock (its members are `unknown`). */
const q = mockClient._mockQuery as Record<string, ReturnType<typeof vi.fn>>;

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));
vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => mockAdmin),
}));
vi.mock("next/server", () => ({
    after: vi.fn((fn: () => void) => {
        fn(); // execute immediately in tests
    }),
}));
vi.mock("@/lib/shows/notifications", () => ({
    runClassChangeFanout: vi.fn().mockResolvedValue(undefined),
    runEntryScratchedNotification: vi.fn().mockResolvedValue(undefined),
    runResultsPublishedFanout: vi.fn().mockResolvedValue(undefined),
    runStaffAddedNotification: vi.fn().mockResolvedValue(undefined),
    runVotingOpenedFanout: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { scratchEntry } from "@/app/actions/shows-v2";
import { runEntryScratchedNotification } from "@/lib/shows/notifications";

const ENTRY_ID = "6b2e0d3c-1111-4444-8888-aaaaaaaaaaaa";

const ENTRY = {
    id: ENTRY_ID,
    owner_id: "owner-1",
    status: "entered",
    show_id: "show-1",
    class_id: "class-1",
    horse_id: "horse-1",
};

/** Queue: entry row → show row → (optional) staff row. */
function stubReads(input: {
    entry?: Partial<typeof ENTRY> | null;
    show: { host_id: string; status: string } | null;
    staffRole?: string | null;
}) {
    const entry = input.entry === null ? null : { ...ENTRY, ...input.entry };
    q.maybeSingle.mockResolvedValueOnce({ data: entry, error: null });
    q.maybeSingle.mockResolvedValueOnce({
        data: input.show
            ? { id: "show-1", host_id: input.show.host_id, status: input.show.status, mode: "live", judging: "judged" }
            : null,
        error: null,
    });
    if (input.staffRole !== undefined) {
        q.maybeSingle.mockResolvedValueOnce({
            data: input.staffRole === null ? null : { role: input.staffRole },
            error: null,
        });
    }
}

function signInAs(userId: string) {
    mockClient.auth.getUser.mockResolvedValue({
        data: { user: { id: userId, email: "t@t.test" } },
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    q.maybeSingle.mockReset();
    q.maybeSingle.mockResolvedValue({ data: null, error: null });
    // The scratch UPDATE is self-verifying (.select after .update) —
    // resolve it with one updated row by default.
    mockClient._setImplicitResolve({ data: [{ id: ENTRY_ID }], error: null });
});

describe("scratchEntry — owner door (unchanged rule: entries_open only)", () => {
    it("lets the owner scratch while entries are open, without notifying anyone", async () => {
        signInAs("owner-1");
        stubReads({ show: { host_id: "host-1", status: "entries_open" }, staffRole: null });

        const result = await scratchEntry({ entryId: ENTRY_ID });
        expect(result).toEqual({ success: true });
        expect(q.update).toHaveBeenCalledWith(
            expect.objectContaining({ status: "scratched" }),
        );
        expect(runEntryScratchedNotification).not.toHaveBeenCalled();
    });

    it("after entries close, the owner is told to ask the host — which now works", async () => {
        signInAs("owner-1");
        stubReads({ show: { host_id: "host-1", status: "entries_closed" }, staffRole: null });

        const result = await scratchEntry({ entryId: ENTRY_ID });
        expect(result).toEqual({
            success: false,
            error: "Entries are closed — ask the host to scratch this entry for you.",
        });
        expect(q.update).not.toHaveBeenCalled();
    });
});

describe("scratchEntry — staff door (Batch 2)", () => {
    it("the host may scratch any live entry after entries close, and the owner is notified with the reason", async () => {
        signInAs("host-1");
        // host_id matches the caller → getShowRole resolves 'host' with no staff query
        stubReads({ show: { host_id: "host-1", status: "entries_closed" } });

        const result = await scratchEntry({ entryId: ENTRY_ID, reason: "Model broke in transit" });
        expect(result).toEqual({ success: true });
        expect(q.update).toHaveBeenCalledWith(
            expect.objectContaining({
                status: "scratched",
                note: "Scratched by show staff: Model broke in transit",
            }),
        );
        expect(runEntryScratchedNotification).toHaveBeenCalledWith(
            mockAdmin,
            expect.objectContaining({
                showId: "show-1",
                classId: "class-1",
                horseId: "horse-1",
                ownerId: "owner-1",
                scratchedByUserId: "host-1",
                reason: "Model broke in transit",
            }),
        );
    });

    it("a steward may scratch during judging", async () => {
        signInAs("steward-1");
        stubReads({ show: { host_id: "host-1", status: "judging" }, staffRole: "steward" });

        const result = await scratchEntry({ entryId: ENTRY_ID });
        expect(result).toEqual({ success: true });
        expect(runEntryScratchedNotification).toHaveBeenCalled();
    });

    it("a judge is NOT entry staff — refused like any third party", async () => {
        signInAs("judge-1");
        stubReads({ show: { host_id: "host-1", status: "entries_closed" }, staffRole: "judge" });

        const result = await scratchEntry({ entryId: ENTRY_ID });
        expect(result).toEqual({
            success: false,
            error: "Only the entry's owner or the show's staff can scratch an entry.",
        });
    });

    it("once the show completes, results are final for staff too", async () => {
        signInAs("host-1");
        stubReads({ show: { host_id: "host-1", status: "completed" } });

        const result = await scratchEntry({ entryId: ENTRY_ID });
        expect(result).toEqual({
            success: false,
            error: "This show's results are final — entries can no longer be scratched.",
        });
        expect(q.update).not.toHaveBeenCalled();
    });

    it("staff scratching their OWN entry does not self-notify", async () => {
        signInAs("host-1");
        stubReads({
            entry: { owner_id: "host-1" },
            show: { host_id: "host-1", status: "entries_closed" },
        });

        const result = await scratchEntry({ entryId: ENTRY_ID });
        expect(result).toEqual({ success: true });
        expect(runEntryScratchedNotification).not.toHaveBeenCalled();
    });
});

describe("scratchEntry — guardrails", () => {
    it("refuses a stranger with no role", async () => {
        signInAs("rando-1");
        stubReads({ show: { host_id: "host-1", status: "entries_open" }, staffRole: null });

        const result = await scratchEntry({ entryId: ENTRY_ID });
        expect(result).toEqual({
            success: false,
            error: "Only the entry's owner or the show's staff can scratch an entry.",
        });
    });

    it("refuses an already-scratched entry", async () => {
        signInAs("owner-1");
        stubReads({ entry: { status: "scratched" }, show: { host_id: "h", status: "entries_open" } });

        const result = await scratchEntry({ entryId: ENTRY_ID });
        expect(result).toEqual({ success: false, error: "This entry is already scratched." });
    });

    it("reports failure when RLS silently filters the update", async () => {
        signInAs("owner-1");
        stubReads({ show: { host_id: "host-1", status: "entries_open" }, staffRole: null });
        mockClient._setImplicitResolve({ data: [], error: null });

        const result = await scratchEntry({ entryId: ENTRY_ID });
        expect(result).toEqual({
            success: false,
            error: "The entry could not be scratched — please refresh and try again.",
        });
    });

    it("zod-rejects an over-long reason before touching the DB", async () => {
        signInAs("host-1");
        const result = await scratchEntry({ entryId: ENTRY_ID, reason: "x".repeat(201) });
        expect(result.success).toBe(false);
        expect(q.maybeSingle).not.toHaveBeenCalled();
    });
});
