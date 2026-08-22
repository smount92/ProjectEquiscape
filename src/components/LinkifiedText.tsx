/**
 * Renders member-written text with bare URLs turned into real links.
 *
 * Collectors paste references into notes all the time — a Flickr shot of
 * the mold, an OMHPS result page — and until now those arrived as dead
 * text the reader had to select and copy.
 *
 * SAFETY: this never builds HTML. The text is split on a URL pattern and
 * the pieces are handed to React as children, so nothing in a note can
 * inject markup. Only http and https are linked — a `javascript:` or
 * `data:` payload stays inert text — and every link carries
 * rel="nofollow noopener noreferrer" so member notes can't pass ranking
 * to a spammer or hand the opener a window reference.
 */

import type { ReactNode } from "react";

/**
 * Bare http(s) URLs. Deliberately conservative: it stops at whitespace
 * and at the angle/quote characters that usually mean the writer was
 * wrapping the link rather than including those characters in it.
 */
const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;

/** Trailing punctuation is nearly always the sentence, not the address. */
function splitTrailingPunctuation(url: string): [string, string] {
    const match = /[.,;:!?]+$/.exec(url);
    if (!match) return [url, ""];
    return [url.slice(0, match.index), match[0]];
}

/** A shortened label so a long address can't blow out a narrow column. */
function displayLabel(url: string): string {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, "");
        const rest = `${parsed.pathname}${parsed.search}`.replace(/\/$/, "");
        if (!rest || rest === "/") return host;
        return rest.length > 24 ? `${host}${rest.slice(0, 24)}…` : `${host}${rest}`;
    } catch {
        return url;
    }
}

export default function LinkifiedText({ text }: { text: string }): ReactNode {
    if (!text) return null;

    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    // `matchAll` needs the global flag, which carries lastIndex state —
    // build a fresh regex per call so concurrent renders can't interfere.
    for (const match of text.matchAll(new RegExp(URL_PATTERN))) {
        const raw = match[0];
        const start = match.index ?? 0;

        if (start > lastIndex) nodes.push(text.slice(lastIndex, start));

        const [href, trailing] = splitTrailingPunctuation(raw);

        // A URL that won't parse is left as plain text rather than guessed at.
        let safe = false;
        try {
            const protocol = new URL(href).protocol;
            safe = protocol === "http:" || protocol === "https:";
        } catch {
            safe = false;
        }

        if (safe) {
            nodes.push(
                <a
                    key={`link-${key++}`}
                    href={href}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="text-forest underline underline-offset-2 hover:no-underline"
                    title={href}
                >
                    {displayLabel(href)}
                </a>,
            );
        } else {
            nodes.push(href);
        }

        if (trailing) nodes.push(trailing);
        lastIndex = start + raw.length;
    }

    if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

    return <>{nodes}</>;
}
