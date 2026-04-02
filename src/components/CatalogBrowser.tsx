"use client";

import { useState, useCallback, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getCatalogItems } from "@/app/actions/catalog-suggestions";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

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

type SortField = "title" | "maker" | "scale" | "created_at";
type SortDir = "asc" | "desc";

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
        const newDir = sortBy === field && sortDir === "asc" ? "desc" : "asc";
        setSortBy(field);
        setSortDir(newDir);
        setPage(1);
        fetchItems(search, activeMaker, activeScale, field, newDir, 1);
    };

    // Pagination
    const handlePage = (newPage: number) => {
        setPage(newPage);
        fetchItems(search, activeMaker, activeScale, sortBy, sortDir, newPage);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Cleanup
    useEffect(() => {
        return () => {
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        };
    }, []);

    const sortIndicator = (field: SortField) => {
        if (sortBy !== field) return "↕";
        return sortDir === "asc" ? "↑" : "↓";
    };

    // Extract common attributes safely
    const getAttr = (item: CatalogItem, key: string): string => {
        if (!item.attributes || typeof item.attributes !== "object") return "—";
        const val = (item.attributes as Record<string, unknown>)[key];
        return val != null ? String(val) : "—";
    };

    return (
        <Card className="w-full overflow-hidden border-stone-200 bg-white shadow-sm">
            {/* Search & Filters */}
            <div className="border-b border-stone-100 bg-stone-50/50 p-6">
                <div className="relative mb-4">
                    <Input
                        id="catalog-search"
                        type="text"
                        className="w-full"
                        placeholder="Search by name, mold, color, maker…"
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                        autoComplete="off"
                    />
                    {isPending && <span className="absolute right-3 top-1/2 -translate-y-1/2">⏳</span>}
                </div>

                {/* Filter Chips */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap items-center gap-[6px]">
                        <span className="text-sm font-semibold text-stone-700">Maker:</span>
                        <button
                            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-all ${activeMaker === null ? "border-forest bg-forest text-white" : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50"}`}
                            onClick={() => handleMakerFilter(null)}
                        >
                            All
                        </button>
                        {makers.slice(0, 10).map((maker) => (
                            <button
                                key={maker}
                                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-all ${activeMaker === maker ? "border-forest bg-forest text-white" : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50"}`}
                                onClick={() => handleMakerFilter(activeMaker === maker ? null : maker)}
                            >
                                {maker}
                            </button>
                        ))}
                    </div>
                    {scales.length > 0 && (
                        <div className="flex flex-wrap items-center gap-[6px]">
                            <span className="text-sm font-semibold text-stone-700">Scale:</span>
                            <select
                                id="catalog-scale-filter"
                                className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700"
                                title="Filter by scale"
                                value={activeScale ?? ""}
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
                <div className="mt-3 flex items-center justify-between text-sm text-stone-600">
                    <span>
                        {total.toLocaleString()} {total === 1 ? "entry" : "entries"} found
                    </span>
                    {(search || activeMaker || activeScale) && (
                        <button
                            className="shrink-0 cursor-pointer border-none bg-transparent text-sm text-stone-600 transition-colors hover:text-stone-900"
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
            </div>

            {/* Table */}
            <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <Table className="min-w-[640px]">
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead
                            className="cursor-pointer select-none text-stone-500"
                            onClick={() => handleSort("title")}
                        >
                            Name {sortIndicator("title")}
                        </TableHead>
                        <TableHead
                            className="cursor-pointer select-none text-stone-500"
                            onClick={() => handleSort("maker")}
                        >
                            Maker {sortIndicator("maker")}
                        </TableHead>
                        <TableHead className="text-stone-500">Color</TableHead>
                        <TableHead className="text-stone-500">Mold</TableHead>
                        <TableHead
                            className="cursor-pointer select-none text-stone-500"
                            onClick={() => handleSort("scale")}
                        >
                            Scale {sortIndicator("scale")}
                        </TableHead>
                        <TableHead className="w-[120px] text-stone-500">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item) => (
                        <TableRow
                            key={item.id}
                            className="cursor-pointer transition-colors hover:bg-stone-50"
                            onClick={() => router.push(`/catalog/${item.id}`)}
                        >
                            <TableCell className="font-semibold text-stone-900">
                                {item.title}
                            </TableCell>
                            <TableCell className="text-stone-600">{item.maker}</TableCell>
                            <TableCell className="text-stone-600">{getAttr(item, "color")}</TableCell>
                            <TableCell className="text-stone-600">{getAttr(item, "mold")}</TableCell>
                            <TableCell className="text-stone-600">{item.scale ?? "—"}</TableCell>
                            <TableCell className="text-right">
                                <button
                                    className="cursor-pointer border-0 bg-transparent text-sm text-forest opacity-0 transition-all group-hover:opacity-100"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/catalog/${item.id}?suggest=true`);
                                    }}
                                >
                                    ✏️ Suggest Edit
                                </button>
                            </TableCell>
                        </TableRow>
                    ))}
                    {items.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="p-8 text-center text-stone-500">
                                No entries match your search.{" "}
                                <a href="/catalog/suggestions" className="text-forest hover:underline">Suggest a new entry?</a>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 border-t border-stone-100 px-6 py-4">
                    <button
                        className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-white px-6 py-2 text-sm font-semibold text-stone-600 transition-all hover:bg-stone-50 disabled:opacity-40"
                        disabled={page <= 1}
                        onClick={() => handlePage(page - 1)}
                    >
                        ← Previous
                    </button>
                    <span className="text-sm text-stone-500">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-white px-6 py-2 text-sm font-semibold text-stone-600 transition-all hover:bg-stone-50 disabled:opacity-40"
                        disabled={page >= totalPages}
                        onClick={() => handlePage(page + 1)}
                    >
                        Next →
                    </button>
                </div>
            )}
        </Card>
    );
}
