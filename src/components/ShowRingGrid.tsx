"use client";

import { useState, useMemo, useCallback } from"react";
import { useRouter, useSearchParams } from"next/navigation";
import Link from"next/link";
import ShowRingFilters from"@/components/ShowRingFilters";
import type { FilterState } from"@/components/ShowRingFilters";
import WishlistButton from"@/components/WishlistButton";
import FavoriteButton from"@/components/FavoriteButton";
import { Input } from "@/components/ui/input";

interface CommunityCardData {
 id: string;
 ownerId: string;
 customName: string;
 finishType: string;
 conditionGrade: string;
 createdAt: string;
 refName: string;
 releaseLine: string | null;
 ownerAlias: string;
 thumbnailUrl: string | null;
 sculptor: string | null;
 tradeStatus: string;
 listingPrice: number | null;
 marketplaceNotes: string | null;
 moldName: string | null;
 releaseName: string | null;
 refMoldId: string | null;
 catalogId: string | null;
 favoriteCount: number;
 isFavorited: boolean;
 scale: string | null;
 hoofprintCount?: number;
 assetCategory?: string;
}

function getFinishBadgeClass(finish: string): string {
 switch (finish) {
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

function timeAgo(dateStr: string): string {
 const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
 if (seconds < 60) return"Just now";
 const minutes = Math.floor(seconds / 60);
 if (minutes < 60) return `${minutes}m ago`;
 const hours = Math.floor(minutes / 60);
 if (hours < 24) return `${hours}h ago`;
 const days = Math.floor(hours / 24);
 if (days < 30) return `${days}d ago`;
 return new Date(dateStr).toLocaleDateString("en-US", { month:"short", day:"numeric" });
}

function formatPrice(price: number | null): string | null {
 if (price === null || price === undefined) return null;
 return `$${price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function ShowRingGrid({ communityCards }: { communityCards: CommunityCardData[] }) {
 const router = useRouter();
 const currentParams = useSearchParams();

 // Read current URL state for search bar local display
 const [searchInput, setSearchInput] = useState(currentParams.get("q") ||"");

 // Build filter state from URL
 const filters: FilterState = {
 finishType: currentParams.get("finishType") || null,
 tradeStatus: currentParams.get("tradeStatus") || null,
 manufacturer: null,
 scale: null,
 sortBy: (currentParams.get("sortBy") ||"newest") as"newest" |"oldest" |"most-favorited",
 };

 // Push filters to URL (triggers server re-render)
 const pushParams = useCallback(
 (updates: Record<string, string | null>) => {
 const params = new URLSearchParams(currentParams.toString());
 for (const [key, val] of Object.entries(updates)) {
 if (val && val !=="all") {
 params.set(key, val);
 } else {
 params.delete(key);
 }
 }
 router.push(`/community?${params.toString()}`);
 },
 [currentParams, router],
 );

 const handleSearch = useCallback((q: string) => {
 setSearchInput(q);
 }, []);

 const handleSearchSubmit = useCallback(() => {
 pushParams({ q: searchInput.trim() || null });
 }, [searchInput, pushParams]);

 const handleFilterChange = useCallback(
 (newFilters: FilterState) => {
 pushParams({
 finishType: newFilters.finishType,
 tradeStatus: newFilters.tradeStatus,
 sortBy: newFilters.sortBy ==="newest" ? null : newFilters.sortBy,
 });
 },
 [pushParams],
 );

 // Extract unique manufacturers/scales from data (for filter dropdowns)
 const manufacturers = useMemo(() => {
 const set = new Set<string>();
 communityCards.forEach((h) => {
 const mfr = h.refName.split("")[0];
 if (mfr && mfr !=="Unlisted") set.add(mfr);
 });
 return [...set].sort();
 }, [communityCards]);

 const scales = useMemo(() => {
 const set = new Set<string>();
 communityCards.forEach((h) => {
 if (h.scale) set.add(h.scale);
 });
 return [...set].sort();
 }, [communityCards]);

 const isFiltering = currentParams.get("q") || currentParams.get("finishType") || currentParams.get("tradeStatus");

 return (
 <>
 {communityCards.length > 0 && (
 <div className="sticky top-[calc(var(--header-height)+0.75rem)] bg-card border-edge shadow-md z-[10] mb-8 flex items-center gap-2 rounded-xl border px-6 py-2 transition-all max-sm:py-0">
 <Input
 type="text"
 value={searchInput}
 onChange={(e) => handleSearch(e.target.value)}
 onKeyDown={(e) => {
 if (e.key ==="Enter") handleSearchSubmit();
 }}
 onBlur={handleSearchSubmit}
 placeholder="Search the Show Ring by name, sculptor, or collector…"
 
 id="showring-search-bar"
 />
 </div>
 )}

 {communityCards.length > 0 && (
 <ShowRingFilters
 filters={filters}
 onFilterChange={handleFilterChange}
 manufacturers={manufacturers}
 scales={scales}
 />
 )}

 {isFiltering && (
 <div className="text-muted mb-6 pl-1 text-sm">
 {communityCards.length === 0
 ?"No models match your filters"
 : `Showing ${communityCards.length} models`}
 </div>
 )}

 {communityCards.length === 0 && !isFiltering ? (
 <div className="bg-card border-edge animate-fade-in-up rounded-lg border px-8 py-12 text-center shadow-md transition-all">
 <div className="mb-4 text-5xl">🏟️</div>
 <h2>The Show Ring is Empty</h2>
 <p>No models have been shared yet. Be the first to showcase your collection!</p>
 <Link
 href="/add-horse"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 >
 🐴 Add to Stable
 </Link>
 </div>
 ) : communityCards.length === 0 && isFiltering ? (
 <div className="bg-card border-edge animate-fade-in-up rounded-lg border px-8 py-12 text-center shadow-md transition-all">
 <div className="mb-4 text-5xl">🔍</div>
 <h2>No Results</h2>
 <p>No models match your search. Try different filters.</p>
 </div>
 ) : (
 <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] animate-fade-in-up gap-5">
 {communityCards.map((horse) => {
 const priceLabel = formatPrice(horse.listingPrice);
 const isListed = horse.tradeStatus ==="For Sale" || horse.tradeStatus ==="Open to Offers";

 return (
 <div
 key={horse.id}
 className="group flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-card text-ink no-underline shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
 id={`community-card-${horse.id}`}
 >
 <Link
 href={`/community/${horse.id}`}
 className="flex flex-1 flex-col text-ink no-underline"
 >
 <div className="relative aspect-[4/3] overflow-hidden bg-[var(--color-bg-secondary)]">
 {horse.thumbnailUrl ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img src={horse.thumbnailUrl} alt={horse.customName} loading="lazy" className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]" />
 ) : (
 <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-[var(--color-bg-secondary)] text-muted">
 <span className="text-4xl">🐴</span>
 <span className="text-xs">No photo</span>
 </div>
 )}
 <span className={`horse-card-badge ${getFinishBadgeClass(horse.finishType)}`}>
 {horse.finishType}
 </span>
 {Date.now() - new Date(horse.createdAt).getTime() < 48 * 60 * 60 * 1000 && (
 <span className="new-badge">NEW</span>
 )}
 {horse.assetCategory && horse.assetCategory !=="model" && (
 <span className="category-badge">
 {horse.assetCategory ==="tack"
 ?"🏇"
 : horse.assetCategory ==="prop"
 ?"🌲"
 :"🎭"}
 </span>
 )}
 {horse.tradeStatus ==="For Sale" && (
 <span className="trade-badge border border-[rgba(34,197,94,0.5)] bg-[rgba(34,197,94,0.85)] text-white">
 💲 {priceLabel ||"For Sale"}
 </span>
 )}
 {horse.tradeStatus ==="Open to Offers" && (
 <span className="trade-badge border border-[rgba(59,130,246,0.5)] bg-[rgba(59,130,246,0.85)] text-white">
 🤝 {priceLabel ? `~${priceLabel}` :"Open to Offers"}
 </span>
 )}
 </div>
 <div className="flex flex-col gap-1.5 p-4">
 <div className="truncate text-sm font-semibold">
 {horse.customName}
 {(horse.hoofprintCount ?? 0) > 0 && (
 <span
 className="bg-[rgba(245,158,11,0.15)] ml-[6px] rounded-[999px] px-[8px] py-[2px] text-[0.65rem] font-semibold text-[#f59e0b]"
 title="Has Hoofprint"
 >
 🐾
 </span>
 )}
 </div>
 <div className="truncate text-xs text-stone-500">
 {horse.refName}
 </div>
 <div className="text-xs text-stone-400">
 {timeAgo(horse.createdAt)}
 </div>
 {horse.releaseLine && (
 <div className="mt-[2px] truncate text-xs text-muted opacity-70">
 🎨 {horse.releaseLine}
 </div>
 )}
 {horse.sculptor && (
 <div className="mt-[2px] truncate text-xs text-muted opacity-70">
 ✂️ {horse.sculptor}
 </div>
 )}
 {isListed && horse.marketplaceNotes && (
 <div className="marketplace-notes-snippet" title={horse.marketplaceNotes}>
 📝{" "}
 {horse.marketplaceNotes.length > 60
 ? horse.marketplaceNotes.slice(0, 60) +"…"
 : horse.marketplaceNotes}
 </div>
 )}
 {isListed && (
 <span
 className="mt-1 inline-block rounded-md border-0 bg-forest px-3 py-1 text-xs font-semibold text-inverse no-underline shadow-sm transition-all"
 >
 View &amp; Contact
 </span>
 )}
 </div>
 </Link>
 <div className="flex items-center justify-between border-t border-stone-100 px-4 py-2.5 text-xs">
 <Link
 href={`/profile/${encodeURIComponent(horse.ownerAlias)}`}
 className="flex items-center gap-1 truncate text-[var(--color-accent-primary)] no-underline hover:underline"
 >
 <svg
 width="12"
 height="12"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 aria-hidden="true"
 >
 <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
 <circle cx="12" cy="7" r="4" />
 </svg>
 @{horse.ownerAlias}
 </Link>
 <div className="flex items-center gap-1">
 <FavoriteButton
 horseId={horse.id}
 initialIsFavorited={horse.isFavorited}
 initialCount={horse.favoriteCount}
 />
 <WishlistButton catalogId={horse.catalogId} />
 </div>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </>
 );
}
