import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

const mockClient = createMockSupabaseClient();

const { createNotification } = vi.hoisted(() => ({ createNotification: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: vi.fn(() => mockClient) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/notifications/createNotification", () => ({ createNotification }));

import {
    createGroup,
    decideBarnJoinRequest,
    joinGroup,
    requestToJoinBarn,
    updateBarnSettings,
} from "@/app/actions/groups";

const BARN_ID = "123e4567-e89b-42d3-a456-426614174000";

/** Payload of the Nth `.insert()` call on the shared mock query. */
function insertCall(n: number): Record<string, unknown> {
    const insert = mockClient._mockQuery.insert as unknown as { mock: { calls: unknown[][] } };
    return insert.mock.calls[n][0] as Record<string, unknown>;
}

function upsertCall(n: number): Record<string, unknown> {
    const upsert = mockClient._mockQuery.upsert as unknown as { mock: { calls: unknown[][] } };
    return upsert.mock.calls[n][0] as Record<string, unknown>;
}

function single() {
    return mockClient._mockQuery.single as unknown as {
        mockResolvedValueOnce: (v: unknown) => void;
    };
}

function maybeSingle() {
    return mockClient._mockQuery.maybeSingle as unknown as {
        mockResolvedValueOnce: (v: unknown) => void;
    };
}

/** The stock implicit-await handler, restored after tests that swap it. */
const originalThen = mockClient._mockQuery.then;

beforeEach(() => {
    vi.clearAllMocks();
    mockClient._mockQuery.then = originalThen;
    (mockClient._mockQuery.single as unknown as { mockReset: () => void }).mockReset();
    (mockClient._mockQuery.single as unknown as { mockResolvedValue: (v: unknown) => void })
        .mockResolvedValue({ data: null, error: null });
    (mockClient._mockQuery.maybeSingle as unknown as { mockReset: () => void }).mockReset();
    (mockClient._mockQuery.maybeSingle as unknown as { mockResolvedValue: (v: unknown) => void })
        .mockResolvedValue({ data: null, error: null });
    mockClient.rpc.mockReset();
    mockClient.rpc.mockResolvedValue({ data: null, error: null });
    mockClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "test-user-id", email: "test@example.com" } },
    });
    mockClient._setImplicitResolve({ data: null, error: null });
});

// ══════════════════════════════════════════════════════════════
// Creating a barn
// ══════════════════════════════════════════════════════════════

describe("barns — createGroup privacy", () => {
    it("writes is_private AND the derived visibility for a private barn", async () => {
        maybeSingle().mockResolvedValueOnce({ data: null, error: null }); // slug free
        single().mockResolvedValueOnce({ data: { id: BARN_ID }, error: null });

        const result = await createGroup({
            name: "Cedar Hollow",
            slug: "cedar-hollow",
            groupType: "general",
            isPrivate: true,
        });

        expect(result).toEqual({ success: true, slug: "cedar-hollow" });
        expect(insertCall(0)).toMatchObject({ is_private: true, visibility: "private" });
    });

    it("defaults to a public barn", async () => {
        maybeSingle().mockResolvedValueOnce({ data: null, error: null });
        single().mockResolvedValueOnce({ data: { id: BARN_ID }, error: null });

        await createGroup({ name: "Open Gate", slug: "open-gate", groupType: "general" });

        expect(insertCall(0)).toMatchObject({ is_private: false, visibility: "public" });
    });

    it("retries without is_private when migration 167 is not applied yet", async () => {
        maybeSingle().mockResolvedValueOnce({ data: null, error: null });
        // First insert: column does not exist.
        single().mockResolvedValueOnce({ data: null, error: { code: "42703", message: "column groups.is_private does not exist" } });
        single().mockResolvedValueOnce({ data: { id: BARN_ID }, error: null });

        const result = await createGroup({
            name: "Cedar Hollow",
            slug: "cedar-hollow",
            groupType: "general",
            isPrivate: true,
        });

        expect(result.success).toBe(true);
        expect(insertCall(1)).not.toHaveProperty("is_private");
        // visibility still carries the choice on a pre-167 database.
        expect(insertCall(1)).toMatchObject({ visibility: "private" });
    });

    it("rejects a barn with no name", async () => {
        const result = await createGroup({ name: "   ", slug: "x", groupType: "general" });
        expect(result).toEqual({ success: false, error: "Barn name is required." });
    });
});

// ══════════════════════════════════════════════════════════════
// Joining
// ══════════════════════════════════════════════════════════════

