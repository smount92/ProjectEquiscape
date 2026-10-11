/**
 * A member's outbound links as a short row of buttons. Every link is
 * rel="nofollow noopener noreferrer" and opens in a new tab: the member
 * published it, the site does not vouch for it.
 */

import { linkEntries, PROFILE_LINK_KEYS, type LinkKey, type MemberLinks } from "@/lib/links/memberLinks";

export default function OutboundLinks({
    links,
    keys = PROFILE_LINK_KEYS,
    className = "",
}: {
    links: MemberLinks | null | undefined;
    keys?: readonly LinkKey[];
    className?: string;
}) {
    const entries = linkEntries(links ?? {}, keys);
    if (entries.length === 0) return null;
    return (
        <ul className={`m-0 flex list-none flex-wrap items-center justify-center gap-2 p-0 ${className}`} aria-label="Links" data-testid="outbound-links">
            {entries.map((e) => (
                <li key={e.key}>
                    <a
                        href={e.href}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-(--leather-text)/30 bg-card/80 px-3 py-1 text-xs font-semibold text-foreground no-underline hover:bg-card"
                    >
                        <span aria-hidden="true">{e.glyph}</span>
                        {e.label}
                    </a>
                </li>
            ))}
        </ul>
    );
}
