/**
 * /calendar — the model horse hobby's calendar of record (Wave 3).
 *
 * ONE chronological list of every upcoming show we know about:
 * MHH-hosted shows (linking internally, with an "enter online"
 * brass affordance) merged with community-submitted external
 * listings — OMHPS, MEPSA, Facebook group shows, club sites, live
 * halls — each stamped with where it lives. External listings are
 * curated (admin-approved) before they appear.
 *
 * Public, anon-safe SSR: reads are the anon-legal getPublicShows()
 * + the approved-only external_shows RLS policy. Degrades
 * gracefully pre-migration (the external layer just isn't there).
 * This page is THE landing target for "model horse show calendar"
 * searches — metadata and JSON-LD are tuned accordingly.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getPublicShows } from "@/app/actions/shows-v2";
import { listApprovedExternalShows } from "@/app/actions/external-shows";
import { showsV2Enabled } from "@/lib/shows/flags";
import {
    buildCalendarMonths,
    closesSoon,
    filterByVenue,
    fromExternalShow,
    fromMhhShow,
    shortDate,
    todayIso,
    VENUE_LABELS,
    type CalendarEntry,
} from "@/lib/external-shows/calendar";
import type { ExternalVenueType } from "@/lib/external-shows/schemas";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import ListShowCta from "@/components/calendar/ListShowCta";
import { Button } from "@/components/ui/button";

const TITLE = "Model Horse Show Calendar — Every Upcoming Show in One Place";
const DESCRIPTION =
    "The hobby's one calendar of record: upcoming model horse shows across Model Horse Hub, OMHPS, MEPSA, Facebook groups, and live halls — online photo shows, live shows, and mail-in shows, in date order.";

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    openGraph: {
        title: TITLE,
        description: DESCRIPTION,
        type: "website",
        siteName: "Model Horse Hub",
    },
};

/** URL param → venue filter. "All" is the absent param. */
const VENUE_PARAM: Record<string, ExternalVenueType> = {
    online: "online_photo",
    live: "live",
    "mail-in": "mail_in",
};

const FILTERS: { label: string; param: string | null }[] = [
    { label: "All", param: null },
    { label: "Online", param: "online" },
    { label: "Live", param: "live" },
    { label: "Mail-in", param: "mail-in" },
];

function eventJsonLd(entry: CalendarEntry, baseUrl: string) {
    const url = entry.outbound ? entry.href : `${baseUrl}${entry.href}`;
    return {
        "@type": "Event",
        name: entry.title,
        startDate: entry.date,
        url,
        organizer: { "@type": "Organization", name: entry.hostLabel },
        eventAttendanceMode:
            entry.venue === "live"
                ? "https://schema.org/OfflineEventAttendanceMode"
                : "https://schema.org/OnlineEventAttendanceMode",
        location:
            entry.venue === "live"
                ? { "@type": "Place", name: entry.location ?? entry.title }
                : { "@type": "VirtualLocation", url },
    };
}

