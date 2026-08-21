"use client";

/**
 * /community/events — the browse surface.
 *
 * Upcoming first, filed onto ledger month shelves (same shape as
 * /calendar), then a collapsed archive of what already happened.
 * Type + search narrow the list. RSVP is inline: seeing a thing and
 * saying "I'm going" should not cost a page load.
 *
 * The empty state has a job — most visitors arrive before anyone has
 * listed anything, and it has to explain what events ARE now (outside
 * happenings, not MHH shows) and point shows at /shows/host.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { rsvpEvent, type MHHEvent } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { eventTypeIcon, eventTypeLabel } from "./eventTypes";

interface Props {
    upcoming: MHHEvent[];
    past: MHHEvent[];
}

interface MonthShelf {
    key: string;
    label: string;
    events: MHHEvent[];
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

/** Settled-RSVP pill — the house chip shape, toned per status. */
const RSVP_PILL =
    "inline-flex items-center rounded-full border px-[10px] py-[3px] text-xs font-semibold whitespace-nowrap";

/** File events onto month shelves, preserving the order handed in. */
function shelve(events: MHHEvent[]): MonthShelf[] {
    const shelves: MonthShelf[] = [];
    for (const e of events) {
        const d = new Date(e.startsAt);
        if (Number.isNaN(d.getTime())) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        let shelf = shelves.find((s) => s.key === key);
        if (!shelf) {
            shelf = { key, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, events: [] };
            shelves.push(shelf);
        }
        shelf.events.push(e);
    }
    return shelves;
}

function matches(e: MHHEvent, needle: string): boolean {
    if (!needle) return true;
    const n = needle.toLowerCase();
    return (
        e.name.toLowerCase().includes(n) ||
        (e.locationName?.toLowerCase().includes(n) ?? false) ||
        (e.region?.toLowerCase().includes(n) ?? false) ||
        (e.groupName?.toLowerCase().includes(n) ?? false)
    );
}

function EventRow({
    event,
    onRsvp,
    busy,
}: {
    event: MHHEvent;
    onRsvp: (id: string, status: "going" | "interested") => void;
    busy: boolean;
}) {
    const date = new Date(event.startsAt);
    const dated = !Number.isNaN(date.getTime());
    const day = dated ? String(date.getDate()) : "?";
    const month = dated
        ? date.toLocaleDateString("en-US", { month: "short" }).toUpperCase()
        : "—";
    const weekday = dated ? date.toLocaleDateString("en-US", { weekday: "short" }) : "";

    const where = event.isVirtual
        ? "Online"
        : event.locationName || event.region || "Location TBD";

    return (
        <li className="flex flex-wrap items-start gap-x-4 gap-y-3 py-4">
            {/* Date block — the same torn-off calendar leaf the event
                page uses, at list scale, so a date reads as a date
                before you've read a word of the row. */}
            <div
                className="border-forest/40 bg-forest/5 flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md border-2"
                aria-hidden="true"
            >
                <span className="text-forest font-serif text-[0.62rem] font-bold tracking-[0.14em] uppercase">
                    {month}
                </span>
                <span className="text-foreground font-serif text-xl leading-none font-bold tabular-nums">
                    {day}
                </span>
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href={`/community/events/${event.id}`}
                        className="text-foreground hover:text-forest font-serif text-[1.02rem] font-bold no-underline hover:underline"
                    >
                        {event.name}
                    </Link>
                    <span className="stamp">
                        {eventTypeIcon(event.eventType)} {eventTypeLabel(event.eventType)}
                    </span>
                    {event.virtualUrl && (
                        <span
                            className="border-input text-secondary-foreground inline-flex items-center rounded-full border px-2 py-[2px] text-[0.7rem] font-semibold"
                            title="This event happens off Model Horse Hub"
                        >
                            ↗ Off-site
                        </span>
                    )}
                </div>
                <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                    {weekday && (
                        <>
                            <span className="font-serif tracking-[0.1em] uppercase">
                                {weekday}
                            </span>
                            <span aria-hidden="true">·</span>
                        </>
                    )}
                    <span>{where}</span>
                    {!event.isAllDay && dated && (
                        <>
                            <span aria-hidden="true">·</span>
                            <span>
                                {date.toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                })}
                            </span>
                        </>
                    )}
                    {event.isAllDay && (
                        <>
                            <span aria-hidden="true">·</span>
                            <span>All day</span>
                        </>
                    )}
                    {event.groupName && (
                        <>
                            <span aria-hidden="true">·</span>
                            <span>{event.groupName}</span>
                        </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                        {event.rsvpCount} {event.rsvpCount === 1 ? "person" : "people"} in
                    </span>
                </div>
            </div>

            {/* RSVP — chips, not a pair of full-weight buttons. Three
                heavy green buttons a screen made the board look like a
                form; the answer is a pill you can already read. */}
            <div className="flex shrink-0 items-center gap-1.5">
                {event.userRsvp === "going" ? (
                    <span className={`${RSVP_PILL} border-success/30 bg-success/10 text-success`}>
                        ✓ Going
                    </span>
                ) : event.userRsvp === "interested" ? (
                    <span className={`${RSVP_PILL} border-warning/30 bg-warning/10 text-warning`}>
                        ⭐ Interested
                    </span>
                ) : (
                    <>
                        <button
                            type="button"
                            className="studio-chip disabled:opacity-50"
                            onClick={() => onRsvp(event.id, "going")}
                            disabled={busy}
                        >
                            ✓ Going
                        </button>
                        <button
                            type="button"
                            className="studio-chip disabled:opacity-50"
                            onClick={() => onRsvp(event.id, "interested")}
                            disabled={busy}
                        >
                            ⭐ Interested
                        </button>
                    </>
                )}
            </div>
        </li>
    );
}

