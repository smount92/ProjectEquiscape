"use client";

import { useState } from"react";
import { useRouter } from"next/navigation";
import { createEvent } from"@/app/actions/events";

import { EVENT_TYPE_LABELS } from"@/lib/constants/events";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function CreateEventPage() {
 const router = useRouter();
 const [name, setName] = useState("");
 const [description, setDescription] = useState("");
 const [eventType, setEventType] = useState("meetup");
 const [startsAt, setStartsAt] = useState("");
 const [endsAt, setEndsAt] = useState("");
 const [isAllDay, setIsAllDay] = useState(false);
 const [isVirtual, setIsVirtual] = useState(false);
 const [locationName, setLocationName] = useState("");
 const [locationAddress, setLocationAddress] = useState("");
 const [region, setRegion] = useState("");
 const [virtualUrl, setVirtualUrl] = useState("");
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState("");
 const [judgingMethod, setJudgingMethod] = useState<"community_vote" |"expert_judge">("community_vote");

 async function handleSubmit(e: React.FormEvent) {
 e.preventDefault();
 if (!startsAt) {
 setError("Start date/time is required.");
 return;
 }
 setSaving(true);
 setError("");

 const result = await createEvent({
 name: name.trim(),
 description: description.trim() || undefined,
 eventType,
 startsAt: new Date(startsAt).toISOString(),
 endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
 isAllDay,
 isVirtual,
 locationName: locationName.trim() || undefined,
 locationAddress: locationAddress.trim() || undefined,
 region: region.trim() || undefined,
 virtualUrl: virtualUrl.trim() || undefined,
 judgingMethod,
 });

 if (result.success && result.eventId) {
 router.push(`/community/events/${result.eventId}`);
 } else {
 setError(result.error ||"Failed to create event");
 setSaving(false);
 }
 }

 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-8">
 <div className="mx-auto max-w-[var(--max-width)] px-6 max-w-[640]">
 <h1 className="mb-8">📅 Create Event</h1>

 <form onSubmit={handleSubmit}>
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Event Name *</label>
 <Input
 
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="Spring Fling Live Show 2026"
 required
 />
 </div>

 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Event Type *</label>
 <select className="flex h-10 w-full rounded-md border border-edge bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" value={eventType} onChange={(e) => setEventType(e.target.value)} title="Event type">
 {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
 <option key={key} value={key}>
 {label}
 </option>
 ))}
 </select>
 </div>

 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Judging Method</label>
 <div className="flex gap-4">
 <label
 className="flex cursor-pointer items-center gap-1"
 >
 <input
 type="radio"
 name="judgingMethod"
 value="community_vote"
 checked={judgingMethod ==="community_vote"}
 onChange={() => setJudgingMethod("community_vote")}
 />
 🗳️ Community Vote
 </label>
 <label
 className="flex cursor-pointer items-center gap-1"
 >
 <input
 type="radio"
 name="judgingMethod"
 value="expert_judge"
 checked={judgingMethod ==="expert_judge"}
 onChange={() => setJudgingMethod("expert_judge")}
 />
 🏅 Expert Judge
 </label>
 </div>
 <span className="text-muted mt-1 block text-xs">
 {judgingMethod ==="community_vote"
 ?"Attendees can vote on entries."
 :"Only the event creator (or assigned judge) can assign placings."}
 </span>
 </div>

 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Description</label>
 <Textarea
 className="w-full resize-y"
 rows={4}
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="What's this event about?"
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Start *</label>
 <Input
 
 type="datetime-local"
 value={startsAt}
 onChange={(e) => setStartsAt(e.target.value)}
 required
 />
 </div>
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">End</label>
 <Input
 
 type="datetime-local"
 value={endsAt}
 onChange={(e) => setEndsAt(e.target.value)}
 />
 </div>
 </div>

 <div className="my-3 flex gap-6">
 <label className="flex cursor-pointer items-center gap-1">
 <input type="checkbox" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} />
 All Day
 </label>
 <label className="flex cursor-pointer items-center gap-1">
 <input
 type="checkbox"
 checked={isVirtual}
 onChange={(e) => setIsVirtual(e.target.checked)}
 />
 Virtual Event
 </label>
 </div>

 {isVirtual ? (
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Virtual URL</label>
 <Input
 
 type="url"
 value={virtualUrl}
 onChange={(e) => setVirtualUrl(e.target.value)}
 placeholder="https://zoom.us/..."
 />
 </div>
 ) : (
 <>
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Location Name</label>
 <Input
 
 value={locationName}
 onChange={(e) => setLocationName(e.target.value)}
 placeholder="Convention Center"
 />
 </div>
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Address</label>
 <Input
 
 value={locationAddress}
 onChange={(e) => setLocationAddress(e.target.value)}
 placeholder="123 Main St, City, State"
 />
 </div>
 </>
 )}

 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Region</label>
 <Input
 
 value={region}
 onChange={(e) => setRegion(e.target.value)}
 placeholder="e.g. Pacific Northwest, Northeast"
 />
 </div>

 {error && (
 <p className="text-danger mt-2 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm">
 {error}
 </p>
 )}

 <div className="mt-6 flex gap-2">
 <button
 type="submit"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 disabled={saving || !name.trim()}
 >
 {saving ?"Creating..." :"Create Event"}
 </button>
 <button
 type="button"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => router.push("/community/events")}
 >
 Cancel
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}
