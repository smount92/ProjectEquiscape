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
    currentUserId?: string;
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
    stripped: "Stripped / Body",
    in_progress: "Work in Progress",
    completed: "Completed",
    for_sale: "Listed for Sale",
    parked: "Parked — Off-Platform Sale",
};

const STAGE_ICONS: Record<string, string> = {
    blank: "🎨",
    stripped: "🛁",
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
    currentUserId,
}: HoofprintTimelineProps) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [formState, setFormState] = useState({
        title: "",
        description: "",
    });
    const [saving, setSaving] = useState(false);
    const [stageUpdating, setStageUpdating] = useState(false);

    const handleAddEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formState.title.trim()) return;
        setSaving(true);
        const result = await addTimelineEvent({
            horseId,
            eventType: "note",
            title: formState.title.trim(),
            description: formState.description.trim() || undefined,
        });
        if (result.success) {
            setFormState({ title: "", description: "" });
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
        await updateLifeStage(horseId, newStage as "blank" | "stripped" | "in_progress" | "completed" | "for_sale");
        router.refresh();
        setStageUpdating(false);
    };

    return (
        <div className="mt-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
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
                                <option value="stripped">🛁 Stripped / Body</option>
                                <option value="in_progress">🔧 In Progress</option>
                                <option value="completed">✅ Completed</option>
                                <option value="for_sale">💲 For Sale</option>
                            </select>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setShowForm(!showForm)}
                                style={{ fontSize: "calc(0.8rem * var(--font-scale))" }}
                            >
                                {showForm ? "Cancel" : "📝 Add Note"}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Ownership Chain */}
            {ownershipChain.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mb-6 p-4 rounded-lg bg-[rgba(0, 0, 0, 0.03)] border border-[rgba(0, 0, 0, 0.06)]">
                    <span style={{ fontSize: "calc(0.75rem * var(--font-scale))", color: "var(--color-text-muted)", marginRight: "var(--space-xs)" }}>
                        Chain of Custody:
                    </span>
                    {ownershipChain.map((owner, i) => (
                        <span key={owner.id} style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-xs)" }}>
                            {i > 0 && <span className="text-muted text-[0.8rem]">→</span>}
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
                                <span className="border border-[var(--color-accent, #f59e0b)]">
                                    {owner.ownerAlias}
                                </span>
                            )}
                        </span>
                    ))}
                </div>
            )}

            {/* Add Event Form */}
            {showForm && (
                <form onSubmit={handleAddEvent} className="p-4 rounded-lg bg-[rgba(0, 0, 0, 0.03)] border border-[rgba(0, 0, 0, 0.06)] mb-6">
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
                        <span style={{ fontSize: "calc(var(--font-size-xs) * var(--font-scale))", color: "var(--color-text-muted)" }}>
                            📝 Notes appear on the Hoofprint™ timeline
                        </span>
                        <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginLeft: "auto" }}>
                            {saving ? "Saving…" : "Add Note"}
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
                <div className="relative pl-[32px]">
                    {timeline.map((event) => (
                        <div key={event.id} className="relative pb-6">
                            <div className="relative pb-6-dot">
                                {EVENT_ICONS[event.eventType] || "📋"}
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                    <div className="relative pb-6-title">
                                        {event.title}
                                        {!event.isPublic && (
                                            <span style={{ fontSize: "0.65rem", marginLeft: "6px", opacity: 0.5 }}>🔒 Private</span>
                                        )}
                                    </div>
                                    <div className="relative pb-6-meta">
                                        {event.eventDate && new Date(event.eventDate).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                        {" · "}by @{event.userAlias}
                                    </div>
                                    {event.description && (
                                        <div className="relative pb-6-desc">{event.description}</div>
                                    )}
                                </div>
                                {/* Only user-authored notes (from posts) can be deleted */}
                                {isOwner && currentUserId && event.userId === currentUserId && event.sourceTable === "posts" && (
                                    <button
                                        className="btn btn-ghost"
                                        onClick={() => handleDelete(event.id)}
                                        style={{ fontSize: "0.7rem", padding: "2px 6px", opacity: 0.5 }}
                                        title="Delete note"
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
