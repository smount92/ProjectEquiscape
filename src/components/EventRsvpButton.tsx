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
        <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
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
                    className="btn btn-ghost"
                    onClick={() => handleRsvp("not_going")}
                    disabled={saving}
                >
                    ✕ Cancel
                </button>
            )}
        </div>
    );
}
