"use client";

import { useState } from"react";
import Link from"next/link";
import type { ArtistProfile } from"@/app/actions/art-studio";

const STATUS_EMOJI: Record<string, string> = { open:"🟢", waitlist:"🟡", closed:"🔴" };
const STATUS_LABEL: Record<string, string> = { open:"Open", waitlist:"Waitlist", closed:"Closed" };

export default function ArtistBrowser({ artists }: { artists: ArtistProfile[] }) {
 const [search, setSearch] = useState("");
 const [statusFilter, setStatusFilter] = useState("all");
 const [specialtyFilter, setSpecialtyFilter] = useState("all");

 // Collect unique specialties from all artists
 const allSpecialties = [...new Set(artists.flatMap((a) => a.specialties))].sort();

 const filtered = artists
 .filter((a) => statusFilter ==="all" || a.status === statusFilter)
 .filter((a) => specialtyFilter ==="all" || a.specialties.includes(specialtyFilter))
 .filter(
 (a) =>
 !search ||
 a.studioName.toLowerCase().includes(search.toLowerCase()) ||
 a.ownerAlias.toLowerCase().includes(search.toLowerCase()) ||
 a.specialties.some((s) => s.toLowerCase().includes(search.toLowerCase())),
 );

 return (
 <div className="animate-fade-in-up">
 {/* Search */}
 <div className="sticky top-[calc(var(--header-height)+var(--space-md))] bg-card border-edge z-[10] mb-8 flex items-center gap-2 rounded-xl border px-6 py-2 shadow-md transition-all max-sm:py-[0]">
 <input
 type="text"
 className="form-input"
 placeholder="🔍 Search studios by name, artist, or specialty…"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 id="studio-search"
 />
 </div>

 {/* Filter Chips */}
 <div className="mb-6 gap-4" style={{ display:"flex", flexWrap:"wrap" }}>
 <div className="flex flex-wrap gap-1">
 <button
 className={`studio-chip ${statusFilter ==="all" ?"active" :""}`}
 onClick={() => setStatusFilter("all")}
 >
 All Status
 </button>
 {(["open","waitlist","closed"] as const).map((s) => (
 <button
 key={s}
 className={`studio-chip ${statusFilter === s ?"active" :""}`}
 onClick={() => setStatusFilter(s)}
 >
 {STATUS_EMOJI[s]} {STATUS_LABEL[s]}
 </button>
 ))}
 </div>
 {allSpecialties.length > 0 && (
 <select
 className="form-select"
 value={specialtyFilter}
 onChange={(e) => setSpecialtyFilter(e.target.value)}
 style={{ maxWidth: 200 }}
 >
 <option value="all">All Specialties</option>
 {allSpecialties.map((s) => (
 <option key={s} value={s}>
 {s}
 </option>
 ))}
 </select>
 )}
 </div>

 {/* Results */}
 {filtered.length === 0 ? (
 <div className="empty-state">
 <p>No studios match your search.</p>
 </div>
 ) : (
 <div className="discover-grid max-sm:grid-cols-1">
 {filtered.map((a) => (
 <Link
 key={a.userId}
 href={`/studio/${a.studioSlug}`}
 className="discover-bg-card border-edge rounded-lg border shadow-md transition-all"
 style={{ textDecoration:"none" }}
 >
 <div className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all">
 <div className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all">
 {STATUS_EMOJI[a.status]} {a.studioName}
 </div>
 <div className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all">
 <span>🎨 @{a.ownerAlias}</span>
 {a.priceRangeMin != null && (
 <span>
 💰 ${a.priceRangeMin}–${a.priceRangeMax}
 </span>
 )}
 </div>
 {a.specialties.length > 0 && (
 <div className="mt-1 gap-[4]" style={{ display:"flex", flexWrap:"wrap" }}>
 {a.specialties.slice(0, 3).map((s) => (
 <span
 key={s}
 className="border-edge bg-card text-ink-light p-[2px 6px] cursor-pointer rounded-full border px-[14px] py-[6px] text-[0.7rem] text-[calc(0.8rem*var(--font-scale))] transition-all"
 >
 {s}
 </span>
 ))}
 </div>
 )}
 </div>
 </Link>
 ))}
 </div>
 )}
 </div>
 );
}
