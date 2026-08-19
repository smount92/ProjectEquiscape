import { describe, expect, it } from "vitest";

import { mapPublicCardRows, type PublicCardRow } from "../publicCards";

function row(overrides: Partial<PublicCardRow> = {}): PublicCardRow {
    return {
        code: "AbCd2345",
        earned_place: 1,
        status: "issued",
        show_year: 2026,
        show_title: "Spring Fling Online",
        class_name: "Breed Halter",
        issued_at: "2026-07-10T12:00:00Z",
        ...overrides,
    };
}

describe("mapPublicCardRows", () => {
    it("maps RPC rows to the passport card shape", () => {
        const cards = mapPublicCardRows([row(), row({ code: "WxYz6789", earned_place: 2, status: "transferred" })]);
        expect(cards).toHaveLength(2);
        expect(cards[0]).toEqual({
            code: "AbCd2345",
            earnedPlace: 1,
            status: "issued",
            showYear: 2026,
            showTitle: "Spring Fling Online",
            className: "Breed Halter",
            issuedAt: "2026-07-10T12:00:00Z",
            // Pre-153 RPC shape: no field counts, never STAKES.
            classEntryCount: null,
            classExhibitorCount: null,
            isStakes: false,
        });
        expect(cards[1].earnedPlace).toBe(2);
        expect(cards[1].status).toBe("transferred");
    });

    it("returns [] for non-array payloads (missing RPC, error bodies)", () => {
        expect(mapPublicCardRows(null)).toEqual([]);
        expect(mapPublicCardRows(undefined)).toEqual([]);
        expect(mapPublicCardRows({ message: "function does not exist" })).toEqual([]);
        expect(mapPublicCardRows("nope")).toEqual([]);
    });

    it("drops junk rows instead of rendering broken plaques", () => {
        const cards = mapPublicCardRows([
            null,
            42,
            row({ code: "" }),
            { ...row(), earned_place: 3 },
            { ...row(), status: "counterfeit" },
            row({ code: "KeepMe22" }),
        ]);
        expect(cards).toHaveLength(1);
        expect(cards[0].code).toBe("KeepMe22");
    });

    it("degrades missing display fields to placeholders, not crashes", () => {
        const cards = mapPublicCardRows([
            { code: "AbCd2345", earned_place: 1, status: "issued" },
        ]);
        expect(cards).toHaveLength(1);
        expect(cards[0].showYear).toBeNull();
        expect(cards[0].showTitle).toBe("Unknown show");
        expect(cards[0].className).toBe("Unknown class");
    });
});
