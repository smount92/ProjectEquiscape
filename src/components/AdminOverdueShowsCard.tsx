"use client";

/**
 * Admin → Shows. "Overdue & stalled" — the shows nothing else is
 * watching.
 *
 * The hourly cron owns two lifecycle flips and one nudge (shows past
 * judging_ends_at). It deliberately never force-flips out of judging:
 * a community-vote show has no placings until the host finalizes the
 * tally, so an automatic flip would publish an empty result. That same
 * restraint applies here — there is NO status control on this card.
 * The state machine and the host own the lifecycle; this console can
 * only look, and poke.
 *
 * Two actions per row, both harmless:
 *   Nudge host  — one notification, the cron's own type and link, with
 *                 a real cooldown so repeated clicks do nothing.
 *   Open console — the host's own show console, where the legitimate
 *                 controls live.
 */

import { useEffect, useState, useTransition } from "react";

import {
    listOverdueShows,
    nudgeOverdueShowHost,
    type OverdueShowRow,
    type OverdueShowsReport,
} from "@/app/actions/admin";
import {
    OVERDUE_REASON_LABELS,
    OVERDUE_REASON_NOTES,
    type OverdueReason,
} from "@/lib/admin/overdueShows";
import { Button } from "@/components/ui/button";

/** Judging shows are the ones with entrants actively waiting on a result. */
const URGENT_REASONS: ReadonlySet<OverdueReason> = new Set<OverdueReason>([
    "judging_overdue",
    "judging_no_deadline",
    "results_review_stalled",
]);

function overdueLabel(row: OverdueShowRow): string {
    if (row.overdueDays === 0) return "since today";
    if (row.overdueDays === 1) return "1 day";
    if (row.overdueDays < 60) return `${row.overdueDays} days`;
    const months = Math.floor(row.overdueDays / 30);
    return `${months} month${months === 1 ? "" : "s"}`;
}

export default function AdminOverdueShowsCard() {
    const [report, setReport] = useState<OverdueShowsReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [pending, startTransition] = useTransition();

    const load = async (): Promise<OverdueShowsReport | null> => {
        const result = await listOverdueShows();
        if (!result.success) {
            setError(result.error);
            return null;
        }
        setError(null);
        return result.report;
    };

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const next = await load();
            if (!cancelled && next) setReport(next);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const nudge = (row: OverdueShowRow) => {
        startTransition(async () => {
            const result = await nudgeOverdueShowHost(row.showId);
            if (!result.success) {
                setNotes((prev) => ({
                    ...prev,
                    [row.showId]: result.error ?? "Could not send the nudge.",
                }));
                return;
            }
            setNotes((prev) => ({
                ...prev,
                [row.showId]: result.sent
                    ? `Nudged @${row.hostAlias}.`
                    : (result.note ?? "Nothing sent."),
            }));
            const next = await load();
            if (next) setReport(next);
        });
    };

    if (error) {
        return (
            <div className="rounded-lg border border-input bg-card p-4">
                <h3 className="m-0 mb-1 text-base font-bold">Overdue &amp; stalled shows</h3>
                <p role="alert" className="m-0 text-sm font-semibold text-destructive">
                    {error}
                </p>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="rounded-lg border border-input bg-card p-4">
                <h3 className="m-0 mb-1 text-base font-bold">Overdue &amp; stalled shows</h3>
                <p className="m-0 text-sm text-muted-foreground">Checking the clock…</p>
            </div>
        );
    }

    if (report.rows.length === 0) {
        return (
            <div className="rounded-lg border border-input bg-card p-4">
                <h3 className="m-0 mb-1 text-base font-bold">Overdue &amp; stalled shows</h3>
                <p className="m-0 text-sm text-muted-foreground">
                    Nothing is past its deadline. Every show is either moving or finished.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-input bg-card p-4">
            <h3 className="m-0 mb-1 text-base font-bold">
                Overdue &amp; stalled shows{" "}
                <span className="text-sm font-normal text-muted-foreground">
                    ({report.rows.length})
                </span>
            </h3>
            <p className="m-0 mb-3 text-sm text-muted-foreground">
                Shows the clock can&rsquo;t move on its own. No status control here on purpose —
                forcing a flip would publish results that don&rsquo;t exist yet. Nudge the host, or
                open their console.
            </p>

            {report.capped && (
                <p className="m-0 mb-3 rounded-md border border-input bg-background px-3 py-2 text-xs text-secondary-foreground">
                    At least one check filled its 50-row slot — there may be more than this behind
                    the list.
                </p>
            )}

            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {report.rows.map((row) => {
                    const note = notes[row.showId];
                    return (
                        <li
                            key={row.showId}
                            className={`flex flex-wrap items-start gap-3 rounded-md border px-3 py-2 text-sm ${
                                URGENT_REASONS.has(row.reason)
                                    ? "border-destructive/40 bg-destructive/5"
                                    : "border-input"
                            }`}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <a
                                        href={`/shows/${row.showId}`}
                                        className="font-semibold text-forest no-underline hover:underline"
                                    >
                                        {row.title}
                                    </a>
                                    <span className="text-xs font-semibold text-foreground">
                                        {OVERDUE_REASON_LABELS[row.reason]}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {overdueLabel(row)} · {row.status}
                                    </span>
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                    @{row.hostAlias} · {row.entryCount} live entr
                                    {row.entryCount === 1 ? "y" : "ies"} · since{" "}
                                    {new Date(row.since).toLocaleDateString()}
                                    {row.nudgedAt && (
                                        <>
                                            {" · "}nudged{" "}
                                            {new Date(row.nudgedAt).toLocaleDateString()}
                                        </>
                                    )}
                                </div>
                                <div className="mt-0.5 text-xs text-secondary-foreground italic">
                                    {OVERDUE_REASON_NOTES[row.reason]}
                                </div>
                                {note && (
                                    <div role="status" className="mt-1 text-xs font-medium text-foreground">
                                        {note}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    size="sm"
                                    disabled={pending || row.nudgeOnCooldown}
                                    onClick={() => nudge(row)}
                                    title={
                                        row.nudgeOnCooldown
                                            ? "Already nudged recently — the cooldown is still running"
                                            : "Send the host one deadline notification"
                                    }
                                >
                                    Nudge host
                                </Button>
                                <Button variant="outline" size="sm" asChild>
                                    <a href={row.hostConsoleUrl}>Show console</a>
                                </Button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
