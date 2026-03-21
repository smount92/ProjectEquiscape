import { getNanDashboard } from "@/app/actions/competition";
import Link from "next/link";

export default async function NanDashboardWidget() {
    const horses = await getNanDashboard();

    // Only show horses with at least one card, plus a summary
    const qualified = horses.filter((h) => h.totalCards > 0);
    const totalQualified = qualified.length;
    const totalDivisions = qualified.reduce((sum, h) => sum + h.qualifications.length, 0);

    if (horses.length === 0) return null;

    const currentYear = new Date().getFullYear();

    return (
        <details className="nan-dashboard-widget" id="nan-dashboard">
            <summary className="hidden">
                🏆 NAN {currentYear} Qualification Status
                {totalQualified > 0 && (
                    <span className="text-muted ml-auto text-[calc(0.8rem*var(--font-scale))] font-normal">
                        {totalQualified} horse{totalQualified !== 1 ? "s" : ""} across {totalDivisions} division
                        {totalDivisions !== 1 ? "s" : ""}
                    </span>
                )}
            </summary>
            <div className="px-4 py-2">
                {horses.slice(0, 10).map((h) => {
                    const currentYearCards = h.qualifications.filter((q) => q.year === currentYear);
                    const status = h.totalCards >= 3 ? "full" : h.totalCards > 0 ? "partial" : "none";

                    return (
                        <div key={h.horseId} className={`nan-horse-row nan-status-${status}`}>
                            <span className="shrink-0 text-xs">
                                {status === "full" ? "🟢" : status === "partial" ? "🟡" : "🔴"}
                            </span>
                            <Link href={`/community/${h.horseId}`} className="text-ink font-semibold no-underline">
                                {h.horseName}
                            </Link>
                            <span className="ml-auto flex gap-1 text-[calc(0.75rem*var(--font-scale))]">
                                {currentYearCards.length > 0 ? (
                                    currentYearCards.map((q, i) => (
                                        <span key={i} className={`nan-card nan-card-${q.cardType}`}>
                                            {q.cardType === "green" ? "🟢" : q.cardType === "yellow" ? "🟡" : "🩷"}
                                            {q.count > 1 ? ` ×${q.count}` : ""}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-muted">No cards yet</span>
                                )}
                            </span>
                        </div>
                    );
                })}
                {horses.length > 10 && (
                    <p className="text-muted mt-2 text-[calc(0.8rem*var(--font-scale))]">
                        + {horses.length - 10} more horses
                    </p>
                )}
            </div>
            <Link
                href="/shows/planner"
                className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
            >
                📋 View Full NAN Planner
            </Link>
        </details>
    );
}
