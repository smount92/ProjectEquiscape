/**
 * The Paddock's rail — the rooms that open off the gathering place.
 *
 * The Paddock is not a bare stream: it is the community ROOM, and the
 * barns, the events board and the show ring are doors in its wall.
 * Each is a ledger card with a kraft index tab, matching the barn
 * page's members panel exactly, so the rail reads as the same filing
 * cabinet the rest of the site is made of.
 *
 * Every card is read-only: it consumes data the page already fetched
 * (getMyGroups, getEvents) and links out. A card with nothing to show
 * renders NOTHING rather than an empty shell — an empty box on a rail
 * is worse than a shorter rail. The one exception is My Barns, which
 * keeps a single line of invitation when the viewer has joined none,
 * because "you are in no barns" is the whole point of showing it.
 */

import Link from "next/link";

import type { Group } from "@/app/actions/groups";
import type { MHHEvent } from "@/app/actions/events";
import { eventTypeIcon } from "@/components/events/eventTypes";

/** "Sat 4 Oct" — short enough for a 1fr rail column. */
function shortDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Date TBD";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const RAIL_LINK =
    "text-forest text-xs font-semibold tracking-[0.08em] uppercase no-underline hover:underline";

function MyBarns({ barns }: { barns: Group[] }) {
    return (
        <aside className="ledger-card">
            <span className="ledger-tab">My Barns</span>
            {barns.length === 0 ? (
                <p className="text-muted-foreground m-0 text-sm italic">
                    You haven&rsquo;t joined a barn yet — they&rsquo;re where the smaller
                    conversations happen.
                </p>
            ) : (
                <ul className="m-0 list-none divide-y divide-forest/10 p-0">
                    {barns.slice(0, 6).map((barn) => (
                        <li key={barn.id} className="py-1.5 first:pt-0 last:pb-0">
                            <Link
                                href={`/community/groups/${barn.slug}`}
                                className="text-foreground flex items-baseline justify-between gap-2 text-sm font-semibold no-underline hover:underline"
                            >
                                <span className="truncate">🏠 {barn.name}</span>
                                <span className="text-muted-foreground shrink-0 text-xs font-normal tabular-nums">
                                    {barn.memberCount}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            <div className="mt-3">
                <Link href="/community/groups" className={RAIL_LINK}>
                    {barns.length === 0 ? "Find a barn →" : "All barns →"}
                </Link>
            </div>
        </aside>
    );
}

function UpcomingEvents({ events }: { events: MHHEvent[] }) {
    // Nothing on the board — no shell, no apology, just no card.
    if (events.length === 0) return null;

    return (
        <aside className="ledger-card">
            <span className="ledger-tab">Upcoming</span>
            <ul className="m-0 list-none divide-y divide-forest/10 p-0">
                {events.map((event) => (
                    <li key={event.id} className="py-2 first:pt-0 last:pb-0">
                        <Link
                            href={`/community/events/${event.id}`}
                            className="text-foreground block text-sm font-semibold no-underline hover:underline"
                        >
                            {eventTypeIcon(event.eventType)} {event.name}
                        </Link>
                        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                            <span className="font-serif tracking-[0.08em] uppercase">
                                {shortDate(event.startsAt)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">
                                {event.rsvpCount} {event.rsvpCount === 1 ? "person" : "people"} in
                            </span>
                        </div>
                    </li>
                ))}
            </ul>
            <div className="mt-3">
                <Link href="/community/events" className={RAIL_LINK}>
                    All events →
                </Link>
            </div>
        </aside>
    );
}

const ROOMS: { href: string; icon: string; label: string; blurb: string }[] = [
    { href: "/community", icon: "🏆", label: "Show Ring", blurb: "Horses on show" },
    { href: "/community/help-id", icon: "🔍", label: "Help ID", blurb: "Name that model" },
    { href: "/discover", icon: "👥", label: "Members", blurb: "Find collectors" },
];

function Rooms() {
    return (
        <aside className="ledger-card">
            <span className="ledger-tab">The Rooms</span>
            <ul className="m-0 list-none divide-y divide-forest/10 p-0">
                {ROOMS.map((room) => (
                    <li key={room.href} className="py-2 first:pt-0 last:pb-0">
                        <Link
                            href={room.href}
                            className="text-foreground flex items-baseline gap-2 text-sm no-underline hover:underline"
                        >
                            <span aria-hidden="true">{room.icon}</span>
                            <span className="font-semibold">{room.label}</span>
                            <span className="text-muted-foreground truncate text-xs">
                                {room.blurb}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </aside>
    );
}

export default function PaddockRail({
    barns,
    events,
}: {
    barns: Group[];
    events: MHHEvent[];
}) {
    return (
        <aside className="flex flex-col gap-5 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)]">
            <MyBarns barns={barns} />
            <UpcomingEvents events={events} />
            <Rooms />
        </aside>
    );
}
