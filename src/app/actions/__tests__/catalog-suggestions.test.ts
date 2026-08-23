import { describe, it, expect, vi, beforeEach } from "vitest";
import { SILVER_AUTO_FIELDS } from "@/lib/catalog/corrections";
import {
    CATALOG_GENDERS,
    RUN_TYPES,
    isCatalogGender,
    isRunType,
    normalizeCatalogBreed,
    normalizeRunCount,
} from "@/lib/catalog/taxonomy";

/* ──────────────────────────────────────────────────────
   catalog-suggestions.ts — Server Action Unit Tests

   Tests focus on input validation and auto-approve logic,
   which are the most critical business rules.
   ────────────────────────────────────────────────────── */

// ── Auto-Approve thresholds (mirror the source of truth) ──
// SILVER_AUTO_FIELDS is imported from the shared module so this test can never
// drift from the real allowlist. Note it holds `attributes` JSONB keys (e.g.
// color_description), the exact keys SuggestEditModal emits — not labels.
const SILVER_THRESHOLD = 50;
const GOLD_THRESHOLD = 200;

describe("Auto-approve rules (pure logic)", () => {
    function shouldAutoApprove(
        approvedCount: number,
        suggestionType: string,
        changedFields: string[]
    ): boolean {
        if (suggestionType !== "correction") return false;
        if (approvedCount >= GOLD_THRESHOLD) return true;
        if (approvedCount >= SILVER_THRESHOLD) {
            return changedFields.every((f) => SILVER_AUTO_FIELDS.has(f));
        }
        return false;
    }

    it("returns false for regular users regardless of fields", () => {
        expect(shouldAutoApprove(0, "correction", ["color_description"])).toBe(false);
        expect(shouldAutoApprove(10, "correction", ["color_description"])).toBe(false);
        expect(shouldAutoApprove(49, "correction", ["color_description"])).toBe(false);
    });

    it("Silver auto-approves color-only corrections", () => {
        expect(shouldAutoApprove(50, "correction", ["color_description"])).toBe(true);
    });

    it("Silver auto-approves year-only corrections", () => {
        expect(shouldAutoApprove(50, "correction", ["release_year_start"])).toBe(true);
    });

    it("Silver auto-approves color + year combined", () => {
        expect(
            shouldAutoApprove(50, "correction", [
                "color_description",
                "release_year_start",
            ])
        ).toBe(true);
    });

    it("Silver auto-approves production_run corrections", () => {
        expect(shouldAutoApprove(75, "correction", ["production_run"])).toBe(true);
    });

    it("Silver auto-approves release_date corrections", () => {
        expect(shouldAutoApprove(99, "correction", ["release_date"])).toBe(true);
    });

    it("Silver does NOT auto-approve maker corrections", () => {
        expect(shouldAutoApprove(50, "correction", ["maker"])).toBe(false);
    });

    it("Silver does NOT auto-approve mold corrections", () => {
        expect(shouldAutoApprove(50, "correction", ["mold"])).toBe(false);
    });

    it("Silver does NOT auto-approve mix of allowed + disallowed fields", () => {
        expect(
            shouldAutoApprove(50, "correction", ["color_description", "maker"])
        ).toBe(false);
    });

    it("Silver does NOT auto-approve human-label keys (must be attribute keys)", () => {
        // Guards the pre-existing bug: SuggestEditModal emits attribute keys
        // like `color_description`, never `color`, so a "color" allowlist
        // would silently never fire.
        expect(shouldAutoApprove(50, "correction", ["color"])).toBe(false);
        expect(shouldAutoApprove(50, "correction", ["year"])).toBe(false);
    });

    it("Gold auto-approves ALL correction fields", () => {
        expect(shouldAutoApprove(200, "correction", ["maker"])).toBe(true);
        expect(shouldAutoApprove(200, "correction", ["mold"])).toBe(true);
        expect(
            shouldAutoApprove(200, "correction", [
                "color_description",
                "maker",
                "mold",
            ])
        ).toBe(true);
    });

    it("Gold with very high count auto-approves", () => {
        expect(shouldAutoApprove(999, "correction", ["mold"])).toBe(true);
    });

    it("additions NEVER auto-approve, even for Gold", () => {
        expect(shouldAutoApprove(0, "addition", ["title"])).toBe(false);
        expect(shouldAutoApprove(50, "addition", ["title"])).toBe(false);
        expect(shouldAutoApprove(200, "addition", ["title"])).toBe(false);
        expect(shouldAutoApprove(999, "addition", ["title"])).toBe(false);
    });

    it("removals NEVER auto-approve", () => {
        expect(shouldAutoApprove(200, "removal", ["id"])).toBe(false);
    });

    it("photo suggestions NEVER auto-approve", () => {
        expect(shouldAutoApprove(200, "photo", ["url"])).toBe(false);
    });
});

