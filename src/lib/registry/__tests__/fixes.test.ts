/**
 * Suggested fixes (Package C): nothing is suggested unless a style rule
 * naming the fix is in effect, each fix does what its rule says, and every
 * fix passes the one Registry writer's checks (validateChanges, write.ts).
 */
import { describe, expect, it } from "vitest";
import { validateChanges } from "@/lib/catalog/write";
import { releaseFlags, moldFlags, type CheckRow } from "@/lib/registry/checks";
import { FIX_RULES, isKnownFix, suggestedFixes, type RuleInEffect } from "@/lib/registry/fixes";

const mold: CheckRow = {
    id: "m1",
    title: "Saddlebred (G1)",
    item_type: "plastic_mold",
    maker: "Breyer",
    scale: "Stablemate (1:32)",
    parent_id: null,
    attributes: {},
};
const rel = (title: string, attributes: Record<string, unknown> = {}): CheckRow => ({
    id: `r-${title}`,
    title,
    item_type: "plastic_release",
    maker: "Breyer",
    scale: "Stablemate (1:32)",
    parent_id: "m1",
    attributes: { color_description: "Bay", ...attributes },
});
const rule = (check_key: string): RuleInEffect => ({ id: `rule-${check_key}`, title: `Rule ${check_key}`, check_key });
const allRules = Object.keys(FIX_RULES).map(rule);

/** One row per fix that the fix applies to. */
const SAMPLES: Record<string, CheckRow> = {
    number_out_of_title: rel("#5038 Morgan Mare"),
    title_no_trailing_punctuation: rel("Saddlebred."),
    title_capital: rel("saddlebred"),
    years_as_numbers: rel("Saddlebred", { release_year_start: "1975", release_year_end: "1988" }),
    shop_to_run_detail: rel("BreyerFest 1990 — Live Auction 01", { color_description: "" }),
    description_to_notes: rel("Pocket Barn (Replaced in 2006 by American Saddlebred)"),
    colour_out_of_title: rel("Black and White Pinto Saddlebred", { color_description: "" }),
    set_piece_title: rel("12-Piece Stablemates Set With Arabian Mare, Citation, Saddlebred, Swaps"),
};

const fixesFor = (row: CheckRow, rules: RuleInEffect[]) =>
    suggestedFixes(row, row.item_type === "plastic_mold" ? moldFlags(row, []) : releaseFlags(row, { mold }), rules, {
        mold,
    });

describe("suggestedFixes", () => {
    it("has a sample row for every fix", () => {
        expect(Object.keys(SAMPLES).sort()).toEqual(Object.keys(FIX_RULES).sort());
    });

    it("offers nothing when no rule is in effect", () => {
        for (const row of Object.values(SAMPLES)) expect(fixesFor(row, [])).toEqual([]);
    });

    it("offers nothing for a rule with no fix, or a fix the Desk doesn't know", () => {
        const row = SAMPLES.title_capital;
        expect(fixesFor(row, [{ id: "x", title: "Prose only", check_key: null }])).toEqual([]);
        expect(fixesFor(row, [{ id: "y", title: "Unknown", check_key: "no_such_fix" }])).toEqual([]);
        expect(isKnownFix(null)).toBe(true);
        expect(isKnownFix("title_capital")).toBe(true);
        expect(isKnownFix("no_such_fix")).toBe(false);
    });

    it("offers a fix only for the flag it answers", () => {
        expect(fixesFor(rel("Saddlebred"), allRules)).toEqual([]);
    });

    it.each(Object.keys(FIX_RULES))("%s: offered under its rule, and passes the writer's checks", async (key) => {
        const row = SAMPLES[key];
        const fixes = fixesFor(row, [rule(key)]);
        expect(fixes).toHaveLength(1);
        expect(fixes[0]).toMatchObject({ ruleId: `rule-${key}`, checkKey: key, flag: FIX_RULES[key].flag });
        const checked = await validateChanges({ ...row, attributes: row.attributes ?? {} }, fixes[0].changes);
        expect(checked, JSON.stringify(checked)).toMatchObject({ ok: true });
    });

    it("each fix does what its rule says", () => {
        const one = (key: string) => fixesFor(SAMPLES[key], [rule(key)])[0].changes;
        expect(one("number_out_of_title")).toEqual({ title: "Morgan Mare", model_number: "5038" });
        expect(one("title_no_trailing_punctuation")).toEqual({ title: "Saddlebred" });
        expect(one("title_capital")).toEqual({ title: "Saddlebred" });
        expect(one("years_as_numbers")).toEqual({ release_year_start: 1975, release_year_end: 1988 });
        expect(one("shop_to_run_detail")).toEqual({
            title: "Saddlebred",
            run_detail: "BreyerFest 1990 — Live Auction 01",
            run_type: "One of a Kind",
        });
        expect(one("description_to_notes")).toEqual({
            title: "Pocket Barn",
            registry_notes: "Replaced in 2006 by American Saddlebred",
        });
        expect(one("colour_out_of_title")).toEqual({ title: "Saddlebred", color_description: "Black and white pinto" });
        expect(one("set_piece_title")).toEqual({ title: "12-Piece Stablemates Set (Saddlebred)" });
    });

    it("says nothing when the fix can't be worked out safely", () => {
        // The title's number disagrees with the box: a person decides.
        expect(
            fixesFor(rel("#5038 Morgan Mare", { model_number: "5039" }), allRules).map((f) => f.checkKey),
        ).not.toContain("number_out_of_title");
        // Not a plain year.
        expect(
            fixesFor(rel("Saddlebred", { release_year_start: "circa 1975" }), allRules).map((f) => f.checkKey),
        ).not.toContain("years_as_numbers");
        // A colour phrase mixed with other words stays.
        expect(
            fixesFor(rel("Black Hawk Pinto Saddlebred", { color_description: "" }), allRules).map((f) => f.checkKey),
        ).not.toContain("colour_out_of_title");
    });

    it("keeps what is already in the notes and run details", () => {
        const notes = fixesFor(
            rel("Pocket Barn (Replaced in 2006 by American Saddlebred)", { registry_notes: "Boxed." }),
            [rule("description_to_notes")],
        )[0].changes;
        expect(notes.registry_notes).toBe("Boxed.\nReplaced in 2006 by American Saddlebred");
        const detail = fixesFor(rel("Sears Holiday Catalog", { run_detail: "1998" }), [rule("shop_to_run_detail")])[0]
            .changes;
        expect(detail).toEqual({ title: "Saddlebred", run_detail: "1998; Sears Holiday Catalog" });
    });
});
