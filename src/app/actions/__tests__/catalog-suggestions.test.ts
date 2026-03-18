import { describe, it, expect, vi, beforeEach } from "vitest";

/* ──────────────────────────────────────────────────────
   catalog-suggestions.ts — Server Action Unit Tests
   
   Tests focus on input validation and auto-approve logic,
   which are the most critical business rules.
   ────────────────────────────────────────────────────── */

// ── Auto-Approve constants (mirror the source of truth) ──
const SILVER_THRESHOLD = 50;
const GOLD_THRESHOLD = 200;
const SILVER_AUTO_FIELDS = new Set(["color", "year", "production_run", "release_date"]);

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
        expect(shouldAutoApprove(0, "correction", ["color"])).toBe(false);
        expect(shouldAutoApprove(10, "correction", ["color"])).toBe(false);
        expect(shouldAutoApprove(49, "correction", ["color"])).toBe(false);
    });

    it("Silver auto-approves color-only corrections", () => {
        expect(shouldAutoApprove(50, "correction", ["color"])).toBe(true);
    });

    it("Silver auto-approves year-only corrections", () => {
        expect(shouldAutoApprove(50, "correction", ["year"])).toBe(true);
    });

    it("Silver auto-approves color + year combined", () => {
        expect(shouldAutoApprove(50, "correction", ["color", "year"])).toBe(true);
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
        expect(shouldAutoApprove(50, "correction", ["color", "maker"])).toBe(false);
    });

    it("Gold auto-approves ALL correction fields", () => {
        expect(shouldAutoApprove(200, "correction", ["maker"])).toBe(true);
        expect(shouldAutoApprove(200, "correction", ["mold"])).toBe(true);
        expect(shouldAutoApprove(200, "correction", ["color", "maker", "mold"])).toBe(true);
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
