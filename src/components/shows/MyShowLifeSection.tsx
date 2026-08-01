/**
 * /shows — "My show life" ledger section (Wave 2).
 *
 * The signed-in entrant's personal strip ABOVE the public browse
 * shelves: where am I entered (with the deadline that actually
 * matters, in relative time) and how did my last shows go. Pure
 * presentational — the page feeds it getMyShowLife() data — and it
 * renders NOTHING at zero data, so members who don't show are never
 * nagged.
 */

import Link from "next/link";

import { formatStatus } from "@/lib/shows/stateMachine";
import {
    formatCloseAt,
    placeLabel,
    type MyShowLife,
} from "@/lib/shows/showLife";

export default function MyShowLifeSection({ life }: { life: MyShowLife }) {
    const { activeEntries, recentResults } = life;
    if (activeEntries.length === 0 && recentResults.length === 0) return null;

    return (
        <section className="ledger-card mb-10" aria-labelledby="my-show-life-heading">
            <span className="ledger-tab" id="my-show-life-heading">
                My show life
            </span>

            {activeEntries.length > 0 && (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {activeEntries.map((entry) => {
                        const deadline = formatCloseAt(entry.entriesCloseAt);
                        const extraClasses = entry.myEntryCount - entry.myClasses.length;
                        return (
                            <li key={entry.showId}>
                                <Link
                                    href={`/shows/${entry.showId}`}
                                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border border-transparent px-2 py-2 no-underline transition-all hover:border-input hover:bg-black/[0.03]"
                                    id={`show-life-${entry.showId}`}
                                >
                                    <span className="font-semibold text-foreground">{entry.showTitle}</span>
                                    <span className="stamp">{formatStatus(entry.showStatus)}</span>
                                    {deadline && entry.showStatus === "entries_open" && (
                                        <span className="text-sm font-semibold text-forest">{deadline}</span>
                                    )}
                                    <span className="text-sm text-muted-foreground">
                                        {entry.myEntryCount} entr{entry.myEntryCount === 1 ? "y" : "ies"}
                                        {entry.myClasses.length > 0 && (
                                            <>
                                                {" · "}
                                                {entry.myClasses.join(", ")}
                                                {extraClasses > 0 && ` +${extraClasses} more`}
                                            </>
                                        )}
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}

            {recentResults.length > 0 && (
                <div className={activeEntries.length > 0 ? "mt-4 border-t border-input pt-4" : ""}>
                    <h3 className="mb-2 text-xs font-semibold tracking-widest text-secondary-foreground uppercase">
                        Recent results
                    </h3>
                    <ul className="m-0 flex list-none flex-col gap-3 p-0">
                        {recentResults.map((result) => (
                            <li key={result.showId}>
                                <Link
                                    href={`/shows/${result.showId}`}
                                    className="font-semibold text-forest no-underline hover:underline"
                                >
                                    {result.showTitle}
                                </Link>
                                <ul className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0">
                                    {result.placings.map((placing, i) => (
                                        <li
                                            key={`${result.showId}-${i}`}
                                            className="text-sm text-secondary-foreground"
                                        >
                                            <span className="font-bold text-foreground">
                                                {placeLabel(placing.place)}
                                            </span>{" "}
                                            — {placing.className} · {placing.horseName}
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}
