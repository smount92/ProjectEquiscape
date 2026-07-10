/**
 * Digital Stable v2 (NEXT_PUBLIC_STABLE_V2) — the filter-ledger
 * dashboard. Leather masthead band → ledger filter bar → server-
 * filtered grid/ledger fed by getStablePage. The URL is the single
 * source of truth for filters; the sidebar is fed by getStableSummary
 * (one aggregate round-trip instead of three unbounded fetches).
 */

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Suspense } from "react";
import { BarChart3, DollarSign, FolderOpen, Mail, Plus, Award } from "lucide-react";

import StableMasthead from "@/components/stable/StableMasthead";
import StableBrowser from "@/components/stable/StableBrowser";
import ExportButton from "@/components/ExportButton";
import InsuranceReportButton from "@/components/InsuranceReportButton";
import TransferHistorySection from "@/components/TransferHistorySection";
import NanDashboardWidget from "@/components/NanDashboardWidget";
import ShowHistoryWidget from "@/components/ShowHistoryWidget";
import { getShowHistory } from "@/app/actions/shows";
import { getStablePage, getStableSummary, listStableViews } from "@/app/actions/stable";
import { parseStableSearchParams } from "@/lib/stable/filterParams";
import type { StableSummary } from "@/lib/stable/types";

/** Async server-side wrapper to fetch show history data */
async function ShowHistoryWidgetWrapper() {
    try {
        const data = await getShowHistory();
        if (data.totalRibbons === 0) return null;
        return <ShowHistoryWidget years={data.years} totalShows={data.totalShows} totalRibbons={data.totalRibbons} />;
    } catch {
        return null;
    }
}

function StatRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between rounded-sm px-1 py-2 transition-colors hover:bg-black/[0.03]">
            <span className="flex items-center gap-1.5 text-sm text-secondary-foreground">
                {icon} {label}
            </span>
            <span className="text-sm font-bold text-foreground">{value}</span>
        </div>
    );
}

