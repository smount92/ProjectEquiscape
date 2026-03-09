"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    addTimelineEvent,
    deleteTimelineEvent,
    updateLifeStage,
} from "@/app/actions/hoofprint";
import type { TimelineEvent, OwnershipRecord } from "@/app/actions/hoofprint";

interface HoofprintTimelineProps {
    horseId: string;
    timeline: TimelineEvent[];
    ownershipChain: OwnershipRecord[];
    lifeStage: string;
    isOwner: boolean;
}

const EVENT_ICONS: Record<string, string> = {
    acquired: "🏠",
    stage_update: "🎨",
    customization: "✂️",
    photo_update: "📸",
    show_result: "🏆",
    listed: "💲",
    sold: "🤝",
    transferred: "📦",
    note: "📝",
    status_change: "🔒",
    condition_change: "📊",
};

const STAGE_LABELS: Record<string, string> = {
    blank: "Blank / Unpainted",
    in_progress: "Work in Progress",
    completed: "Completed",
    for_sale: "Listed for Sale",
    parked: "Parked — Off-Platform Sale",
};

const STAGE_ICONS: Record<string, string> = {
    blank: "🎨",
    in_progress: "🔧",
    completed: "✅",
    for_sale: "💲",
    parked: "🔒",
};

export default function HoofprintTimeline({
    horseId,
    timeline,
    ownershipChain,
    lifeStage,
    isOwner,
}: HoofprintTimelineProps) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [formState, setFormState] = useState({
        eventType: "note",
        title: "",
        description: "",
        eventDate: new Date().toISOString().split("T")[0],
        isPublic: true,
    });
    const [saving, setSaving] = useState(false);
    const [stageUpdating, setStageUpdating] = useState(false);

    const handleAddEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formState.title.trim()) return;
        setSaving(true);
        const result = await addTimelineEvent({
            horseId,
            eventType: formState.eventType,
            title: formState.title.trim(),
            description: formState.description.trim() || undefined,
            eventDate: formState.eventDate || undefined,
            isPublic: formState.isPublic,
        });
        if (result.success) {
            setFormState({ eventType: "note", title: "", description: "", eventDate: new Date().toISOString().split("T")[0], isPublic: true });
            setShowForm(false);
            router.refresh();
        }
        setSaving(false);
    };

    const handleDelete = async (eventId: string) => {
        if (!confirm("Delete this timeline event?")) return;
        await deleteTimelineEvent(eventId, horseId);
        router.refresh();
    };

    const handleStageChange = async (newStage: string) => {
        setStageUpdating(true);
        await updateLifeStage(horseId, newStage as "blank" | "in_progress" | "completed" | "for_sale");
        router.refresh();
        setStageUpdating(false);
    };

    return (
        <div className="hoofprint-section">
            {/* Header */}
            <div className="hoofprint-header">
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                    <h2 className="hoofprint-title">
                        🐾 <span className="text-gradient">Hoofprint™</span>
                    </h2>
                    <span className={`hoofprint-stage-badge stage-${lifeStage}`}>
                        {STAGE_ICONS[lifeStage] || "📋"} {STAGE_LABELS[lifeStage] || lifeStage}
                    </span>
                </div>
                <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
                    {isOwner && (
                        <>
                            <select
                                className="form-input"
                                style={{ width: "auto", minWidth: "140px", fontSize: "calc(0.8rem * var(--font-scale))" }}
                                value={lifeStage}
                                onChange={(e) => handleStageChange(e.target.value)}
                                disabled={stageUpdating}
                            >
                                <option value="blank">🎨 Blank</option>
                                <option value="in_progress">🔧 In Progress</option>
                                <option value="completed">✅ Completed</option>
                                <option value="for_sale">💲 For Sale</option>
                            </select>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setShowForm(!showForm)}
                                style={{ fontSize: "calc(0.8rem * var(--font-scale))" }}
                            >
                                {showForm ? "Cancel" : "＋ Add Event"}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Ownership Chain */}
            {ownershipChain.length > 0 && (
                <div className="ownership-chain">
                    <span style={{ fontSize: "calc(0.75rem * var(--font-scale))", color: "var(--color-text-muted)", marginRight: "var(--space-xs)" }}>
                        Chain of Custody:
                    </span>
                    {ownershipChain.map((owner, i) => (
                        <span key={owner.id} style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-xs)" }}>
                            {i > 0 && <span className="ownership-arrow">→</span>}
                            {owner.ownerId ? (
                                <Link
                                    href={`/profile/${encodeURIComponent(owner.ownerAlias)}`}
                                    className={`ownership-link ${!owner.releasedAt ? "current" : ""}`}
                                >
                                    @{owner.ownerAlias}
                                    <span style={{ fontSize: "0.6rem", opacity: 0.7 }}>
                                        {owner.acquisitionType !== "original" ? ` (${owner.acquisitionType})` : ""}
                                    </span>
                                </Link>
                            ) : (
                                <span className="ownership-link">
                                    {owner.ownerAlias}
                                </span>
                            )}
                        </span>
                    ))}
                </div>
            )}

            {/* Add Event Form */}
            {showForm && (
                <form onSubmit={handleAddEvent} className="timeline-add-form">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
                        <div className="form-group">
                            <label className="form-label">Event Type</label>
                            <select
                                className="form-input"
                                value={formState.eventType}
                                onChange={(e) => setFormState({ ...formState, eventType: e.target.value })}
                            >
                                <option value="note">📝 Note</option>
                                <option value="customization">✂️ Customization</option>
                                <option value="photo_update">📸 Photo Update</option>
                                <option value="show_result">🏆 Show Result</option>
                                <option value="acquired">🏠 Acquired</option>
                                <option value="listed">💲 Listed</option>
                                <option value="sold">🤝 Sold</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Date</label>
                            <input
                                type="date"
                                className="form-input"
                                value={formState.eventDate}
                                onChange={(e) => setFormState({ ...formState, eventDate: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Title</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formState.title}
                            onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                            placeholder="e.g. Won 1st at Breyerfest 2025"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Description (optional)</label>
                        <textarea
                            className="form-input"
                            value={formState.description}
                            onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                            placeholder="Add details..."
                            rows={2}
                        />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", marginTop: "var(--space-sm)" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "calc(0.8rem * var(--font-scale))", cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={formState.isPublic}
                                onChange={(e) => setFormState({ ...formState, isPublic: e.target.checked })}
                            />
                            Public (visible on community passport)
                        </label>
                        <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginLeft: "auto" }}>
                            {saving ? "Saving…" : "Add to Timeline"}
                        </button>
                    </div>
                </form>
            )}

            {/* Timeline */}
            {timeline.length === 0 ? (
                <div style={{ textAlign: "center", padding: "var(--space-xl)", color: "var(--color-text-muted)" }}>
                    <p>🐾 No timeline events yet.</p>
                    {isOwner && <p style={{ fontSize: "calc(0.8rem * var(--font-scale))" }}>Add events to build this horse&apos;s Hoofprint!</p>}
                </div>
            ) : (
                <div className="timeline-list">
                    {timeline.map((event) => (
                        <div key={event.id} className="timeline-event">
                            <div className="timeline-event-dot">
                                {EVENT_ICONS[event.eventType] || "📋"}
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                    <div className="timeline-event-title">
                                        {event.title}
                                        {!event.isPublic && (
                                            <span style={{ fontSize: "0.65rem", marginLeft: "6px", opacity: 0.5 }}>🔒 Private</span>
                                        )}
                                    </div>
                                    <div className="timeline-event-meta">
                                        {event.eventDate && new Date(event.eventDate).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                        {" · "}by @{event.userAlias}
                                    </div>
                                    {event.description && (
                                        <div className="timeline-event-desc">{event.description}</div>
                                    )}
                                </div>
                                {isOwner && (
                                    <button
                                        className="btn btn-ghost"
                                        onClick={() => handleDelete(event.id)}
                                        style={{ fontSize: "0.7rem", padding: "2px 6px", opacity: 0.5 }}
                                        title="Delete event"
                                    >
                                        🗑
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
