import { getNanDashboard } from "@/app/actions/competition";
import Link from "next/link";

export default async function NanDashboardWidget() {
    const horses = await getNanDashboard();

    // Only show horses with at least one card, plus a summary
    const qualified = horses.filter(h => h.totalCards > 0);
    const totalQualified = qualified.length;
    const totalDivisions = qualified.reduce((sum, h) => sum + h.qualifications.length, 0);

    if (horses.length === 0) return null;

    const currentYear = new Date().getFullYear();

    return (
        <details className="nan-dashboard-widget" id="nan-dashboard">
            <summary className="hidden">
                🏆 NAN {currentYear} Qualification Status
                {totalQualified > 0 && (
                    <span className="text-[calc(0.8rem*var(--font-scale))] font-normal text-muted ml-auto">
                        {totalQualified} horse{totalQualified !== 1 ? "s" : ""} across {totalDivisions} division{totalDivisions !== 1 ? "s" : ""}
                    </span>
                )}
            </summary>
            <div className="py-2 px-4">
                {horses.slice(0, 10).map(h => {
                    const currentYearCards = h.qualifications.filter(q => q.year === currentYear);
                    const status = h.totalCards >= 3 ? "full" : h.totalCards > 0 ? "partial" : "none";

                    return (
                        <div key={h.horseId} className={`nan-horse-row nan-status-${status}`}>
                            <span className="text-xs shrink-0">
                                {status === "full" ? "🟢" : status === "partial" ? "🟡" : "🔴"}
                            </span>
                            <Link href={`/community/${h.horseId}`} className="font-semibold text-ink no-underline">
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
                    <p style={{ fontSize: "calc(0.8rem * var(--font-scale))", color: "var(--color-text-muted)", marginTop: "var(--space-sm)" }}>
                        + {horses.length - 10} more horses
                    </p>
                )}
            </div>
            <Link href="/shows/planner" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" style={{ marginTop: "var(--space-md)" }}>
                📋 View Full NAN Planner
            </Link>
        </details>
    );
}
