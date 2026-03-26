"use client";

import { useState } from"react";
import Link from"next/link";
import type { ArtistProfile } from"@/app/actions/art-studio";
import { Input } from "@/components/ui/input";

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
 <div className="sticky top-[calc(var(--header-height)+0.75rem)] bg-card border-edge z-[10] mb-8 flex items-center gap-2 rounded-xl border px-6 py-2 shadow-md transition-all max-sm:py-0">
 <Input
 type="text"
 
 placeholder="🔍 Search studios by name, artist, or specialty…"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 id="studio-search"
 />
 </div>

 {/* Filter Chips */}
 <div className="mb-6 flex flex-wrap gap-4">
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
 className="flex h-10 w-full rounded-md border border-edge bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 max-w-[200px]"
 value={specialtyFilter}
 onChange={(e) => setSpecialtyFilter(e.target.value)}
 aria-label="Filter by specialty"
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
 <div className="flex flex-col items-center justify-center rounded-lg border border-edge bg-card p-8 text-center shadow-sm">
 <p>No studios match your search.</p>
 </div>
 ) : (
 <div className="discover-grid max-sm:grid-cols-1">
 {filtered.map((a) => (
 <Link
 key={a.userId}
 href={`/studio/${a.studioSlug}`}
 className="rounded-lg border border-edge bg-card no-underline shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
 >
 <div className="p-5">
 <div className="mb-2 text-base font-semibold text-ink">
 {STATUS_EMOJI[a.status]} {a.studioName}
 </div>
 <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">
 <span>🎨 @{a.ownerAlias}</span>
 {a.priceRangeMin != null && (
 <span>💰 ${a.priceRangeMin}–${a.priceRangeMax}</span>
 )}
 </div>
 {a.specialties.length > 0 && (
 <div className="flex flex-wrap gap-1.5">
 {a.specialties.slice(0, 3).map((s) => (
 <span
 key={s}
 className="rounded-full border border-edge bg-parchment-dark px-2.5 py-0.5 text-xs text-muted"
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
