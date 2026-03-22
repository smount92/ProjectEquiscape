"use client";

import { useState, useTransition, useEffect } from"react";
import { createPortal } from"react-dom";
import { createSuggestion } from"@/app/actions/catalog-suggestions";
import { useToast } from"@/lib/context/ToastContext";

interface CatalogItem {
 id: string;
 item_type: string;
 title: string;
 maker: string;
 scale: string | null;
 attributes: Record<string, unknown>;
}

interface SuggestEditModalProps {
 catalogItem: CatalogItem;
 openOnMount?: boolean;
}

interface FieldEdit {
 key: string;
 label: string;
 original: string;
 current: string;
}

export default function SuggestEditModal({ catalogItem, openOnMount = false }: SuggestEditModalProps) {
 const [isOpen, setIsOpen] = useState(openOnMount);
 const [isPending, startTransition] = useTransition();
 const [reason, setReason] = useState("");
 const [error, setError] = useState("");
 const { toast } = useToast();

 // Build editable fields
 const attrs = catalogItem.attributes ?? {};
 const initialFields: FieldEdit[] = [
 { key:"title", label:"Title", original: catalogItem.title, current: catalogItem.title },
 { key:"maker", label:"Maker", original: catalogItem.maker, current: catalogItem.maker },
 { key:"scale", label:"Scale", original: catalogItem.scale ??"", current: catalogItem.scale ??"" },
 ...Object.entries(attrs)
 .filter(([, v]) => v != null)
 .map(([k, v]) => ({
 key: k,
 label: k.replace(/_/g,"").replace(/\b\w/g, (c) => c.toUpperCase()),
 original: String(v),
 current: String(v),
 })),
 ];

 const [fields, setFields] = useState<FieldEdit[]>(initialFields);

 // Reset on open
 useEffect(() => {
 if (isOpen) {
 setFields(initialFields);
 setReason("");
 setError("");
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [isOpen]);

 const handleFieldChange = (index: number, value: string) => {
 setFields((prev) => {
 const next = [...prev];
 next[index] = { ...next[index], current: value };
 return next;
 });
 };

 const changedFields = fields.filter((f) => f.current !== f.original);
 const hasChanges = changedFields.length > 0;

 const handleSubmit = () => {
 if (!hasChanges) {
 setError("No changes detected. Edit at least one field.");
 return;
 }
 if (reason.trim().length < 10) {
 setError("Please provide a reason (at least 10 characters).");
 return;
 }

 const fieldChanges: Record<string, { from: string; to: string }> = {};
 for (const f of changedFields) {
 fieldChanges[f.key] = { from: f.original, to: f.current };
 }

 startTransition(async () => {
 const result = await createSuggestion({
 catalogItemId: catalogItem.id,
 suggestionType:"correction",
 fieldChanges,
 reason: reason.trim(),
 });

 if (result.success) {
 setIsOpen(false);
 toast(
 result.autoApproved
 ?"⚡ Auto-approved! Your correction has been applied."
 :"✅ Thanks! Your suggestion will be reviewed.",
"success",
 );
 } else {
 setError(result.error ??"Something went wrong.");
 }
 });
 };

 // Lock body scroll when modal open
 useEffect(() => {
 if (isOpen) {
 document.body.style.overflow ="hidden";
 } else {
 document.body.style.overflow ="";
 }
 return () => {
 document.body.style.overflow ="";
 };
 }, [isOpen]);

 return (
 <>
 <button
 id="suggest-edit-btn"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={() => setIsOpen(true)}
 >
 ✏️ Suggest Edit
 </button>

 {isOpen &&
 createPortal(
 <div
 className="modal-overlay"
 onClick={() => setIsOpen(false)}
 style={{
 position:"fixed",
 inset: 0,
 background:"rgba(0, 0, 0, 0.7)",
 backdropFilter:"blur(4px)",
 WebkitBackdropFilter:"blur(4px)",
 display:"flex",
 alignItems:"center",
 justifyContent:"center",
 zIndex: 1000,
 padding:"24px",
 }}
 >
 <div
 className="border-edge bg-glass rounded-[var(--radius-xl) var(--radius-xl) 0 0] flex items-center justify-between border-b px-8 py-6"
 onClick={(e) => e.stopPropagation()}
 style={{
 background:"#faf6ef",
 border:"1px solid #d4c9a8",
 borderRadius:"16px",
 width:"100%",
 maxWidth: 580,
 maxHeight:"85vh",
 overflowY:"auto",
 boxShadow:"0 24px 64px rgba(0,0,0,0.4)",
 }}
 >
 <div className="sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 <h2>✏️ Suggest Edit</h2>
 <button
 className="text-muted cursor-pointer rounded-md border-0 bg-transparent p-1 text-[1.2rem] transition-all duration-150"
 onClick={() => setIsOpen(false)}
 >
 ✕
 </button>
 </div>
 <p className="text-[var(--color-text)]">
 Editing: <strong>{catalogItem.title}</strong> by {catalogItem.maker}
 </p>

 <div className="px-8 py-6">
 {/* Editable Fields */}
 <div className="mb-6 flex flex-col gap-4">
 {fields.map((field, i) => (
 <div
 key={field.key}
 className={`ref-suggest-field ${field.current !== field.original ?"ref-suggest-field-changed" :""}`}
 >
 <label className="border-[transparent]-label rounded-md border-l-[3px] p-2 transition-colors">
 {field.label}
 {field.current !== field.original && (
 <span className="rounded-[8px] bg-[#ffc107] px-[7px] py-[2px] text-[0.62rem] font-extrabold tracking-[0.03em] text-[#1a1a1a] uppercase">
 Changed
 </span>
 )}
 </label>
 <input
 type="text"
 className="input"
 value={field.current}
 onChange={(e) => handleFieldChange(i, e.target.value)}
 />
 {field.current !== field.original && (
 <span className="text-muted mt-[4px] text-xs italic">
 Was: {field.original}
 </span>
 )}
 </div>
 ))}
 </div>

 {/* Reason */}
 <div className="mb-6">
 <label className="border-[transparent]-label rounded-md border-l-[3px] p-2 transition-colors">
 Reason for change *
 </label>
 <textarea
 className="input min-h-[72px] w-full resize-y text-sm"
 placeholder="Explain why this change is needed (e.g., 'The 2019 Breyer catalog lists this as Dark Bay, not Bay')"
 value={reason}
 onChange={(e) => setReason(e.target.value)}
 rows={3}
 maxLength={2000}
 />
 <span className="text-muted mt-[4px] block text-right text-xs">
 {reason.length}/2000
 </span>
 </div>

 {error && (
 <p className="text-danger mt-2 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm">
 {error}
 </p>
 )}

 {/* Summary */}
 {hasChanges && (
 <div className="m-0 list-none p-0">
 <strong>
 {changedFields.length} field
 {changedFields.length > 1 ?"s" :""} changed:
 </strong>
 <ul>
 {changedFields.map((f) => (
 <li key={f.key}>
 <span className="font-bold text-[var(--color-text)]">
 {f.label}:
 </span>{""}
 <span className="ref-diff-from">{f.original}</span> →{""}
 <span className="font-bold text-[#66bb6a]">{f.current}</span>
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>

 <div className="modal-footer">
 <button
 className="inline-flex min-h-[36px] max-md:min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => setIsOpen(false)}
 >
 Cancel
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleSubmit}
 disabled={isPending || !hasChanges}
 >
 {isPending ?"Submitting…" :"Submit Suggestion"}
 </button>
 </div>
 </div>
 </div>,
 document.body,
 )}
 </>
 );
}