export default async function DashboardV2({
    userId,
    aliasName,
    searchParams,
}: {
    userId: string;
    aliasName: string | null;
    searchParams: Record<string, string | string[] | undefined>;
}) {
    const supabase = await createClient();
    const filters = parseStableSearchParams(searchParams);

    // Filtered page + aggregates + saved views in parallel, alongside
    // the cheap sidebar extras (show placings, unread messages).
    const [pageResult, summaryResult, viewsResult, showRecordsResult, convosResult] =
        await Promise.all([
            getStablePage(filters),
            getStableSummary(),
            listStableViews(),
            supabase.from("show_records").select("id", { count: "exact", head: true }).eq("user_id", userId),
            supabase.from("conversations").select("id").or(`buyer_id.eq.${userId},seller_id.eq.${userId}`),
        ]);

    const convoIds = (convosResult.data ?? []).map((c: { id: string }) => c.id);
    const { count: unreadMsgCount } =
        convoIds.length > 0
            ? await supabase
                  .from("messages")
                  .select("id", { count: "exact", head: true })
                  .neq("sender_id", userId)
                  .eq("is_read", false)
                  .in("conversation_id", convoIds)
            : { count: 0 };

    const summary: StableSummary = summaryResult.success
        ? summaryResult.summary
        : { totalHorses: 0, vaultTotal: 0, forSaleCount: 0, collections: [] };
    const savedViews = viewsResult.success ? viewsResult.views : [];
    const cards = pageResult.success ? pageResult.cards : [];
    const totalCount = pageResult.success ? pageResult.totalCount : 0;
    const hasMore = pageResult.success ? pageResult.hasMore : false;
    const facetOptions = pageResult.success
        ? pageResult.facetOptions
        : { makers: [], scales: [], finishes: [], categories: [] };
    const totalShowRecords = showRecordsResult.count ?? 0;

    return (
        <>
            <StableMasthead aliasName={aliasName} totalHorses={summary.totalHorses} />

            {!pageResult.success && (
                <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                    {pageResult.error}
                </div>
            )}

            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_320px] 2xl:grid-cols-[1fr_360px]">
                {/* ── MAIN: filter ledger + browser ── */}
                <main className="min-w-0">
                    <StableBrowser
                        initialCards={cards}
                        totalCount={totalCount}
                        initialHasMore={hasMore}
                        herdTotal={summary.totalHorses}
                        facetOptions={facetOptions}
                        collections={summary.collections.map((c) => ({ id: c.id, name: c.name }))}
                        savedViews={savedViews}
                        filters={filters}
                    />
                </main>

                {/* ── SIDEBAR: widgets (fed by the one summary round-trip) ── */}
                <aside className="space-y-6">
                    {summary.totalHorses > 0 && (
                        <div className="bg-card rounded-lg border border-input p-6 shadow-md transition-all">
                            <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-widest text-secondary-foreground uppercase">
                                <BarChart3 size={14} strokeWidth={1.5} /> Stable Overview
                            </h3>
                            <div className="flex flex-col gap-[2px]">
                                <StatRow
                                    icon={<Plus size={14} strokeWidth={1.5} />}
                                    label="Total Models"
                                    value={summary.totalHorses}
                                />
                                <StatRow
                                    icon={<FolderOpen size={14} strokeWidth={1.5} />}
                                    label="Collections"
                                    value={summary.collections.length}
                                />
                                <StatRow
                                    icon={<DollarSign size={14} strokeWidth={1.5} />}
                                    label="Vault Value"
                                    value={
                                        summary.vaultTotal > 0
                                            ? `$${summary.vaultTotal.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                            : "—"
                                    }
                                />
                                <StatRow
                                    icon={<Award size={14} strokeWidth={1.5} />}
                                    label="Show Placings"
                                    value={totalShowRecords}
                                />
                                {(unreadMsgCount ?? 0) > 0 && (
                                    <Link
                                        href="/inbox"
                                        className="flex items-center justify-between rounded-sm px-1 py-2 no-underline transition-colors hover:bg-black/[0.03]"
                                        style={{ textDecoration: "none" }}
                                    >
                                        <span className="flex items-center gap-1.5 text-sm text-secondary-foreground">
                                            <Mail size={14} strokeWidth={1.5} /> Unread Messages
                                        </span>
                                        <span className="text-forest text-sm font-bold">{unreadMsgCount}</span>
                                    </Link>
                                )}
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2 border-t border-input pt-4">
                                <ExportButton />
                                <InsuranceReportButton />
                            </div>
                        </div>
                    )}

                    {/* Collections */}
                    {summary.collections.length > 0 && (
                        <div className="bg-card rounded-lg border border-input p-6 shadow-md transition-all">
                            <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-widest text-secondary-foreground uppercase">
                                <FolderOpen size={14} strokeWidth={1.5} /> Collections
                            </h3>
                            <div className="flex flex-col gap-1">
                                {summary.collections.map((col) => (
                                    <Link
                                        key={col.id}
                                        href={`/stable/collection/${col.id}`}
                                        className="flex items-center justify-between rounded-md border border-transparent bg-black/[0.02] px-4 py-2 text-sm text-foreground no-underline transition-all hover:border-input hover:bg-black/[0.06] hover:no-underline"
                                        id={`collection-${col.id}`}
                                    >
                                        <span>{col.name}</span>
                                        <span className="text-xs whitespace-nowrap text-secondary-foreground">
                                            {col.count}
                                            {col.value > 0 && (
                                                <>
                                                    {" "}
                                                    · $
                                                    {col.value.toLocaleString("en-US", {
                                                        minimumFractionDigits: 0,
                                                        maximumFractionDigits: 0,
                                                    })}
                                                </>
                                            )}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    <Suspense fallback={null}>
                        <NanDashboardWidget />
                        <ShowHistoryWidgetWrapper />
                    </Suspense>

                    <TransferHistorySection />
                </aside>
            </div>
        </>
    );
}
