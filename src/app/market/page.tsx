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
        case "plastic_release":
            return "🐎";
        case "artist_resin":
            return "🎨";
        case "tack":
            return "🏇";
        case "prop":
            return "🌲";
        case "diorama":
            return "🎭";
        default:
            return "📦";
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
        "asc" | "desc",
    ];

    const { items, total } = await searchMarketPrices(query || undefined, {
        itemType: itemType !== "all" ? itemType : undefined,
        finishType: finishType || undefined,
        lifeStage: lifeStage || undefined,
        sortBy,
        sortDirection,
        limit: PAGE_SIZE,
        offset,
    });

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
        <div className="mx-auto max-w-[var(--max-width)] px-6 py-[0]">
            <div className="page-content max-w-[900]">
                <div className="animate-fade-in-up">
                    {/* Header */}
                    <div className="mb-12" style={{ textAlign: "center" }}>
                        <h1>
                            📈 Model Horse <span className="text-forest">Price Guide</span>
                        </h1>
                        <p className="text-ink-light mt-2 text-[calc(var(--font-size-md)*var(--font-scale))]">
                            The Blue Book — Real sale data from real collectors
                        </p>
                    </div>

                    {/* Filters (Client Component) */}
                    <Suspense fallback={null}>
                        <MarketFilters />
                    </Suspense>

                    {/* Results (Server-rendered) */}
                    {items.length === 0 ? (
                        <div
                            className="glass-bg-card border-edge rounded-lg border p-12 p-[var(--space-3xl)] shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]"
                            style={{ textAlign: "center" }}
                        >
                            <div className="mb-4 text-[3rem]">📊</div>
                            <h3 className="mb-2">
                                {query || itemType !== "all"
                                    ? "No matching price data"
                                    : "The Blue Book Grows With Every Sale"}
                            </h3>
                            <p className="text-ink-light mx-auto max-w-[400]">
                                {query || itemType !== "all"
                                    ? "Try broadening your search or changing the filter."
                                    : "Complete a transaction to contribute market data. Prices appear here after verified sales."}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4">
                                <span className="text-muted text-sm">
                                    {total} item{total !== 1 ? "s" : ""} with price data
                                </span>
                            </div>

                            <div className="market-bg-[var(--color-surface-secondary)] sticky top-0 font-semibold">
                                {items.map((item) => (
                                    <div
                                        key={`${item.catalogId}::${item.finishType}::${item.lifeStage}`}
                                        className="bg-bg-card border-edge border-edge rounded-lg border p-6 p-12 shadow-md transition-all transition-colors max-[480px]:rounded-[var(--radius-md)]"
                                    >
                                        <div className="bg-bg-card border-edge border-edge sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
                                            <span className="bg-bg-card border-edge border-edge transition-colors-icon rounded-lg border p-6 p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                                                {typeIcon(item.itemType)}
                                            </span>
                                            <div className="bg-bg-card border-edge border-edge transition-colors-info rounded-lg border p-6 p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                                                <span className="bg-bg-card border-edge border-edge transition-colors-title rounded-lg border p-6 p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                                                    {item.title}
                                                </span>
                                                <span className="bg-bg-card border-edge border-edge transition-colors-maker rounded-lg border p-6 p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                                                    {item.maker}
                                                    {item.scale ? ` · ${item.scale}` : ""}
                                                    {item.finishType ? ` · ${item.finishType}` : ""}
                                                    {item.lifeStage && item.lifeStage !== "completed"
                                                        ? ` · ${item.lifeStage === "blank" ? "Blank" : item.lifeStage === "stripped" ? "Stripped" : "In Progress"}`
                                                        : ""}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="bg-bg-card border-edge border-edge transition-colors-prices rounded-lg border p-6 p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                                            <div className="text-forest text-lg font-bold">
                                                {formatCurrency(item.lowestPrice)}
                                                {item.lowestPrice !== item.highestPrice
                                                    ? ` – ${formatCurrency(item.highestPrice)}`
                                                    : ""}
                                            </div>
                                            <div className="mt-[2px] text-sm text-[var(--color-text-secondary)]">
                                                <span>Avg: {formatCurrency(item.averagePrice)}</span>
                                                <span> · Median: {formatCurrency(item.medianPrice)}</span>
                                            </div>
                                        </div>

                                        <div className="bg-bg-card border-edge border-edge transition-colors-footer rounded-lg border p-6 p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                                            <span className="text-forest inline-flex items-center rounded-full bg-[var(--color-accent-primary-glow)] px-[8px] py-[2px] font-semibold">
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
                                <div className="border-edge mt-8 flex items-center justify-between border-t pt-6">
                                    {page > 1 ? (
                                        <Link
                                            href={buildPageUrl(page - 1)}
                                            className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
                                        >
                                            ← Previous
                                        </Link>
                                    ) : (
                                        <button
                                            className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
                                            disabled
                                        >
                                            ← Previous
                                        </button>
                                    )}
                                    <span className="text-muted text-sm">
                                        Page {page} of {totalPages} ({total} items)
                                    </span>
                                    {page < totalPages ? (
                                        <Link
                                            href={buildPageUrl(page + 1)}
                                            className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
                                        >
                                            Next →
                                        </Link>
                                    ) : (
                                        <button
                                            className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
                                            disabled
                                        >
                                            Next →
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* Disclaimer */}
                    <div className="border-edge mt-12 rounded-lg border bg-[var(--color-surface-glass)] p-6 text-xs">
                        <p>
                            📋 Prices based on completed transactions recorded on Model Horse Hub. This is not a
                            professional appraisal. Market conditions vary. Always research current listings before
                            buying or selling.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
