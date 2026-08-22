/**
 * Follow-a-show: the member-facing actions.
 *
 * The load-bearing case here is the PRE-184 one. Migrations are pasted
 * by hand, so between this branch shipping and the owner running 184
 * the site must look and behave exactly as it does today: `supported`
 * is false, the Follow control renders nothing, and no path throws.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

const mockClient = createMockSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

import { getShowFollowState, setShowFollow } from "@/app/actions/show-follow";
import { resetShowFollowSupport } from "@/lib/shows/followSupport";

const SHOW_ID = "123e4567-e89b-42d3-a456-426614174000";

/** Postgres "relation does not exist" — 184 not pasted yet. */
const MISSING_TABLE = { code: "42P01", message: 'relation "show_followers" does not exist' };

beforeEach(() => {
    vi.clearAllMocks();
    // The support probe memoizes for a minute — clear it so each test
    // gets the schema shape it arranges.
    resetShowFollowSupport();
    mockClient._mockQuery.maybeSingle.mockReset();
    mockClient._mockQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockClient._mockQuery.then.mockReset();
    mockClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-1", email: "member@test.com" } },
    });
    mockClient._setImplicitResolve({ data: [], error: null });
});

describe("getShowFollowState — pre-184 degrade", () => {
    it("reports UNSUPPORTED when show_followers is missing", async () => {
        // The probe in getShowFollowSupport is an implicit await.
        mockClient._setImplicitResolve({ data: null, error: MISSING_TABLE });

        const state = await getShowFollowState(SHOW_ID);

        // supported:false is what hides the button — the show page is
        // byte-for-byte today's page until the owner pastes 184.
        expect(state).toEqual({ supported: false, isFollowing: false });
    });

    it("never throws when the client explodes", async () => {
        mockClient.auth.getUser.mockRejectedValueOnce(new Error("session gone"));
        mockClient._setImplicitResolve({ data: [], error: null });
        await expect(getShowFollowState(SHOW_ID)).resolves.toEqual({
            supported: false,
            isFollowing: false,
        });
    });
});

describe("getShowFollowState — with 184 applied", () => {
    it("reports FOLLOWING when the member has a row", async () => {
        mockClient._setImplicitResolve({ data: [], error: null }); // probe OK
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: { show_id: SHOW_ID },
            error: null,
        });
        const state = await getShowFollowState(SHOW_ID);
        expect(state).toEqual({ supported: true, isFollowing: true });
    });

    it("reports NOT following when the member has no row", async () => {
        mockClient._setImplicitResolve({ data: [], error: null });
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
        const state = await getShowFollowState(SHOW_ID);
        expect(state).toEqual({ supported: true, isFollowing: false });
    });

    it("treats an ANON visitor as supported-but-not-following", async () => {
        mockClient._setImplicitResolve({ data: [], error: null });
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        const state = await getShowFollowState(SHOW_ID);
        // The page still renders a sign-in-to-follow affordance.
        expect(state).toEqual({ supported: true, isFollowing: false });
    });
});

describe("setShowFollow", () => {
    it("requires a signed-in member", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        const result = await setShowFollow(SHOW_ID, true);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/signed in/i);
    });

    it("follows via an idempotent upsert on the (show, user) key", async () => {
        mockClient._setImplicitResolve({ data: null, error: null });
        const result = await setShowFollow(SHOW_ID, true);

        expect(result).toEqual({ success: true, isFollowing: true });
        expect(mockClient._mockQuery.upsert).toHaveBeenCalledWith(
            { show_id: SHOW_ID, user_id: "user-1" },
            { onConflict: "show_id,user_id" },
        );
    });

    it("unfollows by deleting only the caller's own row", async () => {
        mockClient._setImplicitResolve({ data: null, error: null });
        const result = await setShowFollow(SHOW_ID, false);

        expect(result).toEqual({ success: true, isFollowing: false });
        expect(mockClient._mockQuery.delete).toHaveBeenCalled();
        // The explicit user_id filter pairs with the RLS policy — the
        // action can never delete someone else's follow.
        expect(mockClient._mockQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    });

    it("reports a friendly refusal when 184 is unapplied", async () => {
        mockClient._setImplicitResolve({ data: null, error: MISSING_TABLE });
        const result = await setShowFollow(SHOW_ID, true);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/isn't available yet/i);
    });

    it("reports a retryable failure on a real error", async () => {
        mockClient._setImplicitResolve({
            data: null,
            error: { code: "500", message: "connection reset" },
        });
        const result = await setShowFollow(SHOW_ID, true);
        expect(result.success).toBe(false);
        // The button rolls back on !success — never leaves the control
        // claiming a subscription the server did not accept.
        expect(result.error).toMatch(/try again/i);
    });
});
