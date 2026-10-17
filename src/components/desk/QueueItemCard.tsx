"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    approveSuggestion,
    claimSuggestion,
    confirmMerge,
    declineMerge,
    rejectSuggestion,
    releaseClaim,
    type QueueChange,
    type QueueItem,
} from "@/app/actions/registry-desk";
import { revertSuggestion } from "@/app/actions/catalog-suggestions";
import EditThenApprove from "@/components/desk/EditThenApprove";

export function timeAgo(iso: string, now: number = Date.now()): string {
    const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
}

function clock(iso: string): string {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function ChangeLines({ changes, side }: { changes: QueueChange[]; side: "from" | "to" }) {
    return (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {changes.map((c) => (
                <li key={c.key}>
                    <span className="text-muted-foreground">{c.label}</span>{" "}
                    <span className="font-semibold text-foreground">{c[side] ? `“${c[side]}”` : "empty"}</span>
                </li>
            ))}
        </ul>
    );
}

type Mode = "idle" | "editing" | "rejecting" | "reverting" | "declining";

/**
 * One item in the Queue: what the member asked for, what the Registry says
 * now, their reason, and the moderator's choices. Nobody decides their own.
 */
export default function QueueItemCard({
    item,
    role,
    onDone,
}: {
    item: QueueItem;
    role: "owner" | "moderator";
    onDone: (id: string, message: string) => void;
}) {
    const [mode, setMode] = useState<Mode>("idle");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [words, setWords] = useState("");
    const [claim, setClaim] = useState(item.claim);

    const heldByOther = !!claim && !claim.mine;
    const blocked = item.mine || heldByOther;

    async function run(fn: () => Promise<{ success: boolean; error?: string }>, done: string) {
        setBusy(true);
        setError("");
        const r = await fn();
        setBusy(false);
        if (!r.success) {
            setError(r.error ?? "That did not work. Please try again.");
            return;
        }
        onDone(item.id, done);
    }

    async function startEditing() {
        setBusy(true);
        setError("");
        const r = await claimSuggestion(item.id);
        setBusy(false);
        if (!r.success) {
            setError(r.error);
            return;
        }
        if (r.claimed && r.until) setClaim({ by: "you", mine: true, until: r.until });
        setMode("editing");
    }

    async function stopEditing() {
        setMode("idle");
        await releaseClaim(item.id);
        setClaim(null);
    }

    const who = item.who;
    let now: React.ReactNode;
    let suggested: React.ReactNode;
    if (item.tab === "second_looks") {
        now = <span>{item.title}</span>;
        suggested = <span>{item.reason ? `“${item.reason}”` : "No note"}</span>;
    } else if (item.kind === "addition") {
        now = <span>Not in the Registry yet{item.moldTitle ? `; it would go under “${item.moldTitle}”` : ""}.</span>;
        suggested = <ChangeLines changes={item.changes} side="to" />;
    } else if (item.kind === "duplicate") {
        now = (
            <span>
                Two entries: “{item.title}” and “{item.keep?.title ?? "the other one"}”
            </span>
        );
        suggested = (
            <span>
                Merge “{item.title}” into “{item.keep?.title ?? "the other one"}”
            </span>
        );
    } else if (item.changes.length > 0) {
        now = <ChangeLines changes={item.changes} side="from" />;
        suggested = <ChangeLines changes={item.changes} side="to" />;
    } else {
        now = <span>{item.title}</span>;
        suggested = <span>{item.kindLabel}</span>;
    }

    const approveLabel = item.kind === "duplicate" && role !== "owner" ? "Approve (needs a second look)" : "Approve";

    return (
        <article
            className="flex flex-col gap-3 rounded-lg border border-input bg-card p-4 shadow-sm"
            data-testid="queue-item"
        >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold tracking-wide text-secondary-foreground uppercase">
                        {item.kindLabel}
                    </span>
                    <strong className="text-base break-words text-foreground">{item.title}</strong>
                </div>
                <span className="text-xs text-muted-foreground">
                    {who} · {timeAgo(item.createdAt)}
                </span>
            </div>
            {item.moldTitle && item.kind !== "addition" && (
                <p className="m-0 text-xs text-muted-foreground">Under the mold “{item.moldTitle}”</p>
            )}

            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-muted px-3 py-2">
                    <div className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Now</div>
                    {now}
                </div>
                <div className="rounded-lg bg-forest/10 px-3 py-2">
                    <div className="text-xs font-bold tracking-wide text-forest uppercase">
                        {item.tab === "auto_applied" ? "Applied" : item.tab === "second_looks" ? "Why" : "Suggested"}
                    </div>
                    {suggested}
                </div>
            </div>

            {item.note && <p className="m-0 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{item.note}</p>}
            {item.reason && item.tab !== "second_looks" && (
                <p className="m-0 text-sm text-secondary-foreground italic">“{item.reason}”</p>
            )}
            {claim && (
                <p className="m-0 text-xs text-muted-foreground" data-testid="claim-line">
                    {claim.mine
                        ? `You have this one until ${clock(claim.until)}.`
                        : `${claim.by} is looking at this one until ${clock(claim.until)}.`}
                </p>
            )}
            {item.mine && (
                <p className="m-0 text-xs text-muted-foreground">
                    {item.tab === "second_looks"
                        ? "You asked for this. Another moderator or the site owner confirms it."
                        : "Your own suggestion: another moderator decides it."}
                </p>
            )}
            {item.deskHref && (
                <Link href={item.deskHref} className="self-start text-sm font-semibold text-forest underline">
                    Open it in the Mold view
                </Link>
            )}

            {mode === "editing" && (
                <EditThenApprove
                    item={item}
                    busy={busy}
                    onCancel={() => void stopEditing()}
                    onApprove={(edited, note) =>
                        void run(
                            () => approveSuggestion(item.id, edited, note || null),
                            `Approved as fixed. ${who} has been told what you changed.`,
                        )
                    }
                />
            )}

            {(mode === "rejecting" || mode === "reverting" || mode === "declining") && (
                <form
                    className="flex flex-col gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        const reason = words.trim();
                        if (mode === "rejecting") {
                            void run(
                                () => rejectSuggestion(item.id, reason),
                                `Said no, with your reason. ${who} has been told.`,
                            );
                        } else if (mode === "reverting") {
                            void run(
                                () => revertSuggestion({ suggestionId: item.id, reason }),
                                `Put back. ${who} has been told why.`,
                            );
                        } else {
                            void run(() => declineMerge(item.id, reason), "Said no to the merge, with your reason.");
                        }
                    }}
                >
                    <label htmlFor={`why-${item.id}`} className="text-sm font-semibold text-foreground">
                        {mode === "declining"
                            ? "Why not (the moderator who asked reads it)"
                            : "Why (the member reads it)"}
                    </label>
                    <Textarea
                        id={`why-${item.id}`}
                        value={words}
                        onChange={(e) => setWords(e.target.value)}
                        placeholder="The 1998 one is a different horse, so these aren't the same release."
                    />
                    <div className="flex flex-wrap gap-2">
                        <Button type="submit" variant="destructive" disabled={busy || words.trim().length < 5}>
                            {mode === "reverting" ? "Put it back" : "Say no"}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setMode("idle")} disabled={busy}>
                            Cancel
                        </Button>
                    </div>
                </form>
            )}

            {error && (
                <p role="alert" className="m-0 text-sm text-destructive">
                    {error}
                </p>
            )}

            {mode === "idle" && (
                <div className="flex flex-wrap gap-2">
                    {item.tab === "second_looks" ? (
                        !item.mine && (
                            <>
                                <Button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                        void run(() => confirmMerge(item.id), "Confirmed. The merge has happened.")
                                    }
                                >
                                    Confirm the merge
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive-outline"
                                    onClick={() => setMode("declining")}
                                >
                                    Say no, with a reason ...
                                </Button>
                            </>
                        )
                    ) : item.tab === "auto_applied" ? (
                        <Button
                            type="button"
                            variant="outline"
                            disabled={busy || item.kind !== "correction"}
                            onClick={() => setMode("reverting")}
                        >
                            Put it back ...
                        </Button>
                    ) : (
                        <>
                            <Button
                                type="button"
                                disabled={busy || blocked}
                                onClick={() =>
                                    void run(
                                        () => approveSuggestion(item.id),
                                        item.kind === "duplicate" && role !== "owner"
                                            ? "Approved. The merge waits for a second look."
                                            : `Approved. ${who} has been told.`,
                                    )
                                }
                            >
                                {approveLabel}
                            </Button>
                            {item.canEdit && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={busy || blocked}
                                    onClick={() => void startEditing()}
                                >
                                    Edit, then approve
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="destructive-outline"
                                disabled={busy || blocked}
                                onClick={() => setMode("rejecting")}
                            >
                                Say no, with a reason ...
                            </Button>
                        </>
                    )}
                </div>
            )}
        </article>
    );
}
