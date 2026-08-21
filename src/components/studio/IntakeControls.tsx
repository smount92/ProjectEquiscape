"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { setStudioIntake } from "@/app/actions/art-studio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { slotState, type StudioStatus } from "@/lib/studio/pipeline";
import { SlotMeter } from "./StudioBits";

/**
 * Intake: the control an artist actually touches every week.
 *
 * Slots exist for capacity and transparency — NOT reservation. Filling the
 * bench flips an open studio to a waitlist rather than closing it, so the
 * artist keeps seeing demand, and nothing here forces first-come
 * first-served: requests still arrive as a queue to triage in whatever
 * order suits.
 */
export default function IntakeControls({
    status,
    maxSlots,
    waitlistOpen,
    statusNote,
    slotsUsed,
}: {
    status: StudioStatus;
    maxSlots: number;
    waitlistOpen: boolean;
    statusNote: string | null;
    slotsUsed: number;
}) {
    const router = useRouter();
    const [draftStatus, setDraftStatus] = useState<StudioStatus>(status);
    const [draftSlots, setDraftSlots] = useState(String(maxSlots));
    const [draftWaitlist, setDraftWaitlist] = useState(waitlistOpen);
    const [draftNote, setDraftNote] = useState(statusNote ?? "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const slots = slotState(slotsUsed, Number(draftSlots) || 0, draftStatus);
    const dirty =
        draftStatus !== status ||
        Number(draftSlots) !== maxSlots ||
        draftWaitlist !== waitlistOpen ||
        draftNote !== (statusNote ?? "");

    const save = async () => {
        setBusy(true);
        setError(null);
        const result = await setStudioIntake({
            status: draftStatus,
            maxSlots: Number(draftSlots) || 5,
            waitlistOpen: draftWaitlist,
            statusNote: draftNote.trim() || null,
        });
        setBusy(false);
        if (!result.success) {
            setError(result.error ?? "That didn't save.");
            return;
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        router.refresh();
    };

    return (
        <div>
            <div className="mb-4 flex flex-wrap gap-1.5">
                {(
                    [
                        ["open", "🟢 Open"],
                        ["waitlist", "🟡 Waitlist only"],
                        ["closed", "⚪ Closed"],
                    ] as const
                ).map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        className={`studio-chip ${draftStatus === key ? "active" : ""}`}
                        onClick={() => setDraftStatus(key)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                    <span className="mb-1 block text-sm font-semibold">Slots</span>
                    <Input
                        type="number"
                        min={1}
                        max={20}
                        value={draftSlots}
                        onChange={(e) => setDraftSlots(e.target.value)}
                    />
                    <span className="text-muted-foreground mt-1 block text-xs">
                        How many commissions you&rsquo;ll carry at once. It doesn&rsquo;t force
                        you to take them in order.
                    </span>
                </label>

                <div>
                    <span className="mb-1 block text-sm font-semibold">Right now</span>
                    <SlotMeter used={slots.used} max={slots.max} label={slots.label} />
                    {slots.full && draftStatus === "open" && (
                        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                            Your bench is full, so your page shows as a waitlist. New requests
                            still arrive — you just aren&rsquo;t promising a start date.
                        </p>
                    )}
                </div>
            </div>

            <label className="mb-4 flex cursor-pointer items-start gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={draftWaitlist}
                    onChange={(e) => setDraftWaitlist(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                />
                <span>
                    Take waitlist requests when the bench is full
                    <span className="text-muted-foreground block text-xs">
                        Turning this off hides the request button once you&rsquo;re at capacity.
                    </span>
                </span>
            </label>

            <label className="mb-4 block">
                <span className="mb-1 block text-sm font-semibold">
                    Note on your page <span className="text-muted-foreground">(optional)</span>
                </span>
                <Input
                    type="text"
                    value={draftNote}
                    onChange={(e) => setDraftNote(e.target.value)}
                    placeholder="e.g. Slots open again September 1 — customs only"
                    maxLength={160}
                />
            </label>

            {error && (
                <p className="text-destructive border-destructive/30 bg-destructive/10 mb-4 rounded-md border px-4 py-2 text-sm">
                    {error}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
                <Button onClick={save} disabled={busy || !dirty}>
                    {busy ? "Saving…" : "Save intake settings"}
                </Button>
                {saved && <span className="text-success text-sm">✓ Saved</span>}
            </div>
        </div>
    );
}
