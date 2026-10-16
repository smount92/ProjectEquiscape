/**
 * Renders member-written text with bare URLs turned into real links.
 *
 * Collectors paste references into notes all the time — a Flickr shot of
 * the mold, an OMHPS result page, the eBay listing a horse came from —
 * and until now those arrived as dead text the reader had to select and
 * copy.
 *
 * SAFETY: this never builds HTML. The text is split on a URL pattern and
 * the pieces are handed to React as children, so nothing in a note can
 * inject markup. Only http(s) addresses and bare `www.` addresses (linked
 * as https) become links — a `javascript:` or `data:` payload stays inert
 * text — and every link carries rel="noopener noreferrer nofollow" so
 * member notes can't pass ranking to a spammer or hand the opened page a
 * handle on our window.
 *
 * Line breaks are kept as "\n" in the text; the caller's container keeps
 * them visible with `whitespace-pre-line`.
 */

import type { ReactNode } from "react";

/**
 * Bare http(s) and www. URLs. Deliberately conservative: it stops at
 * whitespace and at the angle/quote characters that usually mean the
 * writer was wrapping the link rather than including those characters
 * in it.
 */
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;

/** A `www.` glued to a word, a dot, an @ or a path is not the start of an address. */
const GLUED_BEFORE = /[\w.@/:-]/;

/** Trailing punctuation is nearly always the sentence, not the address. */
function splitTrailingPunctuation(url: string): [string, string] {
    const match = /[.,;:!?]+$/.exec(url);
    if (!match) return [url, ""];
    return [url.slice(0, match.index), match[0]];
}

/** The href for a matched address, or null when it should stay text. */
export function safeHref(address: string): string | null {
    const candidate = /^www\./i.test(address) ? `https://${address}` : address;
    try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
        // "www." alone, or "www.thing" with no domain after it, is a word.
        if (/^www\./i.test(address) && !/^www\.[^.]+\.[^.]/i.test(parsed.hostname)) return null;
        return candidate;
    } catch {
        return null;
    }
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

        // "user@www.example.com" or "foo.www.bar": not an address of its own.
        if (/^www\./i.test(raw) && start > 0 && GLUED_BEFORE.test(text[start - 1])) continue;

        if (start > lastIndex) nodes.push(text.slice(lastIndex, start));

        const [address, trailing] = splitTrailingPunctuation(raw);
        // An address that won't parse is left as plain text rather than guessed at.
        const href = safeHref(address);

        if (href) {
            nodes.push(
                <a
                    key={`link-${key++}`}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-forest underline underline-offset-2 hover:no-underline"
                    title={href}
                >
                    {displayLabel(href)}
                </a>,
            );
        } else {
            nodes.push(address);
        }

        if (trailing) nodes.push(trailing);
        lastIndex = start + raw.length;
    }

    if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

    return <>{nodes}</>;
}
