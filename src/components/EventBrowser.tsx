"use client";

import { useState } from"react";
import Link from"next/link";
import { rsvpEvent, type MHHEvent } from"@/app/actions/events";
import { useRouter } from"next/navigation";

interface Props {
 events: MHHEvent[];
 typeLabels: Record<string, string>;
}

const TYPE_ICONS: Record<string, string> = {
 live_show:"🏆",
 photo_show:"📸",
 swap_meet:"🔄",
 meetup:"🤝",
 breyerfest:"🎪",
 studio_opening:"🎨",
 auction:"🔨",
 workshop:"🎓",
 other:"📌",
};

export default function EventBrowser({ events, typeLabels }: Props) {
 const router = useRouter();
 const [filter, setFilter] = useState("all");
 const [search, setSearch] = useState("");
 const [rsvping, setRsvping] = useState<string | null>(null);

 const filtered = events
 .filter((e) => filter ==="all" || e.eventType === filter)
 .filter(
 (e) =>
 !search ||
 e.name.toLowerCase().includes(search.toLowerCase()) ||
 e.locationName?.toLowerCase().includes(search.toLowerCase()) ||
 e.groupName?.toLowerCase().includes(search.toLowerCase()),
 );

 async function handleRsvp(eventId: string, status:"going" |"interested") {
 setRsvping(eventId);
 await rsvpEvent(eventId, status);
 router.refresh();
 setRsvping(null);
 }

 return (
 <div>
 {/* Search */}
 <div className="sticky top-[calc(var(--header-height)+0.75rem)] bg-card border-edge z-[10] mb-8 flex items-center gap-2 rounded-xl border px-6 py-2 shadow-md transition-all max-sm:py-0">
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
 <div className="mb-6 flex flex-wrap gap-1">
 <button className={`studio-chip ${filter ==="all" ?"active" :""}`} onClick={() => setFilter("all")}>
 All
 </button>
 {Object.entries(typeLabels).map(([key, label]) => (
 <button
 key={key}
 className={`studio-chip ${filter === key ?"active" :""}`}
 onClick={() => setFilter(key)}
 >
 {TYPE_ICONS[key] ||"📌"} {label}
 </button>
 ))}
 </div>

 {/* Events List */}
 {filtered.length === 0 ? (
 <div className="flex flex-col items-center justify-center rounded-lg border border-edge bg-card p-8 text-center shadow-sm">
 <p>No upcoming events found.</p>
 </div>
 ) : (
 <div className="grid gap-4">
 {filtered.map((e) => {
 const date = new Date(e.startsAt);
 const month = date.toLocaleDateString("en-US", { month:"short" }).toUpperCase();
 const day = date.getDate();

 return (
 <div
 key={e.id}
 className="bg-elevated border-edge flex items-center gap-6 rounded-lg border p-6 transition-colors"
 >
 <div className="bg-elevated border-edge transition-colors-date flex items-center gap-6 rounded-lg border p-6">
 <span className="text-xs font-bold tracking-[0.05em] text-[#2C5545] uppercase">
 {month}
 </span>
 <span className="text-ink text-xl leading-none font-extrabold">
 {day}
 </span>
 </div>
 <div className="bg-elevated border-edge transition-colors-body flex items-center gap-6 rounded-lg border p-6">
 <Link
 href={`/community/events/${e.id}`}
 className="bg-elevated border-edge transition-colors-name flex items-center gap-6 rounded-lg border p-6"
 >
 {TYPE_ICONS[e.eventType] ||"📌"} {e.name}
 </Link>
 <div className="bg-elevated border-edge transition-colors-meta flex items-center gap-6 rounded-lg border p-6">
 {e.isVirtual ?"🌐 Virtual" : e.locationName ||"Location TBD"}
 {e.groupName && <> · 🏛️ {e.groupName}</>}
 </div>
 <div className="bg-elevated border-edge transition-colors-meta flex items-center gap-6 rounded-lg border p-6">
 {e.isAllDay
 ?"All Day"
 : date.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" })}
 {" ·"}👥 {e.rsvpCount} attending
 </div>
 </div>
 <div className="bg-elevated border-edge transition-colors-actions flex items-center gap-6 rounded-lg border p-6">
 {e.userRsvp ==="going" ? (
 <span
 className="inline-flex items-center rounded-full border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.12)] px-[10px] py-[3px] text-xs font-semibold whitespace-nowrap text-[#22c55e]"
 >
 ✓ Going
 </span>
 ) : e.userRsvp ==="interested" ? (
 <span
 className="inline-flex items-center rounded-full border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.12)] px-[10px] py-[3px] text-xs font-semibold whitespace-nowrap text-[#f59e0b]"
 >
 ⭐ Interested
 </span>
 ) : (
 <div className="flex gap-1">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={() => handleRsvp(e.id,"going")}
 disabled={rsvping === e.id}
 >
 Going
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => handleRsvp(e.id,"interested")}
 disabled={rsvping === e.id}
 >
 Interested
 </button>
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
