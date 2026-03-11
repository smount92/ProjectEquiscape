"use client";

import { useState, useEffect, useCallback } from "react";
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
                <div className="view-toggle-row">
                    <div className="view-toggle" id="dashboard-view-toggle">
                        <button
                            className={`view-toggle-btn ${view === "grid" ? "active" : ""}`}
                            onClick={() => handleViewChange("grid")}
                        >
                            🖼️ Gallery
                        </button>
                        <button
                            className={`view-toggle-btn ${view === "ledger" ? "active" : ""}`}
                            onClick={() => handleViewChange("ledger")}
                        >
                            📋 Ledger
                        </button>
                    </div>
                    <button
                        className={`view-toggle-btn ${selectMode ? "active" : ""}`}
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
                <div className="bulk-select-bar">
                    <button className="btn btn-ghost btn-sm" onClick={selectAll}>
                        Select All ({horseCards.length})
                    </button>
                    {selectedIds.size > 0 && (
                        <span style={{ color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
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
                <div className="bulk-action-bar">
                    <span className="bulk-action-count">✅ {selectedIds.size} selected</span>

                    <div className="bulk-action-buttons">
                        {/* Move to Collection */}
                        <select
                            className="form-select bulk-select"
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
                            className="form-select bulk-select"
                            value=""
                            onChange={(e) => { if (e.target.value) handleBulkTradeStatus(e.target.value); }}
                            disabled={isProcessing}
                        >
                            <option value="">🏷️ Trade Status…</option>
                            <option value="Not for Sale">Not for Sale</option>
                            <option value="For Sale">For Sale</option>
                            <option value="Open to Offers">Open to Offers</option>
                        </select>

                        {/* Delete */}
                        <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={isProcessing}
                        >
                            🗑️ Delete
                        </button>
                    </div>

                    <button className="btn btn-ghost btn-sm" onClick={clearSelection}>
                        Cancel
                    </button>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ marginBottom: "var(--space-md)" }}>🗑️ Confirm Delete</h3>
                        <p style={{ marginBottom: "var(--space-lg)", color: "var(--color-text-secondary)" }}>
                            Are you sure you want to delete <strong>{selectedIds.size}</strong> item{selectedIds.size !== 1 ? "s" : ""}?
                            This cannot be undone. All photos and associated data will be permanently removed.
                        </p>
                        <div style={{ display: "flex", gap: "var(--space-md)", justifyContent: "flex-end" }}>
                            <button className="btn btn-ghost" onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={handleBulkDelete}
                                disabled={isProcessing}
                            >
                                {isProcessing ? "Deleting…" : `Delete ${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
