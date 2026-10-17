/**
 * Migration 244 (Package C): the database's lists match the code's, and
 * the Desk's tables are the server's alone.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AGREEMENTS_NEEDED, type RuleStatus, type RuleVote } from "@/lib/registry/rules";

const DIR = path.join(process.cwd(), "supabase", "migrations");
const file = readdirSync(DIR).find((f) => /^244_registry_rules_todo\.sql$/.test(f));
const sql = file ? readFileSync(path.join(DIR, file), "utf8") : "";
const code = sql.replace(/--.*$/gm, "");

const TABLES = ["registry_style_rules", "registry_rule_votes", "registry_todo_claims", "registry_digests"];

function checkList(constraint: string): string[] {
    const m = code.match(new RegExp(`${constraint}\\s+CHECK \\(\\w+ IN \\(([^)]*)\\)\\)`));
    return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort() : [];
}

describe("migration 244", () => {
    it("exists", () => {
        expect(file).toBeTruthy();
    });

    it("rule statuses and votes are the code's lists", () => {
        const statuses: Record<RuleStatus, true> = {
            proposed: true,
            in_effect: true,
            vetoed: true,
            withdrawn: true,
            retired: true,
        };
        const votes: Record<RuleVote, true> = { agree: true, disagree: true };
        expect(checkList("registry_style_rules_status_check")).toEqual(Object.keys(statuses).sort());
        expect(checkList("registry_rule_votes_vote_check")).toEqual(Object.keys(votes).sort());
        expect(AGREEMENTS_NEEDED).toBe(3);
    });

    it("every table has RLS on, no policies, and no rights for members or visitors", () => {
        for (const t of TABLES) {
            expect(code).toMatch(new RegExp(`ALTER TABLE public\\.${t}\\s+ENABLE ROW LEVEL SECURITY`));
            expect(code).toMatch(new RegExp(`REVOKE ALL ON public\\.${t}\\s+FROM anon, authenticated`));
        }
        expect(code).not.toMatch(/CREATE POLICY/i);
    });

    it("has at most one foreign key to users per table", () => {
        const blocks = code.split(/CREATE TABLE IF NOT EXISTS /).slice(1);
        expect(blocks).toHaveLength(TABLES.length);
        for (const b of blocks)
            expect((b.split(");")[0].match(/REFERENCES public\.users/g) ?? []).length).toBeLessThanOrEqual(1);
    });

    it("keeps the digest once a day by its key", () => {
        expect(code).toMatch(/day\s+DATE PRIMARY KEY/);
    });
});
