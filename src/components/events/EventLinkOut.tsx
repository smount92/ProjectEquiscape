/**
 * The outbound affordance. Events point at things that live somewhere
 * else, so the link off-site is the primary action on the page — not a
 * footnote in a details table.
 *
 * Matches /calendar's pattern: rel="noopener nofollow" (these are
 * user-submitted URLs; we are not passing them link equity) and a ↗
 * marker so nobody is surprised by leaving the site.
 */

/** Only http(s) survives — blocks javascript:/data: in stored URLs. */
export function safeExternalUrl(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
        const url = new URL(trimmed);
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        return url.toString();
    } catch {
        return null;
    }
}

/** The host, for showing people where they're about to go. */
export function linkHost(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
}

export default function EventLinkOut({
    url,
    label = "Event page",
}: {
    url: string;
    label?: string;
}) {
    const host = linkHost(url);

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener nofollow"
            className="inline-flex items-center gap-2 rounded-md border-2 border-forest bg-forest/5 px-4 py-2 font-serif text-sm font-bold tracking-[0.08em] uppercase text-forest no-underline transition-colors hover:bg-forest hover:text-white"
        >
            {label}
            <span aria-hidden="true">↗</span>
            <span className="font-sans text-[0.7rem] font-normal tracking-normal normal-case opacity-70">
                {host}
            </span>
        </a>
    );
}
