/**
 * /calendar — the model horse hobby's calendar of record.
 *
 * ONE chronological view of every dated thing we know about:
 *   · MHH-hosted shows (linking internally, with an "enter online"
 *     brass affordance),
 *   · community-submitted external listings — OMHPS, MEPSA, Facebook
 *     group shows, club sites, live halls — each stamped with where it
 *     lives, curated (admin-approved) before they appear,
 *   · community events — the off-platform gatherings on the events
 *     board: meetups, club days, swap meets, studio openings.
 *
 * ANON-SAFE SSR. The show layers are the anon-legal getPublicShows()
 * plus the approved-only external_shows RLS policy. The events layer is
 * NOT anon-legal — `events_select` is granted `TO authenticated` only
 * (migration 031) — so it is fetched for signed-in viewers ONLY and the
 * anonymous page renders exactly what it rendered before. No migration
 * is involved either way. Each source failing degrades to the others;
 * a public SEO page never 500s over a half-missing data layer.
 *
 * Two views over the same entries: the LIST (default — chronological,
 * crawlable, the honest mobile answer) and the month GRID (`?view=grid`
 * — the shape of a month). Both are server-rendered; the view and the
 * month live in the URL rather than in localStorage so every state is
 * linkable, back-button-honest, and works with JS off.
 *
 * This page is THE landing target for "model horse show calendar"
 * searches — metadata and JSON-LD are tuned accordingly, and the
 * non-default views are noindexed so the paginated month space never
 * competes with the canonical list.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getPublicShows } from "@/app/actions/shows-v2";
import { listApprovedExternalShows } from "@/app/actions/external-shows";
import { getEvents } from "@/app/actions/events";
import {
    buildCalendarMonths,
    buildMonthGrid,
    closesSoon,
    filterByVenue,
    fromCommunityEvent,
    fromExternalShow,
    fromMhhShow,
    isMonthKey,
    monthKeyOf,
    shortDate,
    todayIso,
    type CalendarEntry,
} from "@/lib/external-shows/calendar";
import type { ExternalVenueType } from "@/lib/external-shows/schemas";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import CalendarMonthGrid from "@/components/calendar/CalendarMonthGrid";
import ListShowCta from "@/components/calendar/ListShowCta";
import { Button } from "@/components/ui/button";

const TITLE = "Model Horse Show Calendar — Every Upcoming Show in One Place";
const DESCRIPTION =
    "The hobby's one calendar of record: upcoming model horse shows across Model Horse Hub, OMHPS, MEPSA, Facebook groups, and live halls — online photo shows, live shows, and mail-in shows, in date order.";

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

type CalendarSearchParams = { venue?: string; view?: string; month?: string };

/** How many community events to pull for a calendar page. */
const EVENT_FETCH_LIMIT = 100;

/** Build a /calendar URL, carrying the params that should survive. */
function calendarHref(params: {
    venue?: string | null;
    view?: string | null;
    month?: string | null;
}): string {
    const query = new URLSearchParams();
    if (params.venue) query.set("venue", params.venue);
    if (params.view) query.set("view", params.view);
    if (params.month) query.set("month", params.month);
    const qs = query.toString();
    return qs ? `/calendar?${qs}` : "/calendar";
}

