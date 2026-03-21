"use client";

import { useRouter } from "next/navigation";
import { deleteEvent } from "@/app/actions/events";

export default function EventDeleteButton({ eventId }: { eventId: string }) {
    const router = useRouter();

    return (
        <button
            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
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
