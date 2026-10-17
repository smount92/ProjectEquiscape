"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { previewRemove, removeItem, type DeskLinks } from "@/app/actions/registry-desk";
import { linkWords } from "@/components/desk/linkWords";

/**
 * Remove a row nothing points at. Anything with horses, want lists, set
 * pieces or releases attached is merged instead, and the dialog says so.
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
    onDone: (id: string) => void;
}) {
    const [links, setLinks] = useState<DeskLinks | null>(null);
    const [canRemove, setCanRemove] = useState<boolean | null>(null);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open || !item) return;
        let live = true;
        (async () => {
            const r = await previewRemove(item.id);
            if (!live) return;
            if (r.success) {
                setLinks(r.links);
                setCanRemove(r.canRemove);
                setError("");
            } else {
                setCanRemove(false);
                setError(r.error);
            }
        })();
        return () => {
            live = false;
        };
    }, [open, item]);

    async function remove() {
        if (!item) return;
        setBusy(true);
        const r = await removeItem(item.id, reason);
        setBusy(false);
        if (!r.success) {
            setError(r.error);
            return;
        }
        onDone(item.id);
    }

    const attached = linkWords(links);
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogTitle className="font-serif text-xl font-bold">Remove “{item?.title}”</DialogTitle>
                <DialogDescription>
                    Only a row nothing points at can be removed. It is hidden at once, listed in the site owner&apos;s
                    daily note, and can be put back for 30 days from History.
                </DialogDescription>
                {canRemove === null && !error && <p className="m-0 text-sm text-muted-foreground">Checking ...</p>}
                {canRemove === false && attached.length > 0 && (
                    <p className="m-0 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
                        It has {attached.join(", ")}, so it can&apos;t be removed. Merge it into the right entry
                        instead.
                    </p>
                )}
                {canRemove && (
                    <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
                        Why it goes (kept in the history)
                        <Input
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Test entry, a duplicate with nothing attached ..."
                        />
                    </label>
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
                    {canRemove && (
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
