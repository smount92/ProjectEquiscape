import { vi, describe, it, expect, beforeEach } from "vitest";
import { fakeDb } from "@/__tests__/mocks/fakeDb";

/**
 * A post the site team took down (migration 235) is invisible to members,
 * so it takes no replies. add_post_reply refuses a hidden parent in the
 * database; replyToPost says so in plain words first.
 */

const db = fakeDb();
const rpc = vi.fn(async () => ({ data: "reply-1", error: null }));
const member = Object.assign(db, { rpc });

vi.mock("@/lib/auth", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/auth")>()),
    requireAuth: vi.fn(async () => ({ supabase: member, user: { id: "u1" } })),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => member) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));

import { replyToPost } from "@/app/actions/posts";

beforeEach(() => {
    db.reset();
    rpc.mockClear();
});

describe("replyToPost", () => {
    it("refuses a post the replier can no longer see (taken down or deleted), without calling the RPC", async () => {
        db.on("posts", () => ({ data: null, error: null }));
        const result = await replyToPost("p-hidden", "nice horse");
        expect(result).toEqual({ success: false, error: "This post is no longer available." });
        expect(rpc).not.toHaveBeenCalled();
    });

    it("replies to a post that is still there", async () => {
        db.on("posts", () => ({ data: { id: "p1" }, error: null }));
        const result = await replyToPost("p1", "nice horse");
        expect(result).toEqual({ success: true });
        expect(rpc).toHaveBeenCalledWith("add_post_reply", {
            p_parent_id: "p1",
            p_author_id: "u1",
            p_content: "nice horse",
        });
    });
});
