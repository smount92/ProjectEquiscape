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
    const [search, setSearch] = useState("");
    const [rsvping, setRsvping] = useState<string | null>(null);

    const filtered = events
        .filter(e => filter === "all" || e.eventType === filter)
        .filter(e => !search
            || e.name.toLowerCase().includes(search.toLowerCase())
            || e.locationName?.toLowerCase().includes(search.toLowerCase())
            || e.groupName?.toLowerCase().includes(search.toLowerCase()));

    async function handleRsvp(eventId: string, status: "going" | "interested") {
        setRsvping(eventId);
        await rsvpEvent(eventId, status);
        router.refresh();
        setRsvping(null);
    }

    return (
        <div>
            {/* Search */}
            <div className="sticky top-[calc(var(--header-height) + var(--space-md))] z-[10] flex items-center gap-2 py-2 px-6 mb-8 bg-card border border-edge rounded-xl transition-all shadow-md" style={{ marginBottom: "var(--space-md)" }}>
                <input
                    type="text"
                    className="form-input"
                    placeholder="🔍 Search events by name, location, or group…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    id="event-search"
                />
            </div>

            {/* Type Filter */}
            <div className="flex flex-wrap gap-1" style={{ marginBottom: "var(--space-lg)" }}>
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
                <div className="grid gap-4">
                    {filtered.map(e => {
                        const date = new Date(e.startsAt);
                        const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
                        const day = date.getDate();

                        return (
                            <div key={e.id} className="flex gap-6 p-6 rounded-lg bg-elevated border border-edge items-center transition-colors">
                                <div className="flex gap-6 p-6 rounded-lg bg-elevated border border-edge items-center transition-colors-date">
                                    <span className="text-[calc(0.6rem*var(--font-scale))] font-bold text-[#2C5545] uppercase tracking-[0.05em]">{month}</span>
                                    <span className="text-[calc(1.2rem*var(--font-scale))] font-extrabold text-ink leading-none">{day}</span>
                                </div>
                                <div className="flex gap-6 p-6 rounded-lg bg-elevated border border-edge items-center transition-colors-body">
                                    <Link href={`/community/events/${e.id}`} className="flex gap-6 p-6 rounded-lg bg-elevated border border-edge items-center transition-colors-name">
                                        {TYPE_ICONS[e.eventType] || "📌"} {e.name}
                                    </Link>
                                    <div className="flex gap-6 p-6 rounded-lg bg-elevated border border-edge items-center transition-colors-meta">
                                        {e.isVirtual ? "🌐 Virtual" : e.locationName || "Location TBD"}
                                        {e.groupName && <> · 🏛️ {e.groupName}</>}
                                    </div>
                                    <div className="flex gap-6 p-6 rounded-lg bg-elevated border border-edge items-center transition-colors-meta">
                                        {e.isAllDay ? "All Day" : date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                        {" · "}👥 {e.rsvpCount} attending
                                    </div>
                                </div>
                                <div className="flex gap-6 p-6 rounded-lg bg-elevated border border-edge items-center transition-colors-actions">
                                    {e.userRsvp === "going" ? (
                                        <span className="inline-flex items-center py-[3px] px-[10px] rounded-full text-[calc(0.7rem*var(--font-scale))] font-semibold whitespace-nowrap" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>
                                            ✓ Going
                                        </span>
                                    ) : e.userRsvp === "interested" ? (
                                        <span className="inline-flex items-center py-[3px] px-[10px] rounded-full text-[calc(0.7rem*var(--font-scale))] font-semibold whitespace-nowrap" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                                            ⭐ Interested
                                        </span>
                                    ) : (
                                        <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                                            <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm min-h-[36px] py-1 px-6 text-sm" onClick={() => handleRsvp(e.id, "going")} disabled={rsvping === e.id}>Going</button>
                                            <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm" onClick={() => handleRsvp(e.id, "interested")} disabled={rsvping === e.id}>Interested</button>
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
