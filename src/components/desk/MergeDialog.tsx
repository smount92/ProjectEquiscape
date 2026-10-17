"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { previewMerge, requestMerge, type DeskRelease } from "@/app/actions/registry-desk";
import { linkWords } from "@/components/desk/linkWords";
import MergeCheckFailed from "@/components/desk/MergeCheckFailed";
import { canMerge, mergeButton, mergeNote, type Readiness } from "@/components/desk/mergeWords";

function sub(r: DeskRelease): string {
    const a = r.row.attributes ?? {};
    const years = [a.release_year_start, a.release_year_end].filter((y) => y != null && y !== "").join("–");
    return [
        a.model_number ? `#${String(a.model_number)}` : "",
        a.color_description ? String(a.color_description) : "no colour",
        years,
        r.horses ? `in ${r.horses} stable${r.horses === 1 ? "" : "s"}` : "",
    ]
        .filter(Boolean)
        .join(" · ");
}

/**
 * Merge ticked releases into one. Pick the one to keep; everything that
 * points at the others moves onto it and their old addresses forward.
 * A moderator's merge waits for a second look; the owner's applies. Before
 * update 243 it says first that the merge can't be undone.
 */
export default function MergeDialog({
    open,
    onOpenChange,
    rows,
    role,
    onDone,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rows: DeskRelease[];
    role: "owner" | "moderator";
    onDone: (result: { keepId: string; merged: string[]; waiting: boolean; legacy: boolean }) => void;
}) {
    const [keepId, setKeepId] = useState<string>(rows[0]?.row.id ?? "");
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [moving, setMoving] = useState<string[] | null>(null);
    const [ready, setReady] = useState<Readiness>(null);
    // The check itself failed (a network or server error): not the same as
    // "update 243 is missing". Merging stays off until a check succeeds.
    const [checkFailed, setCheckFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);

    const keep = rows.find((r) => r.row.id === keepId) ? keepId : (rows[0]?.row.id ?? "");
    const others = rows.filter((r) => r.row.id !== keep);

    useEffect(() => {
        const rest = rows.filter((r) => r.row.id !== keep);
        if (!open || !keep || rest.length === 0) return;
        let live = true;
        (async () => {
            const totals: Record<string, number> = {};
            let undoReady: boolean | null = null;
            for (const o of rest) {
                const r = await previewMerge(keep, o.row.id);
                if (!r.success) {
                    if (!live) return;
                    setReady(null);
                    setCheckFailed(true);
                    return;
                }
                undoReady = undoReady === null ? r.undoReady : undoReady && r.undoReady;
                for (const [k, n] of Object.entries((r.remove.links ?? {}) as Record<string, number>)) {
                    // Set pieces are read from titles; a merge moves links, not titles.
                    if (k === "total" || k === "set_mentions" || k === "set_siblings") continue;
                    totals[k] = (totals[k] ?? 0) + (Number(n) || 0);
                }
            }
            if (!live) return;
            setCheckFailed(false);
            setMoving(linkWords(totals));
            setReady(undoReady ?? false);
        })();
        return () => {
            live = false;
        };
    }, [open, keep, rows, attempt]);

    async function send() {
        setBusy(true);
        setError("");
        const merged: string[] = [];
        let waiting = false;
        let legacy = false;
        for (const o of others) {
            const r = await requestMerge(keep, o.row.id, note);
            if (!r.success) {
                setError(r.error);
                setBusy(false);
                if (merged.length > 0) onDone({ keepId: keep, merged, waiting, legacy });
                return;
            }
            merged.push(o.row.id);
            if (r.status !== "applied") waiting = true;
            if (r.legacy) legacy = true;
        }
        setBusy(false);
        onDone({ keepId: keep, merged, waiting, legacy });
    }

    const notice = mergeNote(role, ready);
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogTitle className="font-serif text-xl font-bold">Merge into one release</DialogTitle>
                <DialogDescription>
                    Pick the one to keep. Members&apos; horses and want lists on the others move onto it, and old
                    addresses forward. Nothing a member owns is lost.
                </DialogDescription>
                <div role="radiogroup" aria-label="The one to keep" className="flex flex-col gap-2">
                    {rows.map((r) => {
                        const on = r.row.id === keep;
                        return (
                            <button
                                key={r.row.id}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => setKeepId(r.row.id)}
                                className={`cursor-pointer rounded-lg border-2 px-3 py-2 text-left max-md:min-h-11 ${
                                    on ? "border-forest bg-forest/10" : "border-input bg-card"
                                }`}
                            >
                                <strong className="block text-foreground">
                                    {on ? "Keep: " : ""}
                                    {r.row.title}
                                </strong>
                                <span className="block text-xs text-muted-foreground">{sub(r)}</span>
                            </button>
                        );
                    })}
                </div>
                {moving && (
                    <p className="m-0 text-sm text-foreground">
                        {moving.length > 0
                            ? `Moves onto the one you keep: ${moving.join(", ")}.`
                            : "Nothing points at the others, so nothing needs to move."}
                    </p>
                )}
                <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
                    Why (kept in the history)
                    <Input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Same release listed twice"
                    />
                </label>
                {checkFailed ? (
                    <MergeCheckFailed onRetry={() => setAttempt((n) => n + 1)} />
                ) : ready === null ? (
                    <p className="m-0 text-sm text-muted-foreground">Checking ...</p>
                ) : (
                    <p
                        className={`m-0 rounded-lg px-3 py-2 text-sm ${
                            notice.tone === "bad" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                        }`}
                        data-testid="merge-note"
                    >
                        {notice.text}
                    </p>
                )}
                {error && (
                    <p role="alert" className="m-0 text-sm text-destructive">
                        {error}
                    </p>
                )}
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant={ready === false ? "destructive" : "default"}
                        onClick={send}
                        disabled={busy || others.length === 0 || checkFailed || !canMerge(role, ready)}
                    >
                        {mergeButton(role, ready, busy)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
