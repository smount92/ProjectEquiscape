import { describe, expect, it } from "vitest";

import { escapeCSV } from "../csv";

describe("escapeCSV", () => {
    it("passes plain values through", () => {
        expect(escapeCSV("Misty of Chincoteague")).toBe("Misty of Chincoteague");
        expect(escapeCSV(42)).toBe("42");
    });

    it("returns empty string for null/undefined", () => {
        expect(escapeCSV(null)).toBe("");
        expect(escapeCSV(undefined)).toBe("");
    });

    it("quotes values containing commas, quotes, and newlines", () => {
        expect(escapeCSV("Bay, dapple")).toBe('"Bay, dapple"');
        expect(escapeCSV('The "Duchess"')).toBe('"The ""Duchess"""');
        expect(escapeCSV("line1\nline2")).toBe('"line1\nline2"');
    });

    it("neutralizes formula injection (leading = + - @)", () => {
        expect(escapeCSV('=HYPERLINK("http://evil","x")')).toBe(
            "\"'=HYPERLINK(\"\"http://evil\"\",\"\"x\"\")\""
        );
        expect(escapeCSV("+1234")).toBe("'+1234");
        expect(escapeCSV("-cmd")).toBe("'-cmd");
        expect(escapeCSV("@import")).toBe("'@import");
    });

    it("leaves interior special characters alone", () => {
        expect(escapeCSV("a=b")).toBe("a=b");
        expect(escapeCSV("Reserve @ NAN")).toBe("Reserve @ NAN");
    });
});
