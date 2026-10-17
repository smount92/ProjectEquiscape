/**
 * One writer for the Registry (docs/design/registry-desk-phase1-plan.md §3).
 *
 * src/lib/catalog/write.ts is the only code that writes `catalog_items`
 * or `catalog_changelog`, and the only caller of the merge, unmerge,
 * remove, restore and re-insert database functions. That is what makes
 * every Registry change pass the same checks, land in the history with a
 * name and a role, clear the reference pages and count toward a
 * moderator's limits. Before it, writes sat in four files and each had
 * its own idea of the rules.
 *
 * Scope: every .ts, .tsx, .js, .jsx, .mjs and .cjs file in src/ minus
 * tests. scripts/catalog-delta/*.mjs are the owner's hand-run repairs (dry
 * run, expect-guarded, one transaction) and sit outside src/, so this scan
 * never sees them, on purpose.
 *
 * What counts as a write, in any of these shapes:
 * - a `.from("catalog_items")` chain that reaches update/insert/upsert/delete;
 * - the same through a string constant (`const T = "catalog_items"; .from(T)`);
 * - `.from(variable)` writing, in a file that has a list naming a Registry
 *   table anywhere in it (a loop over tables);
 * - a query built in one statement and written in a later one
 *   (`const q = db.from("catalog_items"); ... q.update(...)`), within the file;
 * - a call to one of the Registry's writing database functions.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(process.cwd(), "src");
const WRITER = "src/lib/catalog/write.ts";
const GUARDED = ["catalog_items", "catalog_changelog"];
const GUARDED_ALT = GUARDED.join("|");
/** Every kind of source file in src/, tests aside. */
const SCANNED = /[.](ts|tsx|js|jsx|mjs|cjs)$/;
const TEST_FILE = /[.](test|spec)[.][cm]?[jt]sx?$/;

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory())
            return name === "__tests__" || name === "node_modules" ? [] : sourceFiles(full);
        return SCANNED.test(name) && !TEST_FILE.test(name) ? [full] : [];
    });
}

