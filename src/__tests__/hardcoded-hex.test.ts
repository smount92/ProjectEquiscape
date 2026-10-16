/**
 * Hex colour ratchet (docs/STANDARDS.md, Styling).
 *
 * hardcoded-colors.test.ts counts palette classes (text-gray-500 ...) but
 * not hex: a "#7a5c3b" in a style prop or a bg-[#F4EFE6] class ignores
 * the theme exactly the same way. PDFs (components/pdf) are exempt; they
 * print on paper with no theme. This test holds the count where it was
 * on 2026-10-15 and fails if it rises: use a token, or raise BASELINE here
 * on purpose and say why in the commit.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const SRC = resolve(__dirname, "..");
const HEX = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b/g;

/** 2026-10-15: the count on the day this ratchet went in. Lower it as usages are converted. */
const BASELINE = 200;

function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (name === "node_modules" || name === "__tests__" || name.startsWith(".")) continue;
        if (statSync(p).isDirectory()) {
            if (relative(SRC, p).replace(/\\/g, "/") === "components/pdf") continue;
            walk(p, out);
        } else if (name.endsWith(".tsx")) out.push(p);
    }
    return out;
}

describe("hex colour literals", () => {
    it(`do not grow past the baseline (${BASELINE})`, () => {
        const perFile = new Map<string, number>();
        let total = 0;
        for (const file of walk(SRC)) {
            const n = (readFileSync(file, "utf8").match(HEX) ?? []).length;
            if (n > 0) {
                perFile.set(relative(SRC, file).replace(/\\/g, "/"), n);
                total += n;
            }
        }
        const top = [...perFile.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
            .map(([f, n]) => `${String(n).padStart(4)}  ${f}`)
            .join("\n  ");
        expect(
            total,
            `Hex colours in components rose from ${BASELINE} to ${total}. Use a theme token, or raise BASELINE in this file on purpose.\n  ${top}`,
        ).toBeLessThanOrEqual(BASELINE);
        if (total < BASELINE) {
            console.info(
                `[hardcoded-hex] ${total} < baseline ${BASELINE}; lower BASELINE in src/__tests__/hardcoded-hex.test.ts to lock the gain in.`,
            );
        }
    });
});
