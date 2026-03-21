"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEvent } from "@/app/actions/events";

import { EVENT_TYPE_LABELS } from "@/lib/constants/events";

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
    const [judgingMethod, setJudgingMethod] = useState<"community_vote" | "expert_judge">("community_vote");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!startsAt) { setError("Start date/time is required."); return; }
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
            setError(result.error || "Failed to create event");
            setSaving(false);
        }
    }

    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6">
            <div className="page-content max-w-[640]">
                <h1 className="mb-8" >📅 Create Event</h1>

                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-ink mb-1">Event Name *</label>
                        <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Spring Fling Live Show 2026" required />
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-ink mb-1">Event Type *</label>
                        <select className="form-input" value={eventType} onChange={e => setEventType(e.target.value)}>
                            {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-ink mb-1">Judging Method</label>
                        <div className="gap-4" style={{ display: "flex" }}>
                            <label className="gap-1" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                                <input
                                    type="radio"
                                    name="judgingMethod"
                                    value="community_vote"
                                    checked={judgingMethod === "community_vote"}
                                    onChange={() => setJudgingMethod("community_vote")}
                                />
                                🗳️ Community Vote
                            </label>
                            <label className="gap-1" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                                <input
                                    type="radio"
                                    name="judgingMethod"
                                    value="expert_judge"
                                    checked={judgingMethod === "expert_judge"}
                                    onChange={() => setJudgingMethod("expert_judge")}
                                />
                                🏅 Expert Judge
                            </label>
                        </div>
                        <span className="block mt-1 text-xs text-muted">
                            {judgingMethod === "community_vote"
                                ? "Attendees can vote on entries."
                                : "Only the event creator (or assigned judge) can assign placings."}
                        </span>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-ink mb-1">Description</label>
                        <textarea className="block w-full min-h-[var(--inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-min-h)] py-2 px-4 font-sans text-base text-ink bg-input border border-edge-input rounded-md outline-none transition-all duration-150" rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this event about?" style={{ resize: "vertical" }} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-ink mb-1">Start *</label>
                            <input className="form-input" type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} required />
                        </div>
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-ink mb-1">End</label>
                            <input className="form-input" type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
                        </div>
                    </div>

                    <div className="gap-6 m-[var(--space-md) 0]" style={{ display: "flex" }}>
                        <label className="gap-1" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                            <input type="checkbox" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} />
                            All Day
                        </label>
                        <label className="gap-1" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                            <input type="checkbox" checked={isVirtual} onChange={e => setIsVirtual(e.target.checked)} />
                            Virtual Event
                        </label>
                    </div>

                    {isVirtual ? (
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-ink mb-1">Virtual URL</label>
                            <input className="form-input" type="url" value={virtualUrl} onChange={e => setVirtualUrl(e.target.value)} placeholder="https://zoom.us/..." />
                        </div>
                    ) : (
                        <>
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-ink mb-1">Location Name</label>
                                <input className="form-input" value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="Convention Center" />
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-ink mb-1">Address</label>
                                <input className="form-input" value={locationAddress} onChange={e => setLocationAddress(e.target.value)} placeholder="123 Main St, City, State" />
                            </div>
                        </>
                    )}

                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-ink mb-1">Region</label>
                        <input className="form-input" value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Pacific Northwest, Northeast" />
                    </div>

                    {error && <p className="flex items-center gap-2 mt-2 py-2 px-4 bg-[rgba(240,108,126,0.1)] border border-[rgba(240,108,126,0.3)] rounded-md text-danger text-sm">{error}</p>}

                    <div className="gap-2 mt-6" style={{ display: "flex" }}>
                        <button type="submit" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm" disabled={saving || !name.trim()}>
                            {saving ? "Creating..." : "Create Event"}
                        </button>
                        <button type="button" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" onClick={() => router.push("/community/events")}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
