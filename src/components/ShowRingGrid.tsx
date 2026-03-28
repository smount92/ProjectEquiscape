"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import ShowRingFilters from "@/components/ShowRingFilters";
import type { FilterState } from "@/components/ShowRingFilters";
import WishlistButton from "@/components/WishlistButton";
import FavoriteButton from "@/components/FavoriteButton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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

const FINISH_BADGE_CLASSES: Record<string, string> = {
 "OF": "bg-amber-50 text-amber-700 border-amber-200",
 "Custom": "bg-indigo-50 text-indigo-700 border-indigo-200",
 "Custom/Resin": "bg-violet-50 text-violet-700 border-violet-200",
 "Artist Resin": "bg-rose-50 text-rose-700 border-rose-200",
 "Test Run": "bg-cyan-50 text-cyan-700 border-cyan-200",
 "Decorator": "bg-emerald-50 text-emerald-700 border-emerald-200",
 "default": "bg-stone-100 text-ink-light border-stone-200",
};

const containerVariants = {
 hidden: {},
 visible: {
  transition: { staggerChildren: 0.06 },
 },
} as const;

const cardVariants = {
 hidden: { opacity: 0, y: 20 },
 visible: {
  opacity: 1,
  y: 0,
  transition: { type: "spring" as const, stiffness: 300, damping: 30 },
 },
};

