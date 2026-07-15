"use client";

/**
 * Console OVERVIEW tab — the state-machine card. Current status is
 * rubber-stamped; every legal next transition renders as a button
 * wired to transitionShowStatus; refusals from the action are
 * surfaced verbatim.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { deleteShow, transitionShowStatus, updateShowSettings } from "@/app/actions/shows-v2";
import type { ConsoleShow } from "@/lib/shows/console";
import { formatStatus, legalNextStatuses, SHOW_STATUS_ORDER } from "@/lib/shows/stateMachine";
import type { ShowStatus } from "@/lib/shows/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

/** Host-facing verb for arriving at each status. */
const TRANSITION_LABELS: Record<ShowStatus, string> = {
    draft: "Revert to draft",
    published: "Publish show",
    entries_open: "Open entries",
    entries_closed: "Close entries",
    running: "Start the show",
    judging: "Begin judging",
    results_review: "Move to results review",
    completed: "Complete show",
    archived: "Archive show",
};

/** Backward moves (pressure valves) render quiet; forward moves are the CTA. */
function isForward(from: ShowStatus, to: ShowStatus): boolean {
    return SHOW_STATUS_ORDER.indexOf(to) > SHOW_STATUS_ORDER.indexOf(from);
}

/**
 * Transitions serious enough to pause for a confirm dialog: every
 * backward move (a pressure valve a host could fat-finger) plus the
 * one forward move that mints permanent records — results_review →
 * completed writes results to every horse's record and issues
 * qualification cards (see the RESULTS PUBLISH block in
 * transitionShowStatus, app/actions/shows-v2.ts). Archiving stays
 * one-click: it's a filing status, not a data-mutating step.
 */
const TRANSITION_CONFIRMATIONS: Partial<Record<ShowStatus, Partial<Record<ShowStatus, string>>>> = {
    published: {
        draft: "This unpublishes the show — it disappears from public browse until you publish again.",
    },
    entries_closed: {
        entries_open: "This reopens entries — entrants can add, change, or withdraw entries again.",
    },
    results_review: {
        running: "This sends the show back to running — any placings already recorded for those classes will need to be redone.",
        judging: "This sends the show back to judging — any placings already recorded will need to be redone.",
        completed: "This finalizes results — they post to every horse's permanent record and qualification cards are issued. This cannot be undone.",
    },
};

function formatDate(iso: string | null, withTime = false): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    });
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
    if (value === null || value === undefined || value === "") return null;
    return (
        <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {label}
            </dt>
            <dd className="text-sm text-foreground">{value}</dd>
        </div>
    );
}

interface ShowStatusCardProps {
    show: ConsoleShow;
    entryCount: number;
    canManage: boolean;
}

