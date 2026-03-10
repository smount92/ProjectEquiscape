"use client";

import { useRouter } from "next/navigation";
import { deleteEvent } from "@/app/actions/events";

export default function EventDeleteButton({ eventId }: { eventId: string }) {
    const router = useRouter();

    return (
        <button
            className="btn btn-ghost"
            style={{ color: "red" }}
            onClick={async () => {
                if (confirm("Delete this event? This cannot be undone.")) {
                    const result = await deleteEvent(eventId);
                    if (result.success) {
                        router.push("/community/events");
                    } else {
                        alert(result.error || "Failed to delete event");
                    }
                }
            }}
        >
            🗑️ Delete Event
        </button>
    );
}
