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
        <details className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm" id="nan-dashboard" open>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold tracking-widest text-stone-700 uppercase select-none [&::-webkit-details-marker]:hidden">
                🏆 NAN {currentYear} Qualification Status
                {totalQualified > 0 && (
                    <span className="ml-auto text-xs font-normal normal-case tracking-normal text-stone-500">
                        {totalQualified} horse{totalQualified !== 1 ? "s" : ""} across {totalDivisions} division
                        {totalDivisions !== 1 ? "s" : ""}
                    </span>
                )}
            </summary>
            <div className="mt-4 flex flex-col gap-1">
                {horses.slice(0, 10).map((h) => {
                    const currentYearCards = h.qualifications.filter((q) => q.year === currentYear);
                    const status = h.totalCards >= 3 ? "full" : h.totalCards > 0 ? "partial" : "none";

                    return (
                        <div
                            key={h.horseId}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-stone-50"
                        >
                            <span className="shrink-0 text-xs">
                                {status === "full" ? "🟢" : status === "partial" ? "🟡" : "🔴"}
                            </span>
                            <Link href={`/community/${h.horseId}`} className="truncate text-sm font-semibold text-stone-900 no-underline hover:text-forest">
                                {h.horseName}
                            </Link>
                            <span className="ml-auto flex shrink-0 gap-1 text-xs">
                                {currentYearCards.length > 0 ? (
                                    currentYearCards.map((q, i) => (
                                        <span key={i} className="rounded-full bg-stone-100 px-1.5 py-0.5 text-stone-600">
                                            {q.cardType === "green" ? "🟢" : q.cardType === "yellow" ? "🟡" : "🩷"}
                                            {q.count > 1 ? ` ×${q.count}` : ""}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-stone-400">No cards yet</span>
                                )}
                            </span>
                        </div>
                    );
                })}
                {horses.length > 10 && (
                    <p className="mt-2 text-sm text-stone-500">
                        + {horses.length - 10} more horses
                    </p>
                )}
            </div>
            <Link
                href="/shows/planner"
                className="mt-4 inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-6 py-2 text-sm font-semibold text-stone-600 no-underline transition-all hover:bg-stone-50"
            >
                🧳 Live Show Packer
            </Link>
        </details>
    );
}
