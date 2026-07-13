/**
 * Decode HTML entities that leak into plain-text fields from copy/pasted or
 * scraped/imported content (e.g. "Smoke &amp;amp; Mirrors" -> "Smoke & Mirrors").
 * Handles the common named entities plus numeric decimal (&#NN;) and hex
 * (&#xHH;) forms. Pure string/regex logic — no DOM, safe to call server-side.
 */

const NAMED_ENTITY_MAP: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
};

const NAMED_ENTITY_PATTERN = /&amp;|&lt;|&gt;|&quot;|&apos;|&nbsp;/g;
const HEX_ENTITY_PATTERN = /&#x([0-9a-fA-F]+);/g;
const DEC_ENTITY_PATTERN = /&#(\d+);/g;

/** Decode one layer of entities (numeric forms, then named entities). */
function decodeOnce(input: string): string {
    return input
        .replace(HEX_ENTITY_PATTERN, (match, hex: string) => {
            const codePoint = parseInt(hex, 16);
            return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
        })
        .replace(DEC_ENTITY_PATTERN, (match, dec: string) => {
            const codePoint = parseInt(dec, 10);
            return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
        })
        .replace(NAMED_ENTITY_PATTERN, (match) => NAMED_ENTITY_MAP[match] ?? match);
}

/**
 * Decode HTML entities in a plain-text string, looping until stable (max 3
 * passes) so double-encoded input like "&amp;amp;" collapses to "&".
 */
export function decodeHtmlEntities(s: string): string {
    if (!s) return s;
    let result = s;
    for (let i = 0; i < 3; i++) {
        const next = decodeOnce(result);
        if (next === result) break;
        result = next;
    }
    return result;
}
