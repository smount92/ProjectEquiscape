/**
 * The month grid — /calendar's second view.
 *
 * A wall calendar in the house hand: a ledger sheet with a kraft month
 * tab, seven columns Sunday-first, and each day's entries as compact
 * chips sitting on the square. It is a pure server component — the page
 * has already fetched everything, so the grid ships zero client JS and
 * paginates by plain <Link> (crawlable, back-button-honest, and it
 * works with JS off).
 *
 * Styling notes:
 *  · Everything is token-routed (--color-forest, --card, --border), so
 *    Lamplight recolors the whole grid for free and Simple Mode's flat
 *    ledger override applies without a fight.
 *  · The squares wear a translucent card wash so the day ledger ruling
 *    reads as texture UNDER the grid rather than as lines THROUGH the
 *    chips; at night `.ledger-card` has no ruling at all and the wash
 *    just deepens the paper.
 *  · Below `sm` seven columns cannot hold a title, so each square
 *    collapses to a count badge and the list view stays the honest
 *    mobile answer.
 */

import Link from "next/link";

import {
    shortDate,
    WEEKDAY_LABELS,
    type CalendarDay,
    type CalendarEntry,
    type CalendarGrid,
} from "@/lib/external-shows/calendar";

/** How many chips fit on a square before it says "+2 more". */
const CHIPS_PER_DAY = 3;

const NAV_LINK =
    "inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1 font-serif text-xs tracking-[0.14em] uppercase text-secondary-foreground no-underline transition-colors hover:border-forest hover:text-forest";

function EntryChip({ entry }: { entry: CalendarEntry }) {
    const label = `${entry.title} — ${entry.venueLabel}, ${entry.kindLabel}`;
    const className =
        "block truncate rounded-[3px] border-l-2 border-forest/70 bg-forest/10 px-1 py-[1px] text-[0.68rem] leading-snug font-medium text-foreground no-underline hover:bg-forest/20 hover:underline";

    return entry.outbound ? (
        <a
            href={entry.href}
            target="_blank"
            rel="noopener nofollow"
            className={className}
            title={label}
        >
            <span aria-hidden="true">{entry.icon}</span> {entry.title}
            <span aria-hidden="true"> ↗</span>
        </a>
    ) : (
        <Link href={entry.href} className={className} title={label}>
            <span aria-hidden="true">{entry.icon}</span> {entry.title}
        </Link>
    );
}

function DaySquare({ day }: { day: CalendarDay }) {
    const dayNumber = Number(day.date.slice(8, 10));
    const shown = day.entries.slice(0, CHIPS_PER_DAY);
    const overflow = day.entries.length - shown.length;

    // Out-of-month squares are scaffolding: present so the weeks line
    // up, quiet so they never compete with the month you asked for.
    const tone = !day.inMonth
        ? "opacity-45"
        : day.isPast
          ? "opacity-70"
          : "";

    return (
        <td
            className={`border-forest/20 bg-card/55 h-[70px] w-[14.28%] border p-1 align-top sm:h-[104px] ${tone}`}
        >
            <div className="flex items-baseline justify-between gap-1">
                {day.isToday && <span className="sr-only">Today, </span>}
                <span
                    className={`font-serif text-[0.7rem] font-bold tabular-nums sm:text-xs ${
                        day.isToday
                            ? "bg-forest grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[color:var(--primary-foreground)]"
                            : "text-forest"
                    }`}
                >
                    {dayNumber}
                </span>
                {/* Mobile: seven columns cannot hold a title, so the
                    square carries the count and the list does the rest.
                    The sentence below carries it for screen readers. */}
                {day.entries.length > 0 && (
                    <span
                        aria-hidden="true"
                        className="border-forest/40 text-forest inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full border px-1 text-[0.6rem] font-bold tabular-nums sm:hidden"
                    >
                        {day.entries.length}
                    </span>
                )}
            </div>

            {day.entries.length > 0 && (
                <>
                    <div className="mt-0.5 hidden flex-col gap-0.5 sm:flex">
                        {shown.map((entry) => (
                            <EntryChip key={`${entry.kind}-${entry.id}`} entry={entry} />
                        ))}
                        {overflow > 0 && (
                            <span className="text-muted-foreground px-1 text-[0.62rem] font-semibold">
                                +{overflow} more
                            </span>
                        )}
                    </div>
                    {/* The grid is a picture; below `sm` the chips are
                        gone, so the day says itself in words instead. */}
                    <span className="sr-only sm:hidden">
                        {shortDate(day.date)}: {day.entries.map((e) => e.title).join(", ")}
                    </span>
                </>
            )}
        </td>
    );
}

export default function CalendarMonthGrid({
    grid,
    prevHref,
    nextHref,
    todayHref,
}: {
    grid: CalendarGrid;
    prevHref: string;
    nextHref: string;
    /** Jump back to the month we are actually in. */
    todayHref: string;
}) {
    return (
        <section aria-labelledby={`grid-${grid.key}`} className="ledger-card mb-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <span className="ledger-tab m-0" id={`grid-${grid.key}`}>
                    {grid.label}
                </span>
                <nav aria-label="Change month" className="flex flex-wrap items-center gap-2">
                    <Link
                        href={prevHref}
                        className={NAV_LINK}
                        aria-label={`Previous month — ${grid.prevKey}`}
                        rel="prev"
                    >
                        ← Prev
                    </Link>
                    <Link href={todayHref} className={NAV_LINK}>
                        This month
                    </Link>
                    <Link
                        href={nextHref}
                        className={NAV_LINK}
                        aria-label={`Next month — ${grid.nextKey}`}
                        rel="next"
                    >
                        Next →
                    </Link>
                </nav>
            </div>

            <table className="w-full table-fixed border-collapse">
                <caption className="sr-only">
                    {grid.label} — {grid.count}{" "}
                    {grid.count === 1 ? "entry" : "entries"} on the calendar
                </caption>
                <thead>
                    <tr>
                        {WEEKDAY_LABELS.map((weekday) => (
                            <th
                                key={weekday}
                                scope="col"
                                className="pb-1 text-center text-[0.62rem] sm:text-[0.7rem]"
                            >
                                <span className="sm:hidden" aria-hidden="true">
                                    {weekday.slice(0, 1)}
                                </span>
                                <span className="max-sm:sr-only">{weekday}</span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {grid.weeks.map((week) => (
                        <tr key={week[0].date}>
                            {week.map((day) => (
                                <DaySquare key={day.date} day={day} />
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>

            {grid.count === 0 && (
                <p className="text-secondary-foreground mt-3 mb-0 text-sm">
                    Nothing on the calendar in {grid.label} yet — try the months either
                    side, or switch to the list to see everything that is coming.
                </p>
            )}
        </section>
    );
}