function timeAgo(dateStr: string): string {
 const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
 if (seconds < 60) return "Just now";
 const minutes = Math.floor(seconds / 60);
 if (minutes < 60) return `${minutes}m ago`;
 const hours = Math.floor(minutes / 60);
 if (hours < 24) return `${hours}h ago`;
 const days = Math.floor(hours / 24);
 if (days < 30) return `${days}d ago`;
 return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPrice(price: number | null): string | null {
 if (price === null || price === undefined) return null;
 return `$${price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function ShowRingGrid({ communityCards }: { communityCards: CommunityCardData[] }) {
 const router = useRouter();
 const currentParams = useSearchParams();

 // Read current URL state for search bar local display
 const [searchInput, setSearchInput] = useState(currentParams.get("q") || "");

 // Build filter state from URL
 const filters: FilterState = {
  finishType: currentParams.get("finishType") || null,
  tradeStatus: currentParams.get("tradeStatus") || null,
  manufacturer: null,
  scale: null,
  sortBy: (currentParams.get("sortBy") || "newest") as "newest" | "oldest" | "most-favorited",
 };

 // Push filters to URL (triggers server re-render)
 const pushParams = useCallback(
  (updates: Record<string, string | null>) => {
   const params = new URLSearchParams(currentParams.toString());
   for (const [key, val] of Object.entries(updates)) {
    if (val && val !== "all") {
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
    sortBy: newFilters.sortBy === "newest" ? null : newFilters.sortBy,
   });
  },
  [pushParams],
 );

 // Extract unique manufacturers/scales from data (for filter dropdowns)
 const manufacturers = useMemo(() => {
  const set = new Set<string>();
  communityCards.forEach((h) => {
   const mfr = h.refName.split("")[0];
   if (mfr && mfr !== "Unlisted") set.add(mfr);
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
       if (e.key === "Enter") handleSearchSubmit();
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
      ? "No models match your filters"
      : `Showing ${communityCards.length} models`}
    </div>
   )}

   {communityCards.length === 0 && !isFiltering ? (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-stone-200 bg-stone-50/50 p-16">
     <span className="mb-4 text-6xl">🏟️</span>
     <h2 className="mb-2 font-serif text-xl font-semibold text-ink">The Show Ring is Empty</h2>
     <p className="mb-6 max-w-sm text-center text-muted">No models have been shared yet. Be the first to showcase your collection!</p>
     <Link
      href="/add-horse"
      className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
     >
      🐴 Add to Stable
     </Link>
    </div>
   ) : communityCards.length === 0 && isFiltering ? (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-stone-200 bg-stone-50/50 p-16">
     <span className="mb-4 text-6xl">🔍</span>
     <h2 className="mb-2 font-serif text-xl font-semibold text-ink">No Results</h2>
     <p className="max-w-sm text-center text-muted">No models match your search. Try different filters.</p>
    </div>
   ) : (
    <motion.div
     className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-3 xl:grid-cols-4"
     variants={containerVariants}
     initial="hidden"
     animate="visible"
    >
     {communityCards.map((horse) => {
      const priceLabel = formatPrice(horse.listingPrice);
      const isListed = horse.tradeStatus === "For Sale" || horse.tradeStatus === "Open to Offers";
      const isNew = Date.now() - new Date(horse.createdAt).getTime() < 48 * 60 * 60 * 1000;
      const finishClass = FINISH_BADGE_CLASSES[horse.finishType] ?? FINISH_BADGE_CLASSES.default;

      return (
       <motion.div
        key={horse.id}
        variants={cardVariants}
        className="group rounded-2xl border border-stone-200 bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
        id={`community-card-${horse.id}`}
       >
        <Link
         href={`/community/${horse.id}`}
         className="flex flex-col text-ink no-underline"
        >
         {/* Image container — locked aspect ratio */}
         <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-stone-100">
          {horse.thumbnailUrl ? (
           // eslint-disable-next-line @next/next/no-img-element
           <img
            src={horse.thumbnailUrl}
            alt={horse.customName}
            loading="lazy"
            className="h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-105"
           />
          ) : (
           <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted">
            <span className="text-4xl opacity-50">🐴</span>
            <span className="text-xs font-medium">No photo</span>
           </div>
          )}

          {/* Overlay badges */}
          {isNew && (
           <span className="absolute top-2 left-2 rounded-full bg-amber-400 px-2 py-0.5 text-[0.6rem] font-bold tracking-wide text-white uppercase shadow-sm">
            NEW
           </span>
          )}
          {horse.assetCategory && horse.assetCategory !== "model" && (
           <span className="absolute top-2 right-2 rounded-md bg-black/40 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
            {horse.assetCategory === "tack" ? "🏇" : horse.assetCategory === "prop" ? "🌲" : "🎭"}
           </span>
          )}
          {horse.tradeStatus === "For Sale" && (
           <span className="absolute bottom-2 left-2 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            💲 {priceLabel || "For Sale"}
           </span>
          )}
          {horse.tradeStatus === "Open to Offers" && (
           <span className="absolute bottom-2 left-2 rounded-full bg-blue-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            🤝 {priceLabel ? `~${priceLabel}` : "Open to Offers"}
           </span>
          )}
         </div>

         {/* Content area */}
         <div className="mt-3 px-1">
          <h3 className="truncate font-serif text-lg font-bold text-ink">
           {horse.customName}
           {(horse.hoofprintCount ?? 0) > 0 && (
            <span
             className="ml-1.5 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 align-middle text-[0.6rem] font-semibold text-amber-600"
             title="Has Hoofprint"
            >
             🐾
            </span>
           )}
          </h3>
          <p className="truncate text-sm text-ink-light">{horse.refName}</p>

          {/* Badge row */}
          <div className="mt-2 flex flex-wrap gap-1.5">
           <Badge className={finishClass}>{horse.finishType}</Badge>
          </div>

          {/* Metadata line */}
          <div className="mt-2 flex items-center gap-2 text-xs text-ink-light">
           <span>{timeAgo(horse.createdAt)}</span>
           {horse.sculptor && <span>· ✂️ {horse.sculptor}</span>}
          </div>

          {isListed && horse.marketplaceNotes && (
           <div className="mt-1.5 truncate rounded-md bg-stone-50 px-2 py-1 text-xs text-ink-light" title={horse.marketplaceNotes}>
            📝 {horse.marketplaceNotes.length > 60 ? horse.marketplaceNotes.slice(0, 60) + "…" : horse.marketplaceNotes}
           </div>
          )}
         </div>
        </Link>

        {/* Footer — owner + actions */}
        <div className="mt-3 flex items-center justify-between border-t border-stone-100 px-1 pt-2.5 text-xs">
         <Link
          href={`/profile/${encodeURIComponent(horse.ownerAlias)}`}
          className="flex items-center gap-1 truncate text-[var(--color-accent-primary)] no-underline hover:underline"
         >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
       </motion.div>
      );
     })}
    </motion.div>
   )}
  </>
 );
}
