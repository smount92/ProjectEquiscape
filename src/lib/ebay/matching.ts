/**
 * Matching an eBay listing to a catalog entry.
 *
 * This is the part of the eBay integration that decides whether the
 * feature is trustworthy, so it is deliberately the strictest part.
 *
 * THE FAILURE MODE WE ARE AVOIDING. A wrong comp is worse than no comp.
 * It puts a confident, specific price on a model, on a site whose whole
 * claim is being the reliable record of the hobby. "No price yet" costs
 * nothing; "$450" against the wrong horse costs the thing we are selling.
 * So every rule here trades recall for precision, on purpose. Pricing
 * 3,000 models correctly beats pricing 10,000 approximately.
 *
 * THE ANCHOR IS THE MODEL NUMBER. The catalog has ~10,900 entries and
 * many are near-identical in words — the Family Arabian paint jobs repeat
 * more than twenty times with the same colour text. Titles cannot
 * separate those; model numbers can. A listing with no usable model
 * number is not matched at all.
 *
 * Pure functions, no network, no database — so the rules can be argued
 * with in tests rather than discovered in production.
 */

/** A catalog row, reduced to what matching actually reads. */
export interface MatchCandidate {
    id: string;
    title: string;
    maker: string | null;
    modelNumber: string | null;
    scale: string | null;
}

/** One eBay listing, reduced likewise. */
export interface ListingInput {
    title: string;
    /** eBay's own item id, for logging a rejection against something. */
    itemId?: string;
}

export type RejectReason =
    | "no-model-number-in-listing"
    | "no-catalog-row-for-number"
    | "ambiguous-multiple-rows"
    | "maker-not-in-title"
    | "multi-item-lot"
    | "not-the-original-model"
    | "empty-listing-title";

export interface MatchResult {
    catalogId: string;
    /** Which rule carried it. Stored, so a bad comp can be traced. */
    basis: "model-number-and-maker";
    matchedNumber: string;
}

export interface MatchFailure {
    catalogId: null;
    reason: RejectReason;
    /** Populated for "ambiguous" so the ambiguity itself is inspectable. */
    candidates?: string[];
}

export type MatchOutcome = MatchResult | MatchFailure;

/**
 * Phrases that mean the listing is not a single original model, whatever
 * else the title says.
 *
 * Customs and repaints are the important ones: they genuinely carry that
 * model's number, they sell for wildly different money, and a collector
 * pricing an original against a custom comp is being actively misled.
 * "Body" is hobby vocabulary for a stripped model sold to be repainted —
 * cheap, and equally not a comp for the original.
 */
const DISQUALIFYING = [
    /\blot\s+of\b/i,
    /\bbundle\b/i,
    /\bjob\s?lot\b/i,
    /\bcustom(ised|ized|s)?\b/i,
    /\bcm\b/i,
    /\brepaint(ed)?\b/i,
    /\bre-?haired\b/i,
    /\bbody\b/i,
    /\bfor\s+parts\b/i,
    /\bdamaged?\b/i,
    /\bbroken\b/i,
    /\brepair\b/i,
    /\brestoration\b/i,
    /\bbox\s+only\b/i,
    /\bempty\s+box\b/i,
    /\brepro(duction)?\b/i,
    /\bfake\b/i,
    /\bhandmade\b/i,
];

/** Multi-item phrasing that a single-model comp must not be drawn from. */
const MULTI_ITEM = [
    /\blot\s+of\s+\d+/i,
    /\bset\s+of\s+\d+/i,
    /\b\d+\s*(?:pc|pcs|piece)\s+lot\b/i,
    /\bx\s?\d{1,2}\s+(?:models?|horses?)\b/i,
];

/**
 * Model numbers we will read out of a listing title.
 *
 * SHORT BARE NUMBERS ARE NOT USABLE. Catalog numbers include "11", "38",
 * "85" — and an eBay title is full of unrelated digits: years, heights,
 * quantities, box numbers. Matching "85" against "1985" or "8.5 inches"
 * would produce confident nonsense at scale.
 *
 * So a number counts only if it is either
 *   - four or more digits, which is specific enough to stand alone, or
 *   - explicitly marked as a model number by a preceding token (#, No.,
 *     model, item), which is a human saying "this is the number".
 */
