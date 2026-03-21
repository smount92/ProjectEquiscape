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
    searchParams: Promise<{ q?: string; type?: string; finish?: string; stage?: string; sort?: string; page?: string }>;
}) {
    const params = await searchParams;
    const query = params.q || "";
    const itemType = params.type || "all";
    const finishType = params.finish || "";
    const lifeStage = params.stage || "";
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
            lifeStage: lifeStage || undefined,
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
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6">
            <div className="page-content" style={{ maxWidth: 900 }}>
                <div className="animate-fade-in-up">
                    {/* Header */}
                    <div style={{ textAlign: "center", marginBottom: "var(--space-2xl)" }}>
                        <h1>📈 Model Horse <span className="text-forest">Price Guide</span></h1>
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
                        <div className="glass-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all" style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
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
                            <div className="mb-4">
                                <span style={{ color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                                    {total} item{total !== 1 ? "s" : ""} with price data
                                </span>
                            </div>

                            <div className="market-bg-[var(--color-surface-secondary)] font-semibold sticky top-0">
                                {items.map((item) => (
                                    <div key={`${item.catalogId}::${item.finishType}::${item.lifeStage}`} className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-6 transition-colors">
                                        <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-6 transition-colors-sticky top-0 z-[100] h-[var(--header max-sm:py-[0] max-sm:px-4-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">
                                            <span className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-6 transition-colors-icon">{typeIcon(item.itemType)}</span>
                                            <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-6 transition-colors-info">
                                                <span className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-6 transition-colors-title">{item.title}</span>
                                                <span className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-6 transition-colors-maker">
                                                    {item.maker}{item.scale ? ` · ${item.scale}` : ""}
                                                    {item.finishType ? ` · ${item.finishType}` : ""}
                                                    {item.lifeStage && item.lifeStage !== "completed" ? ` · ${item.lifeStage === "blank" ? "Blank" : item.lifeStage === "stripped" ? "Stripped" : "In Progress"}` : ""}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-6 transition-colors-prices">
                                            <div className="text-lg font-bold text-forest">
                                                {formatCurrency(item.lowestPrice)}
                                                {item.lowestPrice !== item.highestPrice ? ` – ${formatCurrency(item.highestPrice)}` : ""}
                                            </div>
                                            <div className="text-sm text-[var(--color-text-secondary)] mt-[2px]">
                                                <span>Avg: {formatCurrency(item.averagePrice)}</span>
                                                <span> · Median: {formatCurrency(item.medianPrice)}</span>
                                            </div>
                                        </div>

                                        <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-6 transition-colors-footer">
                                            <span className="inline-flex items-center py-[2px] px-[8px] rounded-full bg-[var(--color-accent-primary-glow)] text-forest font-semibold">
                                                {item.transactionVolume} sale{item.transactionVolume !== 1 ? "s" : ""}
                                            </span>
                                            {item.lastSoldAt && (
                                                <span className="text-muted">
                                                    Last sold: {formatRelativeTime(item.lastSoldAt)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex justify-between items-center mt-8 pt-6 border-t border-edge">
                                    {page > 1 ? (
                                        <Link href={buildPageUrl(page - 1)} className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge">
                                            ← Previous
                                        </Link>
                                    ) : (
                                        <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" disabled>← Previous</button>
                                    )}
                                    <span style={{ color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                                        Page {page} of {totalPages} ({total} items)
                                    </span>
                                    {page < totalPages ? (
                                        <Link href={buildPageUrl(page + 1)} className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge">
                                            Next →
                                        </Link>
                                    ) : (
                                        <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" disabled>Next →</button>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* Disclaimer */}
                    <div className="mt-12 p-6 rounded-lg bg-[var(--color-surface-glass)] border border-edge text-xs">
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
