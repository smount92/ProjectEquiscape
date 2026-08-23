import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

/* ──────────────────────────────────────────────────────
   Migration 188 — catalog_items.sort_key

   The rule lives in SQL (a generated column), so these tests read the
   migration itself. That is deliberate: the one bug this file exists to
   catch cannot be caught at runtime. translate() with a source and target
   of DIFFERENT lengths does not raise — Postgres silently drops the
   unpaired characters, which would corrupt the sort key of every title
   containing one, and nothing would ever report it.
   ────────────────────────────────────────────────────── */

const SQL = readFileSync(
    path.join(process.cwd(), "supabase/migrations/188_catalog_sort_key.sql"),
    "utf8"
);

const TRANSLATE_CALLS = [
    ...SQL.matchAll(/translate\(\s*title,\s*'([^']+)',\s*'([^']+)'\)/g),
];

describe("the accent fold", () => {
    it("is used at all", () => {
        expect(TRANSLATE_CALLS.length).toBeGreaterThan(0);
    });

    // The silent-corruption guard.
    it("pairs every source character with exactly one replacement", () => {
        for (const [, from, to] of TRANSLATE_CALLS) {
            expect([...from].length).toBe([...to].length);
        }
    });

    it("uses the same fold everywhere it appears", () => {
        const [first] = TRANSLATE_CALLS;
        for (const call of TRANSLATE_CALLS) {
            expect(call[1]).toBe(first[1]);
            expect(call[2]).toBe(first[2]);
        }
    });

    // The three names in the catalog that this column exists for.
    it.each([
        ["É", "E"],
        ["Ö", "O"],
        ["é", "e"],
        ["ñ", "n"],
        ["ç", "c"],
    ])("files %s under %s", (accented, base) => {
        const [, from, to] = TRANSLATE_CALLS[0];
        expect([...to][[...from].indexOf(accented)]).toBe(base);
    });

    it("never maps a character to itself, which would mean a mis-aligned pair", () => {
        const [, from, to] = TRANSLATE_CALLS[0];
        const src = [...from], dst = [...to];
        for (let i = 0; i < src.length; i++) expect(dst[i]).not.toBe(src[i]);
    });
});

describe("the filing rule", () => {
    it("strips leading non-alphanumerics, so a quoted nickname files under its letter", () => {
        expect(SQL).toMatch(/\^\[\^\[:alnum:\]\]\+/);
    });

    it("buckets letter-initial titles ahead of everything else", () => {
        // '1' for titles starting with a letter, '2' for the rest, so the
        // years and piece counts land at the back of the catalog.
        expect(SQL).toMatch(/THEN\s+'1'/i);
        expect(SQL).toMatch(/ELSE\s+'2'/i);
        expect(SQL).toMatch(/\^\[\[:alpha:\]\]/);
    });

    it("is STORED, so reads cost nothing and the key cannot drift from the title", () => {
        expect(SQL).toMatch(/GENERATED ALWAYS AS/i);
        expect(SQL).toMatch(/\bSTORED\b/i);
    });

    it("is indexed, because it is the default browse order", () => {
        expect(SQL).toMatch(/CREATE INDEX IF NOT EXISTS[\s\S]*sort_key/i);
    });
});

// A readable statement of the intended order, exercised on the exact rows
// that were wrong. This mirrors the SQL rather than importing it; the
// assertions above are what keep the two honest.
describe("what the order should come out as", () => {
    const key = (t: string) => {
        const s = t
            .replace(/[ÀÁÂÃÄÅ]/g, "A").replace(/[àáâãäå]/g, "a")
            .replace(/[ÈÉÊË]/g, "E").replace(/[èéêë]/g, "e")
            .replace(/[ÒÓÔÕÖ]/g, "O").replace(/[òóôõö]/g, "o")
            .replace(/^[^\p{L}\p{N}]+/u, "");
        return (/^\p{L}/u.test(s) ? "1" : "2") + s.toLowerCase();
    };
    const order = (titles: string[]) =>
        [...titles].sort((a, b) => key(a).localeCompare(key(b), "en"));

    it("files a quoted nickname under its first letter, not ahead of A", () => {
        const sorted = order(['"Commander" The Five Gaiter', "Adios", "Zephyr"]);
        expect(sorted).toEqual(["Adios", '"Commander" The Five Gaiter', "Zephyr"]);
    });

    it("files an accented initial under its base letter, not after Z", () => {
        const sorted = order(["Zephyr", "Éclair", "Adios"]);
        expect(sorted).toEqual(["Adios", "Éclair", "Zephyr"]);
    });

    it("sends titles that do not start with a letter to the back", () => {
        const sorted = order(["12-Piece Stablemate Set", "Adios", "429", "Zephyr"]);
        expect(sorted).toEqual(["Adios", "Zephyr", "12-Piece Stablemate Set", "429"]);
    });

    it("opens the catalog on a horse", () => {
        const page1 = order([
            '"Quelle Surprise!"',
            "1993 Grayingham Lucky Lad",
            "A Class Act",
            "'A' for Arabian",
        ]);
        expect(page1[0]).toBe("A Class Act");
    });
});
