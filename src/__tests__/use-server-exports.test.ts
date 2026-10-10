/**
 * A "use server" module may export async functions and nothing else.
 *
 * One `export const` in src/app/actions/admin-insights.ts took every
 * action in that file down with "A 'use server' file can only export
 * async functions, found object" — the admin Insights tab sat on
 * "Reading the rollups…" until the file was fixed (2026-10-10). tsc and
 * eslint both pass such a file; only the Next runtime refuses it, and
 * only in production. This test refuses it first.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const SRC = resolve(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (name === "node_modules" || name === "__tests__" || name.startsWith(".")) continue;
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.tsx?$/.test(name)) out.push(p);
    }
    return out;
}

function isUseServerModule(source: string): boolean {
    // The directive must be the first statement; comments may precede it.
    const head = source.replace(/^\s*(\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)*/, "").trimStart();
    return /^["']use server["']/.test(head);
}

/** Exports a "use server" module must not have: anything that is not an async function. */
const BAD_EXPORT = /^export\s+(const|let|var|class|default|enum|function\s+[A-Za-z_$][\w$]*\s*\()/m;

describe('"use server" modules export only async functions', () => {
    it("has no value, class, default or sync-function exports", () => {
        const offenders: string[] = [];
        for (const file of walk(SRC)) {
            const source = readFileSync(file, "utf8");
            if (!isUseServerModule(source)) continue;
            const lines = source.split(/\r?\n/);
            lines.forEach((line, i) => {
                if (BAD_EXPORT.test(line) && !/^export\s+async\s+function/.test(line)) {
                    offenders.push(`${relative(SRC, file).replace(/\\/g, "/")}:${i + 1}  ${line.trim()}`);
                }
            });
        }
        expect(offenders, "move these to a lib module — a value export 500s every action in the file").toEqual([]);
    });
});
