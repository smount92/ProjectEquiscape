import { describe, it, expect } from "vitest";
import {
    createThreadSchema,
    getGroupBoardSchema,
    getThreadSchema,
    markGroupReadSchema,
    replyToThreadSchema,
    firstZodError,
} from "@/lib/groups/schemas";

const GROUP_ID = "123e4567-e89b-42d3-a456-426614174000";
const CHANNEL_ID = "223e4567-e89b-42d3-a456-426614174000";
const POST_ID = "323e4567-e89b-42d3-a456-426614174000";

describe("createThreadSchema", () => {
    it("accepts a valid thread", () => {
        const parsed = createThreadSchema.safeParse({
            groupId: GROUP_ID,
            channelId: CHANNEL_ID,
            title: "Region 4 Live — who's going?",
            content: "Entries close Friday.",
        });
        expect(parsed.success).toBe(true);
    });

    it("channel is optional", () => {
        expect(createThreadSchema.safeParse({ groupId: GROUP_ID, title: "abc", content: "x" }).success).toBe(true);
    });

    it("rejects a non-uuid group id", () => {
        const parsed = createThreadSchema.safeParse({ groupId: "nope", title: "abc", content: "x" });
        expect(parsed.success).toBe(false);
    });

    it("rejects titles under 3 chars (after trim)", () => {
        const parsed = createThreadSchema.safeParse({ groupId: GROUP_ID, title: " ab ", content: "x" });
        expect(parsed.success).toBe(false);
        if (!parsed.success) expect(firstZodError(parsed.error)).toMatch(/at least 3/i);
    });

    it("rejects titles over 120 chars", () => {
        const parsed = createThreadSchema.safeParse({ groupId: GROUP_ID, title: "t".repeat(121), content: "x" });
        expect(parsed.success).toBe(false);
    });

    it("rejects empty content", () => {
        const parsed = createThreadSchema.safeParse({ groupId: GROUP_ID, title: "abc", content: "   " });
        expect(parsed.success).toBe(false);
    });

    it("rejects content over 2000 chars", () => {
        const parsed = createThreadSchema.safeParse({ groupId: GROUP_ID, title: "abc", content: "c".repeat(2001) });
        expect(parsed.success).toBe(false);
        if (!parsed.success) expect(firstZodError(parsed.error)).toMatch(/2000/);
    });
});

describe("replyToThreadSchema", () => {
    it("accepts replies up to 2000 chars — the 500 cap dies here", () => {
        const parsed = replyToThreadSchema.safeParse({ postId: POST_ID, content: "r".repeat(2000) });
        expect(parsed.success).toBe(true);
    });

    it("rejects replies over 2000 chars", () => {
        expect(replyToThreadSchema.safeParse({ postId: POST_ID, content: "r".repeat(2001) }).success).toBe(false);
    });

    it("rejects empty replies", () => {
        expect(replyToThreadSchema.safeParse({ postId: POST_ID, content: " " }).success).toBe(false);
    });

    it("rejects a non-uuid post id", () => {
        expect(replyToThreadSchema.safeParse({ postId: "42", content: "hi" }).success).toBe(false);
    });
});

describe("getGroupBoardSchema", () => {
    it("defaults offset to 0", () => {
        const parsed = getGroupBoardSchema.parse({ groupId: GROUP_ID });
        expect(parsed.offset).toBe(0);
    });

    it("rejects negative offsets", () => {
        expect(getGroupBoardSchema.safeParse({ groupId: GROUP_ID, offset: -1 }).success).toBe(false);
    });

    it("accepts an optional channel filter", () => {
        const parsed = getGroupBoardSchema.parse({ groupId: GROUP_ID, channelId: CHANNEL_ID });
        expect(parsed.channelId).toBe(CHANNEL_ID);
    });
});

describe("getThreadSchema / markGroupReadSchema", () => {
    it("getThread defaults repliesOffset to 0", () => {
        expect(getThreadSchema.parse({ postId: POST_ID }).repliesOffset).toBe(0);
    });

    it("markGroupRead requires a uuid", () => {
        expect(markGroupReadSchema.safeParse({ groupId: "x" }).success).toBe(false);
        expect(markGroupReadSchema.safeParse({ groupId: GROUP_ID }).success).toBe(true);
    });
});
