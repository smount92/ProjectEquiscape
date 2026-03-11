"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { searchMarketPrices } from "@/app/actions/market";
import type { MarketPrice } from "@/app/actions/market";

const ITEM_TYPE_LABELS: Record<string, string> = {
    all: "All Types",
    plastic_mold: "Plastic Molds",
    plastic_release: "Plastic Releases",
    artist_resin: "Artist Resins",
    tack: "Tack",
    prop: "Props",
};

const SORT_OPTIONS = [
    { value: "transaction_volume:desc", label: "Most Traded" },
    { value: "average_price:desc", label: "Highest Value" },
    { value: "average_price:asc", label: "Lowest Value" },
    { value: "last_sold_at:desc", label: "Recently Sold" },
    { value: "title:asc", label: "A – Z" },
];

const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
};

const PAGE_SIZE = 20;

export default function MarketPricePage() {
    const [items, setItems] = useState<MarketPrice[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [itemType, setItemType] = useState("all");
    const [sortValue, setSortValue] = useState("transaction_volume:desc");
    const [offset, setOffset] = useState(0);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Reset offset when filters change
    useEffect(() => { setOffset(0); }, [debouncedQuery, itemType, sortValue]);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        const [sortBy, sortDirection] = sortValue.split(":") as [
            "average_price" | "transaction_volume" | "last_sold_at" | "title",
            "asc" | "desc"
        ];

        const result = await searchMarketPrices(
            debouncedQuery || undefined,
            { itemType: itemType !== "all" ? itemType : undefined, sortBy, sortDirection, limit: PAGE_SIZE, offset }
        );

        setItems(result.items);
        setTotal(result.total);
        setIsLoading(false);
    }, [debouncedQuery, itemType, sortValue, offset]);

    useEffect(() => { loadData(); }, [loadData]);

    const typeIcon = (type: string) => {
        switch (type) {
            case "plastic_mold":
            case "plastic_release": return "🐎";
            case "artist_resin": return "🎨";
            case "tack": return "🏇";
            case "prop": return "🌲";
            case "diorama": return "🎭";
            default: return "📦";
        }
    };

    return (
        <div className="page-container">
            <div className="page-content" style={{ maxWidth: 900 }}>
                <div className="animate-fade-in-up">
                    {/* Header */}
                    <div style={{ textAlign: "center", marginBottom: "var(--space-2xl)" }}>
                        <h1>📈 Model Horse <span className="text-gradient">Price Guide</span></h1>
                        <p style={{ color: "var(--color-text-secondary)", fontSize: "calc(var(--font-size-md) * var(--font-scale))", marginTop: "var(--space-sm)" }}>
                            The Blue Book — Real sale data from real collectors
                        </p>
                    </div>

                    {/* Search & Filters */}
                    <div className="market-filters">
                        <div className="market-search-row">
                            <input
                                className="form-input market-search-input"
                                type="search"
                                placeholder="Search by mold, release, or artist resin…"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="market-filter-row">
                            <div className="market-type-filters">
                                {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
                                    <button
                                        key={value}
                                        className={`market-filter-chip ${itemType === value ? "active" : ""}`}
                                        onClick={() => setItemType(value)}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <select
                                className="form-select market-sort-select"
                                value={sortValue}
                                onChange={(e) => setSortValue(e.target.value)}
                            >
                                {SORT_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Results */}
                    {isLoading ? (
                        <div style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
                            <div className="btn-spinner" style={{ margin: "0 auto var(--space-md)", borderTopColor: "var(--color-accent-primary)" }} />
                            <p style={{ color: "var(--color-text-muted)" }}>Loading price data…</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="glass-card" style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
                            <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)" }}>📊</div>
                            <h3 style={{ marginBottom: "var(--space-sm)" }}>
                                {debouncedQuery || itemType !== "all"
                                    ? "No matching price data"
                                    : "The Blue Book Grows With Every Sale"}
                            </h3>
                            <p style={{ color: "var(--color-text-secondary)", maxWidth: 400, margin: "0 auto" }}>
                                {debouncedQuery || itemType !== "all"
                                    ? "Try broadening your search or changing the filter."
                                    : "Complete a transaction to contribute market data. Prices appear here after verified sales."}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="market-results-header">
                                <span style={{ color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                                    {total} item{total !== 1 ? "s" : ""} with price data
                                </span>
                            </div>

                            <div className="market-results-grid">
                                {items.map((item) => (
                                    <div key={item.catalogId} className="market-card">
                                        <div className="market-card-header">
                                            <span className="market-card-icon">{typeIcon(item.itemType)}</span>
                                            <div className="market-card-info">
                                                <span className="market-card-title">{item.title}</span>
                                                <span className="market-card-maker">{item.maker}{item.scale ? ` · ${item.scale}` : ""}</span>
                                            </div>
                                        </div>

                                        <div className="market-card-prices">
                                            <div className="market-price-range">
                                                {formatCurrency(item.lowestPrice)}
                                                {item.lowestPrice !== item.highestPrice ? ` – ${formatCurrency(item.highestPrice)}` : ""}
                                            </div>
                                            <div className="market-price-details">
                                                <span>Avg: {formatCurrency(item.averagePrice)}</span>
                                                <span> · Median: {formatCurrency(item.medianPrice)}</span>
                                            </div>
                                        </div>

                                        <div className="market-card-footer">
                                            <span className="market-volume-badge">
                                                {item.transactionVolume} sale{item.transactionVolume !== 1 ? "s" : ""}
                                            </span>
                                            {item.lastSoldAt && (
                                                <span className="market-last-sold">
                                                    Last sold: {formatRelativeTime(item.lastSoldAt)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination */}
                            {total > PAGE_SIZE && (
                                <div className="market-pagination">
                                    <button
                                        className="btn btn-ghost"
                                        onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                                        disabled={offset === 0}
                                    >
                                        ← Previous
                                    </button>
                                    <span style={{ color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                                        {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
                                    </span>
                                    <button
                                        className="btn btn-ghost"
                                        onClick={() => setOffset(offset + PAGE_SIZE)}
                                        disabled={offset + PAGE_SIZE >= total}
                                    >
                                        Next →
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* Disclaimer */}
                    <div className="market-disclaimer">
                        <p>
                            📋 Prices based on completed transactions recorded on Model Horse Hub.
                            This is not a professional appraisal. Market conditions vary.
                            Always research current listings before buying or selling.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
