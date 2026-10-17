"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { previewRemove, removeItem, type DeskLinks } from "@/app/actions/registry-desk";
import { linkWords } from "@/components/desk/linkWords";

type Check =
    | { state: "checking" }
    | { state: "not_ready"; message: string }
    | { state: "linked"; links: DeskLinks }
    | { state: "free" }
    | { state: "error"; message: string };

/**
 * Remove a row nothing points at. Before update 243 it says so first,
 * before anyone types a reason; anything with horses, want lists, set
 * pieces or releases attached is merged instead, and the dialog says so.
 * The Mold view mounts one per row (keyed), so nothing carries over from
 * the last one.
 */
export default function RemoveDialog({
    open,
    onOpenChange,
    item,
    onDone,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: { id: string; title: string } | null;
    /** The History entry comes back for Undo (null when there is none). */
    onDone: (id: string, actionId: string | null) => void;
}) {
    const [check, setCheck] = useState<Check>({ state: "checking" });
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const reasonRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (!open || !item) return;
        let live = true;
        (async () => {
            const r = await previewRemove(item.id);
            if (!live) return;
            if (!r.success) setCheck({ state: "error", message: r.error });
            else if (!r.ready) setCheck({ state: "not_ready", message: r.message });
            else if (!r.canRemove) setCheck({ state: "linked", links: r.links });
            else setCheck({ state: "free" });
        })();
        return () => {
            live = false;
        };
    }, [open, item]);

    useEffect(() => {
        if (check.state === "free") reasonRef.current?.focus();
    }, [check.state]);

    async function remove() {
        if (!item) return;
        setBusy(true);
        setError("");
        const r = await removeItem(item.id, reason);
        setBusy(false);
        if (!r.success) {
            setError(r.error);
            return;
        }
        onDone(item.id, r.actionId ?? null);
    }

    const attached = check.state === "linked" ? linkWords(check.links) : [];
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogTitle className="font-serif text-xl font-bold">Remove “{item?.title}”</DialogTitle>
                <DialogDescription>
                    Only a row nothing points at can be removed. It is hidden at once, listed in the site owner&apos;s
                    daily note, and can be put back for 30 days from History.
                </DialogDescription>
                {check.state === "checking" && <p className="m-0 text-sm text-muted-foreground">Checking ...</p>}
                {check.state === "not_ready" && (
                    <p
                        className="m-0 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning"
                        data-testid="remove-wait"
                    >
                        {check.message}
                    </p>
                )}
                {check.state === "linked" && (
                    <p className="m-0 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
                        {attached.length > 0
                            ? `It has ${attached.join(", ")}, so it can't be removed. Merge it into the right entry instead.`
                            : "Something points at it, so it can't be removed. Merge it into the right entry instead."}
                    </p>
                )}
                {check.state === "free" && (
                    <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
                        Why it goes (kept in the history)
                        <Input
                            ref={reasonRef}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Test entry, a duplicate with nothing attached ..."
                        />
                    </label>
                )}
                {(error || check.state === "error") && (
                    <p role="alert" className="m-0 text-sm text-destructive">
                        {error || (check.state === "error" ? check.message : "")}
                    </p>
                )}
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        {check.state === "free" ? "Cancel" : "OK"}
                    </Button>
                    {check.state === "free" && (
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={remove}
                            disabled={busy || reason.trim().length < 3}
                        >
                            {busy ? "Removing ..." : "Remove it"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
