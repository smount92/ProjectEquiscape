"use client";

import { useState } from "react";
import Link from "next/link";

interface ShowHistoryRecord {
    horseName: string;
    horseId: string;
    showName: string;
    placing: string;
    ribbonColor: string | null;
    showDate: string;
}

interface ShowHistoryYear {
    year: number;
    records: ShowHistoryRecord[];
}

interface ShowHistoryWidgetProps {
    years: ShowHistoryYear[];
    totalShows: number;
    totalRibbons: number;
}

const RIBBON_EMOJI: Record<string, string> = {
    "1st": "🥇",
    "2nd": "🥈",
    "3rd": "🥉",
    "HM": "🎗️",
    "Champion": "🏆",
    "Reserve Champion": "🥈",
    "Grand Champion": "🏆",
    "Reserve Grand Champion": "🥈",
};

export default function ShowHistoryWidget({ years, totalShows, totalRibbons }: ShowHistoryWidgetProps) {
    const currentYear = new Date().getFullYear();
    const [expandedYear, setExpandedYear] = useState<number | null>(
        years.length > 0 ? years[0].year : null
    );

    if (years.length === 0) return null;

    // Summarize ribbon counts for a year
    const summarizeYear = (records: ShowHistoryRecord[]) => {
        const counts: Record<string, number> = {};
        for (const r of records) {
            const emoji = RIBBON_EMOJI[r.placing] || "🏅";
            counts[emoji] = (counts[emoji] || 0) + 1;
        }
        return Object.entries(counts)
            .map(([emoji, count]) => `${emoji}×${count}`)
            .join(" ");
    };

    return (
        <details className="mt-6 rounded-lg bg-[linear-gradient(135deg,rgba(139,92,246,0.06),rgba(245,158,11,0.04))] border border-[rgba(139,92,246,0.15)] p-2" open>
            <summary className="flex items-center gap-2 py-2 px-4 text-base font-bold text-ink cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
                🎪 <span>Show Placings</span>
                <span className="text-xs font-normal text-muted ml-auto">{totalRibbons} ribbons · {totalShows} shows</span>
            </summary>

            <div className="py-1 px-4 pb-2">
                {years.map(({ year, records }) => (
                    <div key={year} className="mb-1">
                        <button
                            type="button"
                            className={`flex items-center gap-2 w-full py-2 px-2 border-none rounded-sm bg-transparent text-ink cursor-pointer text-sm font-semibold transition-colors hover:bg-[rgba(139,92,246,0.08)] ${expandedYear === year ? "bg-[rgba(139,92,246,0.06)]" : ""}`}
                            onClick={() => setExpandedYear(expandedYear === year ? null : year)}
                        >
                            <span className="flex items-center gap-1">
                                {year}
                                {year === currentYear && <span className="text-[0.6rem] font-bold py-[1px] px-1.5 rounded-full bg-[rgba(34,197,94,0.15)] text-[#22c55e] uppercase tracking-wide">Current</span>}
                            </span>
                            <span className="flex-1 text-right text-xs font-normal text-muted">{summarizeYear(records)}</span>
                            <span className="text-[0.8em] text-muted">{expandedYear === year ? "▾" : "▸"}</span>
                        </button>

                        {expandedYear === year && (
                            <div className="py-1 pl-4">
                                {records.map((record, i) => (
                                    <div key={i} className="flex items-center gap-2 py-1 text-sm">
                                        <span className="shrink-0 text-base">
                                            {RIBBON_EMOJI[record.placing] || "🏅"}
                                        </span>
                                        <div className="flex flex-col min-w-0">
                                            <Link href={`/community/${record.horseId}`} className="font-semibold text-ink no-underline whitespace-nowrap overflow-hidden text-ellipsis hover:underline">
                                                {record.horseName}
                                            </Link>
                                            <span className="text-xs text-muted whitespace-nowrap overflow-hidden text-ellipsis">
                                                {record.showName} · {record.placing}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </details>
    );
}


