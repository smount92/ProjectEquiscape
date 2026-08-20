import Link from "next/link";

import type { PublicShow } from "@/lib/shows/public";
import type { StaffRole } from "@/lib/shows/types";

/** "You are staff here" phrasing per role. */
const STAFF_PHRASES: Record<StaffRole, string> = {
    host: "the host",
    co_host: "a co-host",
    steward: "a steward",
    judge: "a judge",
};

/**
 * Slim ledger strip under the masthead for the show's own staff
 * (Wave 2): names the viewer's role and deep-links to their bench —
 * the judge queue while an online judged show is judging, otherwise
 * the console. Public viewers never see it (staffRole is null).
 */
export function StaffBanner({ show, role }: { show: PublicShow; role: StaffRole }) {
    const judgeQueueLive =
        role === "judge" &&
        show.mode === "online" &&
        show.judging === "judged" &&
        show.status === "judging";
    const href = judgeQueueLive ? `/shows/host/${show.id}/judge` : `/shows/host/${show.id}`;
    const label = judgeQueueLive ? "Open the judge queue →" : "Open the show console →";
    return (
        <section
            className="ledger-card flex flex-wrap items-center gap-3 py-3"
            aria-label="Your role at this show"
            data-testid="staff-banner"
        >
            <span className="stamp">Show Staff</span>
            <p className="text-sm text-foreground">
                You are {STAFF_PHRASES[role]} for this show.
            </p>
            <Link
                href={href}
                className="ml-auto text-sm font-semibold text-forest hover:underline"
                data-testid="staff-banner-link"
            >
                {label}
            </Link>
        </section>
    );
}
