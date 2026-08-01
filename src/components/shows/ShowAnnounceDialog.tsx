"use client";

/**
 * Console OVERVIEW — the announce composer (Wave 2). A host/co-host
 * broadcast to every current entrant, wired to announceToEntrants
 * (Batch 2 action; until now nothing in the UI called it).
 *
 * The card previews the reach ("goes to N entrants" — distinct
 * owners of live entries, minus the sender); the server recomputes
 * the real list and returns the actual count for the success toast.
 * No table, no email — the message IS the notification.
 */

import { useEffect, useRef, useState } from "react";

import { announceToEntrants } from "@/app/actions/show-announcements";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const MAX_LENGTH = 1000;

interface ShowAnnounceDialogProps {
    showId: string;
    /** Distinct live-entry owners, excluding the viewer. */
    recipientCount: number;
}

export default function ShowAnnounceDialog({ showId, recipientCount }: ShowAnnounceDialogProps) {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (toastTimer.current) clearTimeout(toastTimer.current);
        },
        [],
    );

    const handleSend = async () => {
        setSending(true);
        setError(null);
        const result = await announceToEntrants({ showId, message });
        if (result.success) {
            setOpen(false);
            setMessage("");
            setToast(
                `Announcement sent to ${result.recipientCount} entrant${
                    result.recipientCount === 1 ? "" : "s"
                }.`,
            );
            if (toastTimer.current) clearTimeout(toastTimer.current);
            toastTimer.current = setTimeout(() => setToast(null), 3000);
        } else {
            setError(result.error);
        }
        setSending(false);
    };

    return (
        <section className="ledger-card" aria-labelledby="announce-heading">
            <span className="ledger-tab" id="announce-heading">
                Announcements
            </span>
            <div className="flex flex-wrap items-center gap-3">
                <Button
                    variant="outline"
                    onClick={() => {
                        setError(null);
                        setOpen(true);
                    }}
                    data-testid="announce-open"
                >
                    Announce to entrants
                </Button>
                <span className="text-sm text-muted-foreground">
                    {recipientCount > 0
                        ? `Goes to ${recipientCount} entrant${recipientCount === 1 ? "" : "s"} as an in-app notification.`
                        : "No entrants yet — announcements reach the people entered when you send."}
                </span>
            </div>

            <Dialog
                open={open}
                onOpenChange={(next) => {
                    if (!sending) setOpen(next);
                }}
            >
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Announce to entrants</DialogTitle>
                        <DialogDescription>
                            {recipientCount > 0
                                ? `Goes to ${recipientCount} entrant${
                                      recipientCount === 1 ? "" : "s"
                                  } — the distinct owners of this show's live entries.`
                                : "No one has entered yet, so this announcement has no recipients."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-1.5">
                        <Textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={5}
                            maxLength={MAX_LENGTH}
                            placeholder="Judging starts tomorrow — get your last entries in tonight!"
                            aria-label="Announcement message"
                            disabled={sending}
                        />
                        <span className="self-end text-xs tabular-nums text-muted-foreground">
                            {message.length}/{MAX_LENGTH}
                        </span>
                    </div>
                    {error && (
                        <p role="alert" className="text-sm font-semibold text-destructive">
                            {error}
                        </p>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            size="wide"
                            onClick={() => setOpen(false)}
                            disabled={sending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="wide"
                            onClick={handleSend}
                            disabled={sending || message.trim().length === 0 || recipientCount === 0}
                            data-testid="announce-send"
                        >
                            {sending ? "Sending…" : "Send announcement"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {toast && (
                <div className="share-toast" role="status" aria-live="polite">
                    {toast}
                </div>
            )}
        </section>
    );
}
