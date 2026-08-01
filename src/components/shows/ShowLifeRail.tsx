/**
 * Dashboard — compact "Shows" rail card (Wave 2).
 *
 * The member home never mentioned shows (site audit 2026-07). This
 * rail fixes that WITHOUT nagging: it renders only for members who
 * actually have a show life (an active entry or a published result),
 * and hides itself entirely otherwise — plus behind the shows-v2
 * flag, and on any data failure (pre-migration environments).
 *
 * Contents: how many shows are taking entries right now, your next
 * deadline, your latest result line, and the door to /shows.
 */

import Link from "next/link";
import { Trophy } from "lucide-react";

import { getMyShowLife } from "@/app/actions/show-life";
import { showsV2Enabled } from "@/lib/shows/flags";
import { createClient } from "@/lib/supabase/server";
import { formatCloseAt, placeLabel } from "@/lib/shows/showLife";

export default async function ShowLifeRail() {
    if (!showsV2Enabled()) return null;

    const life = await getMyShowLife();
    if (life.activeEntries.length === 0 && life.recentResults.length === 0) return null;

    // Platform-wide "open for entries" count — cheap head count; any
    // failure just hides the line, never the card.
    let openCount: number | null = null;
    try {
        const supabase = await createClient();
        const { count, error } = await supabase
            .from("shows")
            .select("id", { count: "exact", head: true })
            .eq("status", "entries_open");
        if (!error) openCount = count ?? 0;
    } catch {
        openCount = null;
    }

    const nextDeadline = life.activeEntries.find(
        (entry) => entry.showStatus === "entries_open" && formatCloseAt(entry.entriesCloseAt),
    );
    const latestResult = life.recentResults[0];
    const latestPlacing = latestResult?.placings[0];

    return (
        <div className="bg-card rounded-lg border border-input p-6 shadow-md transition-all">
            <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-widest text-secondary-foreground uppercase">
                <Trophy size={14} strokeWidth={1.5} /> Shows
            </h3>
            <div className="flex flex-col gap-2 text-sm">
                {openCount !== null && openCount > 0 && (
                    <p className="m-0 text-secondary-foreground">
                        <span className="text-forest font-bold">{openCount}</span> show
                        {openCount === 1 ? "" : "s"} open for entries right now
                    </p>
                )}
                {life.activeEntries.length > 0 && (
                    <p className="m-0 text-secondary-foreground">
                        You&apos;re entered in{" "}
                        <span className="font-bold text-foreground">{life.activeEntries.length}</span>{" "}
                        show{life.activeEntries.length === 1 ? "" : "s"}
                    </p>
                )}
                {nextDeadline && (
                    <p className="m-0 text-secondary-foreground">
                        <Link
                            href={`/shows/${nextDeadline.showId}`}
                            className="font-semibold text-foreground no-underline hover:underline"
                        >
                            {nextDeadline.showTitle}
                        </Link>{" "}
                        — {formatCloseAt(nextDeadline.entriesCloseAt)}
                    </p>
                )}
                {latestResult && latestPlacing && (
                    <p className="m-0 text-secondary-foreground">
                        Latest result:{" "}
                        <span className="font-bold text-foreground">
                            {placeLabel(latestPlacing.place)}
                        </span>{" "}
                        — {latestPlacing.className},{" "}
                        <Link
                            href={`/shows/${latestResult.showId}`}
                            className="font-semibold text-foreground no-underline hover:underline"
                        >
                            {latestResult.showTitle}
                        </Link>
                    </p>
                )}
            </div>
            <div className="mt-4 border-t border-input pt-3">
                <Link href="/shows" className="text-forest text-sm font-semibold no-underline hover:underline">
                    Find a show →
                </Link>
            </div>
        </div>
    );
}
