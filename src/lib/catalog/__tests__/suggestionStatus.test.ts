import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    OPEN_SUGGESTION_STATUSES,
    SUGGESTION_STATUS_LABELS,
    claimLine,
    isOpenSuggestion,
    liveClaim,
    statusFilterValues,
} from "@/lib/catalog/suggestionStatus";

/**
 * Since Release 3 a moderator who opens a suggestion claims it, and a
 * claimed suggestion reads under_review. It still waits for a decision:
 * every count and filter of waiting suggestions takes both statuses, and
 * the words say it is being looked at.
 */
describe("open suggestions", () => {
    it("pending and under_review both wait for a decision", () => {
        expect([...OPEN_SUGGESTION_STATUSES]).toEqual(["pending", "under_review"]);
        expect(isOpenSuggestion("pending")).toBe(true);
        expect(isOpenSuggestion("under_review")).toBe(true);
        expect(isOpenSuggestion("approved")).toBe(false);
        expect(isOpenSuggestion("rejected")).toBe(false);
    });

    it("the Pending filter shows both; other filters are themselves", () => {
        expect(statusFilterValues("pending")).toEqual(["pending", "under_review"]);
        expect(statusFilterValues("approved")).toEqual(["approved"]);
        expect(statusFilterValues("all")).toBeNull();
        expect(statusFilterValues(undefined)).toBeNull();
    });

    it("says a claimed suggestion is being looked at", () => {
        expect(SUGGESTION_STATUS_LABELS.under_review).toBe("Being looked at");
        expect(SUGGESTION_STATUS_LABELS.pending).toBe("Waiting for review");
    });

    it("a claim is live only until its time runs out", () => {
        const now = new Date("2026-10-16T12:00:00Z");
        expect(liveClaim({ claimed_by: "u1", claimed_until: "2026-10-16T12:10:00Z" }, now)).toEqual({
            by: "u1",
            until: "2026-10-16T12:10:00Z",
        });
        expect(liveClaim({ claimed_by: "u1", claimed_until: "2026-10-16T11:59:00Z" }, now)).toBeNull();
        expect(liveClaim({ claimed_by: null, claimed_until: null }, now)).toBeNull();
        expect(liveClaim({}, now)).toBeNull();
    });

    it("says who holds it and for how long", () => {
        const now = new Date("2026-10-16T12:00:00Z");
        expect(claimLine("Maple", "2026-10-16T12:11:30Z", now)).toBe(
            "@Maple is looking at this for another 12 minutes.",
        );
        expect(claimLine("Maple", "2026-10-16T12:00:20Z", now)).toBe("@Maple is looking at this for another 1 minute.");
    });
});

describe("no count or filter of waiting suggestions misses the claimed ones", () => {
    it("nothing in src filters catalog_suggestions on status 'pending' alone", () => {
        const root = path.join(process.cwd(), "src");
        const files = (readdirSync(root, { recursive: true }) as string[])
            .map((f) => f.replace(/\\/g, "/"))
            .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("__tests__"));
        const problems: string[] = [];
        for (const f of files) {
            const text = readFileSync(path.join(root, f), "utf8");
            for (const m of text.matchAll(/\.from\(\s*"catalog_suggestions"\s*\)/g)) {
                const chain = text.slice(m.index, text.indexOf(";", m.index) + 1);
                if (/\.eq\(\s*"status",\s*"pending"\s*\)/.test(chain)) problems.push(f);
            }
        }
        expect(problems).toEqual([]);
    });

    it("the suggestion page's admin buttons show while it is being looked at, with who has it", () => {
        const page = readFileSync(
            path.join(process.cwd(), "src", "app", "catalog", "suggestions", "[id]", "page.tsx"),
            "utf8",
        );
        expect(page).not.toMatch(/isAdmin && s\.status === "pending"/);
        expect(page).toMatch(/isOpenSuggestion\(s\.status\)/);
        // "@Maple is looking at this for another 12 minutes."
        expect(page).toMatch(/claimLine\(alias, claim\.until\)/);
    });
});
