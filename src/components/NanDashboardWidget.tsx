import { getNanDashboard } from "@/app/actions/competition";
import Link from "next/link";

export default async function NanDashboardWidget() {
    const horses = await getNanDashboard();

    // Only show horses with at least one card, plus a summary
    const qualified = horses.filter((h) => h.totalCards > 0);
    const totalQualifiedHorses = qualified.length;
    const totalActiveCards = qualified.reduce((sum, h) => sum + h.activeCards, 0);

    if (horses.length === 0) return null;

    const currentYear = new Date().getFullYear();

    return (
        <details className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm" id="nan-dashboard" open>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold tracking-widest text-stone-700 uppercase select-none [&::-webkit-details-marker]:hidden">
                🏆 NAN {currentYear} Qualification Status
                {totalQualifiedHorses > 0 && (
                    <span className="ml-auto text-xs font-normal normal-case tracking-normal text-stone-500">
                        {totalQualifiedHorses} horse{totalQualifiedHorses !== 1 ? "s" : ""} · {totalActiveCards} active card{totalActiveCards !== 1 ? "s" : ""}
                    </span>
                )}
            </summary>

            {/* Partnership disclosure */}
            <p className="mt-3 mb-1 text-xs text-stone-400 italic">
                Track your NAN progress digitally — official NAN cards are issued by NAMHSA.
            </p>

            <div className="mt-2 flex flex-col gap-1">
                {horses.slice(0, 10).map((h) => {
                    const currentYearCards = h.qualifications.filter((q) => q.year === currentYear);
                    const status = h.activeCards >= 3 ? "full" : h.activeCards > 0 ? "partial" : "none";

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
                            <span className="ml-auto flex shrink-0 flex-wrap gap-1 text-xs">
                                {h.qualifications.length > 0 ? (
                                    h.qualifications.map((q, i) => (
                                        <span
                                            key={i}
                                            className={`rounded-full px-1.5 py-0.5 ${
                                                q.isExpired
                                                    ? "bg-stone-50 text-stone-300 line-through"
                                                    : "bg-stone-100 text-stone-600"
                                            }`}
                                            title={q.isExpired ? `Expired (${q.year})` : `${q.year} ${q.cardType}`}
                                        >
                                            {q.cardType === "green" ? "🟢" : q.cardType === "yellow" ? "🟡" : "🩷"}
                                            {q.count > 1 ? ` ×${q.count}` : ""}
                                            {q.isExpired && <span className="ml-0.5 text-[10px]">expired</span>}
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
            <div className="mt-4 flex flex-wrap gap-2">
                <Link
                    href="/shows/planner"
                    className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-6 py-2 text-sm font-semibold text-stone-600 no-underline transition-all hover:bg-stone-50"
                >
                    🧳 Live Show Packer
                </Link>
                {totalQualifiedHorses > 0 && (
                    <a
                        href="/api/export/nan-cards"
                        className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-6 py-2 text-sm font-semibold text-stone-600 no-underline transition-all hover:bg-stone-50"
                    >
                        📥 Export NAN Cards
                    </a>
                )}
            </div>
        </details>
    );
}
