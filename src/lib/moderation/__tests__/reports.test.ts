import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    COMMUNITY_RULES_URL,
    REPORT_TARGET_LABEL,
    REPORT_TARGET_NOUN,
    REPORT_TARGET_TYPES,
    REPORT_TARGET_TYPES_BEFORE_235,
    isReportTargetType,
    reportOutcomeNotice,
    takeDownNotice,
    withArticle,
} from "../reports";

describe("take-down notices name what came down", () => {
    it("names it and cites the Community Conduct rules", () => {
        expect(takeDownNotice("horse", "Bramble")).toBe(
            'We made your horse "Bramble" private, which also takes it off the Market, because its page breaks our Community Conduct rules (Terms, section 6).',
        );
        expect(takeDownNotice("comment", "you are all idiots")).toBe(
            'We hid your reply "you are all idiots" because it breaks our Community Conduct rules (Terms, section 6).',
        );
        expect(takeDownNotice("show_entry", "Bramble in Arabian Mares")).toMatch(
            /^We scratched your show entry "Bramble in Arabian Mares" because/,
        );
    });

    it("falls back to 'one of your …' when there is nothing to name", () => {
        expect(takeDownNotice("post", null)).toMatch(/^We hid one of your posts because/);
        expect(takeDownNotice("message", null)).toMatch(/^We removed a message you sent because/);
    });

    it("has words for every kind that can come down, and none for a member", () => {
        for (const t of REPORT_TARGET_TYPES) {
            if (t === "user") expect(takeDownNotice(t, "@x")).toBe("");
            else expect(takeDownNotice(t, "x")).toMatch(/Community Conduct rules \(Terms, section 6\)/);
        }
    });

    it("thanks the reporter without repeating the reported words, and never says what happened to anyone", () => {
        expect(reportOutcomeNotice("take_down", "post")).toBe(
            "Thank you for reporting that post. We looked into it and removed it.",
        );
        expect(reportOutcomeNotice("handled", "user")).toBe(
            "Thank you for reporting that member. We've reviewed your report and closed it.",
        );
        expect(reportOutcomeNotice("dismiss", "message")).toBe(
            "Thank you for reporting that message. We looked, and it doesn't break our Community Conduct rules (Terms, section 6), so we've left it up.",
        );
    });

    it("links to a section of /terms that exists", () => {
        const [page, anchor] = COMMUNITY_RULES_URL.split("#");
        expect(page).toBe("/terms");
        expect(anchor).toBe("community-conduct");
        const terms = readFileSync(path.join(process.cwd(), "src", "app", "terms", "page.tsx"), "utf8");
        expect(terms).toMatch(/id="community-conduct"[^>]*>\s*<h2>6\. Community Conduct<\/h2>/);
    });
});

/** The target types the newest migration that sets the CHECK allows. */
function checkListInMigrations(): string[] {
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = readdirSync(dir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
    let latest: string[] = [];
    for (const f of files) {
        const sql = readFileSync(path.join(dir, f), "utf8");
        const m = sql.match(/user_reports_target_type_check\s+CHECK\s*\(\s*target_type\s+IN\s*\(([^)]*)\)/i);
        if (m) latest = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
    }
    return latest;
}

describe("report vocabulary", () => {
    it("matches the database CHECK on user_reports.target_type", () => {
        expect([...checkListInMigrations()].sort()).toEqual([...REPORT_TARGET_TYPES].sort());
    });

    it("keeps the five types the table took before 235", () => {
        expect([...REPORT_TARGET_TYPES_BEFORE_235].sort()).toEqual(["comment", "horse", "message", "post", "user"]);
    });

    it("has a noun and a label for every type", () => {
        for (const t of REPORT_TARGET_TYPES) {
            expect(REPORT_TARGET_NOUN[t]).toBeTruthy();
            expect(REPORT_TARGET_LABEL[t]).toBeTruthy();
        }
        expect(isReportTargetType("show_entry")).toBe(true);
        expect(isReportTargetType("listing")).toBe(false);
    });

    it("picks the right article", () => {
        expect(withArticle("post")).toBe("a post");
        expect(withArticle("entry")).toBe("an entry");
        expect(withArticle("Help ID request")).toBe("a Help ID request");
    });
});
