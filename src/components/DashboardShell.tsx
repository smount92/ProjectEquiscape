"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import StableGrid from "@/components/StableGrid";
import StableLedger from "@/components/StableLedger";
import { bulkUpdateHorses, bulkDeleteHorses } from "@/app/actions/horse";


interface HorseCardData {
    id: string;
    customName: string;
    finishType: string;
    conditionGrade: string;
    createdAt: string;
    refName: string;
    releaseLine: string | null;
    thumbnailUrl: string | null;
    collectionName: string | null;
    sculptor: string | null;
    tradeStatus: string;
    moldName: string | null;
    releaseName: string | null;
    assetCategory?: string;
    vaultValue?: number | null;
}

interface CollectionOption {
    id: string;
    name: string;
}

export default function DashboardShell({
    horseCards,
    collections = [],
}: {
    horseCards: HorseCardData[];
    collections?: CollectionOption[];
}) {
    const router = useRouter();
    const [view, setView] = useState<"grid" | "ledger">("grid");
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Persist view preference
    useEffect(() => {
        const saved = localStorage.getItem("mhh-dashboard-view");
        if (saved === "grid" || saved === "ledger") setView(saved);
    }, []);

    const handleViewChange = useCallback((v: "grid" | "ledger") => {
        setView(v);
        localStorage.setItem("mhh-dashboard-view", v);
    }, []);

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        setSelectedIds(new Set(horseCards.map(h => h.id)));
    }, [horseCards]);

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
        setSelectMode(false);
        setBulkAction(null);
    }, []);

    const handleBulkCollection = async (collectionId: string | null) => {
        setIsProcessing(true);
        const result = await bulkUpdateHorses(Array.from(selectedIds), { collectionId });
        setIsProcessing(false);
        if (result.success) {
            clearSelection();
            router.refresh();
        }
    };

    const handleBulkTradeStatus = async (tradeStatus: string) => {
        setIsProcessing(true);
        const result = await bulkUpdateHorses(Array.from(selectedIds), { tradeStatus });
        setIsProcessing(false);
        if (result.success) {
            clearSelection();
            router.refresh();
        }
    };

    const handleBulkDelete = async () => {
        setIsProcessing(true);
        const result = await bulkDeleteHorses(Array.from(selectedIds));
        setIsProcessing(false);
        setShowDeleteConfirm(false);
        if (result.success) {
            clearSelection();
            router.refresh();
        }
    };

    return (
        <>
            {/* View Toggle + Select Mode */}
            {horseCards.length > 0 && (
                <div className="flex justify-end max-md:justify-center mb-4">
                    <div className="inline-flex bg-parchment-dark rounded-full p-[3px] gap-[2px]" id="dashboard-view-toggle">
                        <button
                            className={`py-1.5 px-4 border-none rounded-full bg-transparent text-muted text-sm cursor-pointer transition-all duration-200 font-inherit hover:text-ink ${view === "grid" ? "bg-forest text-white font-semibold" : ""}`}
                            onClick={() => handleViewChange("grid")}
                        >
                            🖼️ Gallery
                        </button>
                        <button
                            className={`py-1.5 px-4 border-none rounded-full bg-transparent text-muted text-sm cursor-pointer transition-all duration-200 font-inherit hover:text-ink ${view === "ledger" ? "bg-forest text-white font-semibold" : ""}`}
                            onClick={() => handleViewChange("ledger")}
                        >
                            📋 Ledger
                        </button>
                    </div>
                    <button
                        className={`py-1.5 px-4 border-none rounded-full bg-transparent text-muted text-sm cursor-pointer transition-all duration-200 font-inherit hover:text-ink ${selectMode ? "bg-forest text-white font-semibold" : ""}`}
                        onClick={() => {
                            if (selectMode) clearSelection();
                            else setSelectMode(true);
                        }}
                        id="select-mode-toggle"
                        style={{ marginLeft: "var(--space-sm)" }}
                    >
                        {selectMode ? "✕ Cancel" : "☑ Select"}
                    </button>
                </div>
            )}

            {/* Select All / Clear */}
            {selectMode && horseCards.length > 0 && (
                <div className="flex items-center gap-4 mb-4 py-1.5 px-3 bg-parchment-dark rounded-md">
                    <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm" onClick={selectAll}>
                        Select All ({horseCards.length})
                    </button>
                    {selectedIds.size > 0 && (
                        <span className="text-muted text-sm" >
                            {selectedIds.size} selected
                        </span>
                    )}
                </div>
            )}

            {/* Content */}
            {view === "grid" ? (
                <StableGrid
                    horseCards={horseCards}
                    selectMode={selectMode}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                />
            ) : (
                <StableLedger
                    horseCards={horseCards}
                    selectMode={selectMode}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                />
            )}

            {/* Floating Bulk Action Bar */}
            {selectMode && selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 py-3 px-5 bg-parchment border border-edge rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.25)] z-[100] max-w-[90vw] flex-wrap justify-center">
                    <span className="font-semibold text-sm text-forest whitespace-nowrap">✅ {selectedIds.size} selected</span>

                    <div className="flex gap-2 items-center flex-wrap">
                        {/* Move to Collection */}
                        <select
                            className="form-select py-1.5 px-2.5 rounded-md border border-edge bg-parchment-dark text-ink text-sm font-inherit cursor-pointer"
                            value=""
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === "__none__") handleBulkCollection(null);
                                else if (val) handleBulkCollection(val);
                            }}
                            disabled={isProcessing}
                        >
                            <option value="">📁 Move to…</option>
                            <option value="__none__">— No Collection —</option>
                            {collections.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>

                        {/* Trade Status */}
                        <select
                            className="form-select py-1.5 px-2.5 rounded-md border border-edge bg-parchment-dark text-ink text-sm font-inherit cursor-pointer"
                            value=""
                            onChange={(e) => { if (e.target.value) handleBulkTradeStatus(e.target.value); }}
                            disabled={isProcessing}
                        >
                            <option value="">🏷️ Trade Status…</option>
                            <option value="Not for Sale">Not for Sale</option>
                            <option value="For Sale">For Sale</option>
                            <option value="Open to Offers">Open to Offers</option>
                            <option value="Stolen/Missing">🚨 Stolen/Missing</option>
                        </select>

                        {/* Delete */}
                        <button
                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-[rgb(239,68,68)] text-white border-0 rounded-md py-[6px] px-[14px] text-sm font-[inherit] cursor-pointer transition-all min-h-[36px] py-1 px-6 text-sm"
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={isProcessing}
                        >
                            🗑️ Delete
                        </button>
                    </div>

                    <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm" onClick={clearSelection}>
                        Cancel
                    </button>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && createPortal(
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="modal-content max-sm:max-w-full" onClick={(e) => e.stopPropagation()}>
                        <h3 className="mb-4" >🗑️ Confirm Delete</h3>
                        <p className="mb-6 text-ink-light" >
                            Are you sure you want to delete <strong>{selectedIds.size}</strong> item{selectedIds.size !== 1 ? "s" : ""}?
                            This cannot be undone. All photos and associated data will be permanently removed.
                        </p>
                        <div className="gap-4 justify-end" style={{ display: "flex" }}>
                            <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </button>
                            <button
                                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-[rgb(239,68,68)] text-white border-0 rounded-md py-[6px] px-[14px] text-sm font-[inherit] cursor-pointer transition-all"
                                onClick={handleBulkDelete}
                                disabled={isProcessing}
                            >
                                {isProcessing ? "Deleting…" : `Delete ${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""}`}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body)}
        </>
    );
}
