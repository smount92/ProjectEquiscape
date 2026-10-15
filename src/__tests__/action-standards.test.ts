/**
 * Server action standards ratchet (docs/STANDARDS.md §1).
 *
 * Three habits the standard retires, counted across src/app/actions. Each
 * count may only fall: convert a file when you touch it (use safeError,
 * requireAuth and ActionResult from src/lib/actions/result.ts), then lower
 * the baseline here in the same commit to lock the gain in.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GENERIC_FAILURE, NOT_LOGGED_IN, safeError } from "@/lib/actions/result";

const DIR = path.join(process.cwd(), "src", "app", "actions");
const files = readdirSync(DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => ({ f, text: readFileSync(path.join(DIR, f), "utf8") }));

function count(re: RegExp): { total: number; top: string } {
    const per = files.map(({ f, text }) => [f, (text.match(re) ?? []).length] as const).filter(([, n]) => n > 0);
    const total = per.reduce((s, [, n]) => s + n, 0);
    const top = [...per].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f, n]) => `${String(n).padStart(4)}  ${f}`).join("\n  ");
    return { total, top };
}

/** 2026-10-15 baselines. Lower them as files are converted; never raise them. */
const BASELINES = {
    rawErrorMessages: 364,
    rawGetUser: 63,
    localActionResultTypes: 13,
};

describe("server action standards ratchet", () => {
    it("database error text is not returned to members (use safeError)", () => {
        const { total, top } = count(/error:\s*[A-Za-z_][\w.]*\.message\b/g);
        expect(total, `Raw error.message returns rose to ${total}.\n  ${top}`).toBeLessThanOrEqual(BASELINES.rawErrorMessages);
    });

    it("actions use requireAuth(), not raw auth.getUser()", () => {
        const { total, top } = count(/auth\.getUser\(/g);
        expect(total, `Raw auth.getUser() calls rose to ${total}.\n  ${top}`).toBeLessThanOrEqual(BASELINES.rawGetUser);
    });

    it("ActionResult comes from src/lib/actions/result.ts", () => {
        const { total, top } = count(/^(?:export )?(?:type|interface) ActionResult\b/gm);
        expect(total, `Local ActionResult declarations rose to ${total}.\n  ${top}`).toBeLessThanOrEqual(BASELINES.localActionResultTypes);
    });
});

describe("safeError", () => {
    it("returns plain words, never the database message", () => {
        const result = safeError("Test", { message: "duplicate key value violates unique constraint" }, "Could not save it.");
        expect(result).toEqual({ success: false, error: "Could not save it." });
        expect(safeError("Test", new Error("boom"))).toEqual({ success: false, error: GENERIC_FAILURE });
        expect(NOT_LOGGED_IN).toMatch(/log in/i);
    });
});
