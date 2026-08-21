"use client";

/**
 * The RSVP control on an event page — Going / Interested, with live
 * counts on the buttons themselves so the page reads at a glance the
 * way a Facebook event does. Clicking your current status clears it.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

import { rsvpEvent } from "@/app/actions/events";
import { Button } from "@/components/ui/button";

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
            <p className="m-0 text-sm text-muted-foreground">
                This event has passed — {goingCount} went, {interestedCount} were interested.
            </p>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Button
                variant={currentStatus === "going" ? "default" : "outline"}
                aria-pressed={currentStatus === "going"}
                disabled={saving}
                onClick={() => set("going")}
            >
                ✓ Going
                <span className="ml-1 tabular-nums opacity-70">{goingCount}</span>
            </Button>
            <Button
                variant={currentStatus === "interested" ? "default" : "outline"}
                aria-pressed={currentStatus === "interested"}
                disabled={saving}
                onClick={() => set("interested")}
            >
                ⭐ Interested
                <span className="ml-1 tabular-nums opacity-70">{interestedCount}</span>
            </Button>
            {currentStatus && currentStatus !== "not_going" && (
                <span className="text-xs text-muted-foreground">
                    Tap again to change your mind.
                </span>
            )}
        </div>
    );
}
