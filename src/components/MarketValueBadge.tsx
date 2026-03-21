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
            <span className="market-badge" title={`${price.volume} sale${price.volume !== 1 ? "s" : ""} — Avg: ${formatCurrency(price.average)}`}>
                📈 {formatCurrency(price.lowest)}{price.lowest !== price.highest ? `–${formatCurrency(price.highest)}` : ""}
            </span>
        );
    }

    return (
        <div className="bg-glass border border-edge rounded-lg p-6 mt-6">
            <h4 className="market-value-title">
                <span aria-hidden="true">📈</span> Market Value
            </h4>
            <div className="market-price-range">
                {formatCurrency(price.lowest)}{price.lowest !== price.highest ? ` – ${formatCurrency(price.highest)}` : ""}
            </div>
            <div className="market-value-details">
                <span>Avg: {formatCurrency(price.average)}</span>
                <span>Median: {formatCurrency(price.median)}</span>
                <span className="market-volume">{price.volume} sale{price.volume !== 1 ? "s" : ""}</span>
            </div>
        </div>
    );
}
