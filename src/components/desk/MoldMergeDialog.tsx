"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { previewMerge, requestMerge, type DeskRelease, type MoldHit } from "@/app/actions/registry-desk";
import { linkWords } from "@/components/desk/linkWords";
import MoldPicker from "@/components/desk/MoldPicker";
import { canMerge, mergeButton, mergeNote, type Readiness } from "@/components/desk/mergeWords";

/**
 * "Merge this mold into ...": the same mold listed twice. Pick the mold to
 * keep; this mold's releases move under it and take its scale, and
 * members' horses, want lists and old page addresses follow.
 */
export default function MoldMergeDialog({
    open,
    onOpenChange,
    mold,
    releaseCount,
    role,
    onDone,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mold: DeskRelease;
    releaseCount: number;
    role: "owner" | "moderator";
    onDone: (result: { keep: { id: string; title: string }; waiting: boolean; legacy: boolean }) => void;
}) {
    const [keep, setKeep] = useState<MoldHit | null>(null);
    const [keepScale, setKeepScale] = useState<string | null>(null);
    const [moving, setMoving] = useState<string[] | null>(null);
    const [ready, setReady] = useState<Readiness>(null);
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open || !keep) return;
        let live = true;
        (async () => {
            const r = await previewMerge(keep.id, mold.row.id);
            if (!live) return;
            if (!r.success) {
                setError(r.error);
                setReady(false);
                return;
            }
            setError("");
            setKeepScale(r.keep.row.scale);
            const counts = { ...((r.remove.links ?? {}) as unknown as Record<string, number>) };
            // Set mentions are read from titles: a merge moves links, not titles.
            delete counts.set_mentions;
            delete counts.set_siblings;
            setMoving(linkWords(counts));
            setReady(r.undoReady);
        })();
        return () => {
            live = false;
        };
    }, [open, keep, mold.row.id]);

    async function send() {
        if (!keep) return;
        setBusy(true);
        setError("");
        const r = await requestMerge(keep.id, mold.row.id, note);
        setBusy(false);
        if (!r.success) {
            setError(r.error);
            return;
        }
        onDone({ keep: { id: keep.id, title: keep.title }, waiting: r.status !== "applied", legacy: r.legacy });
    }

    const scaleChanges = !!keep && !!keepScale && keepScale !== mold.row.scale;
    const notice = mergeNote(role, ready);
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogTitle className="font-serif text-xl font-bold">
                    Merge “{mold.row.title}” into another mold
                </DialogTitle>
                <DialogDescription>
                    For the same mold listed twice. Its {releaseCount} release{releaseCount === 1 ? "" : "s"} move under
                    the mold you keep, and members&apos; horses, want lists and old page addresses follow. Nothing a
                    member owns is lost.
                </DialogDescription>
                {!keep ? (
                    <MoldPicker autoFocus excludeId={mold.row.id} onPick={(m) => setKeep(m)} />
                ) : (
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-forest bg-forest/10 px-3 py-2">
                            <div className="min-w-0">
                                <strong className="block text-foreground">Keep: {keep.title}</strong>
                                <span className="block text-xs text-muted-foreground">
                                    {[keep.maker, keep.scale, `${keep.releases} releases`].filter(Boolean).join(" · ")}
                                </span>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    setKeep(null);
                                    setReady(null);
                                    setMoving(null);
                                }}
                            >
                                Pick another
                            </Button>
                        </div>
                        {scaleChanges && (
                            <p className="m-0 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
                                The releases take the kept mold&apos;s scale: {mold.row.scale ?? "no scale"} becomes{" "}
                                {keepScale}.
                            </p>
                        )}
                        {moving && (
                            <p className="m-0 text-sm text-foreground">
                                {moving.length > 0
                                    ? `Moves onto the one you keep: ${moving.join(", ")}.`
                                    : "Nothing else points at this mold."}
                            </p>
                        )}
                        <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
                            Why (kept in the history)
                            <Input
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="The same mold listed twice"
                            />
                        </label>
                        {ready === null ? (
                            <p className="m-0 text-sm text-muted-foreground">Checking ...</p>
                        ) : (
                            <p
                                className={`m-0 rounded-lg px-3 py-2 text-sm ${
                                    notice.tone === "bad"
                                        ? "bg-destructive/10 text-destructive"
                                        : "bg-warning/10 text-warning"
                                }`}
                                data-testid="merge-note"
                            >
                                {notice.text}
                            </p>
                        )}
                    </div>
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
                    {keep && (
                        <Button
                            type="button"
                            variant={ready === false ? "destructive" : "default"}
                            onClick={send}
                            disabled={busy || !canMerge(role, ready)}
                        >
                            {mergeButton(role, ready, busy)}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