/** Code without comments, so prose that names a table never trips the scan. */
function codeOf(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const WRITE_CALL = /\.(update|insert|upsert|delete)\s*\(/;

/** The chain that follows a `.from(` call: up to the end of the statement or the next `.from(`. */
function chainAfter(code: string, index: number): string {
    const rest = code.slice(index + 6);
    const stops = [rest.indexOf(";"), rest.indexOf(".from(")].filter((n) => n >= 0);
    return rest.slice(0, stops.length ? Math.min(...stops) : rest.length);
}

/** The variable a `.from(...)` expression is assigned to, if the statement is `const q = ... .from(`. */
function assignedTo(code: string, index: number): string | null {
    const start = Math.max(code.lastIndexOf(";", index), code.lastIndexOf("{", index), code.lastIndexOf("}", index));
    const head = code.slice(start + 1, index);
    const m = head.match(/(?:\b(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*[^=][\s\S]*$/);
    return m ? m[1] : null;
}

/** Every Registry write in one file's source, as "what: where" lines. */
export function registryWrites(file: string, source: string): string[] {
    const code = codeOf(source);
    const found: string[] = [];
    const line = (i: number) => code.slice(0, i).split("\n").length;
    const escape = (s: string) => s.replace(/[$]/g, "\\$");

    // String constants that name a Registry table: const T = "catalog_items".
    const constants = new Set(
        [
            ...code.matchAll(
                new RegExp(
                    `\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*(?::[^=]+)?=\\s*["'\`](${GUARDED_ALT})["'\`]`,
                    "g",
                ),
            ),
        ].map((m) => m[1]),
    );
    // A list (array literal) naming a Registry table anywhere in it.
    const listsGuarded = new RegExp(`\\[[^\\[\\]]*["'\`](?:${GUARDED_ALT})["'\`][^\\[\\]]*\\]`).test(code);

    for (const m of code.matchAll(/\.from\(\s*(["'`](\w+)["'`]|[A-Za-z_$][\w$.]*)\s*\)/g)) {
        const literal = m[2];
        const name = literal ?? m[1];
        const what = literal
            ? GUARDED.includes(literal)
                ? literal
                : null
            : constants.has(name)
              ? `${name} (a constant naming a Registry table)`
              : listsGuarded
                ? `a table list naming a Registry table (via ${name})`
                : null;
        if (!what) continue;
        const where = `${file}:${line(m.index!)}`;
        const chain = chainAfter(code, m.index!);
        const w = chain.match(WRITE_CALL);
        if (w) {
            found.push(`${where} writes ${what} (.${w[1]})`);
            continue;
        }
        // Built here, written later: const q = db.from("catalog_items"); ... q.update(...)
        const variable = assignedTo(code, m.index!);
        if (!variable) continue;
        const later = code.slice(m.index! + chain.length);
        const write = later.match(
            new RegExp(
                `(?<![\\w$.])${escape(variable)}\\s*(?:\\.\\s*\\w+\\s*\\([^;]*?\\)\\s*)*\\.\\s*(update|insert|upsert|delete)\\s*\\(`,
            ),
        );
        if (write)
            found.push(`${where} builds a query on ${what} and writes it later through ${variable} (.${write[1]})`);
    }

    // The database functions that write the Registry.
    for (const m of code.matchAll(/\.rpc\(\s*["'`](registry_(?:merge|unmerge|remove|restore|reinsert_item))["'`]/g)) {
        found.push(`${file}:${line(m.index!)} calls ${m[1]}`);
    }
    return found;
}

describe("the Registry has one writer", () => {
    it("nothing outside src/lib/catalog/write.ts writes catalog_items or catalog_changelog", () => {
        const offenders = sourceFiles(SRC)
            .map((f) => path.relative(process.cwd(), f).split(path.sep).join("/"))
            .filter((rel) => rel !== WRITER)
            .flatMap((rel) => registryWrites(rel, readFileSync(path.join(process.cwd(), rel), "utf8")));
        expect(offenders, "route these writes through src/lib/catalog/write.ts").toEqual([]);
    });

    it("scans .js and .mjs files too", () => {
        for (const name of ["a.ts", "b.tsx", "c.js", "d.mjs", "e.cjs", "f.jsx"])
            expect(SCANNED.test(name), name).toBe(true);
        expect(TEST_FILE.test("write.test.ts")).toBe(true);
        expect(sourceFiles(SRC).length).toBeGreaterThan(100);
    });

    it("the writer itself is found by the scan (the scan is not blind)", () => {
        const own = registryWrites(WRITER, readFileSync(path.join(process.cwd(), WRITER), "utf8"));
        expect(own.some((w) => w.includes("writes catalog_items"))).toBe(true);
        expect(own.some((w) => w.includes("writes catalog_changelog"))).toBe(true);
        expect(own.some((w) => w.includes("registry_merge"))).toBe(true);
    });

    it("catches the writes it is meant to catch", () => {
        const planted = [
            `await admin.from("catalog_items").update({ title: "x" }).eq("id", id);`,
            `const { error } = await supabase\n  .from('catalog_items')\n  .insert(row)\n  .select("id");`,
            `await admin.from("catalog_items").delete().eq("id", dup.id);`,
            `await admin.from("catalog_changelog").insert({ change_type: "correction" });`,
            `await db.from("catalog_items").upsert(rows, { onConflict: "id" });`,
            `const T = [["catalog_items", "parent_id"]];\nfor (const [t, c] of T) await admin.from(t).update({ [c]: keep });`,
            `await admin.rpc("registry_merge", { p_keep: a, p_remove: b });`,
            `await admin.rpc('registry_remove', { p_item: id });`,
            // A string constant naming the table.
            `const TABLE = "catalog_items";\nawait admin.from(TABLE).update({ title: "x" }).eq("id", id);`,
            `const LOG: string = 'catalog_changelog';\nawait admin.from(LOG).insert({ change_type: "x" });`,
            // A list naming the table anywhere in it, not only first.
            `const T = [["user_horses", "catalog_id"], ["catalog_items", "parent_id"]];\nfor (const [t, c] of T) await admin.from(t).update({ [c]: keep });`,
            `const TABLES = new Set(["user_wishlists", "catalog_changelog"]);\nfor (const t of TABLES) await db.from(t).delete().eq("x", 1);`,
            // Built, then written on a later line.
            `const q = db.from("catalog_items");\nconst other = 1;\nawait q.update({ title: "x" }).eq("id", id);`,
            `let query = admin.from("catalog_items").select("id");\nif (x) query = query.eq("a", 1);\nawait query.delete();`,
            `function f() {\n  const base = db().from("catalog_changelog");\n  return base.insert({ a: 1 });\n}`,
            // The re-insert function the unmerge and restore share.
            `await admin.rpc("registry_reinsert_item", { p_item: row });`,
        ];
        for (const sample of planted) {
            expect(registryWrites("planted.ts", sample), sample).not.toEqual([]);
        }
        // The same in a .mjs file.
        expect(registryWrites("planted.mjs", `await db.from("catalog_items").delete().eq("id", id);`)).not.toEqual([]);
    });

    it("leaves reads, comments and other tables alone", () => {
        const fine = [
            `const { data } = await supabase.from("catalog_items").select("id, title").eq("id", id);`,
            `// admin.from("catalog_items").delete() would strand horses`,
            `/* await admin.from("catalog_changelog").insert({}) */`,
            `await admin.from("catalog_suggestions").update({ status: "approved" }).eq("id", id);`,
            `await admin.from("catalog_items").select("id").limit(1);\nawait admin.from("users").update({ x: 1 });`,
            `await admin.rpc("registry_link_counts", { p_item: id });`,
            `const q = db.from("catalog_items").select("id");\nconst { data } = await q.eq("id", id);\nawait db.from("users").update({ a: 1 });`,
            `const TABLE = "catalog_suggestions";\nawait admin.from(TABLE).update({ status: "x" });`,
            `const label = "catalog_items";\nconsole.log(label);`,
        ];
        for (const sample of fine) {
            expect(registryWrites("fine.ts", sample), sample).toEqual([]);
        }
    });
});

describe("the old duplicate collapse script", () => {
    // It deleted rows (losing sale reports and price flags); merges go through registry_merge now.
    const SCRIPT = path.join(process.cwd(), "scripts", "catalog-delta", "collapse_duplicate_rows.mjs");

    it("refuses to run and points at registry_merge and the Registry Desk", () => {
        const run = spawnSync(process.execPath, [SCRIPT, "--apply"], { encoding: "utf8", timeout: 20_000 });
        expect(run.status).toBe(1);
        expect(run.stderr).toMatch(/retired and will not run/);
        expect(run.stderr).toMatch(/registry_merge/);
        expect(run.stderr).toMatch(/Registry Desk/);
    });

    it("has no database client left in it", () => {
        const code = codeOf(readFileSync(SCRIPT, "utf8"));
        expect(code).not.toMatch(/createClient|SERVICE_ROLE|\.delete\(/);
    });
});
