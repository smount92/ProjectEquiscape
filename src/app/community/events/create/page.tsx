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
        <div className="page-container">
            <div className="page-content" style={{ maxWidth: 640 }}>
                <h1 style={{ marginBottom: "var(--space-xl)" }}>📅 Create Event</h1>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Event Name *</label>
                        <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Spring Fling Live Show 2026" required />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Event Type *</label>
                        <select className="form-input" value={eventType} onChange={e => setEventType(e.target.value)}>
                            {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Judging Method</label>
                        <div style={{ display: "flex", gap: "var(--space-md)" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", cursor: "pointer" }}>
                                <input
                                    type="radio"
                                    name="judgingMethod"
                                    value="community_vote"
                                    checked={judgingMethod === "community_vote"}
                                    onChange={() => setJudgingMethod("community_vote")}
                                />
                                🗳️ Community Vote
                            </label>
                            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", cursor: "pointer" }}>
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
                        <span className="form-hint">
                            {judgingMethod === "community_vote"
                                ? "Attendees can vote on entries."
                                : "Only the event creator (or assigned judge) can assign placings."}
                        </span>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea className="form-textarea" rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this event about?" style={{ resize: "vertical" }} />
                    </div>

                    <div className="form-row-2col">
                        <div className="form-group">
                            <label className="form-label">Start *</label>
                            <input className="form-input" type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">End</label>
                            <input className="form-input" type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "var(--space-lg)", margin: "var(--space-md) 0" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", cursor: "pointer" }}>
                            <input type="checkbox" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} />
                            All Day
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", cursor: "pointer" }}>
                            <input type="checkbox" checked={isVirtual} onChange={e => setIsVirtual(e.target.checked)} />
                            Virtual Event
                        </label>
                    </div>

                    {isVirtual ? (
                        <div className="form-group">
                            <label className="form-label">Virtual URL</label>
                            <input className="form-input" type="url" value={virtualUrl} onChange={e => setVirtualUrl(e.target.value)} placeholder="https://zoom.us/..." />
                        </div>
                    ) : (
                        <>
                            <div className="form-group">
                                <label className="form-label">Location Name</label>
                                <input className="form-input" value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="Convention Center" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Address</label>
                                <input className="form-input" value={locationAddress} onChange={e => setLocationAddress(e.target.value)} placeholder="123 Main St, City, State" />
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <label className="form-label">Region</label>
                        <input className="form-input" value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Pacific Northwest, Northeast" />
                    </div>

                    {error && <p className="form-error">{error}</p>}

                    <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-lg)" }}>
                        <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
                            {saving ? "Creating..." : "Create Event"}
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => router.push("/community/events")}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