export default function EventsIndex({ upcoming, past }: Props) {
    const router = useRouter();
    const [typeFilter, setTypeFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [showPast, setShowPast] = useState(false);
    const [rsvping, setRsvping] = useState<string | null>(null);

    // Only offer chips for types that actually appear — an empty
    // filter chip is a dead end.
    const presentTypes = useMemo(() => {
        const seen = new Set<string>();
        for (const e of [...upcoming, ...past]) seen.add(e.eventType);
        return [...seen];
    }, [upcoming, past]);

    const visibleUpcoming = useMemo(
        () =>
            upcoming
                .filter((e) => typeFilter === "all" || e.eventType === typeFilter)
                .filter((e) => matches(e, search)),
        [upcoming, typeFilter, search],
    );

    const visiblePast = useMemo(
        () =>
            past
                .filter((e) => typeFilter === "all" || e.eventType === typeFilter)
                .filter((e) => matches(e, search)),
        [past, typeFilter, search],
    );

    const shelves = useMemo(() => shelve(visibleUpcoming), [visibleUpcoming]);

    async function handleRsvp(eventId: string, status: "going" | "interested") {
        setRsvping(eventId);
        await rsvpEvent(eventId, status);
        router.refresh();
        setRsvping(null);
    }

    const nothingAtAll = upcoming.length === 0 && past.length === 0;
    const filteredToNothing = !nothingAtAll && visibleUpcoming.length === 0;

    return (
        <div className="flex flex-col gap-6">
            {/* What this board IS — a note card, not a wall of prose
                above the content people came for. */}
            <p className="border-input bg-card/60 text-secondary-foreground m-0 rounded-lg border p-4 text-sm leading-relaxed backdrop-blur-sm">
                What the hobby is doing off-platform: shows running on OMHPS, MEPSA,
                Facebook groups and in live halls, plus meetups, club days, swap meets and
                studio openings. Post one, and people can RSVP and talk about it here.
                Hosting a show <em>on</em> Model Horse Hub?{" "}
                <Link
                    href="/shows/host"
                    className="text-forest font-semibold underline decoration-2 underline-offset-2"
                >
                    Open it in the Show Office
                </Link>
                .
            </p>

            {!nothingAtAll && (
                <div className="border-input bg-card/60 flex flex-col gap-3 rounded-lg border p-4 backdrop-blur-sm">
                    <div>
                        <label htmlFor="event-search" className="sr-only">
                            Search events
                        </label>
                        <Input
                            id="event-search"
                            type="search"
                            placeholder="Search by name, place, region, or club…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <nav aria-label="Filter by event type" className="flex flex-wrap gap-1">
                        <button
                            type="button"
                            className={`studio-chip ${typeFilter === "all" ? "active" : ""}`}
                            aria-pressed={typeFilter === "all"}
                            onClick={() => setTypeFilter("all")}
                        >
                            All
                        </button>
                        {presentTypes.map((t) => (
                            <button
                                key={t}
                                type="button"
                                className={`studio-chip ${typeFilter === t ? "active" : ""}`}
                                aria-pressed={typeFilter === t}
                                onClick={() => setTypeFilter(t)}
                            >
                                {eventTypeIcon(t)} {eventTypeLabel(t)}
                            </button>
                        ))}
                    </nav>
                </div>
            )}

            {nothingAtAll ? (
                <div className="ledger-card py-12 text-center">
                    <div className="mb-3 text-4xl" aria-hidden="true">
                        📅
                    </div>
                    <h2 className="mb-2 font-serif text-lg font-bold">
                        Nothing on the board yet
                    </h2>
                    <p className="text-secondary-foreground mx-auto mb-5 max-w-md text-sm leading-relaxed">
                        Events are how the hobby tells each other what&rsquo;s happening
                        elsewhere — a MEPSA show closing on Friday, a club day in March, an
                        artist opening a sales list, a swap meet two towns over. Post it once
                        and everyone can RSVP, ask questions, and share photos afterwards.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                        <Button asChild>
                            <Link href="/community/events/create">Post the first event</Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/shows/host">Hosting a show here? →</Link>
                        </Button>
                    </div>
                </div>
            ) : filteredToNothing ? (
                <div className="ledger-card py-10 text-center">
                    <p className="text-secondary-foreground m-0 text-sm">
                        Nothing upcoming matches that.{" "}
                        {visiblePast.length > 0 && "There are past events further down."}
                    </p>
                </div>
            ) : (
                /* One ledger shelf per month — the same filing the
                   calendar and the show ring use. */
                shelves.map((shelf) => (
                    <section
                        key={shelf.key}
                        aria-labelledby={`events-${shelf.key}`}
                        className="ledger-card"
                    >
                        <span className="ledger-tab" id={`events-${shelf.key}`}>
                            {shelf.label}
                        </span>
                        <ul className="divide-forest/10 m-0 list-none divide-y p-0">
                            {shelf.events.map((e) => (
                                <EventRow
                                    key={e.id}
                                    event={e}
                                    onRsvp={handleRsvp}
                                    busy={rsvping === e.id}
                                />
                            ))}
                        </ul>
                    </section>
                ))
            )}

            {visiblePast.length > 0 && (
                <section className="ledger-card">
                    <button
                        type="button"
                        className="text-forest font-serif text-[0.8125rem] tracking-[0.14em] uppercase hover:underline"
                        aria-expanded={showPast}
                        onClick={() => setShowPast((v) => !v)}
                    >
                        {showPast ? "▾" : "▸"} Already happened ({visiblePast.length})
                    </button>
                    {showPast && (
                        <ul className="divide-forest/10 m-0 mt-3 list-none divide-y p-0 opacity-80">
                            {visiblePast.map((e) => (
                                <EventRow
                                    key={e.id}
                                    event={e}
                                    onRsvp={handleRsvp}
                                    busy={rsvping === e.id}
                                />
                            ))}
                        </ul>
                    )}
                </section>
            )}
        </div>
    );
}
