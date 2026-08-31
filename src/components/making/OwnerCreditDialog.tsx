"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOwnerCredit } from "@/app/actions/work-records";
import { SERVICE_TYPES } from "@/lib/studio/services";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

/**
 * "Add a credit" — the owner records a link of the chain. The hobby
 * works in relays (sculpted, cast, prepped, painted, restored — all
 * different hands) and the owner is usually the only one who knows
 * the whole story; many of those hands will never have an account.
 * If the name matches an MHH studio, that studio is asked to confirm
 * — otherwise the credit stands honestly labeled "Recorded by owner."
 */
export default function OwnerCreditDialog({ horseId }: { horseId: string }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [workType, setWorkType] = useState<string>(SERVICE_TYPES[1]);
    const [artistName, setArtistName] = useState("");
    const [summary, setSummary] = useState("");
    const [date, setDate] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, start] = useTransition();

    const submit = () => {
        setError(null);
        start(async () => {
            const res = await createOwnerCredit({
                horseId,
                workType,
                artistName,
                summary: summary.trim() || undefined,
                dateCompleted: date || null,
            });
            if (res.success) {
                setOpen(false);
                setArtistName("");
                setSummary("");
                setDate("");
                router.refresh();
            } else {
                setError(res.error ?? "Could not save the credit.");
            }
        });
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="text-forest text-sm font-semibold hover:underline"
            >
                + Add a credit
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Credit an artist</DialogTitle>
                        <DialogDescription>
                            Who did what to this horse — one credit per pair of hands.
                            Sculpted, cast, prepped, painted, haired, restored: each is
                            its own entry, so the whole chain gets its due.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                        <label className="text-sm font-medium">
                            The work
                            <select
                                value={workType}
                                onChange={(e) => setWorkType(e.target.value)}
                                className="border-input bg-card mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                            >
                                {SERVICE_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </label>
                        <label className="text-sm font-medium">
                            The artist
                            <input
                                type="text"
                                value={artistName}
                                maxLength={80}
                                onChange={(e) => setArtistName(e.target.value)}
                                placeholder="Their name or studio — on MHH or not"
                                className="border-input bg-card mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                            />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="text-sm font-medium">
                                When <span className="text-muted-foreground">(optional)</span>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="border-input bg-card mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                                />
                            </label>
                        </div>
                        <label className="text-sm font-medium">
                            Notes <span className="text-muted-foreground">(optional)</span>
                            <textarea
                                rows={2}
                                maxLength={2000}
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                placeholder="What was done, anything worth remembering…"
                                className="border-input bg-card mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                            />
                        </label>
                        {error && <p className="text-destructive m-0 text-sm">{error}</p>}
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground text-sm underline"
                                onClick={() => setOpen(false)}
                            >
                                Cancel
                            </button>
                            <Button onClick={submit} disabled={pending || artistName.trim().length < 2}>
                                {pending ? "Saving…" : "Add credit"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