const MARKED_NUMBER = /(?:#|\bno\.?\s*|\bmodel\s*(?:no\.?|number)?\s*|\bitem\s*(?:no\.?|number)?\s*)([0-9]{1,6}[A-Za-z]?)\b/gi;
const BARE_LONG_NUMBER = /\b([0-9]{4,6}[A-Za-z]?)\b/g;

/** A year in a listing title is almost never the model number. */
const LOOKS_LIKE_YEAR = /^(?:19|20)[0-9]{2}$/;

export function normalizeNumber(raw: string): string {
    return String(raw).trim().toUpperCase().replace(/^#/, "").replace(/\s+/g, "");
}

/**
 * Every number in a listing title that could be a model number, most
 * trustworthy first (explicitly marked before bare).
 */
export function extractModelNumbers(title: string): string[] {
    const text = String(title ?? "");
    const marked: string[] = [];
    const bare: string[] = [];

    for (const m of text.matchAll(MARKED_NUMBER)) {
        const n = normalizeNumber(m[1]);
        if (n) marked.push(n);
    }
    for (const m of text.matchAll(BARE_LONG_NUMBER)) {
        const n = normalizeNumber(m[1]);
        // A bare four-digit number that reads as a year is discarded; a
        // MARKED one is kept, because "#2016" is someone telling us the
        // number even when it looks like a year.
        if (n && !LOOKS_LIKE_YEAR.test(n)) bare.push(n);
    }
    return [...new Set([...marked, ...bare])];
}

/** Does the listing name the maker? Aliases the hobby actually types. */
const MAKER_ALIASES: Record<string, RegExp> = {
    Breyer: /\bbreyer\b/i,
    "Peter Stone": /\b(peter\s+)?stone\b/i,
    "North Light": /\bnorth\s?light\b/i,
    Hartland: /\bhartland\b/i,
    Hagen: /\bhagen[\s-]?renaker\b/i,
    Schleich: /\bschleich\b/i,
    "Copperfox": /\bcopper\s?fox\b/i,
};

export function makerAppearsInTitle(maker: string | null, title: string): boolean {
    if (!maker) return false;
    const alias = MAKER_ALIASES[maker];
    if (alias) return alias.test(title);
    // Unknown maker: require the literal name, case-insensitively.
    const literal = maker.trim();
    if (literal.length < 3) return false;
    return new RegExp(`\\b${literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(title);
}

/**
 * Build the lookup a match runs against: normalized model number → rows.
 * Rows without a model number are absent by construction — they are not
 * matchable and should not silently look like they are.
 */
export function buildNumberIndex(candidates: MatchCandidate[]): Map<string, MatchCandidate[]> {
    const index = new Map<string, MatchCandidate[]>();
    for (const c of candidates) {
        if (!c.modelNumber) continue;
        const n = normalizeNumber(c.modelNumber);
        if (!n) continue;
        if (!index.has(n)) index.set(n, []);
        index.get(n)!.push(c);
    }
    return index;
}

/**
 * Model numbers that identify more than one catalog row are not evidence.
 * 430040 is an import placeholder carrying 36 unrelated models; matching
 * against it would attach one eBay price to a Misty, a Clydesdale Foal and
 * a Stud Spider at once.
 */
export function isAmbiguousNumber(rows: MatchCandidate[]): boolean {
    if (rows.length <= 1) return false;
    const titles = new Set(rows.map((r) => r.title.trim().toLowerCase()));
    // Several rows that are all the same release (glossy/matte variants of
    // one title) still identify one model for pricing purposes.
    return titles.size > 1;
}

export function matchListing(
    listing: ListingInput,
    index: Map<string, MatchCandidate[]>
): MatchOutcome {
    const title = String(listing.title ?? "").trim();
    if (!title) return { catalogId: null, reason: "empty-listing-title" };

    if (MULTI_ITEM.some((re) => re.test(title))) {
        return { catalogId: null, reason: "multi-item-lot" };
    }
    if (DISQUALIFYING.some((re) => re.test(title))) {
        return { catalogId: null, reason: "not-the-original-model" };
    }

    const numbers = extractModelNumbers(title);
    if (!numbers.length) return { catalogId: null, reason: "no-model-number-in-listing" };

    for (const n of numbers) {
        const rows = index.get(n);
        if (!rows || !rows.length) continue;
        if (isAmbiguousNumber(rows)) {
            return { catalogId: null, reason: "ambiguous-multiple-rows", candidates: rows.map((r) => r.id) };
        }
        const row = rows[0];
        if (!makerAppearsInTitle(row.maker, title)) {
            return { catalogId: null, reason: "maker-not-in-title" };
        }
        return { catalogId: row.id, basis: "model-number-and-maker", matchedNumber: n };
    }
    return { catalogId: null, reason: "no-catalog-row-for-number" };
}

/** Narrowing helper for callers. */
export function isMatch(outcome: MatchOutcome): outcome is MatchResult {
    return outcome.catalogId !== null;
}
