import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

const mockClient = createMockSupabaseClient();

const { createNotification, parseAndNotifyMentions, afterCallbacks } = vi.hoisted(() => ({
    createNotification: vi.fn(),
    parseAndNotifyMentions: vi.fn(),
    afterCallbacks: [] as Array<() => Promise<void>>,
}));

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
}));
vi.mock("next/server", () => ({
    after: vi.fn((cb: () => Promise<void>) => {
        afterCallbacks.push(cb);
    }),
}));
vi.mock("@/lib/notifications/createNotification", () => ({ createNotification }));
vi.mock("@/app/actions/mentions", () => ({ parseAndNotifyMentions }));
vi.mock("@/lib/utils/avatars.server", () => ({
    resolveAvatarUrls: vi.fn(async () => new Map<string, string>()),
}));

import {
    createThread,
    getGroupBoard,
    getThread,
    markGroupRead,
    replyToThread,
} from "@/app/actions/groups-forum";
import { togglePinPost } from "@/app/actions/groups";

const GROUP_ID = "123e4567-e89b-42d3-a456-426614174000";
const CHANNEL_ID = "223e4567-e89b-42d3-a456-426614174000";
const THREAD_ID = "323e4567-e89b-42d3-a456-426614174000";
const OTHER_GROUP = "423e4567-e89b-42d3-a456-426614174000";

/** Run (and drain) the deferred `after()` work registered by an action. */
async function runAfterCallbacks() {
    for (const cb of afterCallbacks.splice(0)) await cb();
}

function boardRow(overrides: Record<string, unknown> = {}) {
    return {
        id: THREAD_ID,
        author_id: "author-1",
        content: "First line of an untitled post\nsecond line",
        title: null,
        channel_id: null,
        replies_count: 0,
        is_pinned: false,
        created_at: "2026-07-01T00:00:00Z",
        bumped_at: "2026-07-01T00:00:00Z",
        users: { alias_name: "DappleGreyFan", avatar_url: null },
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    mockClient._mockQuery.single.mockReset();
    mockClient._mockQuery.single.mockResolvedValue({ data: null, error: null });
    mockClient._mockQuery.maybeSingle.mockReset();
    mockClient._mockQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockClient.rpc.mockReset();
    mockClient.rpc.mockResolvedValue({ data: null, error: null });
    mockClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "test-user-id", email: "test@example.com" } },
    });
    mockClient._setImplicitResolve({ data: null, error: null });
});

describe("groups-forum — getGroupBoard", () => {
    it("rejects invalid input before touching auth", async () => {
        const result = await getGroupBoard({ groupId: "not-a-uuid" });
        expect(result.success).toBe(false);
        expect(mockClient.auth.getUser).not.toHaveBeenCalled();
    });

    it("refuses non-members", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
        const result = await getGroupBoard({ groupId: GROUP_ID });
        expect(result).toEqual({ success: false, error: "Join this group to see its board." });
    });

    it("returns threads pinned-first with unread derived against last-read", async () => {
        // membership
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: { role: "member" }, error: null });
        // board rows (implicit await)
        mockClient._setImplicitResolve({
            data: [
                boardRow({
                    id: THREAD_ID,
                    is_pinned: true,
                    title: "Welcome! Club rules",
                    bumped_at: "2026-07-01T00:00:00Z",
                }),
                boardRow({
                    id: OTHER_GROUP,
                    is_pinned: false,
                    bumped_at: "2026-07-09T00:00:00Z",
                }),
            ],
            error: null,
        });
        // viewer's last read — between the two bump times
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: { last_read_at: "2026-07-05T00:00:00Z" },
            error: null,
        });

        const result = await getGroupBoard({ groupId: GROUP_ID });
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.threads).toHaveLength(2);
        // pinned first even though it was bumped long ago
        expect(result.threads[0].isPinned).toBe(true);
        expect(result.threads[0].displayTitle).toBe("Welcome! Club rules");
        expect(result.threads[0].unread).toBe(false); // bumped before last read
        // untitled post derives its title from the first content line
        expect(result.threads[1].displayTitle).toBe("First line of an untitled post");
        expect(result.threads[1].unread).toBe(true); // bumped after last read
        expect(result.hasMore).toBe(false);
    });

    it("treats a missing last-read row as everything-unread", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: { role: "member" }, error: null });
        mockClient._setImplicitResolve({ data: [boardRow()], error: null });
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

        const result = await getGroupBoard({ groupId: GROUP_ID });
        expect(result.success).toBe(true);
        if (result.success) expect(result.threads[0].unread).toBe(true);
    });
});