function EntryRow({ entry, today }: { entry: CalendarEntry; today: string }) {
    const amber = closesSoon(entry, today);
    const titleEl = entry.outbound ? (
        <a
            href={entry.href}
            target="_blank"
            rel="noopener nofollow"
            className="font-semibold text-foreground underline decoration-2 underline-offset-2 hover:text-forest"
        >
            {entry.title}
            <span aria-hidden="true" className="ml-1 text-xs text-muted-foreground">
                ↗
            </span>
        </a>
    ) : (
        <Link
            href={entry.href}
            className="font-semibold text-foreground underline decoration-2 underline-offset-2 hover:text-forest"
        >
            {entry.title}
        </Link>
    );

    return (
        <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
            <span className="w-16 shrink-0 font-serif text-sm font-bold tabular-nums text-forest">
                {shortDate(entry.date)}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    {titleEl}
                    <span className="stamp">{entry.platformLabel}</span>
                    {entry.statusLabel && (
                        <span className="text-xs text-muted-foreground">{entry.statusLabel}</span>
                    )}
                    {amber && (
                        <span
                            className="stamp"
                            style={{ borderColor: "var(--color-warning, #B45309)", color: "var(--color-warning, #B45309)" }}
                        >
                            Closes soon
                        </span>
                    )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{VENUE_LABELS[entry.venue]}</span>
                    <span>Hosted by {entry.hostLabel}</span>
                    {entry.location && <span>{entry.location}</span>}
                    {entry.entriesCloseOn && entry.entriesCloseOn !== entry.date && (
                        <span>Entries close {shortDate(entry.entriesCloseOn)}</span>
                    )}
                </div>
                {entry.description && (
                    <p className="mt-1 mb-0 max-w-xl text-xs leading-relaxed text-secondary-foreground">
                        {entry.description}
                    </p>
                )}
                {entry.kind === "mhh" && (
                    <Link
                        href={entry.href}
                        className="mt-1 inline-block font-serif text-[0.68rem] font-bold tracking-[0.14em] uppercase no-underline hover:underline"
                        style={{ color: "var(--brass-dark, #7A5C22)" }}
                    >
                        Hosted here — enter online →
                    </Link>
                )}
            </div>
        </li>
    );
}

export default async function CalendarPage({
    searchParams,
}: {
    searchParams: Promise<{ venue?: string }>;
}) {
    const params = await searchParams;
    const activeParam = params.venue && VENUE_PARAM[params.venue] ? params.venue : null;
    const venueFilter = activeParam ? VENUE_PARAM[activeParam] : undefined;

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // MHH-hosted shows (flag-gated like /shows) + approved external
    // listings. Either source failing degrades to the other — a
    // public SEO page never 500s over a half-missing data layer.
    let entries: CalendarEntry[] = [];
    if (showsV2Enabled()) {
        const mhh = await getPublicShows();
        if (mhh.success) {
            entries = mhh.shows
                .map(fromMhhShow)
                .filter((e): e is CalendarEntry => e !== null);
        }
    }
    const external = await listApprovedExternalShows();
    if (external.success) {
        entries = entries.concat(external.shows.map(fromExternalShow));
    }

    const today = todayIso();
    const months = buildCalendarMonths(filterByVenue(entries, venueFilter), today);
    const upcomingAll = buildCalendarMonths(entries, today);
    const upcomingCount = upcomingAll.reduce((n, m) => n + m.entries.length, 0);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Model Horse Show Calendar",
        description: DESCRIPTION,
        numberOfItems: upcomingCount,
        itemListElement: upcomingAll
            .flatMap((m) => m.entries)
            .slice(0, 50)
            .map((entry, i) => ({
                "@type": "ListItem",
                position: i + 1,
                item: eventJsonLd(entry, baseUrl),
            })),
    };

    return (
        <ExplorerLayout noHeader>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <div className="animate-fade-in-up mx-auto max-w-[900px]">
                <PageMasthead
                    icon="🗓️"
                    title="Show Calendar"
                    subtitle="Every upcoming show, across the whole hobby"
                    actions={<ListShowCta isAuthed={Boolean(user)} />}
                />

                <p className="mb-6 max-w-2xl text-sm leading-relaxed text-secondary-foreground">
                    Model horse shows are announced in five different places — here, OMHPS,
                    MEPSA, Facebook groups, and club sites. This calendar is the one place
                    they all appear: shows hosted on Model Horse Hub link straight to their
                    entry page, and community-submitted listings link out to wherever the
                    show lives. Listings are curated before they appear.
                </p>

                {/* Venue filter — plain links so the page stays fully
                    server-rendered and crawlable. */}
                <nav aria-label="Filter by show type" className="mb-6 flex flex-wrap gap-2">
                    {FILTERS.map((f) => {
                        const active = f.param === activeParam;
                        return (
                            <Button
                                key={f.label}
                                asChild
                                size="sm"
                                variant={active ? "default" : "outline"}
                            >
                                <Link
                                    href={f.param ? `/calendar?venue=${f.param}` : "/calendar"}
                                    aria-current={active ? "page" : undefined}
                                >
                                    {f.label}
                                </Link>
                            </Button>
                        );
                    })}
                </nav>

                {months.length === 0 ? (
                    <div className="px-4 py-12 text-center">
                        <div className="mb-3 text-4xl" aria-hidden="true">
                            🗓️
                        </div>
                        <h2 className="mb-1 text-lg font-bold">
                            {venueFilter
                                ? "No upcoming shows of this type on the calendar yet"
                                : "No upcoming shows on the calendar yet"}
                        </h2>
                        <p className="m-0 text-sm text-secondary-foreground">
                            Know of one? Listing it takes a minute — and helps the whole hobby.
                        </p>
                    </div>
                ) : (
                    months.map((month) => (
                        <section key={month.key} aria-labelledby={`cal-${month.key}`} className="mb-8">
                            <span className="ledger-tab" id={`cal-${month.key}`}>
                                {month.label}
                            </span>
                            <ul className="m-0 list-none divide-y divide-forest/10 p-0">
                                {month.entries.map((entry) => (
                                    <EntryRow
                                        key={`${entry.kind}-${entry.id}`}
                                        entry={entry}
                                        today={today}
                                    />
                                ))}
                            </ul>
                        </section>
                    ))
                )}

                <p className="mt-10 mb-2 text-xs text-muted-foreground">
                    Missing a show? Any member can list one — it appears once a curator
                    approves it. MHH-hosted shows join the calendar automatically. Browse{" "}
                    <Link href="/shows" className="font-semibold text-forest underline decoration-2 underline-offset-2">
                        shows hosted here
                    </Link>{" "}
                    or read the{" "}
                    <Link
                        href="/learn/enter-your-first-photo-show"
                        className="font-semibold text-forest underline decoration-2 underline-offset-2"
                    >
                        first-show guide
                    </Link>
                    .
                </p>
            </div>
        </ExplorerLayout>
    );
}
