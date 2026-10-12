/**
 * The one "print show tags" control: the entrant's own tags from the
 * show page and the Done view of the entry page, or every tag for a
 * host from the console. Pro feature; a free member sees the nudge
 * instead of a link that answers 403.
 */

import Link from "next/link";
import type { UserTier } from "@/lib/auth";

export default function PrintTagsLink({
    showId,
    all = false,
    tier,
    className = "",
}: {
    showId: string;
    /** Host: every entrant's tags. */
    all?: boolean;
    /** null = not signed in / unknown: render nothing. */
    tier: UserTier | null | undefined;
    className?: string;
}) {
    if (!tier) return null;
    const label = all ? "Print all show tags (PDF)" : "Print my show tags (PDF)";
    if (tier === "free") {
        return (
            <p className={`m-0 text-sm text-muted-foreground ${className}`} data-testid="print-tags-nudge">
                🏷️ Printable show tags are an{" "}
                <Link href="/upgrade" className="font-semibold text-forest underline">
                    MHH Pro
                </Link>{" "}
                feature.
            </p>
        );
    }
    return (
        <a
            href={`/api/export/show-tags?showId=${encodeURIComponent(showId)}${all ? "&all=true" : ""}`}
            target="_blank"
            rel="noopener"
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 py-1.5 text-sm font-semibold text-foreground no-underline hover:bg-muted ${className}`}
            data-testid="print-tags-link"
        >
            🏷️ {label}
        </a>
    );
}
