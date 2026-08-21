"use client";

/**
 * The RSVP control on an event page — Going / Interested, with live
 * counts on the buttons themselves so the page reads at a glance the
 * way a Facebook event does. Clicking your current status clears it.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

import { rsvpEvent } from "@/app/actions/events";

/** House pill: quiet by default, toned forest once it's your answer. */
const RSVP_BTN =
    "inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border px-4 py-2 font-serif text-[0.8rem] font-bold tracking-[0.1em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60";

interface Props {
    eventId: string;
    currentStatus: string | null;
    goingCount: number;
    interestedCount: number;
    /** Past events show the counts but can't be RSVP'd to. */
    closed?: boolean;
}

export default function EventRsvpBar({
    eventId,
    currentStatus,
    goingCount,
    interestedCount,
    closed = false,
}: Props) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);

    async function set(status: "going" | "interested") {
        setSaving(true);
        // Clicking your current status is a toggle-off.
        await rsvpEvent(eventId, currentStatus === status ? "not_going" : status);
        router.refresh();
        setSaving(false);
    }

    if (closed) {
        return (
            <p className="text-muted-foreground m-0 text-sm italic">
                This event has passed — {goingCount} went, {interestedCount} were interested.
            </p>
        );
    }

    const going = currentStatus === "going";
    const interested = currentStatus === "interested";

    return (
        <div className="flex flex-wrap items-center gap-2">
            <button
                type="button"
                className={`${RSVP_BTN} ${
                    going
                        ? "border-forest bg-forest text-white"
                        : "border-forest/35 text-forest hover:bg-forest/10 bg-transparent"
                }`}
                aria-pressed={going}
                disabled={saving}
                onClick={() => set("going")}
            >
                ✓ Going
                <span className="tabular-nums opacity-75">{goingCount}</span>
            </button>
            <button
                type="button"
                className={`${RSVP_BTN} ${
                    interested
                        ? "border-warning bg-warning/15 text-warning"
                        : "border-input text-secondary-foreground hover:bg-warning/10 bg-transparent"
                }`}
                aria-pressed={interested}
                disabled={saving}
                onClick={() => set("interested")}
            >
                ⭐ Interested
                <span className="tabular-nums opacity-75">{interestedCount}</span>
            </button>
            {currentStatus && currentStatus !== "not_going" && (
                <span className="text-muted-foreground text-xs italic">
                    Tap again to change your mind.
                </span>
            )}
        </div>
    );
}
