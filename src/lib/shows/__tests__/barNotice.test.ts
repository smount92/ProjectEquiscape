import { describe, expect, it } from "vitest";
import { barNoticeText } from "@/lib/shows/barNotice";

describe("barNoticeText", () => {
    it("names the show and counts the entries", () => {
        expect(barNoticeText("Summerween", 1)).toBe(
            `The host of "Summerween" has removed your entry, and you can't re-enter this show. You can message the host about it.`,
        );
        expect(barNoticeText("Summerween", 3)).toBe(
            `The host of "Summerween" has removed your entries, and you can't re-enter this show. You can message the host about it.`,
        );
    });

    it("a bar with nothing taken asks them not to enter", () => {
        expect(barNoticeText("Summerween", 0)).toBe(
            `The host of "Summerween" has asked that you not enter this show. You can message the host about it.`,
        );
    });

    it("still reads as a sentence when the title is missing", () => {
        expect(barNoticeText(null, 0)).toBe(
            "The host of this show has asked that you not enter this show. You can message the host about it.",
        );
        expect(barNoticeText("   ", 2)).toMatch(/^The host of this show has removed your entries,/);
    });
});
