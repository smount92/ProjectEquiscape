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
        expect(escapeCSV("=SUM(1+1)")).toBe("'=SUM(1+1)");
        expect(escapeCSV("+1234")).toBe("'+1234");
        expect(escapeCSV("-cmd")).toBe("'-cmd");
        expect(escapeCSV("@import")).toBe("'@import");
    });

    it("neutralizes the classic command payloads", () => {
        // The canonical DDE payloads. No comma or double quote in any of
        // them, so the prefix is the whole of the change.
        expect(escapeCSV("+cmd|' /C calc'!A0")).toBe(`'+cmd|' /C calc'!A0`);
        expect(escapeCSV("-2+3+cmd|' /C calc'!A0")).toBe(`'-2+3+cmd|' /C calc'!A0`);
        expect(escapeCSV("@SUM(1+9)*cmd|' /C calc'!A0")).toBe(`'@SUM(1+9)*cmd|' /C calc'!A0`);
        expect(escapeCSV("-2+3")).toBe("'-2+3");
        expect(escapeCSV("@A1")).toBe("'@A1");
    });

    it("neutralizes leading whitespace smuggling (tab, CR)", () => {
        // Excel trims leading whitespace before deciding it is a formula,
        // so the trigger has to be checked before the trim, not after.
        expect(escapeCSV("\t=SUM(1+1)")).toBe("'\t=SUM(1+1)");
        expect(escapeCSV("\r=SUM(1+1)")).toBe(`"'\r=SUM(1+1)"`);
        expect(escapeCSV("\r\n=cmd")).toBe(`"'\r\n=cmd"`);
    });

    it("quotes a value containing a bare CR so it cannot end the record", () => {
        expect(escapeCSV("Misty\rof Chincoteague")).toBe('"Misty\rof Chincoteague"');
    });

    it("applies the blunt policy to innocent names too (documented cost)", () => {
        // "-Dash" is a plausible horse name and still gets the quote: the
        // sanitizer never guesses intent, because guessing is the bypass.
        expect(escapeCSV("-Dash")).toBe("'-Dash");
        expect(escapeCSV("+Ever After")).toBe("'+Ever After");
    });

    it("leaves interior special characters alone", () => {
        expect(escapeCSV("a=b")).toBe("a=b");
        expect(escapeCSV("Reserve @ NAN")).toBe("Reserve @ NAN");
        expect(escapeCSV("Sea Star -- 1963")).toBe("Sea Star -- 1963");
    });
});
