"use client";

import { useState } from"react";
import { rsvpEvent } from"@/app/actions/events";
import { useRouter } from"next/navigation";

interface Props {
 eventId: string;
 currentStatus: string | null;
}

export default function EventRsvpButton({ eventId, currentStatus }: Props) {
 const router = useRouter();
 const [saving, setSaving] = useState(false);

 async function handleRsvp(status:"going" |"interested" |"not_going") {
 setSaving(true);
 await rsvpEvent(eventId, status);
 router.refresh();
 setSaving(false);
 }

 return (
 <div className="flex flex-wrap gap-2">
 <button
 className={`btn ${currentStatus ==="going" ?"btn-primary" :"btn-ghost"}`}
 onClick={() => handleRsvp("going")}
 disabled={saving}
 >
 ✓ Going
 </button>
 <button
 className={`btn ${currentStatus ==="interested" ?"btn-primary" :"btn-ghost"}`}
 onClick={() => handleRsvp("interested")}
 disabled={saving}
 >
 ⭐ Interested
 </button>
 {currentStatus && currentStatus !=="not_going" && (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => handleRsvp("not_going")}
 disabled={saving}
 >
 ✕ Cancel
 </button>
 )}
 </div>
 );
}