export async function generateMetadata({
    searchParams,
}: {
    searchParams: Promise<CalendarSearchParams>;
}): Promise<Metadata> {
    const params = await searchParams;
    // The month grid is a paginated view over the same entries the list
    // already publishes — crawl it, but index the one canonical list.
    const isPaginatedView = params.view === "grid" || Boolean(params.month);

    return {
        title: TITLE,
        description: DESCRIPTION,
        openGraph: {
            title: TITLE,
            description: DESCRIPTION,
            type: "website",
            siteName: "Model Horse Hub",
        },
        ...(isPaginatedView
            ? {
                  robots: { index: false, follow: true },
                  alternates: { canonical: "/calendar" },
              }
            : {}),
    };
}

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
                    {/* A meetup is not a show. Gatherings carry a second,
                        plain-words chip so nothing on this page reads as a
                        show that isn't one. */}
                    {entry.kind === "event" && (
                        <span
                            className="border-input text-secondary-foreground inline-flex items-center rounded-full border px-2 py-[2px] text-[0.7rem] font-semibold"
                            title="A community event — not a show entry"
                        >
                            {entry.icon} Community event
                        </span>
                    )}
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
                    <span>{entry.venueLabel}</span>
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
    searchParams: Promise<CalendarSearchParams>;
}) {
    const params = await searchParams;
    const activeParam = params.venue && VENUE_PARAM[params.venue] ? params.venue : null;
    const venueFilter = activeParam ? VENUE_PARAM[activeParam] : undefined;
    const isGrid = params.view === "grid";

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Three sources, three independent failures. Any one of them
    // falling over degrades to the others rather than to a 500 — which
    // is why this is allSettled and not Promise.all. They used to be
    // awaited one after another; nothing here depends on anything else.
    //
    // Community events are authenticated-only at the RLS layer, so that
    // read never runs for an anonymous visitor and the anon page keeps
    // exactly the output it had before events joined the calendar.
    const [mhhSettled, externalSettled, eventsSettled] = await Promise.allSettled([
        getPublicShows(),
        listApprovedExternalShows(),
        user
            ? getEvents({ upcoming: true, limit: EVENT_FETCH_LIMIT })
            : Promise.resolve([] as Awaited<ReturnType<typeof getEvents>>),
    ]);

    let entries: CalendarEntry[] = [];

    /* the MHH layer is out — the rest of the calendar still stands */
    if (mhhSettled.status === "fulfilled" && mhhSettled.value.success) {
        entries = entries.concat(
            mhhSettled.value.shows.map(fromMhhShow).filter((e): e is CalendarEntry => e !== null),
        );
    }

    /* the external layer is out (or pre-migration) */
    if (externalSettled.status === "fulfilled" && externalSettled.value.success) {
        entries = entries.concat(externalSettled.value.shows.map(fromExternalShow));
    }

    /* the events board is out — shows still fill the calendar */
    if (eventsSettled.status === "fulfilled") {
        entries = entries.concat(
            eventsSettled.value
                .map(fromCommunityEvent)
                .filter((e): e is CalendarEntry => e !== null),
        );
    }

    const today = todayIso();
    const filtered = filterByVenue(entries, venueFilter);
    const months = buildCalendarMonths(filtered, today);
    const thisMonth = monthKeyOf(today);
    const monthKey = isMonthKey(params.month) ? params.month : thisMonth;
    const grid = isGrid ? buildMonthGrid(filtered, monthKey, today) : null;

    // Structured data describes the PUBLIC calendar only: community
    // events are visible to members, so a crawler could never verify
    // them and they have no business in the page's ItemList.
    const publicUpcoming = buildCalendarMonths(
        entries.filter((e) => e.kind !== "event"),
        today,
    );
    const upcomingCount = publicUpcoming.reduce((n, m) => n + m.entries.length, 0);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Model Horse Show Calendar",
        description: DESCRIPTION,
        numberOfItems: upcomingCount,
        itemListElement: publicUpcoming
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
                    show lives. Listings are curated before they appear.{" "}
                    {user ? (
                        <>
                            Gatherings from the{" "}
                            <Link
                                href="/community/events"
                                className="font-semibold text-forest underline decoration-2 underline-offset-2"
                            >
                                events board
                            </Link>{" "}
                            — meetups, club days, swap meets — sit alongside them.
                        </>
                    ) : (
                        <>
                            <Link
                                href="/login?redirectTo=%2Fcalendar"
                                className="font-semibold text-forest underline decoration-2 underline-offset-2"
                            >
                                Sign in
                            </Link>{" "}
                            to see the community events board&rsquo;s gatherings here too.
                        </>
                    )}
                </p>

                {/* Venue filter + view switch — plain links so the page
                    stays fully server-rendered and crawlable. */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <nav aria-label="Filter by show type" className="flex flex-wrap gap-2">
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
                                        href={calendarHref({
                                            venue: f.param,
                                            view: isGrid ? "grid" : null,
                                            month: isGrid && monthKey !== thisMonth ? monthKey : null,
                                        })}
                                        aria-current={active ? "page" : undefined}
                                    >
                                        {f.label}
                                    </Link>
                                </Button>
                            );
                        })}
                    </nav>

                    <Link
                        href={calendarHref({
                            venue: activeParam,
                            view: isGrid ? null : "grid",
                            month: null,
                        })}
                        id="calendar-view-toggle"
                        aria-label={isGrid ? "Switch to the list view" : "Switch to the month grid"}
                        className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md border border-input bg-transparent px-2.5 py-1 font-serif text-xs tracking-wide text-secondary-foreground no-underline transition-colors hover:border-forest hover:text-forest"
                    >
                        <span aria-hidden="true">{isGrid ? "☰" : "🗓️"}</span>
                        {isGrid ? "List" : "Month grid"}
                    </Link>
                </div>

                {isGrid && grid ? (
                    <CalendarMonthGrid
                        grid={grid}
                        prevHref={calendarHref({
                            venue: activeParam,
                            view: "grid",
                            month: grid.prevKey,
                        })}
                        nextHref={calendarHref({
                            venue: activeParam,
                            view: "grid",
                            month: grid.nextKey,
                        })}
                        todayHref={calendarHref({ venue: activeParam, view: "grid" })}
                    />
                ) : months.length === 0 ? (
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
                    </Link>
                    , post a meetup or club day on the{" "}
                    <Link
                        href="/community/events"
                        className="font-semibold text-forest underline decoration-2 underline-offset-2"
                    >
                        events board
                    </Link>
                    , or read the{" "}
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
