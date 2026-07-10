"use client";

/**
 * Digital Stable v2 browser — the client orchestrator under the
 * leather masthead. Wires the ledger filter bar to the URL (single
 * source of truth: router.push, so paging and the back button never
 * wipe filters), renders the gallery/ledger views from server data,
 * appends via Show More, and runs the forest bulk bar (now with a
 * Visibility toggle and cross-page "Select all N matching").
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import StableFilterBar from "@/components/stable/StableFilterBar";
import StableHorseCard from "@/components/stable/StableHorseCard";
import StableLedgerTable from "@/components/stable/StableLedgerTable";
import {
    buildStableSearchParams,
    countActiveFilters,
    type StableFilters,
} from "@/lib/stable/filterParams";
import type { SavedView, StableCard, StableFacetOptions } from "@/lib/stable/types";
import { getMatchingHorseIds, loadMoreStable } from "@/app/actions/stable";
import { bulkDeleteHorses, bulkUpdateHorses } from "@/app/actions/horse";

const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06 } },
} as const;

const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring" as const, stiffness: 300, damping: 30 },
    },
};

export default function StableBrowser({
    initialCards,
    totalCount,
    initialHasMore,
    herdTotal,
    facetOptions,
    collections,
    savedViews,
    filters,
}: {
    initialCards: StableCard[];
    /** Horses matching the current filters (whole collection, not page). */
    totalCount: number;
    initialHasMore: boolean;
    /** Unfiltered herd size, for the "N of TOTAL match" line. */
    herdTotal: number;
    facetOptions: StableFacetOptions;
    collections: { id: string; name: string }[];
    savedViews: SavedView[];
    filters: StableFilters;
}) {
    const router = useRouter();
    const [cards, setCards] = useState<StableCard[]>(initialCards);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [loadingMore, setLoadingMore] = useState(false);

    const [view, setView] = useState<"grid" | "ledger">("grid");
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isProcessing, setIsProcessing] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [bulkNotice, setBulkNotice] = useState<string | null>(null);

    // Persist view preference (same key as v1)
    useEffect(() => {
        const saved = localStorage.getItem("mhh-dashboard-view");
        if (saved === "grid" || saved === "ledger") setView(saved);
    }, []);

    const handleViewChange = useCallback((v: "grid" | "ledger") => {
        setView(v);
        localStorage.setItem("mhh-dashboard-view", v);
    }, []);

    // Server re-rendered with new data (filter/sort change or refresh):
    // replace the loaded set. Selection ids stay valid, so keep them.
    useEffect(() => {
        setCards(initialCards);
        setHasMore(initialHasMore);
    }, [initialCards, initialHasMore]);

    // ── URL is the single source of truth ──
    const pushFilters = useCallback(
        (next: StableFilters) => {
            const qs = buildStableSearchParams(next).toString();
            router.push(qs ? `/dashboard?${qs}` : "/dashboard");
        },
        [router],
    );

    // ── Show More: appends below; filters, scroll, selection stay put ──
    const handleLoadMore = useCallback(async () => {
        setLoadingMore(true);
        try {
            const result = await loadMoreStable({ ...filters, offset: cards.length });
            if (result.success) {
                setCards((prev) => [...prev, ...result.cards]);
                setHasMore(result.hasMore);
            }
        } finally {
            setLoadingMore(false);
        }
    }, [cards.length, filters]);

    // ── Selection ──
    const toggleSelect = useCallback((id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
        setSelectMode(false);
        setBulkNotice(null);
    }, []);

    const handleSelectAllMatching = useCallback(async () => {
        setIsProcessing(true);
        setBulkNotice(null);
        try {
            const result = await getMatchingHorseIds(filters);
            if (result.success) {
                setSelectedIds(new Set(result.ids));
                if (result.capped) {
                    setBulkNotice(
                        `Selected the first ${result.ids.length} of ${result.totalMatching} matching — bulk actions cap at ${result.ids.length}.`,
                    );
                }
            } else {
                setBulkNotice(result.error);
            }
        } finally {
            setIsProcessing(false);
        }
    }, [filters]);

    // ── Bulk actions ──
    const afterBulk = useCallback(
        (result: { success: boolean; error?: string }) => {
            setIsProcessing(false);
            if (result.success) {
                clearSelection();
                router.refresh();
            } else if (result.error) {
                setBulkNotice(result.error);
            }
        },
        [clearSelection, router],
    );

    const handleBulkCollection = async (collectionId: string | null) => {
        setIsProcessing(true);
        afterBulk(await bulkUpdateHorses(Array.from(selectedIds), { collectionId }));
    };

    const handleBulkTradeStatus = async (tradeStatus: string) => {
        setIsProcessing(true);
        afterBulk(await bulkUpdateHorses(Array.from(selectedIds), { tradeStatus }));
    };

    const handleBulkVisibility = async (visibility: "public" | "unlisted" | "private") => {
        setIsProcessing(true);
        afterBulk(await bulkUpdateHorses(Array.from(selectedIds), { visibility }));
    };

    const handleBulkDelete = async () => {
        setIsProcessing(true);
        const result = await bulkDeleteHorses(Array.from(selectedIds));
        setShowDeleteConfirm(false);
        afterBulk(result);
    };

    const activeCount = countActiveFilters(filters);
    const bulkSelectClass =
        "flex h-9 cursor-pointer rounded-full border border-[rgba(237,228,204,.4)] bg-transparent px-3 py-1.5 font-serif text-xs tracking-wide text-[#EDE4CC] focus:outline-none";

    return (
        <>
            <StableFilterBar
                filters={filters}
                facetOptions={facetOptions}
                collections={collections}
                initialSavedViews={savedViews}
                view={view}
                onViewChange={handleViewChange}
                onFiltersChange={pushFilters}
            />

            {/* Result line + select-mode toggle */}
            <div className="mt-3 mb-4 flex flex-wrap items-center gap-3 pl-1 text-sm text-muted-foreground italic">
                <span id="stable-result-line">
                    {activeCount > 0 ? (
                        <>
                            <b className="text-foreground not-italic">
                                {totalCount} of {herdTotal}
                            </b>{" "}
                            match
                        </>
                    ) : (
                        <>
                            <b className="text-foreground not-italic">{herdTotal}</b> model
                            {herdTotal === 1 ? "" : "s"}
                        </>
                    )}
                </span>
                <button
                    type="button"
                    className={`font-inherit ml-auto cursor-pointer rounded-full border-none px-4 py-1.5 text-sm not-italic transition-all duration-200 ${selectMode ? "bg-forest font-semibold text-white" : "bg-muted text-secondary-foreground hover:text-foreground"}`}
                    onClick={() => {
                        if (selectMode) clearSelection();
                        else setSelectMode(true);
                    }}
                    id="select-mode-toggle"
                >
                    {selectMode ? "✕ Cancel" : "☑ Select"}
                </button>
            </div>

            {/* Empty states */}
            {cards.length === 0 && activeCount === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-input bg-muted/50 p-16">
                    <span className="mb-4 text-6xl">🏠</span>
                    <h2 className="mb-2 font-serif text-xl font-semibold text-foreground">Your Stable is Empty</h2>
                    <p className="mb-6 max-w-sm text-center text-muted-foreground">
                        You haven&apos;t added any models yet. Click the button above to catalog your first horse!
                    </p>
                    <Button asChild>
                        <Link href="/add-horse" id="add-first-horse">
                            🐴 Add Your First Horse
                        </Link>
                    </Button>
                </div>
            ) : cards.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-input bg-muted/50 p-16">
                    <span className="mb-4 text-6xl">🔍</span>
                    <h2 className="mb-2 font-serif text-xl font-semibold text-foreground">No Results</h2>
                    <p className="max-w-sm text-center text-muted-foreground">
                        No models match these filters. Loosen one, or clear all.
                    </p>
                </div>
            ) : view === "grid" ? (
                <motion.div
                    className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-3 xl:grid-cols-4"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {cards.map((horse) => (
                        <motion.div key={horse.id} variants={cardVariants}>
                            <StableHorseCard
                                horse={horse}
                                selectMode={selectMode}
                                isSelected={selectedIds.has(horse.id)}
                                onToggleSelect={toggleSelect}
                            />
                        </motion.div>
                    ))}
                </motion.div>
            ) : (
                <StableLedgerTable
                    horses={cards}
                    selectMode={selectMode}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                />
            )}

            {/* Show More — appends; nothing above is lost */}
            {cards.length > 0 && hasMore && (
                <div className="mt-8 flex flex-col items-center gap-2">
                    <button
                        type="button"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="btn-brass disabled:cursor-not-allowed disabled:opacity-60"
                        id="stable-show-more"
                    >
                        {loadingMore ? "Loading…" : `Show more (${cards.length} of ${totalCount} shown)`}
                    </button>
                </div>
            )}
            {cards.length > 0 && !hasMore && totalCount > 48 && (
                <p className="mt-6 text-center text-sm text-muted-foreground italic">
                    All {totalCount} shown.
                </p>
            )}

            {/* ── Forest bulk bar ── */}
            {selectMode && (
                <div
                    className="fixed bottom-6 left-1/2 z-[100] flex max-w-[92vw] -translate-x-1/2 flex-wrap items-center justify-center gap-3 rounded-full px-5 py-3 shadow-[0_6px_16px_rgba(0,0,0,0.3)]"
                    style={{ background: "linear-gradient(180deg, #37664F, var(--color-forest-dark, #1E3D31))" }}
                >
                    <span className="font-serif text-sm font-bold whitespace-nowrap" style={{ color: "var(--brass-hi)" }}>
                        {selectedIds.size} selected
                    </span>

                    {/* Select all N matching — spans pages */}
                    <button
                        type="button"
                        onClick={handleSelectAllMatching}
                        disabled={isProcessing}
                        className="cursor-pointer rounded-full border bg-transparent px-3 py-1.5 font-serif text-xs tracking-wide disabled:opacity-60"
                        style={{ borderColor: "var(--brass-hi)", color: "var(--brass-hi)" }}
                        id="stable-select-all-matching"
                    >
                        Select all {totalCount} matching
                    </button>

                    {selectedIds.size > 0 && (
                        <>
                            {/* Move to Collection */}
                            <select
                                className={bulkSelectClass}
                                value=""
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "__none__") handleBulkCollection(null);
                                    else if (val) handleBulkCollection(val);
                                }}
                                disabled={isProcessing}
                                title="Move to collection"
                            >
                                <option value="">📁 Move to…</option>
                                <option value="__none__">— No Collection —</option>
                                {collections.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>

                            {/* Trade Status */}
                            <select
                                className={bulkSelectClass}
                                value=""
                                onChange={(e) => {
                                    if (e.target.value) handleBulkTradeStatus(e.target.value);
                                }}
                                disabled={isProcessing}
                                title="Change trade status"
                            >
                                <option value="">🏷️ Trade Status…</option>
                                <option value="Not for Sale">Not for Sale</option>
                                <option value="For Sale">For Sale</option>
                                <option value="Open to Offers">Open to Offers</option>
                                <option value="Stolen/Missing">🚨 Stolen/Missing</option>
                            </select>

                            {/* Visibility — bulkUpdateHorses supported it all along */}
                            <select
                                className={bulkSelectClass}
                                value=""
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === "public" || v === "unlisted" || v === "private") {
                                        handleBulkVisibility(v);
                                    }
                                }}
                                disabled={isProcessing}
                                title="Change visibility"
                                id="stable-bulk-visibility"
                            >
                                <option value="">👁️ Visibility…</option>
                                <option value="public">🌐 Public</option>
                                <option value="unlisted">🔗 Unlisted</option>
                                <option value="private">🔒 Private</option>
                            </select>

                            {/* Delete */}
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={isProcessing}
                                className="cursor-pointer rounded-full border border-[rgba(237,228,204,.4)] bg-transparent px-3 py-1.5 font-serif text-xs tracking-wide text-[#EDE4CC] disabled:opacity-60"
                            >
                                🗑️ Delete
                            </button>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={clearSelection}
                        className="cursor-pointer border-none bg-transparent px-2 py-1.5 text-xs text-[#EDE4CC]/80 hover:text-white"
                    >
                        Cancel
                    </button>

                    {bulkNotice && (
                        <span className="basis-full text-center text-xs" style={{ color: "var(--brass-hi)" }} role="status">
                            {bulkNotice}
                        </span>
                    )}
                </div>
            )}

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                    <DialogContent className="sm:max-w-md">
                        <h3 className="mb-4">🗑️ Confirm Delete</h3>
                        <p className="mb-6 text-secondary-foreground">
                            Are you sure you want to delete <strong>{selectedIds.size}</strong> item
                            {selectedIds.size !== 1 ? "s" : ""}? This cannot be undone. All photos and associated
                            data will be permanently removed.
                        </p>
                        <div className="flex justify-end gap-4">
                            <Button variant="outline" size="wide" onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </Button>
                            <Button variant="outline" onClick={handleBulkDelete} disabled={isProcessing}>
                                {isProcessing
                                    ? "Deleting…"
                                    : `Delete ${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""}`}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
