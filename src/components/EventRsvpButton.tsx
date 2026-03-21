"use client";

import { useState } from "react";
import { rsvpEvent } from "@/app/actions/events";
import { useRouter } from "next/navigation";

interface Props {
    eventId: string;
    currentStatus: string | null;
}

export default function EventRsvpButton({ eventId, currentStatus }: Props) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);

    async function handleRsvp(status: "going" | "interested" | "not_going") {
        setSaving(true);
        await rsvpEvent(eventId, status);
        router.refresh();
        setSaving(false);
    }

    return (
        <div className="gap-2" style={{ display: "flex", flexWrap: "wrap" }}>
            <button
                className={`btn ${currentStatus === "going" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => handleRsvp("going")}
                disabled={saving}
            >
                ✓ Going
            </button>
            <button
                className={`btn ${currentStatus === "interested" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => handleRsvp("interested")}
                disabled={saving}
            >
                ⭐ Interested
            </button>
            {currentStatus && currentStatus !== "not_going" && (
                <button
                    className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
                    onClick={() => handleRsvp("not_going")}
                    disabled={saving}
                >
                    ✕ Cancel
                </button>
            )}
        </div>
    );
}
