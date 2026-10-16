import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    REPORT_TARGET_LABEL,
    REPORT_TARGET_NOUN,
    REPORT_TARGET_TYPES,
    REPORT_TARGET_TYPES_BEFORE_235,
    isReportTargetType,
    withArticle,
} from "../reports";

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
