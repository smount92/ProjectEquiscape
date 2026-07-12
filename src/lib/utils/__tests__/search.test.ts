import { describe, it, expect } from "vitest";
import { sanitizeForOr } from "@/lib/utils/search";

describe("sanitizeForOr", () => {
    it("passes normal model-name searches through unchanged", () => {
        expect(sanitizeForOr("Silver")).toBe("Silver");
        expect(sanitizeForOr("Man o' War")).toBe("Man o' War");
        expect(sanitizeForOr("Peter Stone ISH")).toBe("Peter Stone ISH");
        expect(sanitizeForOr("G2 Warmblood #1370")).toBe("G2 Warmblood #1370");
        expect(sanitizeForOr("Black/Bay")).toBe("Black/Bay");
    });

    it("strips the PostgREST filter break-out characters (comma + parens)", () => {
        // These are what let a value escape its `col.ilike.%value%` slot and
        // inject a new OR condition.
        expect(sanitizeForOr("a,b")).toBe("a b");
        expect(sanitizeForOr("x(1)")).toBe("x 1");
        expect(sanitizeForOr("id.eq.1,is_admin.eq.true")).not.toContain(",");
    });

    it("strips LIKE wildcards and the escape char so a term can't balloon a scan", () => {
        expect(sanitizeForOr("%%%")).toBe("");
        expect(sanitizeForOr("a%b")).toBe("a b");
        expect(sanitizeForOr("a*b")).toBe("a b");
        expect(sanitizeForOr("a\\b")).toBe("a b");
    });

    it("collapses whitespace left behind and trims", () => {
        expect(sanitizeForOr("  a , b  ")).toBe("a b");
        expect(sanitizeForOr(",,,")).toBe("");
        expect(sanitizeForOr("")).toBe("");
    });

    it("leaves no filter-control characters in a hostile input", () => {
        const out = sanitizeForOr("Silver%,(title.ilike.*)");
        expect(out).not.toMatch(/[,()%*\\]/);
    });
});
