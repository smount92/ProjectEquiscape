"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * BlueBookProCharts — Premium analytics overlay
 * Free users: see median/avg text + blurred chart placeholder + upgrade CTA
 * Pro users: see full interactive historical data
 */

interface ChartDataPoint {
    date: string;
    price: number;
    finishType: string;
}

interface BlueBookProChartsProps {
    tier: "free" | "pro";
    catalogId: string;
    title: string;
    historicalData?: ChartDataPoint[];
    averagePrice: number;
    medianPrice: number;
    transactionVolume: number;
}

export default function BlueBookProCharts({
    tier,
    title,
    historicalData = [],
    averagePrice,
    medianPrice,
    transactionVolume,
}: BlueBookProChartsProps) {
    const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null);

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

    // ── Free Tier: Blurred chart with upgrade CTA ──
    if (tier === "free") {
        return (
            <div className="relative mt-6 overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-lg">
                {/* Summary stats (always visible) */}
                <div className="mb-4 flex items-center gap-3">
                    <span className="text-2xl">📊</span>
                    <div>
                        <h3 className="text-lg font-bold text-stone-800">{title}</h3>
                        <p className="text-sm text-ink-light">
                            Avg: {formatCurrency(averagePrice)} · Median: {formatCurrency(medianPrice)} · {transactionVolume} sale{transactionVolume !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>

                {/* Blurred fake chart */}
                <div className="relative">
                    <div className="pointer-events-none select-none blur-[6px]" aria-hidden="true">
                        <div className="flex h-[180px] items-end gap-1 rounded-lg bg-white/60 p-4">
                            {Array.from({ length: 24 }, (_, i) => (
                                <div
                                    key={i}
                                    className="flex-1 rounded-t bg-gradient-to-t from-emerald-400 to-emerald-600"
                                    style={{ height: `${30 + Math.sin(i * 0.8) * 25 + Math.random() * 40}%` }}
                                />
                            ))}
                        </div>
                        <div className="mt-2 flex justify-between text-xs text-muted">
                            <span>2021</span><span>2022</span><span>2023</span><span>2024</span><span>2025</span><span>2026</span>
                        </div>
                    </div>

                    {/* Upgrade overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-white/40 backdrop-blur-[2px]">
                        <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                            ✨ MHH Pro Feature
                        </div>
                        <p className="mt-2 max-w-[280px] text-center text-sm font-semibold text-stone-700">
                            Unlock 5-Year Historical Price Trends
                        </p>
                        <Link
                            href="/upgrade"
                            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-sm font-bold text-white shadow-md transition-all hover:from-amber-600 hover:to-orange-600 hover:shadow-lg no-underline"
                        >
                            💎 Upgrade to MHH Pro
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // ── Pro Tier: Full interactive chart ──
    const maxPrice = Math.max(...historicalData.map(d => d.price), 1);
    const chartWidth = 700;
    const chartHeight = 200;
    const padding = 40;

    return (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">📊</span>
                    <div>
                        <h3 className="text-lg font-bold text-stone-800">{title}</h3>
                        <p className="text-sm text-ink-light">
                            Avg: {formatCurrency(averagePrice)} · Median: {formatCurrency(medianPrice)} · {transactionVolume} sale{transactionVolume !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                    💎 PRO
                </span>
            </div>

            {historicalData.length > 0 ? (
                <div className="rounded-lg bg-white/70 p-4">
                    <svg
                        viewBox={`0 0 ${chartWidth} ${chartHeight + padding}`}
                        className="w-full"
                        onMouseLeave={() => setHoveredPoint(null)}
                    >
                        {/* Grid lines */}
                        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                            const y = chartHeight - pct * chartHeight;
                            return (
                                <g key={pct}>
                                    <line x1={padding} y1={y} x2={chartWidth - 10} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                                    <text x={0} y={y + 4} fontSize="10" fill="#9ca3af">
                                        {formatCurrency(maxPrice * pct)}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Data points */}
                        {historicalData.map((d, i) => {
                            const x = padding + (i / Math.max(historicalData.length - 1, 1)) * (chartWidth - padding - 10);
                            const y = chartHeight - (d.price / maxPrice) * chartHeight;
                            return (
                                <g key={i}>
                                    <circle
                                        cx={x}
                                        cy={y}
                                        r={hoveredPoint === d ? 6 : 4}
                                        fill={d.finishType === "Original Finish" ? "#10b981" : "#f59e0b"}
                                        stroke="white"
                                        strokeWidth="2"
                                        className="cursor-pointer transition-all"
                                        onMouseEnter={() => setHoveredPoint(d)}
                                    />
                                </g>
                            );
                        })}
                    </svg>

                    {/* Tooltip */}
                    {hoveredPoint && (
                        <div className="mt-2 rounded-md bg-stone-800 px-3 py-2 text-xs text-white">
                            {formatCurrency(hoveredPoint.price)} · {hoveredPoint.finishType} · {new Date(hoveredPoint.date).toLocaleDateString()}
                        </div>
                    )}

                    {/* Legend */}
                    <div className="mt-3 flex gap-4 text-xs text-ink-light">
                        <span className="flex items-center gap-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Original Finish
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> Custom / Other
                        </span>
                    </div>
                </div>
            ) : (
                <div className="rounded-lg bg-white/70 p-8 text-center text-sm text-ink-light">
                    No historical transaction data available yet for this item.
                </div>
            )}
        </div>
    );
}
