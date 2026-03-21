"use client";

import { useRouter } from"next/navigation";
import { deleteEvent } from"@/app/actions/events";

export default function EventDeleteButton({ eventId }: { eventId: string }) {
 const router = useRouter();

 return (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 style={{ color:"red" }}
 onClick={async () => {
 if (confirm("Delete this event? This cannot be undone.")) {
 const result = await deleteEvent(eventId);
 if (result.success) {
 router.push("/community/events");
 } else {
 alert(result.error ||"Failed to delete event");
 }
 }
 }}
 >
 🗑️ Delete Event
 </button>
 );
}
