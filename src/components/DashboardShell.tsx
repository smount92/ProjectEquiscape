"use client";

import { useState, useEffect, useCallback } from"react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from"next/navigation";
import StableGrid from"@/components/StableGrid";
import StableLedger from"@/components/StableLedger";
import { bulkUpdateHorses, bulkDeleteHorses } from"@/app/actions/horse";

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
 const [view, setView] = useState<"grid" |"ledger">("grid");
 const [selectMode, setSelectMode] = useState(false);
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [bulkAction, setBulkAction] = useState<string | null>(null);
 const [isProcessing, setIsProcessing] = useState(false);
 const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

 // Persist view preference
 useEffect(() => {
 const saved = localStorage.getItem("mhh-dashboard-view");
 if (saved ==="grid" || saved ==="ledger") setView(saved);
 }, []);

 const handleViewChange = useCallback((v:"grid" |"ledger") => {
 setView(v);
 localStorage.setItem("mhh-dashboard-view", v);
 }, []);

 const toggleSelect = useCallback((id: string) => {
 setSelectedIds((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 }, []);

 const selectAll = useCallback(() => {
 setSelectedIds(new Set(horseCards.map((h) => h.id)));
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
 <div className="mb-4 flex justify-end max-md:justify-center">
 <div
 className="bg-parchment-dark inline-flex gap-[2px] rounded-full p-[3px]"
 id="dashboard-view-toggle"
 >
 <button
 className={`text-muted font-inherit hover:text-ink cursor-pointer rounded-full border-none bg-transparent px-4 py-1.5 text-sm transition-all duration-200 ${view ==="grid" ?"bg-forest font-semibold text-white" :""}`}
 onClick={() => handleViewChange("grid")}
 >
 🖼️ Gallery
 </button>
 <button
 className={`text-muted font-inherit hover:text-ink cursor-pointer rounded-full border-none bg-transparent px-4 py-1.5 text-sm transition-all duration-200 ${view ==="ledger" ?"bg-forest font-semibold text-white" :""}`}
 onClick={() => handleViewChange("ledger")}
 >
 📋 Ledger
 </button>
 </div>
 <button
 className={`text-muted font-inherit hover:text-ink ml-2 cursor-pointer rounded-full border-none bg-transparent px-4 py-1.5 text-sm transition-all duration-200 ${selectMode ?"bg-forest font-semibold text-white" :""}`}
 onClick={() => {
 if (selectMode) clearSelection();
 else setSelectMode(true);
 }}
 id="select-mode-toggle"
 >
 {selectMode ?"✕ Cancel" :"☑ Select"}
 </button>
 </div>
 )}

 {/* Select All / Clear */}
 {selectMode && horseCards.length > 0 && (
 <div className="bg-parchment-dark mb-4 flex items-center gap-4 rounded-md px-3 py-1.5">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={selectAll}
 >
 Select All ({horseCards.length})
 </button>
 {selectedIds.size > 0 && <span className="text-muted text-sm">{selectedIds.size} selected</span>}
 </div>
 )}

 {/* Content */}
 {view ==="grid" ? (
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
 <div className="bg-parchment border-edge fixed bottom-6 left-1/2 z-[100] flex max-w-[90vw] -translate-x-1/2 flex-wrap items-center justify-center gap-4 rounded-xl border px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
 <span className="text-forest text-sm font-semibold whitespace-nowrap">
 ✅ {selectedIds.size} selected
 </span>

 <div className="flex flex-wrap items-center gap-2">
 {/* Move to Collection */}
 <select
 className="flex h-10 w-full rounded-md border border-edge bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-edge bg-parchment-dark text-ink font-inherit cursor-pointer rounded-md border px-2.5 py-1.5 text-sm"
 value=""
 onChange={(e) => {
 const val = e.target.value;
 if (val ==="__none__") handleBulkCollection(null);
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
 className="flex h-10 w-full rounded-md border border-edge bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-edge bg-parchment-dark text-ink font-inherit cursor-pointer rounded-md border px-2.5 py-1.5 text-sm"
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

 {/* Delete */}
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 onClick={() => setShowDeleteConfirm(true)}
 disabled={isProcessing}
 >
 🗑️ Delete
 </button>
 </div>

 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={clearSelection}
 >
 Cancel
 </button>
 </div>
 )}

 {/* Delete Confirmation Modal */}
 {showDeleteConfirm &&
 (
 <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
 <DialogContent className="sm:max-w-md">
 
 <h3 className="mb-4">🗑️ Confirm Delete</h3>
 <p className="text-ink-light mb-6">
 Are you sure you want to delete <strong>{selectedIds.size}</strong> item
 {selectedIds.size !== 1 ?"s" :""}? This cannot be undone. All photos and associated
 data will be permanently removed.
 </p>
 <div className="flex justify-end gap-4">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => setShowDeleteConfirm(false)}
 >
 Cancel
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 onClick={handleBulkDelete}
 disabled={isProcessing}
 >
 {isProcessing
 ?"Deleting…"
 : `Delete ${selectedIds.size} item${selectedIds.size !== 1 ?"s" :""}`}
 </button>
 </div>
 </DialogContent>
 </Dialog>
 )}
 </>
 );
}
