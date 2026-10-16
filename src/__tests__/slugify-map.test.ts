/**
 * catalog_slugify's letter map (migration 233) must line up letter for
 * letter: translate() maps the Nth character of the first string to the
 * Nth of the second. The 129 version had one extra "c", so every letter
 * from "è" on mapped to its neighbour and Melody Peña's page lived at
 * "melody-peia". This reads the latest definition and checks it.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.join(process.cwd(), "supabase", "migrations");

function latestMap(): { from: string; to: string } {
    const files = readdirSync(DIR)
        .filter((f) => f.endsWith(".sql"))
        .sort()
        .reverse();
    for (const f of files) {
        const sql = readFileSync(path.join(DIR, f), "utf8");
        const at = sql.indexOf("CREATE OR REPLACE FUNCTION public.catalog_slugify(");
        if (at < 0) continue;
        const body = sql.slice(at, sql.indexOf("$$;", at));
        const m = body.match(/translate\(lower\(coalesce\(txt, ''\)\),\s*'([^']+)',\s*'([^']+)'\)/);
        if (!m) throw new Error(`Could not read the map in ${f}`);
        return { from: m[1], to: m[2] };
    }
    throw new Error("No migration defines public.catalog_slugify");
}

/** The SQL function, in JS, for the examples below. */
function slugify(text: string, map: { from: string; to: string }): string {
    const from = [...map.from];
    const to = [...map.to];
    const mapped = [...text.toLowerCase()].map((c) => {
        const i = from.indexOf(c);
        return i < 0 ? c : to[i];
    });
    return mapped
        .join("")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-+|-+$)/g, "");
}

describe("catalog_slugify letter map", () => {
    const map = latestMap();

    it("has as many target letters as source letters", () => {
        expect([...map.to].length).toBe([...map.from].length);
    });

    it("maps every source letter to plain a-z", () => {
        expect([...map.to].every((c) => /[a-z]/.test(c))).toBe(true);
    });

    it("gives the addresses a person would expect", () => {
        expect(slugify("Melody Peña", map)).toBe("melody-pena");
        expect(slugify("Mesteño, The Messenger", map)).toBe("mesteno-the-messenger");
        expect(slugify("Crème de la Crème", map)).toBe("creme-de-la-creme");
        expect(slugify("Après Ski", map)).toBe("apres-ski");
        expect(slugify("Elżbieta Zarzecka", map)).toBe("elzbieta-zarzecka");
        expect(slugify("Öjvind", map)).toBe("ojvind");
        expect(slugify("Sporður frá Bergi", map)).toBe("spordur-fra-bergi");
    });
});
