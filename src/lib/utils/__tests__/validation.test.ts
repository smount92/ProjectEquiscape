import { describe, it, expect } from "vitest";
import {
    getRequiredString,
    getOptionalString,
    getOptionalNumber,
    getBoolean,
    sanitizeText,
    sanitizeRichText,
} from "@/lib/utils/validation";

// Helper to create FormData with a key-value pair
function makeFormData(entries: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [key, value] of Object.entries(entries)) {
        fd.append(key, value);
    }
    return fd;
}

describe("getRequiredString", () => {
    it("returns trimmed string for valid input", () => {
        expect(getRequiredString(makeFormData({ name: "hello" }), "name")).toBe("hello");
    });

    it("returns null for empty string", () => {
        expect(getRequiredString(makeFormData({ name: "" }), "name")).toBe(null);
    });

    it("returns null for literal 'null'", () => {
        expect(getRequiredString(makeFormData({ name: "null" }), "name")).toBe(null);
    });

    it("returns null for literal 'undefined'", () => {
        expect(getRequiredString(makeFormData({ name: "undefined" }), "name")).toBe(null);
    });

    it("returns null for missing key", () => {
        expect(getRequiredString(makeFormData({}), "name")).toBe(null);
    });

    it("trims whitespace", () => {
        expect(getRequiredString(makeFormData({ name: "  spaces  " }), "name")).toBe("spaces");
    });
});

describe("getOptionalString", () => {
    it("returns trimmed string for valid input", () => {
        expect(getOptionalString(makeFormData({ bio: "hello world" }), "bio")).toBe("hello world");
    });

    it("returns null for empty string", () => {
        expect(getOptionalString(makeFormData({ bio: "" }), "bio")).toBe(null);
    });

    it("returns null for missing key", () => {
        expect(getOptionalString(makeFormData({}), "bio")).toBe(null);
    });
});

describe("getOptionalNumber", () => {
    it("returns number for valid numeric string", () => {
        expect(getOptionalNumber(makeFormData({ price: "42.5" }), "price")).toBe(42.5);
    });

    it("returns null for non-numeric string", () => {
        expect(getOptionalNumber(makeFormData({ price: "abc" }), "price")).toBe(null);
    });

    it("returns null for missing key", () => {
        expect(getOptionalNumber(makeFormData({}), "price")).toBe(null);
    });

    it("returns integer for whole number string", () => {
        expect(getOptionalNumber(makeFormData({ price: "100" }), "price")).toBe(100);
    });

    it("returns null for empty string", () => {
        expect(getOptionalNumber(makeFormData({ price: "" }), "price")).toBe(null);
    });
});

describe("getBoolean", () => {
    it("returns true for 'true'", () => {
        expect(getBoolean(makeFormData({ flag: "true" }), "flag")).toBe(true);
    });

    it("returns false for 'false'", () => {
        expect(getBoolean(makeFormData({ flag: "false" }), "flag")).toBe(false);
    });

    it("returns default value for missing key", () => {
        expect(getBoolean(makeFormData({}), "flag", true)).toBe(true);
        expect(getBoolean(makeFormData({}), "flag", false)).toBe(false);
    });

    it("returns false for non-'true' values", () => {
        expect(getBoolean(makeFormData({ flag: "yes" }), "flag")).toBe(false);
        expect(getBoolean(makeFormData({ flag: "1" }), "flag")).toBe(false);
    });
});

describe("sanitizeText", () => {
    it("passes through normal text", () => {
        expect(sanitizeText("Normal text")).toBe("Normal text");
    });

    it("strips script tags", () => {
        const result = sanitizeText("<script>alert('xss')</script>");
        expect(result).not.toContain("<script>");
        expect(result).not.toContain("</script>");
    });

    it("strips bold tags", () => {
        expect(sanitizeText("Hello <b>bold</b>")).toBe("Hello bold");
    });

    it("strips img tags with onerror", () => {
        const result = sanitizeText("<img src=x onerror=alert(1)>");
        expect(result).not.toContain("<img");
        expect(result).not.toContain("onerror");
    });

    it("preserves multiline text", () => {
        const result = sanitizeText("Line 1\nLine 2");
        expect(result).toContain("Line 1");
        expect(result).toContain("Line 2");
    });

    it("trims whitespace", () => {
        expect(sanitizeText("  hello  ")).toBe("hello");
    });
});

describe("sanitizeRichText", () => {
    it("preserves allowed tags (b, i, em, strong)", () => {
        const input = "<b>bold</b> <i>italic</i> <em>emphasis</em> <strong>strong</strong>";
        const result = sanitizeRichText(input);
        expect(result).toContain("<b>bold</b>");
        expect(result).toContain("<i>italic</i>");
    });

    it("strips script tags", () => {
        const result = sanitizeRichText("<script>bad</script>");
        expect(result).not.toContain("<script>");
    });

    it("preserves safe links", () => {
        const input = '<a href="https://safe.com">link</a>';
        const result = sanitizeRichText(input);
        expect(result).toContain("https://safe.com");
        expect(result).toContain("<a");
    });

    it("strips javascript: scheme from links", () => {
        const result = sanitizeRichText('<a href="javascript:void(0)">bad</a>');
        expect(result).not.toContain("javascript:");
    });

    it("preserves paragraph and list tags", () => {
        const input = "<p>text</p><ul><li>item</li></ul>";
        const result = sanitizeRichText(input);
        expect(result).toContain("<p>");
        expect(result).toContain("<li>");
    });
});
