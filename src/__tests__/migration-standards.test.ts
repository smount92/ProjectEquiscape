/**
 * Migration standards (docs/STANDARDS.md §2, Migrations).
 *
 * The owner pastes migrations into the Supabase SQL editor by hand, and may
 * paste one twice. So every migration from FIRST_CHECKED on must be safe to
 * re-run, say what it is in its header, and have an Admin › Ops probe so
 * the owner can see whether it is in. Older files are left as they are.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.join(process.cwd(), "supabase", "migrations");
const FIRST_CHECKED = 233;

const files = readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
const numberOf = (f: string) => Number(f.slice(0, 3));
const checked = files.filter((f) => numberOf(f) >= FIRST_CHECKED);
const adminSource = readFileSync(path.join(process.cwd(), "src", "app", "actions", "admin.ts"), "utf8");

/** SQL with comments removed, so prose in comments never trips a rule. */
function codeOf(sql: string): string {
    return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");
}

/** Every problem in one migration, in plain words. */
export function migrationProblems(name: string, sql: string): string[] {
    const problems: string[] = [];
    const n = numberOf(name);
    const code = codeOf(sql);
    if (!/^\d{3}_[a-z0-9_]+\.sql$/.test(name)) problems.push("file name must be NNN_lowercase_words.sql");
    if (!new RegExp(`^--.*\\b${n}\\b`, "m").test(sql.split("\n").slice(0, 15).join("\n")))
        problems.push(`header must name the migration number ${n} in its first lines`);
    for (const m of code.matchAll(/\bCREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?!IF\s+NOT\s+EXISTS)([\w."]+)/gi))
        problems.push(`CREATE TABLE ${m[1]} needs IF NOT EXISTS`);
    for (const m of code.matchAll(
        /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?!IF\s+NOT\s+EXISTS)([\w."]+)/gi,
    ))
        problems.push(`CREATE INDEX ${m[1]} needs IF NOT EXISTS`);
    for (const m of code.matchAll(/\bCREATE\s+(?!OR\s+REPLACE)FUNCTION\s+([\w."]+)/gi))
        problems.push(`CREATE FUNCTION ${m[1]} needs OR REPLACE`);
    for (const m of code.matchAll(/\bADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)([\w"]+)/gi))
        problems.push(`ADD COLUMN ${m[1]} needs IF NOT EXISTS`);
    for (const m of code.matchAll(/\bCREATE\s+POLICY\s+("[^"]+"|\w+)\s+ON\s+([\w."]+)/gi)) {
        const drop = new RegExp(
            `DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+${m[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+ON\\s+${m[2].replace(/\./g, "\\.")}`,
            "i",
        );
        if (!drop.test(code)) problems.push(`policy ${m[1]} needs a DROP POLICY IF EXISTS first`);
    }
    for (const m of code.matchAll(/\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+(\w+)/gi)) {
        if (/CREATE\s+OR\s+REPLACE\s+TRIGGER/i.test(m[0])) continue;
        if (!new RegExp(`DROP\\s+TRIGGER\\s+IF\\s+EXISTS\\s+${m[1]}\\b`, "i").test(code))
            problems.push(`trigger ${m[1]} needs a DROP TRIGGER IF EXISTS first`);
    }
    // A second foreign key to users on a table that already has one makes
    // every `users(...)` embed from that table ambiguous, and the API
    // refuses it (PGRST201). 235 did this to user_horses and posts and broke
    // stables and the feed until 239. Leave such a column without a foreign
    // key, or, after checking no code embeds users from that table, mark the
    // line `-- embed-checked`.
    for (const line of sql.split("\n")) {
        if (/\bREFERENCES\s+(?:public\.)?users\b/i.test(line.replace(/--.*$/, "")) && !/--\s*embed-checked/i.test(line))
            problems.push(`a new foreign key to users needs an embed check: ${line.trim().slice(0, 80)}`);
    }
    for (const m of code.matchAll(/\bADD\s+CONSTRAINT\s+(\w+)/gi)) {
        if (!new RegExp(`DROP\\s+CONSTRAINT\\s+IF\\s+EXISTS\\s+${m[1]}\\b`, "i").test(code))
            problems.push(`constraint ${m[1]} needs a DROP CONSTRAINT IF EXISTS first`);
    }
    // Each function definition that is SECURITY DEFINER must pin search_path to ''.
    for (const fn of code.split(/\bCREATE\s+OR\s+REPLACE\s+FUNCTION\b/i).slice(1)) {
        const head = fn.split(/\$\$|\$[a-z_]+\$/i)[0];
        if (/SECURITY\s+DEFINER/i.test(head) && !/SET\s+search_path\s*=\s*''/i.test(head))
            problems.push(`SECURITY DEFINER function ${fn.trim().split("(")[0]} must SET search_path = ''`);
    }
    if (!new RegExp(`id:\\s*"${n}"`).test(adminSource))
        problems.push(`needs a PENDING_MIGRATIONS entry (id: "${n}") in src/app/actions/admin.ts`);
    return problems;
}

describe("migrations", () => {
    it("never reuse a number", () => {
        const seen = new Map<number, string>();
        const dupes: string[] = [];
        for (const f of files) {
            const n = numberOf(f);
            if (seen.has(n)) dupes.push(`${seen.get(n)} and ${f}`);
            seen.set(n, f);
        }
        expect(dupes).toEqual([]);
    });

    it.each(checked.length ? checked : ["(none yet)"])("%s meets the standards", (f) => {
        if (f === "(none yet)") return;
        expect(migrationProblems(f, readFileSync(path.join(DIR, f), "utf8"))).toEqual([]);
    });

    it("catches the mistakes it is meant to catch", () => {
        const bad = `-- 999: example\nCREATE TABLE t (id int);\nCREATE INDEX i ON t(id);\nCREATE FUNCTION f() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ select 1 $$;\nCREATE POLICY "p" ON t FOR SELECT USING (true);\nALTER TABLE t ADD COLUMN c int;`;
        const found = migrationProblems("999_example.sql", bad).join("\n");
        expect(found).toMatch(/CREATE TABLE t needs IF NOT EXISTS/);
        expect(found).toMatch(/CREATE INDEX i needs IF NOT EXISTS/);
        expect(found).toMatch(/CREATE FUNCTION f\(\) needs OR REPLACE|CREATE FUNCTION f needs OR REPLACE/);
        expect(found).toMatch(/policy "p" needs a DROP POLICY IF EXISTS first/);
        expect(found).toMatch(/ADD COLUMN c needs IF NOT EXISTS/);
        expect(found).toMatch(/PENDING_MIGRATIONS/);
    });

    it("catches a second foreign key to users (the 235 embed break)", () => {
        const fk = `-- 999: example\nALTER TABLE public.posts ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES public.users(id);`;
        expect(migrationProblems("999_example.sql", fk).join("\n")).toMatch(
            /foreign key to users needs an embed check/,
        );
        const checked = `${fk} -- embed-checked`;
        expect(migrationProblems("999_example.sql", checked).join("\n")).not.toMatch(/embed check/);
    });

    it("passes a well-formed migration", () => {
        const good = `-- 999: example\nCREATE TABLE IF NOT EXISTS t (id int);\nCREATE INDEX IF NOT EXISTS i ON t(id);\nCREATE OR REPLACE FUNCTION f() RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ select 1 $$;\nDROP POLICY IF EXISTS "p" ON t;\nCREATE POLICY "p" ON t FOR SELECT USING (true);\nALTER TABLE t ADD COLUMN IF NOT EXISTS c int;`;
        expect(migrationProblems("999_example.sql", good).filter((p) => !p.includes("PENDING_MIGRATIONS"))).toEqual([]);
    });
});
