"use client";

import { useRouter } from "next/navigation";
import { deleteEvent } from "@/app/actions/events";

export default function EventDeleteButton({ eventId }: { eventId: string }) {
    const router = useRouter();

    return (
        <button
            className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
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
