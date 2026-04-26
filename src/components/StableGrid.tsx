"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import SearchBar from "@/components/SearchBar";
import { Badge } from "@/components/ui/badge";
import { getThumbUrl } from "@/lib/utils/imageUrl";

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

const FINISH_BADGE_CLASSES: Record<string, string> = {
 "OF": "bg-amber-50 text-amber-700 border-amber-200",
 "Custom": "bg-indigo-50 text-indigo-700 border-indigo-200",
 "Custom/Resin": "bg-violet-50 text-violet-700 border-violet-200",
 "Artist Resin": "bg-rose-50 text-rose-700 border-rose-200",
 "Test Run": "bg-cyan-50 text-cyan-700 border-cyan-200",
 "Decorator": "bg-emerald-50 text-emerald-700 border-emerald-200",
 "default": "bg-stone-100 text-stone-600 border-stone-200",
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

function formatDate(dateStr: string): string {
 return new Date(dateStr).toLocaleDateString("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
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
 const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name-az" | "name-za" | "condition">("newest");

 const CONDITION_ORDER = ["Mint", "Near Mint", "Excellent", "Very Good", "Good", "Fair", "Poor", "Play Grade"];

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
  if (sortBy === "oldest") {
   sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else if (sortBy === "name-az") {
   sorted.sort((a, b) => a.customName.localeCompare(b.customName));
  } else if (sortBy === "name-za") {
   sorted.sort((a, b) => b.customName.localeCompare(a.customName));
  } else if (sortBy === "condition") {
   sorted.sort((a, b) => {
    const aIdx = CONDITION_ORDER.indexOf(a.conditionGrade);
    const bIdx = CONDITION_ORDER.indexOf(b.conditionGrade);
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
   });
  }
  // "newest" is the default server order — no re-sort needed
  return sorted;
 }, [searchQuery, horseCards, sortBy, CONDITION_ORDER]);

 return (
  <>
   {horseCards.length > 0 && (
    <div className="mb-6 flex flex-wrap items-center gap-4">
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
      className="flex h-10 w-auto min-w-[160px] rounded-md border border-stone-200 bg-white px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
    <div className="text-stone-500 mb-6 pl-1 text-sm">
     {filteredCards.length === 0
      ? "No models match your search"
      : `Showing ${filteredCards.length} of ${horseCards.length} models`}
    </div>
   )}

   {filteredCards.length === 0 && !searchQuery.trim() ? (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-stone-200 bg-stone-50/50 p-16">
     <span className="mb-4 text-6xl">🏠</span>
     <h2 className="mb-2 font-serif text-xl font-semibold text-stone-900">Your Stable is Empty</h2>
     <p className="mb-6 max-w-sm text-center text-stone-500">You haven&apos;t added any models yet. Click the button above to catalog your first horse!</p>
     <Link
      href="/add-horse"
      className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
      id="add-first-horse"
     >
      🐴 Add Your First Horse
     </Link>
    </div>
   ) : filteredCards.length === 0 && searchQuery.trim() ? (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-stone-200 bg-stone-50/50 p-16">
     <span className="mb-4 text-6xl">🔍</span>
     <h2 className="mb-2 font-serif text-xl font-semibold text-stone-900">No Results</h2>
     <p className="max-w-sm text-center text-stone-500">No models match &ldquo;{searchQuery}&rdquo;. Try a different search term.</p>
    </div>
   ) : (
    <motion.div
     className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-3 xl:grid-cols-4"
     variants={containerVariants}
     initial="hidden"
     animate="visible"
    >
     {filteredCards.map((horse) => {
      const isSelected = selectedIds.has(horse.id);
      const finishClass = FINISH_BADGE_CLASSES[horse.finishType] ?? FINISH_BADGE_CLASSES.default;

      const cardContent = (
       <>
        {selectMode && (
         <div className="pointer-events-none absolute top-3 left-3 z-[5]">
          <input type="checkbox" checked={isSelected} readOnly aria-label={`Select ${horse.customName}`} />
         </div>
        )}

        {/* Image container */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-stone-100">
         {horse.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
           src={getThumbUrl(horse.thumbnailUrl)}
           onError={(e) => {
            // Fallback to full-res if thumb doesn't exist (older uploads)
            (e.target as HTMLImageElement).src = horse.thumbnailUrl!;
           }}
           alt={horse.customName}
           loading="lazy"
           className="h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-105"
          />
         ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-stone-500">
           <span className="text-4xl opacity-50">🐴</span>
           <span className="text-xs font-medium">No photo</span>
          </div>
         )}

         {/* Overlay badges */}
         {horse.assetCategory && horse.assetCategory !== "model" && (
          <span className="absolute top-2 right-2 rounded-md bg-black/40 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
           {horse.assetCategory === "tack" ? "🏇 Tack" : horse.assetCategory === "prop" ? "🌲 Prop" : horse.assetCategory === "diorama" ? "🎭 Diorama" : "🐄 Other Model"}
          </span>
         )}
         {horse.tradeStatus === "For Sale" && (
          <span className="absolute bottom-2 left-2 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
           💲 For Sale
          </span>
         )}
         {horse.tradeStatus === "Open to Offers" && (
          <span className="absolute bottom-2 left-2 rounded-full bg-blue-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
           🤝 Open to Offers
          </span>
         )}
        </div>

        {/* Content area */}
        <div className="mt-3 px-1">
         <h3 className="truncate font-serif text-lg font-bold text-stone-800">
          {horse.customName}
         </h3>
         <p className="mt-0.5 truncate text-sm text-stone-600">{horse.refName}</p>

         {/* Badge row */}
         <div className="mt-2 flex flex-wrap gap-1.5">
          {horse.finishType && (
           <Badge className={finishClass}>{horse.finishType}</Badge>
          )}
          {horse.conditionGrade && (
           <Badge variant="outline">{horse.conditionGrade}</Badge>
          )}
         </div>

         {/* Metadata */}
         <div className="mt-2 flex items-center gap-2 text-xs text-stone-600">
          <span>{formatDate(horse.createdAt)}</span>
          {horse.sculptor && <span>· ✂️ {horse.sculptor}</span>}
         </div>
         {horse.releaseLine && (
          <div className="mt-0.5 truncate text-[0.7rem] text-stone-500">
           🎨 {horse.releaseLine}
          </div>
         )}
         {horse.collectionName && (
          <div className="mt-1 truncate text-[0.7rem] text-stone-500">
           📁 {horse.collectionName}
          </div>
         )}
        </div>
       </>
      );

      return (
       <motion.div key={horse.id} variants={cardVariants}>
        {selectMode ? (
         <div
          onClick={() => onToggleSelect?.(horse.id)}
          className={`group relative cursor-pointer rounded-2xl border bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${
           isSelected ? "border-[var(--color-accent-primary)] ring-2 ring-forest" : "border-stone-200"
          }`}
          id={`horse-card-${horse.id}`}
         >
          {cardContent}
         </div>
        ) : (
         <Link
          href={`/stable/${horse.id}`}
          className="group relative block rounded-2xl border border-stone-200 bg-white p-3 no-underline shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
          id={`horse-card-${horse.id}`}
         >
          {cardContent}
         </Link>
        )}
       </motion.div>
      );
     })}
    </motion.div>
   )}
  </>
 );
}
