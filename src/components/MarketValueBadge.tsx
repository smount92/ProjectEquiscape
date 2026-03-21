"use client";

import { useState, useEffect } from "react";
import { getMarketPrice } from "@/app/actions/market";

interface MarketValueBadgeProps {
    catalogId: string | null;
    compact?: boolean;
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export default function MarketValueBadge({ catalogId, compact = false }: MarketValueBadgeProps) {
    const [price, setPrice] = useState<{
        lowest: number; highest: number; average: number; median: number; volume: number;
    } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!catalogId) { setLoading(false); return; }
        let cancelled = false;

        getMarketPrice(catalogId).then(data => {
            if (cancelled) return;
            if (data && data.transactionVolume > 0) {
                setPrice({
                    lowest: data.lowestPrice,
                    highest: data.highestPrice,
                    average: data.averagePrice,
                    median: data.medianPrice,
                    volume: data.transactionVolume,
                });
            }
            setLoading(false);
        }).catch(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [catalogId]);

    if (loading) return null;
    if (!price) return null;

    if (compact) {
        return (
            <span className="inline-flex items-center gap-[4px] py-[2px] px-[8px] rounded-full bg-[rgba(16, 185, 129, 0.1)] text-[#10b981] text-xs font-semibold whitespace-nowrap" title={`${price.volume} sale${price.volume !== 1 ? "s" : ""} — Avg: ${formatCurrency(price.average)}`}>
                📈 {formatCurrency(price.lowest)}{price.lowest !== price.highest ? `–${formatCurrency(price.highest)}` : ""}
            </span>
        );
    }

    return (
        <div className="bg-glass border border-edge rounded-lg p-6 mt-6">
            <h4 className="flex items-center gap-1 mb-2 text-sm text-[var(--color-text-secondary)] font-semibold">
                <span aria-hidden="true">📈</span> Market Value
            </h4>
            <div className="text-lg font-bold text-forest">
                {formatCurrency(price.lowest)}{price.lowest !== price.highest ? ` – ${formatCurrency(price.highest)}` : ""}
            </div>
            <div className="flex gap-4 flex-wrap mt-1 text-sm text-[var(--color-text-secondary)]">
                <span>Avg: {formatCurrency(price.average)}</span>
                <span>Median: {formatCurrency(price.median)}</span>
                <span className="inline-flex items-center py-[1px] px-[6px] rounded-full bg-[var(--color-accent-primary-glow)] text-forest font-semibold text-xs">{price.volume} sale{price.volume !== 1 ? "s" : ""}</span>
            </div>
        </div>
    );
}
