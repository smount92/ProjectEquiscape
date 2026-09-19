/**
 * Hardcoded palette ratchet.
 *
 * `text-gray-500`, `bg-white`, `text-amber-800` … are the classes that
 * do not follow the theme: they read fine in daylight and vanish (or
 * glare) under Lamplight and in Simple Mode. The theme tokens
 * (text-foreground / text-secondary-foreground / text-muted-foreground,
 * the text-forest / text-warning inks, bg-card / bg-muted) do follow it.
 *
 * This test does not forbid raw colours — a translucent white rule on
 * leather or a scrim over a photo is a raw colour on purpose. It stops
 * the count from GROWING without a conscious decision: when it goes up,
 * either switch the new usage to a token or raise BASELINE here in the
 * same commit and say why.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const SRC = resolve(__dirname, "..");
const PALETTE =
    /\b(bg|text|border)-(gray|amber|yellow|blue|red|green|white|black|slate|zinc|stone|neutral|emerald|indigo|purple|pink|orange|sky|rose|lime|teal|cyan|violet|fuchsia)(-[0-9]{2,3})?(\/[0-9]+)?\b/g;

/** 2026-09-19 — the count on the day the ratchet went in. Lower it as usages are converted. */
const BASELINE = 406;

function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (name === "node_modules" || name === "__tests__" || name.startsWith(".")) continue;
        if (statSync(p).isDirectory()) walk(p, out);
        else if (name.endsWith(".tsx")) out.push(p);
    }
    return out;
}

describe("hardcoded palette classes", () => {
    it(`do not grow past the baseline (${BASELINE})`, () => {
        const perFile = new Map<string, number>();
        let total = 0;
        for (const file of walk(SRC)) {
            const n = (readFileSync(file, "utf8").match(PALETTE) ?? []).length;
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
            `Hardcoded palette classes rose from ${BASELINE} to ${total}. Use theme tokens so night mode and Simple Mode stay readable, or raise BASELINE in this file on purpose.\n  ${top}`,
        ).toBeLessThanOrEqual(BASELINE);
        if (total < BASELINE) {
            console.info(`[hardcoded-colors] ${total} < baseline ${BASELINE} — lower BASELINE in src/__tests__/hardcoded-colors.test.ts to lock the gain in.`);
        }
    });
});
