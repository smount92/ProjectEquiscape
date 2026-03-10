"use client";

import { useState } from "react";
import Link from "next/link";
import { rsvpEvent, type MHHEvent } from "@/app/actions/events";
import { useRouter } from "next/navigation";

interface Props {
    events: MHHEvent[];
    typeLabels: Record<string, string>;
}

const TYPE_ICONS: Record<string, string> = {
    live_show: "🏆",
    photo_show: "📸",
    swap_meet: "🔄",
    meetup: "🤝",
    breyerfest: "🎪",
    studio_opening: "🎨",
    auction: "🔨",
    workshop: "🎓",
    other: "📌",
};

export default function EventBrowser({ events, typeLabels }: Props) {
    const router = useRouter();
    const [filter, setFilter] = useState("all");
    const [rsvping, setRsvping] = useState<string | null>(null);

    const filtered = filter === "all" ? events : events.filter(e => e.eventType === filter);

    async function handleRsvp(eventId: string, status: "going" | "interested") {
        setRsvping(eventId);
        await rsvpEvent(eventId, status);
        router.refresh();
        setRsvping(null);
    }

    return (
        <div>
            {/* Type Filter */}
            <div className="studio-chip-grid" style={{ marginBottom: "var(--space-lg)" }}>
                <button className={`studio-chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All</button>
                {Object.entries(typeLabels).map(([key, label]) => (
                    <button key={key} className={`studio-chip ${filter === key ? "active" : ""}`} onClick={() => setFilter(key)}>
                        {TYPE_ICONS[key] || "📌"} {label}
                    </button>
                ))}
            </div>

            {/* Events List */}
            {filtered.length === 0 ? (
                <div className="empty-state"><p>No upcoming events found.</p></div>
            ) : (
                <div className="event-card-grid">
                    {filtered.map(e => {
                        const date = new Date(e.startsAt);
                        const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
                        const day = date.getDate();

                        return (
                            <div key={e.id} className="event-card">
                                <div className="event-card-date">
                                    <span className="event-date-month">{month}</span>
                                    <span className="event-date-day">{day}</span>
                                </div>
                                <div className="event-card-body">
                                    <Link href={`/community/events/${e.id}`} className="event-card-name">
                                        {TYPE_ICONS[e.eventType] || "📌"} {e.name}
                                    </Link>
                                    <div className="event-card-meta">
                                        {e.isVirtual ? "🌐 Virtual" : e.locationName || "Location TBD"}
                                        {e.groupName && <> · 🏛️ {e.groupName}</>}
                                    </div>
                                    <div className="event-card-meta">
                                        {e.isAllDay ? "All Day" : date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                        {" · "}👥 {e.rsvpCount} attending
                                    </div>
                                </div>
                                <div className="event-card-actions">
                                    {e.userRsvp === "going" ? (
                                        <span className="commission-status-badge" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>
                                            ✓ Going
                                        </span>
                                    ) : e.userRsvp === "interested" ? (
                                        <span className="commission-status-badge" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                                            ⭐ Interested
                                        </span>
                                    ) : (
                                        <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                                            <button className="btn btn-primary btn-sm" onClick={() => handleRsvp(e.id, "going")} disabled={rsvping === e.id}>Going</button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleRsvp(e.id, "interested")} disabled={rsvping === e.id}>Interested</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
