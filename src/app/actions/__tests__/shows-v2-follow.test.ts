/**
 * Follow-a-show, at the TRANSITION boundary.
 *
 * The fan-out internals live in src/lib/shows/__tests__/showFollowers
 * — this file guards the two rules that belong to the action itself:
 *
 *   1. A no-op transition fires NOTHING. The compare-and-set on status
 *      is what makes a double-click safe; a fan-out placed on the wrong
 *      side of it would notify a whole show twice.
 *   2. A notification failure NEVER breaks the transition. This is the
 *      single most important constraint in the feature: a host must not
 *      be blocked from running their show because a notify call failed.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient, createMockAdminClient } from "@/__tests__/mocks/supabase";

const mockClient = createMockSupabaseClient();
const mockAdmin = createMockAdminClient();

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));
vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => mockAdmin),
}));
// after() runs inline so the assertions can see the fan-out.
vi.mock("next/server", () => ({
    after: vi.fn((fn: () => void) => {
        fn();
    }),
}));

const runEntriesClosedFanout = vi.fn().mockResolvedValue(undefined);
const runJudgingStartedFanout = vi.fn().mockResolvedValue(undefined);
const runResultsFollowersFanout = vi.fn().mockResolvedValue(undefined);
const runVotingOpenedFanout = vi.fn().mockResolvedValue(undefined);
const runJudgingOpenedFanout = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/shows/notifications", () => ({
    runClassChangeFanout: vi.fn().mockResolvedValue(undefined),
    runEntriesClosedFanout: (...a: unknown[]) => runEntriesClosedFanout(...a),
    runEntryScratchedNotification: vi.fn().mockResolvedValue(undefined),
    runJudgingOpenedFanout: (...a: unknown[]) => runJudgingOpenedFanout(...a),
    runJudgingStartedFanout: (...a: unknown[]) => runJudgingStartedFanout(...a),
    runResultsFollowersFanout: (...a: unknown[]) => runResultsFollowersFanout(...a),
    runResultsPublishedFanout: vi.fn().mockResolvedValue(undefined),
    runStaffAddedNotification: vi.fn().mockResolvedValue(undefined),
    runVotingOpenedFanout: (...a: unknown[]) => runVotingOpenedFanout(...a),
}));

import { transitionShowStatus } from "@/app/actions/shows-v2";

const SHOW_ID = "123e4567-e89b-42d3-a456-426614174000";

function showRow(overrides: Record<string, unknown> = {}) {
    return {
        id: SHOW_ID,
        host_id: "user-1",
        status: "draft",
        mode: "online",
        judging: "judged",
        ...overrides,
    };
}

/** Arrange a transition from `status`; `won` = the CAS matched a row. */
function arrangeTransition(status: string, won: boolean, extra: Record<string, unknown> = {}) {
    mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
        data: showRow({ status, ...extra }),
        error: null,
    });
    mockClient._setImplicitResolve({ data: won ? [{ id: SHOW_ID }] : [], error: null });
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
        data: { user: { id: "user-1", email: "host@test.com" } },
    });
    mockClient._setImplicitResolve({ data: null, error: null });
    runEntriesClosedFanout.mockResolvedValue(undefined);
    runJudgingStartedFanout.mockResolvedValue(undefined);
    runResultsFollowersFanout.mockResolvedValue(undefined);
});

// ══════════════════════════════════════════════════════════════
// The transitions that used to be silent
// ══════════════════════════════════════════════════════════════

