import { describe, it, expect } from "vitest";
import {
    mergeByCreatedAtDesc,
    takePage,
    isGloballyVisible,
    type ContextualRow,
} from "@/lib/feed/stream";

const row = (id: string, createdAt: string) => ({ id, createdAt });

describe("mergeByCreatedAtDesc", () => {
    it("interleaves two sources newest-first", () => {
        const a = [row("a1", "2026-08-10T10:00:00Z"), row("a2", "2026-08-08T10:00:00Z")];
        const b = [row("b1", "2026-08-09T10:00:00Z"), row("b2", "2026-08-07T10:00:00Z")];
        expect(mergeByCreatedAtDesc(a, b).map((r) => r.id)).toEqual(["a1", "b1", "a2", "b2"]);
    });

    it("handles empty sources", () => {
        expect(mergeByCreatedAtDesc([], [])).toEqual([]);
    });

    it("breaks ties deterministically by id", () => {
        const same = "2026-08-10T10:00:00Z";
        const first = mergeByCreatedAtDesc([row("b", same)], [row("a", same)]).map((r) => r.id);
        const second = mergeByCreatedAtDesc([row("a", same)], [row("b", same)]).map((r) => r.id);
        expect(first).toEqual(second);
    });
});

describe("takePage", () => {
    const rows = [
        row("1", "2026-08-10T10:00:00Z"),
        row("2", "2026-08-09T10:00:00Z"),
        row("3", "2026-08-08T10:00:00Z"),
    ];

    it("returns a cursor when more rows were fetched than fit", () => {
        const page = takePage(rows, 2, true);
        expect(page.items.map((r) => r.id)).toEqual(["1", "2"]);
        expect(page.nextCursor).toBe("2026-08-09T10:00:00Z");
    });

    it("returns no cursor once the sources are exhausted and everything fits", () => {
        expect(takePage(rows, 5, true).nextCursor).toBeNull();
    });

    it("keeps paging when a source was NOT exhausted even if the page is short", () => {
        // A page can come back short purely because visibility filtering
        // ate the rows — that must not look like the end of the feed.
        expect(takePage(rows, 5, false).nextCursor).toBe("2026-08-08T10:00:00Z");
    });

    it("returns an empty page for no rows", () => {
        expect(takePage([], 10, false)).toEqual({ items: [], nextCursor: null });
    });
});

describe("isGloballyVisible", () => {
    const base: ContextualRow = {
        horseId: null,
        groupId: null,
        eventId: null,
        studioId: null,
        helpRequestId: null,
        channelId: null,
    };
    const publicHorses = new Set(["horse-public"]);
    const publicGroups = new Set(["group-public"]);

    it("admits a context-free post", () => {
        expect(isGloballyVisible(base, publicHorses, publicGroups)).toBe(true);
    });

    it("admits a post on a public horse", () => {
        expect(
            isGloballyVisible({ ...base, horseId: "horse-public" }, publicHorses, publicGroups),
        ).toBe(true);
    });

    it("REFUSES a post on a private or unlisted horse", () => {
        expect(
            isGloballyVisible({ ...base, horseId: "horse-private" }, publicHorses, publicGroups),
        ).toBe(false);
    });

    it("admits a post in a public group", () => {
        expect(
            isGloballyVisible({ ...base, groupId: "group-public" }, publicHorses, publicGroups),
        ).toBe(true);
    });

    it("REFUSES a post in a private or restricted group", () => {
        expect(
            isGloballyVisible({ ...base, groupId: "group-private" }, publicHorses, publicGroups),
        ).toBe(false);
    });

    it("REFUSES a group forum channel post even in a public group", () => {
        expect(
            isGloballyVisible(
                { ...base, groupId: "group-public", channelId: "chan-1" },
                publicHorses,
                publicGroups,
            ),
        ).toBe(false);
    });

    it("REFUSES studio, help-request and event threads", () => {
        expect(isGloballyVisible({ ...base, studioId: "s" }, publicHorses, publicGroups)).toBe(false);
        expect(isGloballyVisible({ ...base, helpRequestId: "h" }, publicHorses, publicGroups)).toBe(false);
        expect(isGloballyVisible({ ...base, eventId: "e" }, publicHorses, publicGroups)).toBe(false);
    });

    it("REFUSES a public-horse post that is also inside a non-public group", () => {
        expect(
            isGloballyVisible(
                { ...base, horseId: "horse-public", groupId: "group-private" },
                publicHorses,
                publicGroups,
            ),
        ).toBe(false);
    });
});
