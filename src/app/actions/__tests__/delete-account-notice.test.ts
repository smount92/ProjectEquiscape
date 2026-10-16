/**
 * Account deletions reach the owner (gap G9): a bell naming the alias,
 * read before the soft delete scrubs it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const signOut = vi.fn(async () => ({}));
vi.mock("@/lib/auth", () => ({
    requireAuth: vi.fn(async () => ({ user: { id: "member-1" }, supabase: { auth: { signOut } } })),
    AuthError: class extends Error {},
}));

let rpcError: { message: string } | null = null;
const chain = {
    select: () => chain,
    eq: () => chain,
    not: async () => ({ data: [], error: null }),
    maybeSingle: async () => ({ data: { alias_name: "Bramble" }, error: null }),
};
vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => ({
        from: () => chain,
        rpc: vi.fn(async () => ({ error: rpcError })),
        auth: { admin: { updateUserById: vi.fn(async () => ({ error: null })) } },
    })),
}));
const deferred: (() => Promise<void>)[] = [];
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => deferred.push(fn) }));
const notified: { userId: string; content: string }[] = [];
vi.mock("@/lib/notifications/createNotification", () => ({
    createNotification: vi.fn(async (n: { userId: string; content: string }) => notified.push(n)),
}));
vi.mock("@/lib/notifications/adminTargets", () => ({ adminNotificationTargets: vi.fn(async () => ["owner-1"]) }));

import { deleteAccount } from "@/app/actions/settings";

describe("deleteAccount tells the owner", () => {
    beforeEach(() => {
        rpcError = null;
        deferred.length = 0;
        notified.length = 0;
    });

    it("rings the owner's bell with the member's alias", async () => {
        const r = await deleteAccount();
        expect(r.success).toBe(true);
        for (const run of deferred) await run();
        expect(notified).toEqual([
            expect.objectContaining({ userId: "owner-1", content: "👋 @Bramble deleted their account." }),
        ]);
    });

    it("says nothing, and shows plain words, when the delete fails", async () => {
        rpcError = { message: "permission denied for function soft_delete_account" };
        const r = await deleteAccount();
        expect(r).toEqual({ success: false, error: "Your account couldn't be deleted just now. Please try again." });
        expect(deferred).toEqual([]);
    });
});
