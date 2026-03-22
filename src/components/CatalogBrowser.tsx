"use client";

import { useState, useCallback, useTransition, useEffect, useRef } from"react";
import { useRouter } from"next/navigation";
import { getCatalogItems } from"@/app/actions/catalog-suggestions";

interface CatalogItem {
 id: string;
 item_type: string;
 parent_id: string | null;
 title: string;
 maker: string;
 scale: string | null;
 attributes: Record<string, unknown>;
 created_at: string;
}

interface CatalogBrowserProps {
 initialItems: CatalogItem[];
 totalCount: number;
 makers: string[];
 scales: string[];
}

type SortField ="title" |"maker" |"scale" |"created_at";
type SortDir ="asc" |"desc";

export default function CatalogBrowser({ initialItems, totalCount, makers, scales }: CatalogBrowserProps) {
 const router = useRouter();
 const [isPending, startTransition] = useTransition();

 const [items, setItems] = useState<CatalogItem[]>(initialItems);
 const [total, setTotal] = useState(totalCount);
 const [page, setPage] = useState(1);
 const [search, setSearch] = useState("");
 const [activeMaker, setActiveMaker] = useState<string | null>(null);
 const [activeScale, setActiveScale] = useState<string | null>(null);
 const [sortBy, setSortBy] = useState<SortField>("title");
 const [sortDir, setSortDir] = useState<SortDir>("asc");

 const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const pageSize = 50;
 const totalPages = Math.ceil(total / pageSize);

 // Debounced fetch
 const fetchItems = useCallback(
 (
 searchVal: string,
 makerVal: string | null,
 scaleVal: string | null,
 sortField: SortField,
 sortDirection: SortDir,
 pageNum: number,
 ) => {
 startTransition(async () => {
 const result = await getCatalogItems({
 search: searchVal || undefined,
 maker: makerVal || undefined,
 scale: scaleVal || undefined,
 sortBy: sortField,
 sortDir: sortDirection,
 page: pageNum,
 pageSize,
 });
 if (result.success) {
 setItems(result.items as CatalogItem[]);
 setTotal(result.total);
 }
 });
 },
 [],
 );

 // Debounced search
 const handleSearch = (value: string) => {
 setSearch(value);
 setPage(1);
 if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
 searchTimerRef.current = setTimeout(() => {
 fetchItems(value, activeMaker, activeScale, sortBy, sortDir, 1);
 }, 300);
 };

 // Filter changes (immediate)
 const handleMakerFilter = (maker: string | null) => {
 setActiveMaker(maker);
 setPage(1);
 fetchItems(search, maker, activeScale, sortBy, sortDir, 1);
 };

 const handleScaleFilter = (scale: string | null) => {
 setActiveScale(scale);
 setPage(1);
 fetchItems(search, activeMaker, scale, sortBy, sortDir, 1);
 };

 // Sort
 const handleSort = (field: SortField) => {
 const newDir = sortBy === field && sortDir ==="asc" ?"desc" :"asc";
 setSortBy(field);
 setSortDir(newDir);
 setPage(1);
 fetchItems(search, activeMaker, activeScale, field, newDir, 1);
 };

 // Pagination
 const handlePage = (newPage: number) => {
 setPage(newPage);
 fetchItems(search, activeMaker, activeScale, sortBy, sortDir, newPage);
 window.scrollTo({ top: 0, behavior:"smooth" });
 };

 // Cleanup
 useEffect(() => {
 return () => {
 if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
 };
 }, []);

 const sortIndicator = (field: SortField) => {
 if (sortBy !== field) return"↕";
 return sortDir ==="asc" ?"↑" :"↓";
 };

 // Extract common attributes safely
 const getAttr = (item: CatalogItem, key: string): string => {
 if (!item.attributes || typeof item.attributes !=="object") return"—";
 const val = (item.attributes as Record<string, unknown>)[key];
 return val != null ? String(val) :"—";
 };

 return (
 <div className="ref-browser">
 {/* Search */}
 <div className="relative mb-4">
 <input
 id="catalog-search"
 type="text"
 className="input text-muted"
 placeholder="Search by name, mold, color, maker…"
 value={search}
 onChange={(e) => handleSearch(e.target.value)}
 autoComplete="off"
 />
 {isPending && <span className="absolute top-[50%] right-[12px] translate-y-[-50%]">⏳</span>}
 </div>

 {/* Filter Chips */}
 <div className="mb-4 flex flex-wrap items-center gap-2">
 <div className="flex flex-wrap items-center gap-[6px]">
 <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-semibold">Maker:</span>
 <button
 className={`ref-chip ${activeMaker === null ?"ref-chip-active" :""}`}
 onClick={() => handleMakerFilter(null)}
 >
 All
 </button>
 {makers.slice(0, 10).map((maker) => (
 <button
 key={maker}
 className={`ref-chip ${activeMaker === maker ?"ref-chip-active" :""}`}
 onClick={() => handleMakerFilter(activeMaker === maker ? null : maker)}
 >
 {maker}
 </button>
 ))}
 </div>
 {scales.length > 0 && (
 <div className="flex flex-wrap items-center gap-[6px]">
 <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-semibold">Scale:</span>
 <select
 id="catalog-scale-filter"
 className="input max-w-[160px] text-[calc(0.8rem*var(--font-scale))]"
 value={activeScale ??""}
 onChange={(e) => handleScaleFilter(e.target.value || null)}
 >
 <option value="">All Scales</option>
 {scales.map((scale) => (
 <option key={scale} value={scale}>
 {scale}
 </option>
 ))}
 </select>
 </div>
 )}
 </div>

 {/* Results Count */}
 <div className="text-muted mb-2 flex items-center justify-between text-[calc(0.85rem*var(--font-scale))]">
 <span>
 {total.toLocaleString()} {total === 1 ?"entry" :"entries"} found
 </span>
 {(search || activeMaker || activeScale) && (
 <button
 className="shrink-0 text-sm"
 onClick={() => {
 setSearch("");
 setActiveMaker(null);
 setActiveScale(null);
 setPage(1);
 fetchItems("", null, null, sortBy, sortDir, 1);
 }}
 >
 ✕ Clear filters
 </button>
 )}
 </div>

 {/* Table */}
 <div className="ref-table-wrap">
 <table className="ref-table">
 <thead>
 <tr>
 <th
 className="border-edge text-muted cursor-pointer border-b-[2px] p-2 text-left font-semibold whitespace-nowrap select-none"
 onClick={() => handleSort("title")}
 >
 Name {sortIndicator("title")}
 </th>
 <th
 className="border-edge text-muted cursor-pointer border-b-[2px] p-2 text-left font-semibold whitespace-nowrap select-none"
 onClick={() => handleSort("maker")}
 >
 Maker {sortIndicator("maker")}
 </th>
 <th className="border-edge text-muted border-b-[2px] p-2 text-left font-semibold whitespace-nowrap">
 Color
 </th>
 <th className="border-edge text-muted border-b-[2px] p-2 text-left font-semibold whitespace-nowrap">
 Mold
 </th>
 <th
 className="border-edge text-muted cursor-pointer border-b-[2px] p-2 text-left font-semibold whitespace-nowrap select-none"
 onClick={() => handleSort("scale")}
 >
 Scale {sortIndicator("scale")}
 </th>
 <th className="border-edge text-muted w-[120px] border-b-[2px] p-2 text-left font-semibold whitespace-nowrap">
 Actions
 </th>
 </tr>
 </thead>
 <tbody>
 {items.map((item) => (
 <tr
 key={item.id}
 className="cursor-pointer transition-colors"
 onClick={() => router.push(`/catalog/${item.id}`)}
 >
 <td className="border-edge border-b p-2 font-semibold text-[var(--color-text)]">
 {item.title}
 </td>
 <td className="border-edge border-b p-2">{item.maker}</td>
 <td className="border-edge border-b p-2">{getAttr(item,"color")}</td>
 <td className="border-edge border-b p-2">{getAttr(item,"mold")}</td>
 <td className="border-edge border-b p-2">{item.scale ??"—"}</td>
 <td className="border-edge border-b p-2 text-right">
 <button
 className="text-forest cursor-pointer border-0 bg-transparent text-[calc(0.8rem*var(--font-scale))] opacity-[0] transition-all"
 onClick={(e) => {
 e.stopPropagation();
 router.push(`/catalog/${item.id}?suggest=true`);
 }}
 >
 ✏️ Suggest Edit
 </button>
 </td>
 </tr>
 ))}
 {items.length === 0 && (
 <tr>
 <td colSpan={6} className="text-muted p-8 text-center">
 No entries match your search.{""}
 <a href="/catalog/suggestions">Suggest a new entry?</a>
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>

 {/* Pagination */}
 {totalPages > 1 && (
 <div className="mt-6 flex items-center justify-center gap-4 px-0 py-4">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 disabled={page <= 1}
 onClick={() => handlePage(page - 1)}
 >
 ← Previous
 </button>
 <span className="text-muted text-[calc(0.85rem*var(--font-scale))]">
 Page {page} of {totalPages}
 </span>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 disabled={page >= totalPages}
 onClick={() => handlePage(page + 1)}
 >
 Next →
 </button>
 </div>
 )}
 </div>
 );
}
