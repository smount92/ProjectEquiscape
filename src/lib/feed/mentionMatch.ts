/**
 * Mention resolution — pure, shared by the server notifier and the
 * client renderer.
 *
 * THE BUG THIS EXISTS TO FIX: aliases on this site contain spaces
 * ("black fox farm"), but a mention is written inline with no
 * delimiter — "@black fox farm loved this". Any regex that stops at
 * the first space tags "@black"; any regex that runs to the end of
 * the sentence tags a phrase nobody is called. The only correct
 * parse needs the alias list: take the greedy candidate the
 * extractor produced, then pick the LONGEST real alias that is a
 * whole-token prefix of it.
 *
 * Whole-token, not substring: "@black fox farmhouse" must NOT tag
 * "black fox farm".
 */

export function tokenizeAlias(value: string): string[] {
    return value.trim().split(/\s+/).filter(Boolean);
}

/**
 * The longest alias in `aliases` whose tokens are a prefix of
 * `candidate`'s tokens (case-insensitive). Returns the alias in its
 * canonical stored casing, or null when nothing matches.
 */
export function matchLongestAlias(candidate: string, aliases: readonly string[]): string | null {
    const cTokens = tokenizeAlias(candidate).map((t) => t.toLowerCase());
    if (cTokens.length === 0) return null;

    let best: string | null = null;
    let bestLen = 0;

    for (const alias of aliases) {
        const aTokens = tokenizeAlias(alias).map((t) => t.toLowerCase());
        if (aTokens.length === 0 || aTokens.length > cTokens.length) continue;

        let matches = true;
        for (let i = 0; i < aTokens.length; i++) {
            if (aTokens[i] !== cTokens[i]) {
                matches = false;
                break;
            }
        }
        if (!matches) continue;

        if (aTokens.length > bestLen) {
            bestLen = aTokens.length;
            best = alias;
        }
    }

    return best;
}

/**
 * Resolve a list of greedy candidates to the set of real aliases
 * they mention. Order-preserving, de-duplicated case-insensitively.
 */
export function resolveMentions(
    candidates: readonly string[],
    aliases: readonly string[],
): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const candidate of candidates) {
        const matched = matchLongestAlias(candidate, aliases);
        if (!matched) continue;
        const key = matched.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(matched);
    }
    return out;
}

/**
 * The distinct lowercase FIRST tokens of a candidate list — the
 * narrow prefix set the server uses to pull only plausible aliases
 * out of the users table instead of the whole directory.
 */
export function candidateFirstTokens(candidates: readonly string[]): string[] {
    const tokens = new Set<string>();
    for (const candidate of candidates) {
        const first = tokenizeAlias(candidate)[0];
        if (first) tokens.add(first.toLowerCase());
    }
    return [...tokens];
}

// ────────────────────────────────────────────────────────────
// Rendering
// ────────────────────────────────────────────────────────────

export interface MentionSegment {
    type: "text" | "mention";
    /** For a mention this is the alias WITHOUT the leading @. */
    value: string;
}

/** A mention may only start at the beginning or after a non-word char. */
function isMentionBoundary(text: string, index: number): boolean {
    if (index === 0) return true;
    return !/[\w"]/.test(text[index - 1]);
}

/**
 * Split text into plain and mention segments.
 *
 * When `aliases` are supplied, multi-word aliases resolve correctly.
 * With an empty alias list the behaviour is exactly the legacy one —
 * `@"quoted name"` and a single `@word` still linkify — so callers
 * that have no alias list lose nothing.
 */
export function splitMentionSegments(
    text: string,
    aliases: readonly string[] = [],
): MentionSegment[] {
    const segments: MentionSegment[] = [];
    let plainStart = 0;
    let i = 0;

    const pushPlain = (end: number) => {
        if (end > plainStart) {
            segments.push({ type: "text", value: text.slice(plainStart, end) });
        }
    };

    while (i < text.length) {
        if (text[i] !== "@" || !isMentionBoundary(text, i)) {
            i++;
            continue;
        }

        // @"Quoted Alias"
        if (text[i + 1] === '"') {
            const close = text.indexOf('"', i + 2);
            const inner = close > -1 ? text.slice(i + 2, close) : null;
            if (inner && inner.length >= 3 && inner.length <= 30) {
                pushPlain(i);
                segments.push({ type: "mention", value: inner });
                i = close + 1;
                plainStart = i;
                continue;
            }
            i++;
            continue;
        }

        // Greedy run of word chars and single spaces, capped like the
        // extractor's 30-char alias ceiling (plus room for the words we
        // will trim back off).
        const runMatch = /^[\w][\w ]{0,59}/.exec(text.slice(i + 1));
        const run = runMatch ? runMatch[0].replace(/\s+$/, "") : "";
        if (!run) {
            i++;
            continue;
        }

        const matched = aliases.length > 0 ? matchLongestAlias(run, aliases) : null;
        if (matched) {
            pushPlain(i);
            segments.push({ type: "mention", value: matched });
            // Advance past "@" + however many characters of the run the
            // alias actually consumed (token counts are equal, so a
            // token-wise re-walk gives the exact length).
            i += 1 + aliasSpanLength(run, tokenizeAlias(matched).length);
            plainStart = i;
            continue;
        }

        // Legacy fallback: a bare @handle with no spaces.
        const simple = /^[a-zA-Z0-9_-]{3,30}/.exec(text.slice(i + 1));
        if (simple) {
            pushPlain(i);
            segments.push({ type: "mention", value: simple[0] });
            i += 1 + simple[0].length;
            plainStart = i;
            continue;
        }

        i++;
    }

    pushPlain(text.length);
    return segments;
}

// ────────────────────────────────────────────────────────────
// Composer autocomplete
// ────────────────────────────────────────────────────────────

export interface MentionQuery {
    /** Index of the "@" in the source text. */
    start: number;
    /** What the user has typed after it. */
    query: string;
}

/**
 * The @-mention the caret is currently sitting inside, if any.
 *
 * Spaces are allowed in the query — that is the whole point, since
 * aliases have them — but only up to three of them, so ordinary prose
 * following a finished mention stops triggering the typeahead.
 */
export function findMentionQuery(text: string, caret: number): MentionQuery | null {
    const upto = text.slice(0, Math.max(0, Math.min(caret, text.length)));
    const at = upto.lastIndexOf("@");
    if (at === -1) return null;
    // Must start a word: "me@example.com" is an address, not a mention.
    if (at > 0 && /[\w"]/.test(upto[at - 1])) return null;

    const query = upto.slice(at + 1);
    if (query.length > 30) return null;
    if (/[\n\r]/.test(query)) return null;
    if ((query.match(/ /g) || []).length > 3) return null;
    if (/[^\w ]/.test(query)) return null;

    return { start: at, query };
}

/** Replace the in-progress mention at `range` with the chosen alias. */
export function applyMentionCompletion(
    text: string,
    range: MentionQuery,
    caret: number,
    alias: string,
): { text: string; caret: number } {
    const head = text.slice(0, range.start);
    const tail = text.slice(caret);
    const inserted = `@${alias} `;
    return {
        text: `${head}${inserted}${tail}`,
        caret: head.length + inserted.length,
    };
}

/** Character length of the first `tokenCount` whitespace-separated tokens of `run`. */
function aliasSpanLength(run: string, tokenCount: number): number {
    let seen = 0;
    let i = 0;
    while (i < run.length && seen < tokenCount) {
        while (i < run.length && /\s/.test(run[i])) i++;
        while (i < run.length && !/\s/.test(run[i])) i++;
        seen++;
    }
    return i;
}
