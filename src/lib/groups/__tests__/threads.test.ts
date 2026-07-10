import { describe, it, expect } from "vitest";
import { compareBoardThreads, deriveThreadTitle, isThreadUnread } from "@/lib/groups/threads";

describe("deriveThreadTitle", () => {
    it("prefers the stored title when present", () => {
        expect(deriveThreadTitle("Club rules", "Some long content")).toBe("Club rules");
    });

    it("trims the stored title", () => {
        expect(deriveThreadTitle("  Club rules  ", "content")).toBe("Club rules");
    });

    it("derives from the first line of content when no title", () => {
        expect(deriveThreadTitle(null, "Carpool from Tacoma?\nI have room for two.")).toBe("Carpool from Tacoma?");
    });

    it("handles CRLF line breaks", () => {
        expect(deriveThreadTitle(null, "First line\r\nSecond line")).toBe("First line");
    });

    it("skips leading whitespace/newlines before the first line", () => {
        expect(deriveThreadTitle(null, "\n\n  Hello there\nmore")).toBe("Hello there");
    });

    it("truncates long first lines to ~80 chars with an ellipsis", () => {
        const line = "a".repeat(200);
        const derived = deriveThreadTitle(null, line);
        expect(derived.length).toBe(80);
        expect(derived.endsWith("…")).toBe(true);
        expect(derived.startsWith("a".repeat(79))).toBe(true);
    });

    it("does not truncate an exactly-80-char line", () => {
        const line = "b".repeat(80);
        expect(deriveThreadTitle(null, line)).toBe(line);
    });

    it("falls back to Untitled for empty content", () => {
        expect(deriveThreadTitle(null, "")).toBe("Untitled");
        expect(deriveThreadTitle(null, null)).toBe("Untitled");
        expect(deriveThreadTitle(undefined, undefined)).toBe("Untitled");
    });

    it("falls back to Untitled for whitespace-only content", () => {
        expect(deriveThreadTitle(null, "   \n\n  ")).toBe("Untitled");
    });

    it("treats a whitespace-only stored title as absent", () => {
        expect(deriveThreadTitle("   ", "Real content here")).toBe("Real content here");
    });
});

describe("isThreadUnread", () => {
    it("is unread when the viewer has never visited (null last-read)", () => {
        expect(isThreadUnread("2026-07-01T00:00:00Z", null)).toBe(true);
    });

    it("is unread when bumped after the last visit", () => {
        expect(isThreadUnread("2026-07-02T00:00:00Z", "2026-07-01T00:00:00Z")).toBe(true);
    });

    it("is read when bumped before the last visit", () => {
        expect(isThreadUnread("2026-06-30T00:00:00Z", "2026-07-01T00:00:00Z")).toBe(false);
    });

    it("is read when bumped exactly at the last visit", () => {
        expect(isThreadUnread("2026-07-01T00:00:00Z", "2026-07-01T00:00:00Z")).toBe(false);
    });
});

describe("compareBoardThreads", () => {
    const t = (isPinned: boolean, lastActivity: string) => ({ isPinned, lastActivity });

    it("orders pinned threads before unpinned ones regardless of bump time", () => {
        const threads = [
            t(false, "2026-07-09T12:00:00Z"),
            t(true, "2026-05-02T00:00:00Z"),
        ];
        threads.sort(compareBoardThreads);
        expect(threads[0].isPinned).toBe(true);
    });

    it("orders by most-recently-bumped within the same pin state", () => {
        const older = t(false, "2026-07-01T00:00:00Z");
        const newer = t(false, "2026-07-09T00:00:00Z");
        expect([older, newer].sort(compareBoardThreads)).toEqual([newer, older]);
    });

    it("sorts a mixed board: pinned first, then bump order", () => {
        const a = t(false, "2026-07-08T00:00:00Z");
        const b = t(true, "2026-07-01T00:00:00Z");
        const c = t(false, "2026-07-09T00:00:00Z");
        const d = t(true, "2026-07-02T00:00:00Z");
        expect([a, b, c, d].sort(compareBoardThreads)).toEqual([d, b, c, a]);
    });
});