describe("groups-forum — markGroupRead", () => {
    it("refuses non-members", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
        const result = await markGroupRead({ groupId: GROUP_ID });
        expect(result.success).toBe(false);
    });

    it("upserts the viewer's read state", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: { role: "member" }, error: null });
        const result = await markGroupRead({ groupId: GROUP_ID });
        expect(result).toEqual({ success: true });
        expect(mockClient._mockQuery.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ group_id: GROUP_ID, user_id: "test-user-id" }),
            { onConflict: "group_id,user_id" },
        );
    });
});

describe("groups-forum — getThread", () => {
    it("refuses non-members", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({
                data: { id: THREAD_ID, parent_id: null, group_id: GROUP_ID, content: "x" },
                error: null,
            }) // root post
            .mockResolvedValueOnce({ data: null, error: null }); // membership
        const result = await getThread({ postId: THREAD_ID });
        expect(result).toEqual({ success: false, error: "Join this group to read its threads." });
    });

    it("rejects replies and non-group posts as thread roots", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: { id: THREAD_ID, parent_id: OTHER_GROUP, group_id: GROUP_ID },
            error: null,
        });
        const result = await getThread({ postId: THREAD_ID });
        expect(result).toEqual({ success: false, error: "Thread not found." });
    });
});

describe("groups-forum — createThread", () => {
    it("refuses non-members", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
        const result = await createThread({ groupId: GROUP_ID, title: "A ride share", content: "Anyone?" });
        expect(result).toEqual({ success: false, error: "Join this group to start a thread." });
    });

    it("rejects a channel from a different group", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: { role: "member" }, error: null })
            .mockResolvedValueOnce({ data: { group_id: OTHER_GROUP }, error: null });
        const result = await createThread({
            groupId: GROUP_ID,
            channelId: CHANNEL_ID,
            title: "A ride share",
            content: "Anyone?",
        });
        expect(result).toEqual({ success: false, error: "Channel not found in this group." });
    });

    it("inserts a titled root post in the channel", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: { role: "member" }, error: null })
            .mockResolvedValueOnce({ data: { group_id: GROUP_ID }, error: null });
        mockClient._mockQuery.single.mockResolvedValueOnce({ data: { id: THREAD_ID }, error: null });

        const result = await createThread({
            groupId: GROUP_ID,
            channelId: CHANNEL_ID,
            title: "Region 4 Live — who's going?",
            content: "Entries close Friday.",
        });
        expect(result).toEqual({ success: true, threadId: THREAD_ID });
        expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(
            expect.objectContaining({
                author_id: "test-user-id",
                title: "Region 4 Live — who's going?",
                group_id: GROUP_ID,
                channel_id: CHANNEL_ID,
            }),
        );
    });

    it("rejects titles shorter than 3 chars via zod", async () => {
        const result = await createThread({ groupId: GROUP_ID, title: "ab", content: "x" });
        expect(result.success).toBe(false);
        expect(mockClient.auth.getUser).not.toHaveBeenCalled();
    });
});

