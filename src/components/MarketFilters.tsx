"use client";

import { useRouter, useSearchParams } from"next/navigation";
import { useState, useCallback, useEffect } from"react";
import { Input } from "@/components/ui/input";

const ITEM_TYPE_LABELS: Record<string, string> = {
 all:"All Types",
 plastic_mold:"Plastic Molds",
 plastic_release:"Plastic Releases",
 artist_resin:"Artist Resins",
 tack:"Tack",
 prop:"Props",
};

const FINISH_TYPE_LABELS: Record<string, string> = {
 all:"All Finishes",
 OF:"Original Finish",
 Custom:"Custom",
"Artist Resin":"Artist Resin",
};

const LIFE_STAGE_LABELS: Record<string, string> = {
 all:"All Stages",
 blank:"Blank",
 stripped:"Stripped / Body",
 in_progress:"In Progress",
 completed:"Completed",
};

const SORT_OPTIONS = [
 { value:"transaction_volume:desc", label:"Most Traded" },
 { value:"average_price:desc", label:"Highest Value" },
 { value:"average_price:asc", label:"Lowest Value" },
 { value:"last_sold_at:desc", label:"Recently Sold" },
 { value:"title:asc", label:"A – Z" },
];

export default function MarketFilters() {
 const router = useRouter();
 const params = useSearchParams();
 const [searchInput, setSearchInput] = useState(params.get("q") ||"");

 const currentType = params.get("type") ||"all";
 const currentFinish = params.get("finish") ||"all";
 const currentStage = params.get("stage") ||"all";
 const currentSort = params.get("sort") ||"transaction_volume:desc";

 const pushParams = useCallback(
 (updates: Record<string, string | null>) => {
 const newParams = new URLSearchParams(params.toString());
 for (const [key, val] of Object.entries(updates)) {
 if (val && val !=="all" && val !=="transaction_volume:desc") {
 newParams.set(key, val);
 } else {
 newParams.delete(key);
 }
 }
 // Reset page when filters change
 newParams.delete("page");
 router.push(`/market?${newParams.toString()}`);
 },
 [params, router],
 );

 // Debounced search push
 useEffect(() => {
 const timer = setTimeout(() => {
 const currentQ = params.get("q") ||"";
 if (searchInput.trim() !== currentQ) {
 pushParams({ q: searchInput.trim() || null });
 }
 }, 400);
 return () => clearTimeout(timer);
 }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

 return (
 <div className="mb-8">
 <div className="mb-4">
 <Input
 className="w-full rounded-lg p-3 text-base"
 type="search"
 placeholder="Search by mold, release, or artist resin…"
 value={searchInput}
 onChange={(e) => setSearchInput(e.target.value)}
 id="market-search"
 />
 </div>
 <div className="flex flex-wrap items-center justify-between gap-4">
 <div className="flex flex-wrap gap-2">
 {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
 <button
 key={value}
 className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition-all ${currentType === value ?"bg-forest border-forest text-white" :"border-edge text-muted hover:text-ink hover:border-forest bg-card"}`}
 onClick={() => pushParams({ type: value ==="all" ? null : value })}
 >
 {label}
 </button>
 ))}
 </div>
 <div className="flex flex-wrap items-center gap-3">
 <select
 className="min-w-[140px] rounded-md border border-edge bg-card px-3 py-2 text-sm"
 value={currentFinish}
 onChange={(e) => pushParams({ finish: e.target.value ==="all" ? null : e.target.value })}
 id="market-finish"
 aria-label="Filter by finish type"
 >
 {Object.entries(FINISH_TYPE_LABELS).map(([value, label]) => (
 <option key={value} value={value}>
 {label}
 </option>
 ))}
 </select>
 <select
 className="min-w-[140px] rounded-md border border-edge bg-card px-3 py-2 text-sm"
 value={currentStage}
 onChange={(e) => pushParams({ stage: e.target.value ==="all" ? null : e.target.value })}
 id="market-stage"
 aria-label="Filter by life stage"
 >
 {Object.entries(LIFE_STAGE_LABELS).map(([value, label]) => (
 <option key={value} value={value}>
 {label}
 </option>
 ))}
 </select>
 <select
 className="min-w-[160px] rounded-md border border-edge bg-card px-3 py-2 text-sm"
 value={currentSort}
 onChange={(e) => pushParams({ sort: e.target.value })}
 id="market-sort"
 aria-label="Sort market results"
 >
 {SORT_OPTIONS.map((opt) => (
 <option key={opt.value} value={opt.value}>
 {opt.label}
 </option>
 ))}
 </select>
 </div>
 </div>
 </div>
 );
}