export default function ShowStatusCard({ show, entryCount, canManage }: ShowStatusCardProps) {
    const router = useRouter();
    const [pending, setPending] = useState<ShowStatus | null>(null);
    const [togglingBlind, setTogglingBlind] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmTarget, setConfirmTarget] = useState<ShowStatus | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleBlindToggle = async () => {
        setTogglingBlind(true);
        setError(null);
        const result = await updateShowSettings({
            showId: show.id,
            patch: { blindBrowsing: !show.blindBrowsing },
        });
        if (result.success) {
            router.refresh();
        } else {
            setError(result.error);
        }
        setTogglingBlind(false);
    };

    // Forward moves first so the primary CTA leads the row.
    const nextStatuses = [...legalNextStatuses(show.status, show.mode)].sort(
        (a, b) => Number(isForward(show.status, b)) - Number(isForward(show.status, a)),
    );

    const handleTransition = async (to: ShowStatus) => {
        setPending(to);
        setError(null);
        const result = await transitionShowStatus({ showId: show.id, to });
        if (result.success) {
            setConfirmTarget(null);
            router.refresh();
        } else {
            setError(result.error);
        }
        setPending(null);
    };

    const handleDelete = async () => {
        setDeleting(true);
        setError(null);
        const result = await deleteShow({ showId: show.id });
        if (result.success) {
            router.push("/shows/host");
            return;
        }
        setError(result.error);
        setDeleting(false);
    };

    return (
        <div className="flex flex-col gap-6">
            {/* State machine card */}
            <section className="ledger-card" aria-labelledby="show-status-heading">
                <span className="ledger-tab" id="show-status-heading">
                    Show Status
                </span>
                <div className="flex flex-wrap items-center gap-4">
                    <span className="stamp text-lg" data-testid="current-status">
                        {formatStatus(show.status)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                        {show.status === "draft" &&
                            "Only you and your staff can see this show. Publish it when the classlist is ready."}
                        {show.status === "published" &&
                            "The show is visible. Open entries when you're ready to accept them."}
                        {show.status === "entries_open" && "Entrants can enter now."}
                        {show.status === "entries_closed" &&
                            (show.mode === "live"
                                ? "Entries are locked. Start the show on the day."
                                : "Entries are locked. Begin judging when your judges are ready.")}
                        {show.status === "running" && "Show day — classes are being called and placed."}
                        {show.status === "judging" &&
                            "Judges are working through the classes. When every class is placed, a Champion & Reserve callback round opens automatically in the judge queue."}
                        {show.status === "results_review" &&
                            "Check the placings, then complete the show to publish results."}
                        {show.status === "completed" && "Results are final and on every horse's record."}
                        {show.status === "archived" && "This show is archived and read-only."}
                    </span>
                </div>

                {/* Live show day-of surfaces (Phase E2): the ring console
                    runs the table; the board is the projector view. */}
                {show.mode === "live" && show.status === "running" && (
                    <div className="mt-4 flex flex-wrap gap-4">
                        <Link
                            href={`/shows/host/${show.id}/ring`}
                            className="text-sm font-semibold text-forest hover:underline"
                            data-testid="ring-console-link"
                        >
                            Open the ring console →
                        </Link>
                        <Link
                            href={`/shows/host/${show.id}/ring/board`}
                            className="text-sm font-semibold text-forest hover:underline"
                        >
                            Announcer board (public) →
                        </Link>
                    </div>
                )}

                {/* NAMHSA-format results file (Phase F): on-demand CSV,
                    host/co-host only — the route re-checks the role. */}
                {canManage &&
                    (show.status === "completed" || show.status === "archived") && (
                        <div className="mt-4">
                            <Button asChild variant="outline">
                                <a
                                    href={`/api/export/show-results-v2/${show.id}`}
                                    download
                                    data-testid="download-results-csv"
                                >
                                    Download results (CSV)
                                </a>
                            </Button>
                            <p className="mt-2 text-xs text-muted-foreground">
                                Searchable NAMHSA-format results — class names, entry
                                counts, placings, owners, and championships.
                            </p>
                        </div>
                    )}

                {canManage ? (
                    nextStatuses.length > 0 && (
                        <div className="mt-5 flex flex-wrap gap-3">
                            {nextStatuses.map((to) => {
                                const confirmMessage = TRANSITION_CONFIRMATIONS[show.status]?.[to];
                                return (
                                    <Button
                                        key={to}
                                        variant={isForward(show.status, to) ? "default" : "outline"}
                                        disabled={pending !== null}
                                        onClick={() => {
                                            if (confirmMessage) {
                                                setError(null);
                                                setConfirmTarget(to);
                                            } else {
                                                handleTransition(to);
                                            }
                                        }}
                                    >
                                        {pending === to ? "Working…" : TRANSITION_LABELS[to]}
                                    </Button>
                                );
                            })}
                        </div>
                    )
                ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                        Only the host or a co-host can change the show status.
                    </p>
                )}

                {canManage && show.status === "draft" && (
                    <div className="mt-5 border-t border-border pt-4">
                        <Button
                            variant="destructive-outline"
                            onClick={() => {
                                setError(null);
                                setDeleteOpen(true);
                            }}
                        >
                            <Trash2 />
                            Delete draft
                        </Button>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Permanently removes this draft and its classlist — only drafts can be
                            deleted.
                        </p>
                    </div>
                )}

                {error && (
                    <p role="alert" className="mt-4 text-sm font-semibold text-destructive">
                        {error}
                    </p>
                )}
            </section>

            <Dialog
                open={confirmTarget !== null}
                onOpenChange={(next) => {
                    if (!next && pending === null) setConfirmTarget(null);
                }}
            >
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>
                            {confirmTarget && `${TRANSITION_LABELS[confirmTarget]}?`}
                        </DialogTitle>
                        <DialogDescription>
                            {confirmTarget && TRANSITION_CONFIRMATIONS[show.status]?.[confirmTarget]}
                        </DialogDescription>
                    </DialogHeader>
                    {error && (
                        <p role="alert" className="text-sm font-semibold text-destructive">
                            {error}
                        </p>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            size="wide"
                            onClick={() => setConfirmTarget(null)}
                            disabled={pending !== null}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="default"
                            size="wide"
                            onClick={() => confirmTarget && handleTransition(confirmTarget)}
                            disabled={pending !== null}
                        >
                            {pending !== null ? "Working…" : "Confirm"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={deleteOpen}
                onOpenChange={(next) => {
                    if (!deleting) setDeleteOpen(next);
                }}
            >
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Delete this draft?</DialogTitle>
                        <DialogDescription>
                            This permanently deletes the draft and its classlist. This cannot be
                            undone.
                        </DialogDescription>
                    </DialogHeader>
                    {error && (
                        <p role="alert" className="text-sm font-semibold text-destructive">
                            {error}
                        </p>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            size="wide"
                            onClick={() => setDeleteOpen(false)}
                            disabled={deleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive-outline"
                            size="wide"
                            onClick={handleDelete}
                            disabled={deleting}
                        >
                            {deleting ? "Deleting…" : "Delete draft"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Summary card */}
            <section className="ledger-card" aria-labelledby="show-summary-heading">
                <span className="ledger-tab" id="show-summary-heading">
                    At a Glance
                </span>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                    <SummaryRow
                        label="Mode"
                        value={show.mode === "live" ? "Live show" : "Online photo show"}
                    />
                    <SummaryRow
                        label="Judging"
                        value={show.judging === "judged" ? "Judged" : "Community vote"}
                    />
                    <SummaryRow
                        label="Qualifying"
                        value={
                            show.isMhhQualifying ? (
                                <Badge>MHH Qualifying</Badge>
                            ) : (
                                <Badge variant="outline">Not qualifying</Badge>
                            )
                        }
                    />
                    {show.mode === "live" ? (
                        <>
                            <SummaryRow label="Show date" value={formatDate(show.showDate)} />
                            <SummaryRow label="Venue" value={show.venueName} />
                            <SummaryRow
                                label="Capacity"
                                value={show.capacity !== null ? `${show.capacity} tables` : null}
                            />
                        </>
                    ) : (
                        <>
                            <SummaryRow
                                label="Entries open"
                                value={formatDate(show.entriesOpenAt, true)}
                            />
                            <SummaryRow
                                label="Entries close"
                                value={formatDate(show.entriesCloseAt, true)}
                            />
                            <SummaryRow
                                label="Judging ends"
                                value={formatDate(show.judgingEndsAt, true)}
                            />
                        </>
                    )}
                    {show.mode === "online" && (
                        <SummaryRow
                            label="Blind browsing"
                            value={
                                <span className="flex flex-wrap items-center gap-2">
                                    <Badge variant={show.blindBrowsing ? "default" : "outline"}>
                                        {show.blindBrowsing ? "On" : "Off"}
                                    </Badge>
                                    {canManage && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={togglingBlind}
                                            title="While on, the public gallery hides owner identities until results publish (the digital leg-tag convention)."
                                            onClick={handleBlindToggle}
                                            data-testid="blind-toggle"
                                        >
                                            {togglingBlind
                                                ? "Saving…"
                                                : show.blindBrowsing
                                                  ? "Turn off"
                                                  : "Turn on"}
                                        </Button>
                                    )}
                                </span>
                            }
                        />
                    )}
                    <SummaryRow
                        label="Entries"
                        value={
                            entryCount > 0
                                ? `${entryCount} entr${entryCount === 1 ? "y" : "ies"}`
                                : "None yet"
                        }
                    />
                    <SummaryRow label="Sanctioning" value={show.sanctioningNote} />
                </dl>
            </section>
        </div>
    );
}
