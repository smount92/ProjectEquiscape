"use client";

import { useState, useEffect, useCallback } from"react";
import { getInsuranceReportData } from"@/app/actions/insurance-report";
import type { InsuranceReportPayload } from"@/app/actions/insurance-report";

interface Collection {
 id: string;
 name: string;
 emoji: string;
}

export default function InsuranceReportButton() {
 const [status, setStatus] = useState<"idle" |"loading" |"error" |"picking">("idle");
 const [error, setError] = useState<string | null>(null);
 const [collections, setCollections] = useState<Collection[]>([]);
 const [selectedCollection, setSelectedCollection] = useState<string>("");
 const [horseCount, setHorseCount] = useState<number | null>(null);

 // Fetch collections on mount
 useEffect(() => {
 import("@/app/actions/collections").then(({ getCollectionsAction }) => {
 getCollectionsAction().then((cols: { id: string; name: string; description: string | null }[]) => {
 setCollections(cols.map((c) => ({ id: c.id, name: c.name, emoji:"📁" })));
 });
 });
 }, []);

 // Fetch rough horse count for OOM warning
 useEffect(() => {
 import("@/lib/supabase/client").then(({ createClient }) => {
 const supabase = createClient();
 supabase.auth.getUser().then(({ data: { user } }) => {
 if (user) {
 supabase
 .from("user_horses")
 .select("id", { count:"exact", head: true })
 .eq("owner_id", user.id)
 .then(({ count }) => setHorseCount(count ?? 0));
 }
 });
 });
 }, []);

 const handleGenerate = useCallback(async (collectionId?: string) => {
 setStatus("loading");
 setError(null);

 try {
 const result = await getInsuranceReportData(collectionId || undefined);
 if (!result.success || !result.data) {
 throw new Error(result.error ||"Failed to fetch report data");
 }

 const data: InsuranceReportPayload = result.data;

 // Lazy-load react-pdf (1.5MB) only when generating
 const [{ pdf }, { default: InsuranceReport }] = await Promise.all([
 import("@react-pdf/renderer"),
 import("@/components/pdf/InsuranceReport"),
 ]);

 // Generate PDF client-side
 const blob = await pdf(<InsuranceReport data={data} />).toBlob();

 // Trigger download
 const url = URL.createObjectURL(blob);
 const link = document.createElement("a");
 link.href = url;
 link.download = `MHH_Insurance_Report_${new Date().toISOString().split("T")[0]}.pdf`;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 URL.revokeObjectURL(url);

 setStatus("idle");
 } catch (err) {
 setStatus("error");
 setError(err instanceof Error ? err.message :"Failed to generate report");
 }
 }, []);

 const handleClick = () => {
 if (collections.length > 0) {
 setStatus("picking");
 setSelectedCollection("");
 } else {
 handleGenerate();
 }
 };

 const handleConfirm = () => {
 setStatus("idle");
 handleGenerate(selectedCollection || undefined);
 };

 const handleCancel = () => {
 setStatus("idle");
 setSelectedCollection("");
 };

 return (
 <div className="insurance-report-wrapper">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={handleClick}
 disabled={status ==="loading"}
 id="insurance-report-btn"
 title="Generate a PDF insurance report of your collection"
 >
 {status ==="loading" ? (
 <>
 <span className="spinner-inline" /> Generating…
 </>
 ) : (
"📄 Insurance Report"
 )}
 </button>
 {status ==="error" && error && <span className="text-danger ml-2 text-xs">{error}</span>}

 {/* Collection Picker Modal */}
 {status ==="picking" && (
 <div className="modal-backdrop" onClick={handleCancel}>
 <div
 className="bg-card border-edge max-w-[400] rounded-lg border shadow-md transition-all"
 onClick={(e) => e.stopPropagation()}
 >
 <h3 className="mb-4">📄 Insurance Report Scope</h3>
 <p className="text-ink-light mb-6 text-sm">
 Choose which horses to include in your insurance report.
 </p>

 <select
 className="form-select"
 value={selectedCollection}
 onChange={(e) => setSelectedCollection(e.target.value)}
 style={{ width:"100%", marginBottom:"var(--space-md)" }}
 id="insurance-collection-select"
 >
 <option value="">🐎 Entire Stable</option>
 {collections.map((c) => (
 <option key={c.id} value={c.id}>
 {c.emoji} {c.name}
 </option>
 ))}
 </select>

 {!selectedCollection && horseCount !== null && horseCount > 200 && (
 <div className="text-[var(--color-accent-warning, #f59e0b)] mt-4 mb-4 rounded-lg border border-[rgba(44,85,69,0.2)] bg-[rgba(44,85,69,0.08)] px-6 py-4 text-sm leading-relaxed">
 ⚠️ Your stable has {horseCount} models. Generating a full report may be slow. Consider
 selecting a collection for faster results.
 </div>
 )}

 <div className="justify-end gap-2" style={{ display:"flex" }}>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={handleCancel}
 >
 Cancel
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleConfirm}
 >
 Generate Report
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
