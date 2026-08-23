/**
 * Show moderation — removeEntrantFromShow + liftBar.
 *
 * The sloptrough fix: the host's two half-tools (Scratch, which is
 * not sticky, and Bar, which does not remove) become one motion.
 * These tests pin the parts that were hand-written SQL twice: the
 * authorization door, that SCRATCHED rows go too, that the bar row
 * is ON CONFLICT DO NOTHING, and that a published show refuses.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabaseClient, createMockAdminClient } from "@/__tests__/mocks/supabase";

const mockClient = createMockSupabaseClient();
const mockAdmin = createMockAdminClient();
const q = mockClient._mockQuery as Record<string, ReturnType<typeof vi.fn>>;
const aq = mockAdmin._mockQuery as Record<string, ReturnType<typeof vi.fn>>;

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
vi.mock("@/lib/notifications/createNotification", () => ({
    createNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { liftBar, removeEntrantFromShow } from "@/app/actions/shows-v4";
import { createNotification } from "@/lib/notifications/createNotification";

const SHOW_ID = "6b2e0d3c-1111-4444-8888-aaaaaaaaaaaa";
const HOST_ID = "6b2e0d3c-2222-4444-8888-bbbbbbbbbbbb";
const COHOST_ID = "6b2e0d3c-3333-4444-8888-cccccccccccc";
const ADMIN_ID = "6b2e0d3c-4444-4444-8888-dddddddddddd";
const TROLL_ID = "6b2e0d3c-5555-4444-8888-eeeeeeeeeeee";
const STEWARD_ID = "6b2e0d3c-6666-4444-8888-ffffffffffff";
const CLASS_A = "7c3f1e4d-1111-4444-8888-aaaaaaaaaaaa";
const CLASS_B = "7c3f1e4d-2222-4444-8888-bbbbbbbbbbbb";
const ENTRY_1 = "8d401f5e-1111-4444-8888-aaaaaaaaaaaa";
const ENTRY_2 = "8d401f5e-2222-4444-8888-bbbbbbbbbbbb";
const ENTRY_3 = "8d401f5e-3333-4444-8888-cccccccccccc";

const ORIGINAL_ADMIN_EMAIL = process.env.ADMIN_EMAIL;

function signInAs(userId: string, email = "staff@test.com") {
    mockClient.auth.getUser.mockResolvedValue({
        data: { user: { id: userId, email } },
    });
}

/** getShowRole reads: shows row, then (if not host) show_staff row. */
function stubRole(input: { hostId: string; status?: string; staffRole?: string | null }) {
    q.maybeSingle.mockResolvedValueOnce({
        data: {
            id: SHOW_ID,
            host_id: input.hostId,
            status: input.status ?? "entries_open",
            mode: "online",
            judging: "judged",
        },
        error: null,
    });
    if (input.staffRole !== undefined) {
        q.maybeSingle.mockResolvedValueOnce({
            data: input.staffRole === null ? null : { role: input.staffRole },
            error: null,
        });
    }
}

/** Queue ONE list-read result (implicit await) in call order. */
function queueList(data: unknown, error: unknown = null) {
    q.then.mockImplementationOnce(((resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data, error }).then(resolve)) as never);
}

/** Same, on the service-role client (the platform-admin path). */
function queueAdminList(data: unknown, error: unknown = null) {
    aq.then.mockImplementationOnce(((resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data, error }).then(resolve)) as never);
}

/**
 * The four writes removeEntrantFromShow makes after its gate, in
 * order: entries read → bar upsert → placings delete → entries
 * delete. (The bar-row existence check is a maybeSingle, not a list.)
 */
function queueRemovalSequence(
    queue: typeof queueList,
    entries: { id: string; class_id: string }[],
) {
    queue(entries);
    queue(null);
    queue(null);
    queue(entries.map((e) => ({ id: e.id })));
}

beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_EMAIL = "admin@test.com";
    for (const query of [q, aq]) {
        query.maybeSingle.mockReset();
        query.maybeSingle.mockResolvedValue({ data: null, error: null });
        // mockReset restores vi.fn's ORIGINAL implementation — the
        // closure that reads _implicitResolve — and clears any
        // leftover queueList()s from the test before.
        query.then.mockReset();
    }
    mockClient._setImplicitResolve({ data: [], error: null });
    mockAdmin._setImplicitResolve({ data: [], error: null });
    signInAs(HOST_ID);
});

afterEach(() => {
    process.env.ADMIN_EMAIL = ORIGINAL_ADMIN_EMAIL;
});

