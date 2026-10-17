"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";

/**
 * "Leave without saving N releases?" Asked when a moderator follows a link
 * or presses Back with unsaved edits on the Mold view. Stay keeps
 * everything as it is; Save all saves every unsaved release first and
 * leaves only if all of them saved.
 */
export default function LeaveDialog({
    open,
    count,
    titles,
    onStay,
    onLeave,
    onSaveAll,
}: {
    open: boolean;
    count: number;
    /** The unsaved releases, by name (the first few are listed). */
    titles: string[];
    onStay: () => void;
    onLeave: () => void;
    /** Resolves true when every one saved. */
    onSaveAll: () => Promise<boolean>;
}) {
    const [busy, setBusy] = useState(false);
    const what = count === 1 ? "1 release" : `${count} releases`;
    const shown = titles.slice(0, 4);

    return (
        <Dialog open={open} onOpenChange={(o) => (!o && !busy ? onStay() : undefined)}>
            <DialogContent>
                <DialogTitle className="font-serif text-xl font-bold">Leave without saving {what}?</DialogTitle>
                <DialogDescription>
                    {count === 1 ? "It has" : "They have"} changes you haven&apos;t saved. Leaving drops them.
                </DialogDescription>
                {shown.length > 0 && (
                    <ul className="m-0 list-disc pl-5 text-sm text-foreground">
                        {shown.map((t, i) => (
                            <li key={`${t}-${i}`} className="break-words">
                                {t}
                            </li>
                        ))}
                        {titles.length > shown.length && (
                            <li className="text-muted-foreground">and {titles.length - shown.length} more</li>
                        )}
                    </ul>
                )}
                <DialogFooter className="flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={onStay} disabled={busy} autoFocus>
                        Stay
                    </Button>
                    <Button type="button" variant="destructive-outline" onClick={onLeave} disabled={busy}>
                        Leave without saving
                    </Button>
                    <Button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                            setBusy(true);
                            const ok = await onSaveAll();
                            setBusy(false);
                            if (ok) onLeave();
                        }}
                    >
                        {busy ? "Saving ..." : "Save all and leave"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
