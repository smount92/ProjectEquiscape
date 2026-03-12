import Link from "next/link";
import { Suspense } from "react";
import { searchMarketPrices } from "@/app/actions/market";
import MarketFilters from "@/components/MarketFilters";

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

const PAGE_SIZE = 20;

export default async function MarketPricePage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; type?: string; finish?: string; sort?: string; page?: string }>;
}) {
    const params = await searchParams;
    const query = params.q || "";
    const itemType = params.type || "all";
    const finishType = params.finish || "";
    const sortValue = params.sort || "transaction_volume:desc";
    const page = Math.max(1, parseInt(params.page || "1"));
    const offset = (page - 1) * PAGE_SIZE;

    const [sortBy, sortDirection] = sortValue.split(":") as [
        "average_price" | "transaction_volume" | "last_sold_at" | "title",
        "asc" | "desc"
    ];

    const { items, total } = await searchMarketPrices(
        query || undefined,
        {
            itemType: itemType !== "all" ? itemType : undefined,
            finishType: finishType || undefined,
            sortBy,
            sortDirection,
            limit: PAGE_SIZE,
            offset,
        }
    );

    const totalPages = Math.ceil(total / PAGE_SIZE);

    // Build pagination URLs
    const buildPageUrl = (p: number) => {
        const newParams = new URLSearchParams();
        if (query) newParams.set("q", query);
        if (itemType !== "all") newParams.set("type", itemType);
        if (sortValue !== "transaction_volume:desc") newParams.set("sort", sortValue);
        if (p > 1) newParams.set("page", String(p));
        const qs = newParams.toString();
        return `/market${qs ? `?${qs}` : ""}`;
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

                    {/* Filters (Client Component) */}
                    <Suspense fallback={null}>
                        <MarketFilters />
                    </Suspense>

                    {/* Results (Server-rendered) */}
                    {items.length === 0 ? (
                        <div className="glass-card" style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
                            <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)" }}>📊</div>
                            <h3 style={{ marginBottom: "var(--space-sm)" }}>
                                {query || itemType !== "all"
                                    ? "No matching price data"
                                    : "The Blue Book Grows With Every Sale"}
                            </h3>
                            <p style={{ color: "var(--color-text-secondary)", maxWidth: 400, margin: "0 auto" }}>
                                {query || itemType !== "all"
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
                                    <div key={`${item.catalogId}::${item.finishType}`} className="market-card">
                                        <div className="market-card-header">
                                            <span className="market-card-icon">{typeIcon(item.itemType)}</span>
                                            <div className="market-card-info">
                                                <span className="market-card-title">{item.title}</span>
                                                <span className="market-card-maker">
                                                    {item.maker}{item.scale ? ` · ${item.scale}` : ""}
                                                    {item.finishType ? ` · ${item.finishType}` : ""}
                                                </span>
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
                            {totalPages > 1 && (
                                <div className="market-pagination">
                                    {page > 1 ? (
                                        <Link href={buildPageUrl(page - 1)} className="btn btn-ghost">
                                            ← Previous
                                        </Link>
                                    ) : (
                                        <button className="btn btn-ghost" disabled>← Previous</button>
                                    )}
                                    <span style={{ color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                                        Page {page} of {totalPages} ({total} items)
                                    </span>
                                    {page < totalPages ? (
                                        <Link href={buildPageUrl(page + 1)} className="btn btn-ghost">
                                            Next →
                                        </Link>
                                    ) : (
                                        <button className="btn btn-ghost" disabled>Next →</button>
                                    )}
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