describe("groups-forum — replyToThread", () => {
    function primeParentAndMembership(role: string | null = "member") {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({
                data: {
                    id: THREAD_ID,
                    author_id: "op-user",
                    parent_id: null,
                    group_id: GROUP_ID,
                    title: "Carpool from Tacoma?",
                    content: "Anyone?",
                },
                error: null,
            })
            .mockResolvedValueOnce({ data: role ? { role } : null, error: null });
    }

    it("rejects replies over 2000 chars via zod", async () => {
        const result = await replyToThread({ postId: THREAD_ID, content: "r".repeat(2001) });
        expect(result.success).toBe(false);
        expect(mockClient.auth.getUser).not.toHaveBeenCalled();
    });

    it("refuses non-members", async () => {
        primeParentAndMembership(null);
        const result = await replyToThread({ postId: THREAD_ID, content: "count me in" });
        expect(result).toEqual({ success: false, error: "Join this group to reply." });
    });

    it("refuses replying to a reply", async () => {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: { id: THREAD_ID, author_id: "x", parent_id: OTHER_GROUP, group_id: GROUP_ID },
            error: null,
        });
        const result = await replyToThread({ postId: THREAD_ID, content: "hi" });
        expect(result).toEqual({ success: false, error: "Thread not found." });
    });

    it("replies via the bumping RPC and notifies parent author + distinct prior repliers", async () => {
        primeParentAndMembership();
        mockClient.rpc.mockResolvedValueOnce({ data: "reply-99", error: null });

        const result = await replyToThread({ postId: THREAD_ID, content: "Count me in!" });
        expect(result).toEqual({ success: true, replyId: "reply-99" });
        expect(mockClient.rpc).toHaveBeenCalledWith("add_post_reply", expect.objectContaining({
            p_parent_id: THREAD_ID,
            p_author_id: "test-user-id",
        }));

        // Deferred notifications: actor alias, group slug, prior repliers
        mockClient._mockQuery.single
            .mockResolvedValueOnce({ data: { alias_name: "Replier" }, error: null })
            .mockResolvedValueOnce({ data: { slug: "pnw-breyer" }, error: null });
        mockClient._setImplicitResolve({
            data: [
                { author_id: "participant-1" },
                { author_id: "participant-2" },
                { author_id: "participant-1" }, // duplicate — must collapse
                { author_id: "op-user" }, // parent author — gets the dedicated notification instead
            ],
            error: null,
        });
        await runAfterCallbacks();

        expect(createNotification).toHaveBeenCalledTimes(3);
        expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
            userId: "op-user",
            type: "reply",
            content: expect.stringContaining("replied to your thread"),
            linkUrl: `/community/groups/pnw-breyer/thread/${THREAD_ID}`,
        }));
        for (const participant of ["participant-1", "participant-2"]) {
            expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
                userId: participant,
                type: "reply",
                content: expect.stringContaining('replied in "Carpool from Tacoma?"'),
            }));
        }
        expect(parseAndNotifyMentions).toHaveBeenCalledWith(
            "Count me in!",
            "test-user-id",
            "Replier",
            `/community/groups/pnw-breyer/thread/${THREAD_ID}`,
        );
    });

    it("caps the participant fan-out at 25 besides the parent author", async () => {
        primeParentAndMembership();
        mockClient.rpc.mockResolvedValueOnce({ data: "reply-100", error: null });
        const result = await replyToThread({ postId: THREAD_ID, content: "big thread" });
        expect(result.success).toBe(true);

        mockClient._mockQuery.single
            .mockResolvedValueOnce({ data: { alias_name: "Replier" }, error: null })
            .mockResolvedValueOnce({ data: { slug: "pnw-breyer" }, error: null });
        mockClient._setImplicitResolve({
            data: Array.from({ length: 40 }, (_, i) => ({ author_id: `participant-${i}` })),
            error: null,
        });
        await runAfterCallbacks();

        // 1 parent-author notification + 25 capped participants
        expect(createNotification).toHaveBeenCalledTimes(26);
    });
});

describe("groups — togglePinPost authz (surfaced by the forum UI)", () => {
    it("refuses plain members", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: { group_id: GROUP_ID, is_pinned: false }, error: null })
            .mockResolvedValueOnce({ data: { role: "member" }, error: null });
        const result = await togglePinPost(THREAD_ID);
        expect(result).toEqual({ success: false, error: "Only admins can pin posts." });
        expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
    });

    it("lets moderators toggle the pin", async () => {
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({ data: { group_id: GROUP_ID, is_pinned: false }, error: null })
            .mockResolvedValueOnce({ data: { role: "moderator" }, error: null });
        const result = await togglePinPost(THREAD_ID);
        expect(result).toEqual({ success: true });
        expect(mockClient._mockQuery.update).toHaveBeenCalledWith({ is_pinned: true });
    });
});
