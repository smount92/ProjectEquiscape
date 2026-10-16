/**
 * The Registry's search key: a title the way a person types it, not the
 * way it was punctuated.
 *
 * Identical wording kept missing (MHH-080): quotes ("Horspital" Play Set),
 * hyphens (12-Piece), curly apostrophes (Lover’s) and word order
 * (Prancing Morgan against Morgan - Prancing). The key is lowercase, with
 * accents folded, quotes and other punctuation removed, hyphens, dashes and
 * slashes turned into spaces, "&" read as "and", and spaces squashed.
 *
 * The database keeps the same key in catalog_items.search_key and computes
 * it with public.catalog_search_key() (migration 240), step for step as
 * below. The search RPC normalises the typed term itself, so callers send
 * the term as typed; this helper is for every comparison the app makes in
 * TypeScript (which rows name the searched mold, roster-only matches,
 * piece names in a set). Change the two together; a test checks the
 * letter map and the space list are the same in both.
 */

/** Accented letters folded to their base letter (unaccent is not installed). Same order as the SQL. */
export const ACCENTS_FROM = "ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿĄĆĘŁŃŚŹŻąćęłńśźżØøŠšŽžČčŘřĚěŮů";
export const ACCENTS_TO = "AAAAAACEEEEIIIINOOOOOUUUUYaaaaaaceeeeiiiinooooouuuuyyACELNSZZacelnszzOoSsZzCcRrEeUu";

const FOLD = new Map<string, string>([...ACCENTS_FROM].map((c, i) => [c, ACCENTS_TO[i]]));

/**
 * Every non-ASCII character JavaScript's `\s` reads as a space, by code
 * point: the non-breaking space U+00A0, U+1680, U+2000 to U+200A, U+2028,
 * U+2029, U+202F, U+205F, U+3000 and U+FEFF. SQL's `[:space:]` leaves some
 * of them out, so a title pasted with a non-breaking space keyed as one
 * glued word there and two words here. Both turn these into a plain space
 * first; 240 lists the same code points as `chr(n)`. Numbers rather than
 * the characters, which are invisible in an editor.
 */
export const UNICODE_SPACE_CODES: readonly number[] = [
    0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028,
    0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
];
const SPACES = new Set(UNICODE_SPACE_CODES.map((n) => String.fromCharCode(n)));

/** "“Horspital” Play-Set & Lover’s" → "horspital play set and lovers". */
export function searchKey(raw: string | null | undefined): string {
    if (!raw) return "";
    let s = "";
    for (const c of raw) s += SPACES.has(c) ? " " : (FOLD.get(c) ?? c);
    return s
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[-‐‑‒–—―/_]+/g, " ")
        .replace(/[^\p{L}\p{N}\s]+/gu, "")
        .replace(/\s+/g, " ")
        .trim();
}

/** The words of a term's key; empty when nothing searchable was typed. */
export function searchWords(raw: string | null | undefined): string[] {
    const k = searchKey(raw);
    return k ? k.split(" ") : [];
}

/** Every word of `termKey` appears somewhere in `haystackKey` (both already keys). An empty term matches nothing. */
export function containsEveryWord(haystackKey: string, termKey: string): boolean {
    if (!termKey) return false;
    return termKey.split(" ").every((w) => haystackKey.includes(w));
}

/** The same words, in any order: "Morgan - Prancing" names "Prancing Morgan"; "American Saddlebred" does not name "Saddlebred". */
export function sameWords(a: string | null | undefined, b: string | null | undefined): boolean {
    const wa = searchWords(a).sort();
    const wb = searchWords(b).sort();
    return wa.length > 0 && wa.length === wb.length && wa.every((w, i) => w === wb[i]);
}

/** The database's "every typed word is in the title" rule, for one title. */
export function termMatchesTitle(term: string, title: string): boolean {
    return containsEveryWord(searchKey(title), searchKey(term));
}
