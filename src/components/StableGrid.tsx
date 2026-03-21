"use client";

import { useState, useMemo } from"react";
import Link from"next/link";
import SearchBar from"@/components/SearchBar";

interface HorseCardData {
 id: string;
 customName: string;
 finishType: string;
 conditionGrade: string;
 createdAt: string;
 refName: string;
 releaseLine: string | null;
 thumbnailUrl: string | null;
 collectionName: string | null;
 sculptor: string | null;
 tradeStatus: string;
 moldName: string | null;
 releaseName: string | null;
 assetCategory?: string;
}

function getFinishBadgeClass(finishType: string): string {
 switch (finishType) {
 case"OF":
 return"of";
 case"Custom":
 return"custom";
 case"Artist Resin":
 return"resin";
 default:
 return"";
 }
}

function formatDate(dateStr: string): string {
 return new Date(dateStr).toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 year:"numeric",
 });
}

export default function StableGrid({
 horseCards,
 selectMode = false,
 selectedIds = new Set(),
 onToggleSelect,
}: {
 horseCards: HorseCardData[];
 selectMode?: boolean;
 selectedIds?: Set<string>;
 onToggleSelect?: (id: string) => void;
}) {
 const [searchQuery, setSearchQuery] = useState("");
 const [sortBy, setSortBy] = useState<"newest" |"oldest" |"name-az" |"name-za" |"condition">("newest");

 const CONDITION_ORDER = ["Mint","Near Mint","Excellent","Very Good","Good","Fair","Poor","Play Grade"];

 const filteredCards = useMemo(() => {
 // Step 1: Filter
 let filtered = horseCards;
 if (searchQuery.trim()) {
 const q = searchQuery.toLowerCase().trim();
 filtered = horseCards.filter(
 (horse) =>
 horse.customName.toLowerCase().includes(q) ||
 (horse.moldName && horse.moldName.toLowerCase().includes(q)) ||
 (horse.releaseName && horse.releaseName.toLowerCase().includes(q)) ||
 (horse.sculptor && horse.sculptor.toLowerCase().includes(q)) ||
 horse.refName.toLowerCase().includes(q),
 );
 }

 // Step 2: Sort
 const sorted = [...filtered];
 if (sortBy ==="oldest") {
 sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
 } else if (sortBy ==="name-az") {
 sorted.sort((a, b) => a.customName.localeCompare(b.customName));
 } else if (sortBy ==="name-za") {
 sorted.sort((a, b) => b.customName.localeCompare(a.customName));
 } else if (sortBy ==="condition") {
 sorted.sort((a, b) => {
 const aIdx = CONDITION_ORDER.indexOf(a.conditionGrade);
 const bIdx = CONDITION_ORDER.indexOf(b.conditionGrade);
 return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
 });
 }
 //"newest" is the default server order — no re-sort needed
 return sorted;
 }, [searchQuery, horseCards, sortBy, CONDITION_ORDER]);

 return (
 <>
 {horseCards.length > 0 && (
 <div className="mb-4 gap-4" style={{ display:"flex", alignItems:"center", flexWrap:"wrap" }}>
 <div className="min-w-[200px] flex-1">
 <SearchBar
 value={searchQuery}
 onChange={setSearchQuery}
 placeholder="Search your stable by name, mold, release, or sculptor…"
 id="stable-search-bar"
 />
 </div>
 <select
 value={sortBy}
 onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
 className="form-input"
 style={{
 width:"auto",
 minWidth:"160px",
 fontSize:"calc(var(--font-size-sm) * var(--font-scale))",
 }}
 id="stable-sort"
 aria-label="Sort your stable"
 >
 <option value="newest">🕐 Newest First</option>
 <option value="oldest">🕐 Oldest First</option>
 <option value="name-az">🔤 Name A→Z</option>
 <option value="name-za">🔤 Name Z→A</option>
 <option value="condition">⭐ By Condition</option>
 </select>
 </div>
 )}

 {searchQuery.trim() && (
 <div className="text-muted mb-6 pl-1 text-sm">
 {filteredCards.length === 0
 ?"No models match your search"
 : `Showing ${filteredCards.length} of ${horseCards.length} models`}
 </div>
 )}

 {filteredCards.length === 0 && !searchQuery.trim() ? (
 <div className="bg-card border-edge rounded-lg border px-8 py-[var(--space-3xl)] text-center shadow-md transition-all">
 <div className="mb-4 text-5xl">🏠</div>
 <h2>Your Stable is Empty</h2>
 <p>You haven&apos;t added any models yet. Click the button above to catalog your first horse!</p>
 <Link
 href="/add-horse"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 id="add-first-horse"
 >
 🐴 Add Your First Horse
 </Link>
 </div>
 ) : filteredCards.length === 0 && searchQuery.trim() ? (
 <div className="bg-card border-edge rounded-lg border px-8 py-[var(--space-3xl)] text-center shadow-md transition-all">
 <div className="mb-4 text-5xl">🔍</div>
 <h2>No Results</h2>
 <p>No models match &ldquo;{searchQuery}&rdquo;. Try a different search term.</p>
 </div>
 ) : (
 <div className="grid-cols-[repeat(auto-fill,minmax(280px,1fr))] grid gap-6">
 {filteredCards.map((horse) => {
 const isSelected = selectedIds.has(horse.id);
 const CardWrapper = selectMode ?"div" : Link;
 const wrapperProps = selectMode
 ? {
 onClick: () => onToggleSelect?.(horse.id),
 className: `horse-card ${isSelected ?"horse-card-selected" :""}`,
 id: `horse-card-${horse.id}`,
 }
 : { href: `/stable/${horse.id}`, className:"horse-card", id: `horse-card-${horse.id}` };
 return (
 // @ts-expect-error — dynamic component type
 <CardWrapper key={horse.id} {...wrapperProps}>
 {selectMode && (
 <div className="pointer-events-none absolute top-[8px] left-[8px] z-[5]">
 <input type="checkbox" checked={isSelected} readOnly />
 </div>
 )}
 <div className="h-full w-full object-contain transition-transform">
 {horse.thumbnailUrl ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img src={horse.thumbnailUrl} alt={horse.customName} loading="lazy" />
 ) : (
 <div className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all">
 <span className="flex items-center justify-center rounded-lg border border-edge bg-card text-4xl shadow-md">
 🐴
 </span>
 <span>No photo</span>
 </div>
 )}
 {horse.finishType && (
 <span className={`horse-card-badge ${getFinishBadgeClass(horse.finishType)}`}>
 {horse.finishType}
 </span>
 )}
 {horse.assetCategory && horse.assetCategory !=="model" && (
 <span className="absolute top-2 right-2 rounded-md bg-[rgba(124,109,240,0.15)] px-2 py-0.5 text-xs font-bold text-white">
 {horse.assetCategory ==="tack"
 ?"🏇 Tack"
 : horse.assetCategory ==="prop"
 ?"🌲 Prop"
 :"🎭 Diorama"}
 </span>
 )}
 {horse.tradeStatus ==="For Sale" && (
 <span className="trade-badge border border-[rgba(34,197,94,0.5)] bg-[rgba(34,197,94,0.85)] text-white">
 💲 For Sale
 </span>
 )}
 {horse.tradeStatus ==="Open to Offers" && (
 <span className="trade-badge border border-[rgba(59,130,246,0.5)] bg-[rgba(59,130,246,0.85)] text-white">
 🤝 Open to Offers
 </span>
 )}
 </div>
 <div className="px-6 py-4">
 <div className="truncate text-sm font-semibold">
 {horse.customName}
 </div>
 <div className="overflow-hidden text-sm text-ellipsis whitespace-nowrap text-[var(--color-text-secondary)]">
 {horse.refName}
 </div>
 {horse.releaseLine && (
 <div className="mt-[2px] overflow-hidden text-sm text-[calc(0.7rem*var(--font-scale))] text-ellipsis whitespace-nowrap text-[var(--color-text-secondary)] opacity-[0.7]">
 🎨 {horse.releaseLine}
 </div>
 )}
 {horse.sculptor && (
 <div className="mt-[2px] overflow-hidden text-sm text-[calc(0.7rem*var(--font-scale))] text-ellipsis whitespace-nowrap text-[var(--color-text-secondary)] opacity-[0.7]">
 ✂️ {horse.sculptor}
 </div>
 )}
 <div className="border-edge text-muted mt-2 flex items-center justify-between border-t pt-2 text-xs">
 {horse.conditionGrade && <span>{horse.conditionGrade}</span>}
 <span>{formatDate(horse.createdAt)}</span>
 </div>
 {horse.collectionName && (
 <div className="mt-1 truncate text-xs text-muted">
 📁 {horse.collectionName}
 </div>
 )}
 </div>
 </CardWrapper>
 );
 })}
 </div>
 )}
 </>
 );
}
