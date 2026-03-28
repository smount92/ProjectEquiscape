"use client";

interface FilterState {
 finishType: string | null;
 tradeStatus: string | null;
 manufacturer: string | null;
 scale: string | null;
 sortBy:"newest" |"oldest" |"most-favorited";
}

interface ShowRingFiltersProps {
 filters: FilterState;
 onFilterChange: (filters: FilterState) => void;
 manufacturers: string[];
 scales: string[];
}

const FINISH_TYPES = ["OF","Custom","Artist Resin"];

export default function ShowRingFilters({ filters, onFilterChange, manufacturers, scales }: ShowRingFiltersProps) {
 const setFilter = (key: keyof FilterState, value: string | null) => {
 onFilterChange({ ...filters, [key]: value });
 };

 return (
 <div
 className="showring-filters mb-6 flex flex-wrap items-center gap-2 py-2 max-sm:flex-col max-sm:items-stretch"
 id="showring-filters"
 >
 {/* Finish Type Pills */}
 <div className="flex gap-[4px] rounded-lg border border-[rgb(245 245 244)] bg-stone-50 p-[3px]">
 <button
 className={`filter-pill ${filters.finishType === null ?"filter-pill-active" :""}`}
 onClick={() => setFilter("finishType", null)}
 >
 All
 </button>
 {FINISH_TYPES.map((ft) => (
 <button
 key={ft}
 className={`filter-pill ${filters.finishType === ft ?"filter-pill-active" :""}`}
 onClick={() => setFilter("finishType", filters.finishType === ft ? null : ft)}
 >
 {ft}
 </button>
 ))}
 </div>

 {/* Trade Status Dropdown */}
 <select
 className="filter-dropdown hover:border-emerald-700"
 value={filters.tradeStatus ||""}
 onChange={(e) => setFilter("tradeStatus", e.target.value || null)}
 id="filter-trade-status"
 >
 <option value="">All Statuses</option>
 <option value="For Sale">💲 For Sale</option>
 <option value="Open to Offers">🤝 Open to Offers</option>
 </select>

 {/* Manufacturer Dropdown */}
 {manufacturers.length > 1 && (
 <select
 className="filter-dropdown hover:border-emerald-700"
 value={filters.manufacturer ||""}
 onChange={(e) => setFilter("manufacturer", e.target.value || null)}
 id="filter-manufacturer"
 >
 <option value="">All Makes</option>
 {manufacturers.map((m) => (
 <option key={m} value={m}>
 {m}
 </option>
 ))}
 </select>
 )}

 {/* Scale Dropdown */}
 {scales.length > 1 && (
 <select
 className="filter-dropdown hover:border-emerald-700"
 value={filters.scale ||""}
 onChange={(e) => setFilter("scale", e.target.value || null)}
 id="filter-scale"
 aria-label="Filter by scale"
 >
 <option value="">All Scales</option>
 {scales.map((s) => (
 <option key={s} value={s}>
 {s}
 </option>
 ))}
 </select>
 )}

 {/* Sort Dropdown */}
 <select
 className="filter-dropdown hover:border-emerald-700"
 value={filters.sortBy}
 onChange={(e) => setFilter("sortBy", e.target.value as FilterState["sortBy"])}
 id="filter-sort"
 >
 <option value="newest">Sort: Newest</option>
 <option value="oldest">Sort: Oldest</option>
 <option value="most-favorited">Sort: Most ❤️</option>
 </select>
 </div>
 );
}

export type { FilterState };
