/**
 * Reading a catalog search the way a hobbyist types it.
 *
 * "Peter stone Ideal sto" found nothing useful: the fuzzy RPC matches a
 * title OR a maker, and no title contains all of that. People type the
 * maker first ("Breyer Adios", "Stone ISH") and reach for the hobby's
 * initials ("PAS", "ISH", "SHM"). This module splits a leading maker
 * off the query and spells the initials out, so the search runs on the
 * name and the maker becomes a preference, never a filter that hides
 * the answer.
 */

export interface ParsedCatalogQuery {
    /** Canonical maker as stored in catalog_items.maker, or null. */
    maker: string | null;
    /** What to search titles for: the query minus the maker, initials spelled out. */
    term: string;
    raw: string;
}

/** Leading maker phrases → the maker string the catalog stores. Longest alias wins. */
const MAKER_ALIASES: Array<[alias: string, maker: string]> = [
    ["breyer", "Breyer"],
    ["breyers", "Breyer"],
    ["peter stone", "Peter Stone"],
    ["stone horses", "Peter Stone"],
    ["stone horse", "Peter Stone"],
    ["stone", "Peter Stone"],
    ["ps", "Peter Stone"],
    ["copperfox", "Copperfox"],
    ["schleich", "Schleich"],
    ["collecta", "CollectA"],
    ["hagen-renaker", "Hagen-Renaker"],
    ["hagen renaker", "Hagen-Renaker"],
    ["hr", "Hagen-Renaker"],
    ["north light", "North Light"],
    ["northlight", "North Light"],
    ["royal doulton", "Royal Doulton"],
    ["border fine arts", "Border Fine Arts"],
    ["bfa", "Border Fine Arts"],
    ["wia", "WIA"],
    ["stone critters", "Stone Critters"],
    ["animal artistry", "Animal Artistry"],
    ["black horse ranch", "Black Horse Ranch"],
    ["bhr", "Black Horse Ranch"],
].sort((a, b) => b[0].length - a[0].length) as Array<[string, string]>;

/** Hobby initials for mold names, matched as whole words. */
const INITIALS: Record<string, string> = {
    ish: "Ideal Stock Horse",
    pas: "Proud Arabian Stallion",
    pam: "Proud Arabian Mare",
    paf: "Proud Arabian Foal",
    fas: "Family Arabian Stallion",
    fam: "Family Arabian Mare",
    faf: "Family Arabian Foal",
    shs: "Stock Horse Stallion",
    shm: "Stock Horse Mare",
    shf: "Stock Horse Foal",
    qhg: "Quarter Horse Gelding",
    asb: "American Saddlebred",
    twh: "Tennessee Walking Horse",
    tsh: "Traditional Stock Horse",
    pob: "Pony of the Americas",
};

function normalize(raw: string): string {
    return raw.trim().replace(/\s+/g, " ");
}

/** The maker a query starts with, if any, and the rest of the query. */
function splitMaker(query: string): { maker: string | null; rest: string } {
    const lower = query.toLowerCase();
    for (const [alias, maker] of MAKER_ALIASES) {
        if (lower === alias) return { maker, rest: "" };
        if (lower.startsWith(alias + " ")) return { maker, rest: query.slice(alias.length + 1).trim() };
    }
    return { maker: null, rest: query };
}

/** "ISH" → "Ideal Stock Horse", word by word; other words pass through. */
export function expandInitials(term: string): string {
    return term
        .split(" ")
        .map((word) => INITIALS[word.toLowerCase()] ?? word)
        .join(" ");
}

export function parseCatalogQuery(raw: string): ParsedCatalogQuery {
    const query = normalize(raw);
    if (!query) return { maker: null, term: "", raw };
    const { maker, rest } = splitMaker(query);
    // A bare maker name is still a search for that maker: the RPC matches
    // on maker too, so the name itself is the best term.
    const term = expandInitials(rest || query);
    return { maker, term, raw };
}

/** Case-insensitive "this row belongs to the maker the query named". */
export function makerMatches(rowMaker: string | null | undefined, maker: string | null): boolean {
    if (!maker || !rowMaker) return false;
    const a = rowMaker.trim().toLowerCase();
    const b = maker.trim().toLowerCase();
    return a === b || a.startsWith(b + " ") || a.startsWith(b + ",");
}
