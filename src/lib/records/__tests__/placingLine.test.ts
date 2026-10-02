import { describe, it, expect } from "vitest";
import { fieldSize, fieldTitle, placingWithField } from "@/lib/records/placingLine";

describe("the placing line", () => {
    it("says 'of N' for an ordinal with a known field", () => {
        expect(placingWithField("3rd", 12)).toBe("3rd of 12");
        expect(placingWithField("1st", "8")).toBe("1st of 8");
        expect(placingWithField(" 2nd ", 2)).toBe("2nd of 2");
    });

    it("keeps to what is certain when the field is unknown or impossible", () => {
        expect(placingWithField("3rd", null)).toBe("3rd");
        expect(placingWithField("3rd", 0)).toBe("3rd");
        expect(placingWithField("5th", 3)).toBe("5th");
        expect(placingWithField("3rd", "lots")).toBe("3rd");
    });

    it("names the field beside a non-ordinal award", () => {
        expect(placingWithField("Champion", 14)).toBe("Champion · 14 in class");
        expect(placingWithField("HM", 9)).toBe("HM · 9 in class");
    });

    it("returns null when there is no placing", () => {
        expect(placingWithField(null, 12)).toBeNull();
        expect(placingWithField("  ", 12)).toBeNull();
    });

    it("normalises a class size and glosses it", () => {
        expect(fieldSize(12.9)).toBe(12);
        expect(fieldSize("")).toBeNull();
        expect(fieldSize(-3)).toBeNull();
        expect(fieldTitle(1)).toBe("1 horse in the class");
        expect(fieldTitle(12)).toBe("12 horses in the class");
        expect(fieldTitle(null)).toBeUndefined();
    });
});