describe("lifecycle notifications fire on a REAL transition", () => {
    it("entries_open → entries_closed notifies the audience", async () => {
        arrangeTransition("entries_open", true);
        const result = await transitionShowStatus({ showId: SHOW_ID, to: "entries_closed" });
        expect(result).toEqual({ success: true });
        expect(runEntriesClosedFanout).toHaveBeenCalledTimes(1);
        expect(runEntriesClosedFanout).toHaveBeenCalledWith(mockAdmin, SHOW_ID);
    });

    it("entries_closed → judging notifies the audience (the confirmed gap)", async () => {
        arrangeTransition("entries_closed", true, { judging: "judged" });
        const result = await transitionShowStatus({ showId: SHOW_ID, to: "judging" });
        expect(result).toEqual({ success: true });
        expect(runJudgingStartedFanout).toHaveBeenCalledTimes(1);
        // A judged show tells its whole audience.
        expect(runJudgingStartedFanout).toHaveBeenCalledWith(mockAdmin, SHOW_ID, {
            excludeEntrants: false,
        });
        // The judges' own queue ping still fires — different audience,
        // different message.
        expect(runJudgingOpenedFanout).toHaveBeenCalledTimes(1);
    });

    it("a COMMUNITY-VOTE show excludes entrants (they got voting-open)", async () => {
        arrangeTransition("entries_closed", true, { judging: "community_vote" });
        await transitionShowStatus({ showId: SHOW_ID, to: "judging" });
        expect(runVotingOpenedFanout).toHaveBeenCalledTimes(1);
        expect(runJudgingStartedFanout).toHaveBeenCalledWith(mockAdmin, SHOW_ID, {
            excludeEntrants: true,
        });
    });
});

// ══════════════════════════════════════════════════════════════
// Rule 1: the no-op transition
// ══════════════════════════════════════════════════════════════

describe("a no-op transition fires NOTHING", () => {
    it("a lost CAS on entries_closed notifies nobody", async () => {
        // The double-click case: another writer already flipped the
        // show, so this update matches zero rows.
        arrangeTransition("entries_open", false);
        const result = await transitionShowStatus({ showId: SHOW_ID, to: "entries_closed" });

        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/changed while saving/i);
        expect(runEntriesClosedFanout).not.toHaveBeenCalled();
    });

    it("a lost CAS on judging notifies nobody", async () => {
        arrangeTransition("entries_closed", false, { judging: "judged" });
        await transitionShowStatus({ showId: SHOW_ID, to: "judging" });
        expect(runJudgingStartedFanout).not.toHaveBeenCalled();
        expect(runJudgingOpenedFanout).not.toHaveBeenCalled();
    });

    it("an ILLEGAL transition never reaches the fan-out", async () => {
        // draft → completed is refused by the state machine, before
        // any update is even attempted.
        arrangeTransition("draft", true);
        const result = await transitionShowStatus({ showId: SHOW_ID, to: "completed" });
        expect(result.success).toBe(false);
        expect(runResultsFollowersFanout).not.toHaveBeenCalled();
        expect(runEntriesClosedFanout).not.toHaveBeenCalled();
    });

    it("a non-manager is refused and notifies nobody", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: showRow({ host_id: "someone-else" }), error: null })
            .mockResolvedValueOnce({ data: { role: "judge" }, error: null });
        const result = await transitionShowStatus({ showId: SHOW_ID, to: "entries_closed" });
        expect(result.success).toBe(false);
        expect(runEntriesClosedFanout).not.toHaveBeenCalled();
    });
});

// ══════════════════════════════════════════════════════════════
// Rule 2: a notification failure never breaks the transition
// ══════════════════════════════════════════════════════════════

describe("a notification failure never breaks the transition", () => {
    it("entries_closed still succeeds when the fan-out REJECTS", async () => {
        runEntriesClosedFanout.mockRejectedValueOnce(new Error("notification sink down"));
        arrangeTransition("entries_open", true);

        const result = await transitionShowStatus({ showId: SHOW_ID, to: "entries_closed" });

        // The status flip is what matters — the host is not blocked.
        expect(result).toEqual({ success: true });
        expect(mockClient._mockQuery.update).toHaveBeenCalledWith({ status: "entries_closed" });
    });

    it("judging still succeeds when the fan-out THROWS synchronously", async () => {
        runJudgingStartedFanout.mockImplementationOnce(() => {
            throw new Error("server-only import blew up");
        });
        arrangeTransition("entries_closed", true, { judging: "judged" });

        const result = await transitionShowStatus({ showId: SHOW_ID, to: "judging" });
        expect(result).toEqual({ success: true });
    });
});