describe("barns — joinGroup", () => {
    it("joins a public barn immediately", async () => {
        maybeSingle().mockResolvedValueOnce({ data: { id: BARN_ID, is_private: false, visibility: "public" }, error: null });

        const result = await joinGroup(BARN_ID);

        expect(result.success).toBe(true);
        expect(result.pending).toBeUndefined();
        expect(insertCall(0)).toMatchObject({ group_id: BARN_ID, user_id: "test-user-id", role: "member" });
    });

    it("files a request instead of a membership for a private barn", async () => {
        maybeSingle().mockResolvedValueOnce({ data: { id: BARN_ID, is_private: true, visibility: "private" }, error: null });
        maybeSingle().mockResolvedValueOnce({ data: null, error: null }); // not already a member

        const result = await joinGroup(BARN_ID);

        expect(result).toMatchObject({ success: true, pending: true });
        expect(mockClient._mockQuery.insert).not.toHaveBeenCalled();
        expect(upsertCall(0)).toMatchObject({ group_id: BARN_ID, user_id: "test-user-id", status: "pending" });
    });

    it("treats a pre-167 barn with visibility='private' as private", async () => {
        // No is_private column on the row at all.
        maybeSingle().mockResolvedValueOnce({ data: { id: BARN_ID, visibility: "private" }, error: null });
        maybeSingle().mockResolvedValueOnce({ data: null, error: null });

        const result = await joinGroup(BARN_ID);

        expect(result).toMatchObject({ pending: true });
        expect(mockClient._mockQuery.insert).not.toHaveBeenCalled();
    });

    it("refuses to join a barn that does not exist", async () => {
        maybeSingle().mockResolvedValueOnce({ data: null, error: null });
        const result = await joinGroup(BARN_ID);
        expect(result).toEqual({ success: false, error: "Barn not found." });
    });
});

describe("barns — requestToJoinBarn", () => {
    it("degrades with a friendly message when barn_join_requests is missing", async () => {
        maybeSingle().mockResolvedValueOnce({ data: null, error: null }); // not a member
        mockClient._setImplicitResolve({ data: null, error: { code: "42P01", message: "relation does not exist" } });

        const result = await requestToJoinBarn(BARN_ID);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/aren't open for requests yet/);
    });

    it("refuses when the caller is already a member", async () => {
        maybeSingle().mockResolvedValueOnce({ data: { role: "member" }, error: null });

        const result = await requestToJoinBarn(BARN_ID);

        expect(result).toEqual({ success: false, error: "You are already in this barn." });
        expect(mockClient._mockQuery.upsert).not.toHaveBeenCalled();
    });
});

// ══════════════════════════════════════════════════════════════
// Deciding
// ══════════════════════════════════════════════════════════════

describe("barns — decideBarnJoinRequest", () => {
    it("refuses a plain member", async () => {
        maybeSingle().mockResolvedValueOnce({ data: { role: "member" }, error: null });

        const result = await decideBarnJoinRequest(BARN_ID, "other-user", "approved");

        expect(result).toEqual({ success: false, error: "Only barn staff can answer join requests." });
        expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
    });

    it("refuses a non-member", async () => {
        maybeSingle().mockResolvedValueOnce({ data: null, error: null });

        const result = await decideBarnJoinRequest(BARN_ID, "other-user", "approved");

        expect(result.success).toBe(false);
        expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
    });

    it("approving inserts the membership", async () => {
        maybeSingle().mockResolvedValueOnce({ data: { role: "moderator" }, error: null });

        const result = await decideBarnJoinRequest(BARN_ID, "other-user", "approved");

        expect(result.success).toBe(true);
        expect(insertCall(0)).toMatchObject({ group_id: BARN_ID, user_id: "other-user", role: "member" });
    });

    it("denying does not insert a membership", async () => {
        maybeSingle().mockResolvedValueOnce({ data: { role: "owner" }, error: null });

        const result = await decideBarnJoinRequest(BARN_ID, "other-user", "denied");

        expect(result.success).toBe(true);
        expect(mockClient._mockQuery.insert).not.toHaveBeenCalled();
    });
});

// ══════════════════════════════════════════════════════════════
// Settings
// ══════════════════════════════════════════════════════════════

describe("barns — updateBarnSettings", () => {
    it("refuses a moderator (owner/admin only)", async () => {
        maybeSingle().mockResolvedValueOnce({ data: { role: "moderator" }, error: null });

        const result = await updateBarnSettings(BARN_ID, { isPrivate: true });

        expect(result.success).toBe(false);
        expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
    });

    it("flipping to private writes both columns", async () => {
        maybeSingle().mockResolvedValueOnce({ data: { role: "owner" }, error: null });

        const result = await updateBarnSettings(BARN_ID, { isPrivate: true });

        expect(result.success).toBe(true);
        const update = mockClient._mockQuery.update as unknown as { mock: { calls: unknown[][] } };
        expect(update.mock.calls[0][0]).toMatchObject({ is_private: true, visibility: "private" });
    });

    it("drops is_private and keeps the visibility write on a pre-167 database", async () => {
        maybeSingle().mockResolvedValueOnce({ data: { role: "owner" }, error: null });
        let firstUpdate = true;
        mockClient._mockQuery.then = vi.fn((resolve: (value: unknown) => void) => {
            const value = firstUpdate
                ? { data: null, error: { code: "42703", message: "column groups.is_private does not exist" } }
                : { data: null, error: null };
            firstUpdate = false;
            return Promise.resolve(value).then(resolve);
        }) as unknown as typeof mockClient._mockQuery.then;

        const result = await updateBarnSettings(BARN_ID, { isPrivate: true });

        expect(result.success).toBe(true);
        const update = mockClient._mockQuery.update as unknown as { mock: { calls: unknown[][] } };
        expect(update.mock.calls[1][0]).not.toHaveProperty("is_private");
        expect(update.mock.calls[1][0]).toMatchObject({ visibility: "private" });
    });
});
