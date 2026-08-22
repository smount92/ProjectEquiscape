/**
 * A horse is announced once.
 *
 * The edit form calls notifyHorsePublic on every save of a public horse,
 * not only when it first becomes public — so without deduplication a
 * member correcting a typo re-announces the horse to the whole feed and
 * re-alerts every want-list watcher. These tests pin the "once" rule on
 * both surfaces.
 */
import { vi, describe, it, expect, beforeEach, type Mock } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

const mockClient = createMockSupabaseClient();
const mockAdmin = createMockSupabaseClient();
const q = mockClient._mockQuery as unknown as Record<string, Mock>;
const adminQ = mockAdmin._mockQuery as unknown as Record<string, Mock>;

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));
vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => mockAdmin),
}));

const createActivityEvent = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/activity", () => ({ createActivityEvent }));

import { notifyHorsePublic } from "@/app/actions/horse-events";

const OWNER = "owner-1";

/** A public, for-sale horse owned by the caller, with a catalog link. */
function horseRow(overrides: Record<string, unknown> = {}) {
    return {
        id: "h1",
        owner_id: OWNER,
        custom_name: "Silver Charm",
        finish_type: "OF",
        catalog_id: "cat-1",
        trade_status: "For Sale",
        is_public: true,
        ...overrides,
    };
}

/** The arguments every call in these tests shares. */
const CALL = {
    userId: OWNER,
    horseId: "h1",
    horseName: "Silver Charm",
    finishType: "OF",
    tradeStatus: "For Sale",
    catalogId: "cat-1",
    photoCount: 3,
};

beforeEach(() => {
    vi.clearAllMocks();
    mockClient.auth.getUser.mockResolvedValue({ data: { user: { id: OWNER } } });
    mockClient._setImplicitResolve({ data: null, error: null });
    mockAdmin._setImplicitResolve({ data: null, error: null });
});

describe("notifyHorsePublic — announce once", () => {
    it("announces a horse the first time it goes public", async () => {
        q.single.mockResolvedValueOnce({ data: horseRow(), error: null });
        // No prior new_horse event for this horse.
        q.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

        await notifyHorsePublic(CALL);

        expect(createActivityEvent).toHaveBeenCalledWith(
            expect.objectContaining({ eventType: "new_horse", horseId: "h1" })
        );
    });

    it("does not re-announce on a later save of the same horse", async () => {
        q.single.mockResolvedValueOnce({ data: horseRow(), error: null });
        // A new_horse event already exists — this is an edit, not a debut.
        q.maybeSingle.mockResolvedValueOnce({ data: { id: "evt-1" }, error: null });

        await notifyHorsePublic(CALL);

        expect(createActivityEvent).not.toHaveBeenCalled();
    });

    it("still refuses horses with no photos", async () => {
        await notifyHorsePublic({ ...CALL, photoCount: 0 });
        expect(createActivityEvent).not.toHaveBeenCalled();
    });

    it("refuses to announce a horse the caller does not own", async () => {
        q.single.mockResolvedValueOnce({
            data: horseRow({ owner_id: "someone-else" }),
            error: null,
        });

        await notifyHorsePublic(CALL);

        expect(createActivityEvent).not.toHaveBeenCalled();
    });
});

describe("notifyHorsePublic — want-list alerts go out once per watcher", () => {
    it("alerts watchers who have not been told about this horse", async () => {
        q.single.mockResolvedValueOnce({ data: horseRow(), error: null });
        q.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
        // Two watchers on the catalog entry (this query ends on .neq)...
        adminQ.neq.mockResolvedValueOnce({
            data: [{ user_id: "watcher-a" }, { user_id: "watcher-b" }],
            error: null,
        });
        // ...neither previously alerted about this horse. The prior-alert
        // lookup ends on .eq(), which is chainable, so it resolves through
        // the builder itself rather than a terminal method.
        mockAdmin._setImplicitResolve({ data: [], error: null });

        await notifyHorsePublic(CALL);

        const rows = adminQ.insert.mock.calls.at(-1)?.[0] as Array<{ user_id: string }>;
        expect(rows.map((r) => r.user_id).sort()).toEqual(["watcher-a", "watcher-b"]);
    });

    it("skips a watcher already alerted about this horse", async () => {
        q.single.mockResolvedValueOnce({ data: horseRow(), error: null });
        q.maybeSingle.mockResolvedValueOnce({ data: { id: "evt-1" }, error: null });
        adminQ.neq.mockResolvedValueOnce({
            data: [{ user_id: "watcher-a" }, { user_id: "watcher-b" }],
            error: null,
        });
        // watcher-a already heard about h1 on an earlier save.
        mockAdmin._setImplicitResolve({ data: [{ user_id: "watcher-a" }], error: null });

        await notifyHorsePublic(CALL);

        const rows = adminQ.insert.mock.calls.at(-1)?.[0] as Array<{ user_id: string }>;
        expect(rows.map((r) => r.user_id)).toEqual(["watcher-b"]);
    });

    it("writes nothing when every watcher has already been told", async () => {
        q.single.mockResolvedValueOnce({ data: horseRow(), error: null });
        q.maybeSingle.mockResolvedValueOnce({ data: { id: "evt-1" }, error: null });
        adminQ.neq.mockResolvedValueOnce({ data: [{ user_id: "watcher-a" }], error: null });
        mockAdmin._setImplicitResolve({ data: [{ user_id: "watcher-a" }], error: null });

        await notifyHorsePublic(CALL);

        expect(adminQ.insert).not.toHaveBeenCalled();
    });
});
