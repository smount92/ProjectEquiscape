import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    ACCENTS_FROM,
    ACCENTS_TO,
    containsEveryWord,
    sameWords,
    searchKey,
    searchWords,
    termMatchesTitle,
    UNICODE_SPACE_CODES,
} from "@/lib/catalog/searchKey";

/**
 * MHH-080. Identical wording missed in the Registry search because of how
 * it was punctuated. These are the volunteer's four cases, on live titles.
 */
describe("searchKey", () => {
    it("drops quotes, so a quoted title is found with or without them", () => {
        expect(searchKey('"Horspital" Play Set')).toBe("horspital play set");
        expect(searchKey("Horspital Play Set")).toBe("horspital play set");
        expect(searchKey("“Commander” The Five Gaiter")).toBe("commander the five gaiter");
        expect(termMatchesTitle("Horspital Play Set", '"Horspital" Play Set With American Saddlebred, blankets')).toBe(
            true,
        );
    });

    it("turns hyphens, dashes and slashes into spaces", () => {
        expect(searchKey("12-Piece Stablemates Set")).toBe("12 piece stablemates set");
        expect(searchKey("12 Piece Stablemates Set")).toBe("12 piece stablemates set");
        expect(searchKey("Arabian-Rearing")).toBe("arabian rearing");
        expect(searchKey("Black/White Pinto")).toBe("black white pinto");
        expect(searchKey("Morgan – Prancing")).toBe("morgan prancing");
    });

    it("reads curly and straight apostrophes the same, and & as and", () => {
        expect(searchKey("Stablemates Horse Lover’s Collection")).toBe("stablemates horse lovers collection");
        expect(searchKey("Stablemates Horse Lover's Collection")).toBe("stablemates horse lovers collection");
        expect(searchKey("Black & White Arabian")).toBe("black and white arabian");
        expect(searchKey("Smoke 'N Mirrors")).toBe("smoke n mirrors");
    });

    it("matches every typed word in any order", () => {
        expect(
            termMatchesTitle("Prancing Morgan", "Polka Dot Parade With American Saddlebred, Morgan - Prancing"),
        ).toBe(true);
        expect(termMatchesTitle("Morgan - Prancing", "Prancing Morgan")).toBe(true);
        expect(termMatchesTitle("Prancing Morgan", "Morgan Stallion")).toBe(false);
        expect(sameWords("Morgan - Prancing", "Prancing Morgan")).toBe(true);
        expect(sameWords("Arabian-Rearing", "Rearing Arabian")).toBe(true);
        expect(sameWords("American Saddlebred", "Saddlebred")).toBe(false);
        expect(sameWords("", "")).toBe(false);
    });

    it("folds accents, squashes spaces and handles empty input", () => {
        expect(searchKey("  Mesteño   Crème Éclair ")).toBe("mesteno creme eclair");
        expect(searchKey("Łukasz Żółw")).toBe("lukasz zolw");
        expect(searchKey("")).toBe("");
        expect(searchKey(null)).toBe("");
        expect(searchKey("!!!")).toBe("");
        expect(searchWords("Black and White Saddlebred")).toEqual(["black", "and", "white", "saddlebred"]);
        expect(searchWords("  ")).toEqual([]);
        // An empty term matches nothing rather than everything.
        expect(containsEveryWord("arabian stallion", "")).toBe(false);
        expect(containsEveryWord("arabian stallion", "stall arab")).toBe(true);
    });

    it("uses the same letter map as the database function (migration 240)", () => {
        expect(ACCENTS_FROM.length).toBe(ACCENTS_TO.length);
        const sql = readFileSync(
            path.join(process.cwd(), "supabase", "migrations", "240_registry_search_key.sql"),
            "utf8",
        );
        expect(sql).toContain(`'${ACCENTS_FROM}'`);
        expect(sql).toContain(`'${ACCENTS_TO}'`);
    });

    it("reads a non-breaking space as a space, here and in the database function", () => {
        // Built from code points: the characters themselves are invisible in an editor.
        const sp = (n: number) => String.fromCharCode(n);
        expect(searchKey(`Silky${sp(0xa0)}Sullivan`)).toBe("silky sullivan");
        expect(searchKey(`Silky${sp(0x202f)}Sullivan`)).toBe("silky sullivan");
        expect(searchKey(`Silky${sp(0x3000)}Sullivan`)).toBe("silky sullivan");
        expect(searchKey(`${sp(0xfeff)}Silky${sp(0x2007)}${sp(0xa0)}Sullivan`)).toBe("silky sullivan");
        // Every non-ASCII character JavaScript reads as a space is on the list.
        const listed = new Set(UNICODE_SPACE_CODES);
        for (let code = 0x80; code <= 0xffff; code++)
            if (/\s/.test(sp(code))) expect(listed.has(code), code.toString(16)).toBe(true);
        // SQL [:space:] does not cover U+00A0 (and its kin), so 240 turns the
        // same list into spaces first, or "Silky<nbsp>Sullivan" keys as "silkysullivan".
        const sql = readFileSync(
            path.join(process.cwd(), "supabase", "migrations", "240_registry_search_key.sql"),
            "utf8",
        );
        expect(sql).toContain(UNICODE_SPACE_CODES.map((n) => `chr(${n})`).join(" || "));
        expect(sql).toContain(`repeat(' ', ${UNICODE_SPACE_CODES.length})`);
    });
});