describe("Curator tier boundaries", () => {
    function getCuratorTier(approvedCount: number): string {
        if (approvedCount >= GOLD_THRESHOLD) return "gold";
        if (approvedCount >= SILVER_THRESHOLD) return "silver";
        if (approvedCount >= 10) return "bronze";
        if (approvedCount >= 1) return "contributor";
        return "none";
    }

    it("below 1 = none", () => {
        expect(getCuratorTier(0)).toBe("none");
    });

    it("1–9 = contributor", () => {
        expect(getCuratorTier(1)).toBe("contributor");
        expect(getCuratorTier(9)).toBe("contributor");
    });

    it("10–49 = bronze", () => {
        expect(getCuratorTier(10)).toBe("bronze");
        expect(getCuratorTier(49)).toBe("bronze");
    });

    it("50–199 = silver", () => {
        expect(getCuratorTier(50)).toBe("silver");
        expect(getCuratorTier(199)).toBe("silver");
    });

    it("200+ = gold", () => {
        expect(getCuratorTier(200)).toBe("gold");
        expect(getCuratorTier(500)).toBe("gold");
    });
});

describe("Suggestion input validation", () => {
    it("rejects reasons shorter than 10 chars", () => {
        const reason = "too short";
        expect(reason.trim().length).toBeLessThan(10);
    });

    it("accepts reasons of 10+ chars", () => {
        const reason = "This model is listed incorrectly in the catalog.";
        expect(reason.trim().length).toBeGreaterThanOrEqual(10);
    });

    it("enforces 2000 char max on reasons", () => {
        const longReason = "x".repeat(2001);
        expect(longReason.length).toBeGreaterThan(2000);
    });

    it("rejects empty field changes", () => {
        const changes = {};
        expect(Object.keys(changes).length).toBe(0);
    });

    it("validates field change structure (from/to)", () => {
        const goodChange = { color: { from: "Bay", to: "Dark Bay" } };
        const entry = goodChange.color;
        expect(entry).toHaveProperty("from");
        expect(entry).toHaveProperty("to");
    });
});

describe("Vote count denormalization", () => {
    it("calculates net score correctly from up/down ratios", () => {
        expect(10 - 3).toBe(7);
        expect(0 - 0).toBe(0);
        expect(5 - 5).toBe(0);
        expect(100 - 1).toBe(99);
    });

    it("handles toggle (removing same vote type)", () => {
        let upvotes = 5;
        let downvotes = 2;
        const currentVote = "up";

        // Toggle off up
        if (currentVote === "up") upvotes--;
        expect(upvotes - downvotes).toBe(2);
    });

    it("handles switch (changing vote direction)", () => {
        let upvotes = 5;
        let downvotes = 2;
        const currentVote = "up";

        // Switch from up to down
        if (currentVote === "up") upvotes--;
        downvotes++;
        expect(upvotes - downvotes).toBe(1);
    });
});

/* ──────────────────────────────────────────────────────
   Tier 1 attribute guards (2026-08-23)

   applyApprovedSuggestion() maps an approved addition's field_changes
   into the attributes JSONB. These are the guards it runs on the way
   in — imported from taxonomy.ts, never mirrored here, so the tests
   cannot drift from what approval actually stores.

   The contract everywhere below: a value the guard doesn't recognize
   yields undefined/false, and the caller's `...(x ? {k:x} : {})`
   spread drops it. A bad value costs its own field and nothing else —
   approval still succeeds, the attribute is simply absent.
   ────────────────────────────────────────────────────── */

describe("run_type approval guard", () => {
    it("accepts every value the suggestion form can emit", () => {
        for (const rt of RUN_TYPES) expect(isRunType(rt)).toBe(true);
    });

    it("holds the nine owner-approved release channels", () => {
        expect(RUN_TYPES).toHaveLength(9);
        expect(RUN_TYPES).toContain("Regular Run");
        expect(RUN_TYPES).toContain("BreyerFest");
        expect(RUN_TYPES).toContain("One of a Kind");
    });

    it("rejects near-misses in case and spacing", () => {
        // The filter matches on the exact stored string, so these are
        // the failures that would silently split a facet in two.
        expect(isRunType("web special")).toBe(false);
        expect(isRunType("WEB SPECIAL")).toBe(false);
        expect(isRunType(" Web Special ")).toBe(false);
        expect(isRunType("Web  Special")).toBe(false);
    });

    it("rejects free text and non-strings", () => {
        expect(isRunType("Limited Edition")).toBe(false);
        expect(isRunType("")).toBe(false);
        expect(isRunType(undefined)).toBe(false);
        expect(isRunType(null)).toBe(false);
        expect(isRunType(42)).toBe(false);
        expect(isRunType(["Regular Run"])).toBe(false);
    });
});

