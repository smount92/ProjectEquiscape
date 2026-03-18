"use client";

import { useState, useCallback, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getCatalogItems } from "@/app/actions/catalog-suggestions";

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

export default function CatalogBrowser({
    initialItems,
    totalCount,
    makers,
    scales,
}: CatalogBrowserProps) {
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
            pageNum: number
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
        []
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
        <div className="ref-browser">
            {/* Search */}
            <div className="ref-search-bar">
                <input
                    id="catalog-search"
                    type="text"
                    className="input ref-search-input"
                    placeholder="Search by name, mold, color, maker…"
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                    autoComplete="off"
                />
                {isPending && <span className="ref-loading-indicator">⏳</span>}
            </div>

            {/* Filter Chips */}
            <div className="ref-filters">
                <div className="ref-filter-group">
                    <span className="ref-filter-label">Maker:</span>
                    <button
                        className={`ref-chip ${activeMaker === null ? "ref-chip-active" : ""}`}
                        onClick={() => handleMakerFilter(null)}
                    >
                        All
                    </button>
                    {makers.slice(0, 10).map((maker) => (
                        <button
                            key={maker}
                            className={`ref-chip ${activeMaker === maker ? "ref-chip-active" : ""}`}
                            onClick={() =>
                                handleMakerFilter(activeMaker === maker ? null : maker)
                            }
                        >
                            {maker}
                        </button>
                    ))}
                </div>
                {scales.length > 0 && (
                    <div className="ref-filter-group">
                        <span className="ref-filter-label">Scale:</span>
                        <select
                            id="catalog-scale-filter"
                            className="input ref-scale-select"
                            value={activeScale ?? ""}
                            onChange={(e) =>
                                handleScaleFilter(e.target.value || null)
                            }
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
            <div className="ref-results-summary">
                <span>
                    {total.toLocaleString()} {total === 1 ? "entry" : "entries"} found
                </span>
                {(search || activeMaker || activeScale) && (
                    <button
                        className="ref-clear-btn"
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
                                className="ref-th ref-th-sortable"
                                onClick={() => handleSort("title")}
                            >
                                Name {sortIndicator("title")}
                            </th>
                            <th
                                className="ref-th ref-th-sortable"
                                onClick={() => handleSort("maker")}
                            >
                                Maker {sortIndicator("maker")}
                            </th>
                            <th className="ref-th">Color</th>
                            <th className="ref-th">Mold</th>
                            <th
                                className="ref-th ref-th-sortable"
                                onClick={() => handleSort("scale")}
                            >
                                Scale {sortIndicator("scale")}
                            </th>
                            <th className="ref-th ref-th-actions">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr
                                key={item.id}
                                className="ref-row"
                                onClick={() => router.push(`/catalog/${item.id}`)}
                            >
                                <td className="ref-td ref-td-title">{item.title}</td>
                                <td className="ref-td">{item.maker}</td>
                                <td className="ref-td">{getAttr(item, "color")}</td>
                                <td className="ref-td">{getAttr(item, "mold")}</td>
                                <td className="ref-td">{item.scale ?? "—"}</td>
                                <td className="ref-td ref-td-actions">
                                    <button
                                        className="ref-suggest-link"
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
                                <td colSpan={6} className="ref-empty">
                                    No entries match your search.{" "}
                                    <a href="/catalog/suggestions">Suggest a new entry?</a>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="ref-pagination">
                    <button
                        className="btn btn-secondary btn-small"
                        disabled={page <= 1}
                        onClick={() => handlePage(page - 1)}
                    >
                        ← Previous
                    </button>
                    <span className="ref-page-info">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        className="btn btn-secondary btn-small"
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
