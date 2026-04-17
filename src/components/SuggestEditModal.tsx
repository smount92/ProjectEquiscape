"use client";

import { useState, useTransition, useEffect } from "react";
import { createSuggestion } from "@/app/actions/catalog-suggestions";
import { useToast } from "@/lib/context/ToastContext";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

 const attrs = catalogItem.attributes ?? {};
 const initialFields: FieldEdit[] = [
 { key: "title", label: "Title", original: catalogItem.title, current: catalogItem.title },
 { key: "maker", label: "Maker", original: catalogItem.maker, current: catalogItem.maker },
 { key: "scale", label: "Scale", original: catalogItem.scale ?? "", current: catalogItem.scale ?? "" },
 ...Object.entries(attrs)
 .filter(([, v]) => v != null)
 .map(([k, v]) => ({
  key: k,
  label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  original: String(v),
  current: String(v),
 })),
 ];

 const [fields, setFields] = useState<FieldEdit[]>(initialFields);

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
  suggestionType: "correction",
  fieldChanges,
  reason: reason.trim(),
  });

  if (result.success) {
  setIsOpen(false);
  toast(
   result.autoApproved
   ? "⚡ Auto-approved! Your correction has been applied."
   : "✅ Thanks! Your suggestion will be reviewed.",
   "success",
  );
  } else {
  setError(result.error ?? "Something went wrong.");
  }
 });
 };

 return (
 <>
  <button
  id="suggest-edit-btn"
  className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
  onClick={() => setIsOpen(true)}
  >
  ✏️ Suggest Edit
  </button>

  <Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="sm:max-w-[580px] max-h-[85dvh] overflow-y-auto">
   <DialogHeader>
   <DialogTitle>✏️ Suggest Edit</DialogTitle>
   <DialogDescription>
    Editing: <strong>&ldquo;{catalogItem.title}&rdquo;</strong> by {catalogItem.maker}
   </DialogDescription>
   </DialogHeader>

   <div className="flex flex-col gap-5">
   {/* Editable Fields */}
   <div className="flex flex-col gap-4">
    {fields.map((field, i) => (
    <div key={field.key} className="flex flex-col gap-1.5">
     <label className="flex items-center gap-2 text-sm font-semibold text-ink">
     {field.label}
     {field.current !== field.original && (
      <span className="rounded-full bg-[#ffc107] px-2 py-0.5 text-[0.62rem] font-extrabold tracking-wide text-[#1a1a1a] uppercase">
      Changed
      </span>
     )}
     </label>
     <Input
     type="text"
     value={field.current}
     onChange={(e) => handleFieldChange(i, e.target.value)}
     aria-label={field.label}
     />
     {field.current !== field.original && (
     <span className="text-muted-foreground text-xs italic">
      Was: {field.original}
     </span>
     )}
    </div>
    ))}
   </div>

   {/* Reason */}
   <div className="flex flex-col gap-1.5">
    <label className="text-sm font-semibold text-ink">
    Reason for change <span className="text-destructive">*</span>
    </label>
    <Textarea
    placeholder="Explain why this change is needed (e.g., 'The 2019 Breyer catalog lists this as Dark Bay, not Bay')"
    value={reason}
    onChange={(e) => setReason(e.target.value)}
    rows={3}
    maxLength={2000}
    className="min-h-[72px] resize-y"
    />
    <span className="text-muted-foreground block text-right text-xs">
    {reason.length}/2000
    </span>
   </div>

   {error && (
    <p className="text-red-700 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm">
    {error}
    </p>
   )}

   {/* Summary */}
   {hasChanges && (
    <div className="rounded-lg border border-[#E0D5C1] bg-[#F4EFE6] p-4">
    <strong className="text-sm">
     {changedFields.length} field{changedFields.length > 1 ? "s" : ""} changed:
    </strong>
    <ul className="mt-2 flex flex-col gap-1 pl-4">
     {changedFields.map((f) => (
     <li key={f.key} className="text-sm">
      <span className="font-bold text-ink">
      {f.label}:
      </span>{" "}
      <span className="text-red-400 line-through">{f.original}</span> →{" "}
      <span className="font-bold text-emerald-600">{f.current}</span>
     </li>
     ))}
    </ul>
    </div>
   )}
   </div>

   <div className="flex justify-end gap-2 pt-4">
   <button
    className="inline-flex min-h-[36px] max-md:min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-md border border-[#E0D5C1] bg-transparent px-6 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
    onClick={() => setIsOpen(false)}
   >
    Cancel
   </button>
   <button
    className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
    onClick={handleSubmit}
    disabled={isPending || !hasChanges}
   >
    {isPending ? "Submitting…" : "Submit Suggestion"}
   </button>
   </div>
  </DialogContent>
  </Dialog>
 </>
 );
}
