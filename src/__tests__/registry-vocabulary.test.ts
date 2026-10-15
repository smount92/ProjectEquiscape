/**
 * The Registry's vocabularies live in two places: the TypeScript lists the
 * site writes from, and the CHECK constraints the database enforces
 * (migration 233). Twice before, a CHECK list fell behind the code and
 * writes failed in production (079→172, 101→169). This test fails the
 * moment the two disagree, so a new scale or run type is added to both.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CANONICAL_SCALES, RUN_TYPES } from "@/lib/catalog/taxonomy";
import { MATERIAL_OPTIONS } from "@/lib/catalog/editableFields";

const DIR = path.join(process.cwd(), "supabase", "migrations");

/** The value list of the latest migration that defines this constraint. */
function checkList(constraint: string): string[] {
    const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort().reverse();
    for (const f of files) {
        const sql = readFileSync(path.join(DIR, f), "utf8");
        const at = sql.indexOf(`ADD CONSTRAINT ${constraint} CHECK`);
        if (at < 0) continue;
        const body = sql.slice(at, sql.indexOf(") NOT VALID", at) > 0 ? sql.indexOf(") NOT VALID", at) : sql.indexOf(";", at));
        const inList = body.slice(body.lastIndexOf(" IN ("));
        return [...inList.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"));
    }
    throw new Error(`No migration defines ${constraint}`);
}

describe("database CHECK lists match the site's vocabularies", () => {
    it("scale", () => {
        expect(checkList("catalog_items_scale_check")).toEqual([...CANONICAL_SCALES]);
    });
    it("run type", () => {
        expect(checkList("catalog_items_run_type_check")).toEqual([...RUN_TYPES]);
    });
    it("material", () => {
        expect(checkList("catalog_items_material_check")).toEqual([...MATERIAL_OPTIONS]);
    });
});
