"use client";

import { useState, useTransition } from "react";
import { suggestArtistNotes } from "@/app/actions/catalog-suggestions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

/**
 * "Improve these notes" for artists — the same suggest→review door the
 * catalog entries have, pointed at the artists table. Submissions land
 * in the ordinary suggestion queue; nothing publishes without review.
 */
export default function ArtistNotesSuggest({
    artistName,
    hasNotes,
    currentNotes,
}: {
    artistName: string;
    hasNotes: boolean;
    currentNotes: string | null;
}) {
    const [open, setOpen] = useState(false);
    const [notes, setNotes] = useState(currentNotes ?? "");
    const [reason, setReason] = useState("");
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const submit = () => {
        setError(null);
        startTransition(async () => {
            const res = await suggestArtistNotes({ artistName, notes, reason });
            if (res.success) setDone(true);
            else setError(res.error ?? "Could not file the suggestion.");
        });
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="text-forest text-sm font-semibold hover:underline"
            >
                {hasNotes ? "Improve these notes →" : "Write the first notes →"}
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Registry notes — {artistName}</DialogTitle>
                        <DialogDescription>
                            A few short paragraphs in your own words. Facts like years and
                            counts belong on the works themselves — this is for the knowledge
                            that doesn&rsquo;t fit a field. A curator reviews before anything
                            publishes.
                        </DialogDescription>
                    </DialogHeader>
                    {done ? (
                        <p className="text-secondary-foreground text-sm">
                            ✅ Filed — thank you. A curator will review it shortly.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <Textarea
                                rows={7}
                                value={notes}
                                maxLength={4000}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Who they are in the hobby, what they're known for, how to spot their work…"
                            />
                            <input
                                type="text"
                                className="border-input bg-card w-full rounded-md border px-3 py-2 text-sm"
                                value={reason}
                                maxLength={200}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Where does this knowledge come from?"
                            />
                            {error && <p className="text-destructive m-0 text-sm">{error}</p>}
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground text-sm underline"
                                    onClick={() => setOpen(false)}
                                >
                                    Cancel
                                </button>
                                <Button onClick={submit} disabled={pending || notes.trim().length < 20}>
                                    {pending ? "Filing…" : "File for review"}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
