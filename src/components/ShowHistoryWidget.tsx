"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./ShowHistoryWidget.module.css";

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
        <details className={styles.widget} open>
            <summary className={styles.toggle}>
                🎪 <span>Show Placings</span>
                <span className={styles.count}>{totalRibbons} ribbons · {totalShows} shows</span>
            </summary>

            <div className={styles.content}>
                {years.map(({ year, records }) => (
                    <div key={year} className={styles.yearGroup}>
                        <button
                            type="button"
                            className={`${styles.yearHeader} ${expandedYear === year ? styles.yearExpanded : ""}`}
                            onClick={() => setExpandedYear(expandedYear === year ? null : year)}
                        >
                            <span className={styles.yearLabel}>
                                {year}
                                {year === currentYear && <span className={styles.currentBadge}>Current</span>}
                            </span>
                            <span className={styles.yearSummary}>{summarizeYear(records)}</span>
                            <span className={styles.chevron}>{expandedYear === year ? "▾" : "▸"}</span>
                        </button>

                        {expandedYear === year && (
                            <div className={styles.records}>
                                {records.map((record, i) => (
                                    <div key={i} className={styles.record}>
                                        <span className={styles.recordEmoji}>
                                            {RIBBON_EMOJI[record.placing] || "🏅"}
                                        </span>
                                        <div className={styles.recordInfo}>
                                            <Link href={`/community/${record.horseId}`} className={styles.horseName}>
                                                {record.horseName}
                                            </Link>
                                            <span className={styles.showName}>
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