// ══════════════════════════════════════════════════════════════
// The door
// ══════════════════════════════════════════════════════════════

describe("removeEntrantFromShow — authorization", () => {
    it("refuses a caller with no role on the show and writes nothing", async () => {
        signInAs(TROLL_ID);
        stubRole({ hostId: HOST_ID, staffRole: null });

        const result = await removeEntrantFromShow({ showId: SHOW_ID, userId: TROLL_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toContain("Only the host");
        expect(q.upsert).not.toHaveBeenCalled();
        expect(q.delete).not.toHaveBeenCalled();
    });

    it("refuses a steward — removal is host/co-host, not the ring crew", async () => {
        signInAs(STEWARD_ID);
        stubRole({ hostId: HOST_ID, staffRole: "steward" });

        const result = await removeEntrantFromShow({ showId: SHOW_ID, userId: TROLL_ID });
        expect(result.success).toBe(false);
        expect(q.delete).not.toHaveBeenCalled();
    });

    it("refuses a judge", async () => {
        signInAs(STEWARD_ID);
        stubRole({ hostId: HOST_ID, staffRole: "judge" });

        const result = await removeEntrantFromShow({ showId: SHOW_ID, userId: TROLL_ID });
        expect(result.success).toBe(false);
        expect(q.delete).not.toHaveBeenCalled();
    });

    it("allows a co-host", async () => {
        signInAs(COHOST_ID);
        stubRole({ hostId: HOST_ID, staffRole: "co_host" });
        queueRemovalSequence(queueList, [{ id: ENTRY_1, class_id: CLASS_A }]);

        const result = await removeEntrantFromShow({ showId: SHOW_ID, userId: TROLL_ID });
        expect(result).toEqual({
            success: true,
            removedEntries: 1,
            removedClasses: 1,
            newlyBarred: true,
        });
        expect(q.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ barred_by: COHOST_ID }),
            expect.anything(),
        );
    });

    it("allows the platform admin, whose writes go through the service-role client", async () => {
        // An admin holds no show_staff row, so every show_role_check
        // RLS policy would filter their writes to a silent no-op.
        signInAs(ADMIN_ID, "admin@test.com");
        stubRole({ hostId: HOST_ID, staffRole: null });
        queueRemovalSequence(queueAdminList, [{ id: ENTRY_1, class_id: CLASS_A }]);

        const result = await removeEntrantFromShow({ showId: SHOW_ID, userId: TROLL_ID });
        expect(result.success).toBe(true);
        expect(aq.upsert).toHaveBeenCalled();
        expect(aq.delete).toHaveBeenCalledTimes(2);
        // The user client did the role read only — never a write.
        expect(q.upsert).not.toHaveBeenCalled();
        expect(q.delete).not.toHaveBeenCalled();
    });

    it("fails closed when ADMIN_EMAIL is unset", async () => {
        delete process.env.ADMIN_EMAIL;
        signInAs(ADMIN_ID, "admin@test.com");
        stubRole({ hostId: HOST_ID, staffRole: null });

        const result = await removeEntrantFromShow({ showId: SHOW_ID, userId: TROLL_ID });
        expect(result.success).toBe(false);
        expect(aq.delete).not.toHaveBeenCalled();
    });

    it("refuses self-removal — that is just scratching", async () => {
        signInAs(HOST_ID);
        stubRole({ hostId: HOST_ID });

        const result = await removeEntrantFromShow({ showId: SHOW_ID, userId: HOST_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toContain("yourself");
        expect(q.upsert).not.toHaveBeenCalled();
    });

    it("refuses a co-host removing the HOST's own entries", async () => {
        signInAs(COHOST_ID);
        stubRole({ hostId: HOST_ID, staffRole: "co_host" });

        const result = await removeEntrantFromShow({ showId: SHOW_ID, userId: HOST_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toContain("host's own entries");
        expect(q.upsert).not.toHaveBeenCalled();
    });
});

// ══════════════════════════════════════════════════════════════
// What it actually removes
// ══════════════════════════════════════════════════════════════

describe("removeEntrantFromShow — the sweep", () => {
    it("deletes every entry the owner holds, scratched rows included, and clears their placings", async () => {
        signInAs(HOST_ID);
        stubRole({ hostId: HOST_ID, status: "entries_closed" });
        queueRemovalSequence(queueList, [
            { id: ENTRY_1, class_id: CLASS_A },
            { id: ENTRY_2, class_id: CLASS_A },
            { id: ENTRY_3, class_id: CLASS_B },
        ]);

        const result = await removeEntrantFromShow({
            showId: SHOW_ID,
            userId: TROLL_ID,
            reason: "joke entries after a warning",
        });
        expect(result).toEqual({
            success: true,
            removedEntries: 3,
            removedClasses: 2,
            newlyBarred: true,
        });
        // No status filter anywhere — barEntrant's sweep used
        // .neq("status", "scratched"); removal must NOT.
        expect(q.neq).not.toHaveBeenCalled();
        // Placings first, then the entries themselves.
        expect(q.in).toHaveBeenCalledWith("entry_id", [ENTRY_1, ENTRY_2, ENTRY_3]);
        expect(q.delete).toHaveBeenCalledTimes(2);
    });

    it("writes the bar row with ON CONFLICT DO NOTHING and the host's reason", async () => {
        signInAs(HOST_ID);
        stubRole({ hostId: HOST_ID });
        queueRemovalSequence(queueList, [{ id: ENTRY_1, class_id: CLASS_A }]);

        await removeEntrantFromShow({
            showId: SHOW_ID,
            userId: TROLL_ID,
            reason: "joke entries after a warning",
        });
        expect(q.upsert).toHaveBeenCalledWith(
            {
                show_id: SHOW_ID,
                user_id: TROLL_ID,
                barred_by: HOST_ID,
                reason: "joke entries after a warning",
            },
            { onConflict: "show_id,user_id", ignoreDuplicates: true },
        );
    });

    it("tolerates an existing bar — re-runs still sweep, and report newlyBarred false", async () => {
        signInAs(HOST_ID);
        stubRole({ hostId: HOST_ID });
        // Bar-row existence probe finds a row.
        q.maybeSingle.mockResolvedValueOnce({ data: { user_id: TROLL_ID }, error: null });
        queueRemovalSequence(queueList, [{ id: ENTRY_1, class_id: CLASS_A }]);

        const result = await removeEntrantFromShow({ showId: SHOW_ID, userId: TROLL_ID });
        expect(result).toEqual({
            success: true,
            removedEntries: 1,
            removedClasses: 1,
            newlyBarred: false,
        });
        // ignoreDuplicates keeps the ORIGINAL reason/barred_by.
        expect(q.upsert).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ ignoreDuplicates: true }),
        );
    });

    it("bars a member who has no entries yet", async () => {
        signInAs(HOST_ID);
        stubRole({ hostId: HOST_ID });
        queueList([]); // entries read
        queueList(null); // bar upsert

        const result = await removeEntrantFromShow({ showId: SHOW_ID, userId: TROLL_ID });
        expect(result).toEqual({
            success: true,
            removedEntries: 0,
            removedClasses: 0,
            newlyBarred: true,
        });
        expect(q.upsert).toHaveBeenCalled();
        expect(q.delete).not.toHaveBeenCalled();
    });

    it("says so plainly when there is nothing to do — already barred, no entries", async () => {
        signInAs(HOST_ID);
        stubRole({ hostId: HOST_ID });
        q.maybeSingle.mockResolvedValueOnce({ data: { user_id: TROLL_ID }, error: null });
        queueList([]); // entries read

        const result = await removeEntrantFromShow({ showId: SHOW_ID, userId: TROLL_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toContain("already barred");
        expect(q.upsert).not.toHaveBeenCalled();
        expect(q.delete).not.toHaveBeenCalled();
    });

    it("refuses an RLS-filtered no-op delete rather than reporting success", async () => {
        signInAs(HOST_ID);
        stubRole({ hostId: HOST_ID });
        queueList([{ id: ENTRY_1, class_id: CLASS_A }]); // entries read
        queueList(null); // bar upsert
        queueList(null); // placings delete
        queueList([]); // entries delete came back empty

        const result = await removeEntrantFromShow({ showId: SHOW_ID, userId: TROLL_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toContain("could not be removed");
    });

    it("surfaces a delete error verbatim", async () => {
        signInAs(HOST_ID);
        stubRole({ hostId: HOST_ID });
        queueList([{ id: ENTRY_1, class_id: CLASS_A }]);
        queueList(null);
        queueList(null);
        queueList(null, { message: "permission denied for table show_class_entries" });

        const result = await removeEntrantFromShow({ showId: SHOW_ID, userId: TROLL_ID });
        expect(result.success).toBe(false);
        if (!result.success)
            expect(result.error).toBe("permission denied for table show_class_entries");
    });
});

// ══════════════════════════════════════════════════════════════
// Results are final
// ══════════════════════════════════════════════════════════════

describe("removeEntrantFromShow — the publish guard", () => {
    for (const status of ["results_review", "completed", "archived"]) {
        it(`refuses on a ${status} show and points at Strike`, async () => {
            signInAs(HOST_ID);
            stubRole({ hostId: HOST_ID, status });

            const result = await removeEntrantFromShow({ showId: SHOW_ID, userId: TROLL_ID });
            expect(result.success).toBe(false);
            if (!result.success) expect(result.error).toContain("Strike");
            expect(q.upsert).not.toHaveBeenCalled();
            expect(q.delete).not.toHaveBeenCalled();
        });
    }

    it("allows removal while judging is still open", async () => {
        signInAs(HOST_ID);
        stubRole({ hostId: HOST_ID, status: "judging" });
        queueRemovalSequence(queueList, [{ id: ENTRY_1, class_id: CLASS_A }]);

        const result = await removeEntrantFromShow({ showId: SHOW_ID, userId: TROLL_ID });
        expect(result.success).toBe(true);
        // Mid-judging placings must not survive their entry.
        expect(q.in).toHaveBeenCalledWith("entry_id", [ENTRY_1]);
    });
});

// ══════════════════════════════════════════════════════════════
// The notification
// ══════════════════════════════════════════════════════════════

describe("removeEntrantFromShow — telling the member", () => {
    it("notifies plainly and never leaks the host's reason", async () => {
        signInAs(HOST_ID);
        stubRole({ hostId: HOST_ID });
        queueRemovalSequence(queueList, [
            { id: ENTRY_1, class_id: CLASS_A },
            { id: ENTRY_2, class_id: CLASS_B },
        ]);

        await removeEntrantFromShow({
            showId: SHOW_ID,
            userId: TROLL_ID,
            reason: "sloptrough garbage",
        });
        expect(createNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: TROLL_ID,
                type: "show_moderation",
                actorId: null,
                linkUrl: `/shows/${SHOW_ID}`,
            }),
        );
        const sent = vi.mocked(createNotification).mock.calls[0][0];
        expect(sent.content).toContain("entries were removed");
        expect(sent.content).not.toContain("sloptrough");
    });

    it("a failing notification never breaks the removal", async () => {
        signInAs(HOST_ID);
        stubRole({ hostId: HOST_ID });
        vi.mocked(createNotification).mockRejectedValueOnce(new Error("notify sink is down"));
        queueRemovalSequence(queueList, [{ id: ENTRY_1, class_id: CLASS_A }]);

        const result = await removeEntrantFromShow({ showId: SHOW_ID, userId: TROLL_ID });
        expect(result).toEqual({
            success: true,
            removedEntries: 1,
            removedClasses: 1,
            newlyBarred: true,
        });
    });
});

// ══════════════════════════════════════════════════════════════
// Undo
// ══════════════════════════════════════════════════════════════

describe("liftBar", () => {
    it("the host lifts a bar", async () => {
        signInAs(HOST_ID);
        stubRole({ hostId: HOST_ID });
        queueList(null);

        const result = await liftBar({ showId: SHOW_ID, userId: TROLL_ID });
        expect(result).toEqual({ success: true });
        expect(q.delete).toHaveBeenCalled();
        expect(q.eq).toHaveBeenCalledWith("user_id", TROLL_ID);
    });

    it("a co-host lifts a bar", async () => {
        signInAs(COHOST_ID);
        stubRole({ hostId: HOST_ID, staffRole: "co_host" });
        queueList(null);

        const result = await liftBar({ showId: SHOW_ID, userId: TROLL_ID });
        expect(result).toEqual({ success: true });
        expect(q.delete).toHaveBeenCalled();
    });

    it("the platform admin lifts a bar through the service-role client", async () => {
        signInAs(ADMIN_ID, "admin@test.com");
        stubRole({ hostId: HOST_ID, staffRole: null });
        queueAdminList(null);

        const result = await liftBar({ showId: SHOW_ID, userId: TROLL_ID });
        expect(result).toEqual({ success: true });
        expect(aq.delete).toHaveBeenCalled();
        expect(q.delete).not.toHaveBeenCalled();
    });

    it("refuses a steward", async () => {
        signInAs(STEWARD_ID);
        stubRole({ hostId: HOST_ID, staffRole: "steward" });

        const result = await liftBar({ showId: SHOW_ID, userId: TROLL_ID });
        expect(result.success).toBe(false);
        expect(q.delete).not.toHaveBeenCalled();
        expect(aq.delete).not.toHaveBeenCalled();
    });
});
