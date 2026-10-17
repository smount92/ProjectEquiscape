/**
 * One writer for the Registry (docs/design/registry-desk-phase1-plan.md §3).
 *
 * src/lib/catalog/write.ts is the only code that writes `catalog_items`
 * or `catalog_changelog`, and the only caller of the merge, unmerge,
 * remove and restore database functions. That is what makes every
 * Registry change pass the same checks, land in the history with a name
 * and a role, clear the reference pages and count toward a moderator's
 * limits. Before it, writes sat in four files and each had its own idea
 * of the rules.
 *
 * Scope: src/ minus tests. scripts/catalog-delta/*.mjs are the owner's
 * hand-run repairs (dry run, expect-guarded, one transaction) and sit
 * outside src/, so this scan never sees them, on purpose.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(process.cwd(), "src");
const WRITER = "src/lib/catalog/write.ts";
const GUARDED = ["catalog_items", "catalog_changelog"];

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory())
            return name === "__tests__" || name === "node_modules" ? [] : sourceFiles(full);
        return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
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

/** Every Registry write in one file's source, as "what: where" lines. */
export function registryWrites(file: string, source: string): string[] {
    const code = codeOf(source);
    const found: string[] = [];
    const line = (i: number) => code.slice(0, i).split("\n").length;

    // 1. .from("catalog_items") / .from("catalog_changelog") reaching a write.
    for (const m of code.matchAll(/\.from\(\s*["'`](\w+)["'`]\s*\)/g)) {
        if (!GUARDED.includes(m[1])) continue;
        const chain = chainAfter(code, m.index!);
        const w = chain.match(WRITE_CALL);
        if (w) found.push(`${file}:${line(m.index!)} writes ${m[1]} (.${w[1]})`);
    }

    // 2. A table list naming a guarded table, written through a variable:
    //    .from(table).update(...) with "catalog_items" in an array in the same file.
    const listsGuarded = /\[\s*["'`](?:catalog_items|catalog_changelog)["'`]\s*,/.test(code);
    if (listsGuarded) {
        for (const m of code.matchAll(/\.from\(\s*([A-Za-z_$][\w$.]*)\s*\)/g)) {
            const chain = chainAfter(code, m.index!);
            const w = chain.match(WRITE_CALL);
            if (w) found.push(`${file}:${line(m.index!)} writes a table list naming a Registry table (.${w[1]})`);
        }
    }

    // 3. The database functions that write the Registry.
    for (const m of code.matchAll(/\.rpc\(\s*["'`](registry_(?:merge|unmerge|remove|restore))["'`]/g)) {
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
        ];
        for (const sample of planted) {
            expect(registryWrites("planted.ts", sample), sample).not.toEqual([]);
        }
    });

    it("leaves reads, comments and other tables alone", () => {
        const fine = [
            `const { data } = await supabase.from("catalog_items").select("id, title").eq("id", id);`,
            `// admin.from("catalog_items").delete() would strand horses`,
            `/* await admin.from("catalog_changelog").insert({}) */`,
            `await admin.from("catalog_suggestions").update({ status: "approved" }).eq("id", id);`,
            `await admin.from("catalog_items").select("id").limit(1);\nawait admin.from("users").update({ x: 1 });`,
            `await admin.rpc("registry_link_counts", { p_item: id });`,
        ];
        for (const sample of fine) {
            expect(registryWrites("fine.ts", sample), sample).toEqual([]);
        }
    });
});