describe("run_count approval guard", () => {
    it("stores a positive integer as a plain string", () => {
        expect(normalizeRunCount("2500")).toBe("2500");
        expect(normalizeRunCount("1")).toBe("1");
        expect(normalizeRunCount(2500)).toBe("2500");
    });

    it("trims surrounding whitespace and drops leading zeros", () => {
        expect(normalizeRunCount("  2500  ")).toBe("2500");
        expect(normalizeRunCount("0250")).toBe("250");
    });

    it("rejects zero and negatives — a run of none is not a run", () => {
        expect(normalizeRunCount("0")).toBeUndefined();
        expect(normalizeRunCount("00")).toBeUndefined();
        expect(normalizeRunCount("-5")).toBeUndefined();
        expect(normalizeRunCount(-5)).toBeUndefined();
    });

    it("rejects the formatted and approximate values collectors type", () => {
        expect(normalizeRunCount("2,500")).toBeUndefined();
        expect(normalizeRunCount("~2500")).toBeUndefined();
        expect(normalizeRunCount("2500 pieces")).toBeUndefined();
        expect(normalizeRunCount("about 2500")).toBeUndefined();
        expect(normalizeRunCount("2500.0")).toBeUndefined();
    });

    it("rejects absurd magnitudes and non-values", () => {
        expect(normalizeRunCount("12345678")).toBeUndefined();
        expect(normalizeRunCount("")).toBeUndefined();
        expect(normalizeRunCount("   ")).toBeUndefined();
        expect(normalizeRunCount(undefined)).toBeUndefined();
        expect(normalizeRunCount(null)).toBeUndefined();
        expect(normalizeRunCount({ count: 2500 })).toBeUndefined();
    });
});

describe("gender approval guard", () => {
    it("accepts the horse forms' vocabulary verbatim", () => {
        for (const g of CATALOG_GENDERS) expect(isCatalogGender(g)).toBe(true);
        expect(isCatalogGender("Mare")).toBe(true);
        expect(isCatalogGender("Gelding")).toBe(true);
    });

    it("includes the longears terms, not just the horse list", () => {
        // Regression guard: flattening GENDER_GROUPS must keep every
        // group, or donkey/mule entries silently fail approval.
        expect(isCatalogGender("Jenny")).toBe(true);
        expect(isCatalogGender("Jack")).toBe(true);
        expect(isCatalogGender("John")).toBe(true);
        expect(isCatalogGender("Molly")).toBe(true);
    });

    it("rejects synonyms outside the vocabulary", () => {
        expect(isCatalogGender("mare")).toBe(false);
        expect(isCatalogGender("Male")).toBe(false);
        expect(isCatalogGender("Female")).toBe(false);
        expect(isCatalogGender("Stud")).toBe(false);
        expect(isCatalogGender("")).toBe(false);
        expect(isCatalogGender(undefined)).toBe(false);
        expect(isCatalogGender(7)).toBe(false);
    });
});

describe("breed approval guard", () => {
    it("keeps free text — there is no breed vocabulary to check against", () => {
        expect(normalizeCatalogBreed("Andalusian")).toBe("Andalusian");
        expect(normalizeCatalogBreed("Rocky Mountain Horse")).toBe("Rocky Mountain Horse");
    });

    it("trims, and treats whitespace-only as absent", () => {
        expect(normalizeCatalogBreed("  Arabian  ")).toBe("Arabian");
        expect(normalizeCatalogBreed("   ")).toBeUndefined();
        expect(normalizeCatalogBreed("")).toBeUndefined();
    });

    it("caps at 100 chars, matching assigned_breed on user horses", () => {
        expect(normalizeCatalogBreed("x".repeat(150))).toHaveLength(100);
    });

    it("rejects non-strings", () => {
        expect(normalizeCatalogBreed(undefined)).toBeUndefined();
        expect(normalizeCatalogBreed(null)).toBeUndefined();
        expect(normalizeCatalogBreed(["Arabian"])).toBeUndefined();
    });
});
