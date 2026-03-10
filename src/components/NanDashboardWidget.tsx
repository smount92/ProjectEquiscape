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
            <summary className="nan-dashboard-toggle">
                🏆 NAN {currentYear} Qualification Status
                {totalQualified > 0 && (
                    <span className="nan-dashboard-count">
                        {totalQualified} horse{totalQualified !== 1 ? "s" : ""} across {totalDivisions} division{totalDivisions !== 1 ? "s" : ""}
                    </span>
                )}
            </summary>
            <div className="nan-dashboard-list">
                {horses.slice(0, 10).map(h => {
                    const currentYearCards = h.qualifications.filter(q => q.year === currentYear);
                    const status = h.totalCards >= 3 ? "full" : h.totalCards > 0 ? "partial" : "none";

                    return (
                        <div key={h.horseId} className={`nan-horse-row nan-status-${status}`}>
                            <span className="nan-horse-dot">
                                {status === "full" ? "🟢" : status === "partial" ? "🟡" : "🔴"}
                            </span>
                            <Link href={`/community/${h.horseId}`} className="nan-horse-name">
                                {h.horseName}
                            </Link>
                            <span className="nan-horse-cards">
                                {currentYearCards.length > 0 ? (
                                    currentYearCards.map((q, i) => (
                                        <span key={i} className={`nan-card nan-card-${q.cardType}`}>
                                            {q.cardType === "green" ? "🟢" : q.cardType === "yellow" ? "🟡" : "🩷"}
                                            {q.count > 1 ? ` ×${q.count}` : ""}
                                        </span>
                                    ))
                                ) : (
                                    <span className="nan-none">No cards yet</span>
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
            <Link href="/shows/planner" className="btn btn-ghost" style={{ marginTop: "var(--space-md)" }}>
                📋 View Full NAN Planner
            </Link>
        </details>
    );
}
