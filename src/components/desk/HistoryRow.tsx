"use client";

/**
 * One line of the Desk's History: what was done, by whom and in which
 * role, its state, and the two after-the-fact checks: Undo (within 30
 * days, with a reason) and "Looks right" (another moderator's check-off,
 * never your own).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markLooksRight, undoAction, type HistoryEntry } from "@/app/actions/registry-desk-lists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const AT = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
});
const when = (iso: string) => (iso ? `${AT.format(new Date(iso))} UTC` : "");

const ROLE_WORDS: Record<string, string> = {
    owner: "site owner",
    moderator: "Registry moderator",
    curator: "curator",
    member: "member",
};

function stateOf(e: HistoryEntry): { label: string; tone: string } {
    if (e.status === "undone") return { label: e.undoneBy ? `Undone by @${e.undoneBy}` : "Undone", tone: "bad" };
    if (e.status === "awaiting_second_look") return { label: "Waiting for a second look", tone: "wait" };
    // Written just before a merge or removal runs; the database turns it applied when it has.
    if (e.status === "pending") return { label: "Waiting to run", tone: "wait" };
    if (e.status === "declined") return { label: "Declined", tone: "bad" };
    if (e.status === "failed") return { label: "Didn't go through", tone: "bad" };
    if (e.looksRightBy) return { label: `Looks right · @${e.looksRightBy}`, tone: "good" };
    if (e.secondLookBy) return { label: `Second look by @${e.secondLookBy}`, tone: "good" };
    return { label: "Done", tone: "plain" };
}

const TONE: Record<string, string> = {
    good: "border-forest/40 bg-forest/10 text-forest",
    wait: "border-warning/50 bg-warning/10 text-warning",
    bad: "border-destructive/40 bg-destructive/10 text-destructive",
    plain: "border-input bg-muted text-secondary-foreground",
};

export default function HistoryRow({ entry }: { entry: HistoryEntry }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [undoing, setUndoing] = useState(false);
    const [reason, setReason] = useState("");
    const state = stateOf(entry);

    const undo = () =>
        startTransition(async () => {
            setError(null);
            const r = await undoAction(entry.id, reason);
            if (!r.success) {
                setError(r.error);
                return;
            }
            setUndoing(false);
            setNotice(
                r.drifted.length
                    ? `Undone. Left as they are, because they changed since: ${r.drifted.join("; ")}.`
                    : "Undone.",
            );
            router.refresh();
        });
    const looksRight = () =>
        startTransition(async () => {
            setError(null);
            const r = await markLooksRight(entry.id);
            if (!r.success) setError(r.error);
            else router.refresh();
        });

    return (
        <li className="flex flex-col gap-2 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <p className="m-0 font-semibold break-words text-foreground">
                        {entry.summary}
                        {entry.rowCount > 1 && (
                            <span className="font-normal text-muted-foreground"> · {entry.rowCount} rows</span>
                        )}
                    </p>
                    <p className="m-0 text-xs text-muted-foreground">
                        {entry.mine ? "You" : `@${entry.by}`}
                        {entry.role ? `, ${ROLE_WORDS[entry.role] ?? entry.role}` : ""} · {when(entry.createdAt)}
                        {/* A removed or merged-away row has no page; its History line is the record. */}
                        {entry.catalogItemId && entry.kind !== "remove" && entry.kind !== "merge" && (
                            <>
                                {" · "}
                                <Link
                                    href={`/catalog/desk/mold/${entry.catalogItemId}`}
                                    className="font-semibold text-forest"
                                >
                                    Open
                                </Link>
                            </>
                        )}
                    </p>
                    {entry.note && <p className="mt-1 mb-0 text-sm text-secondary-foreground">“{entry.note}”</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", TONE[state.tone])}>
                        {state.label}
                    </span>
                    {entry.canMarkLooksRight && (
                        <Button size="sm" variant="outline" disabled={pending} onClick={looksRight}>
                            Looks right
                        </Button>
                    )}
                    {entry.canUndo && !undoing && (
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => setUndoing(true)}>
                            Undo…
                        </Button>
                    )}
                </div>
            </div>
            {undoing && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label className="flex flex-1 flex-col gap-1 text-sm font-semibold text-foreground">
                        Why undo it? (kept in the history)
                        <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
                    </label>
                    <div className="flex gap-2">
                        <Button size="sm" disabled={pending || reason.trim().length < 3} onClick={undo}>
                            Undo it
                        </Button>
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setUndoing(false)}>
                            Cancel
                        </Button>
                    </div>
                </div>
            )}
            {error && (
                <p role="alert" className="m-0 text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}
            {notice && (
                <p role="status" className="m-0 text-sm font-semibold text-forest">
                    {notice}
                </p>
            )}
        </li>
    );
}
