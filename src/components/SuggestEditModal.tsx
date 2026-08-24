"use client";

import { useState, useTransition, useEffect } from "react";
import { createSuggestion } from "@/app/actions/catalog-suggestions";
import {
    buildEditableFields,
    changedFields as pickChanged,
    type FieldEdit,
} from "@/lib/catalog/editableFields";
import { CATEGORY_LABELS } from "@/lib/catalog/taxonomy";
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
import { Button } from "@/components/ui/button";

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

/**
 * The correction form.
 *
 * The field list comes from buildEditableFields, which offers the WHOLE
 * curated set whether filled or not. Its predecessor listed only
 * attributes that already had values — so the emptier an entry was, the
 * less a member could do about it, and filling a blank required creating
 * a duplicate entry instead. Of the 51 suggestions ever received, 45 were
 * whole new entries and 6 were corrections. The catalog's defect is
 * emptiness, and emptiness was the one thing this form could not express.
 */
export default function SuggestEditModal({ catalogItem, openOnMount = false }: SuggestEditModalProps) {
 const [isOpen, setIsOpen] = useState(openOnMount);
 const [isPending, startTransition] = useTransition();
 const [reason, setReason] = useState("");
 const [error, setError] = useState("");
 const { toast } = useToast();

 const [fields, setFields] = useState<FieldEdit[]>(() => buildEditableFields(catalogItem));

 useEffect(() => {
 if (isOpen) {
  setFields(buildEditableFields(catalogItem));
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

 const changed = pickChanged(fields);
 const hasChanges = changed.length > 0;
 const filled = fields.filter((f) => !f.isEmpty);
 const empty = fields.filter((f) => f.isEmpty);

 const handleSubmit = () => {
 if (!hasChanges) {
  setError("No changes yet — fix a value or fill in a blank.");
  return;
 }
 if (reason.trim().length < 10) {
  setError("Please provide a reason (at least 10 characters).");
  return;
 }

 const fieldChanges: Record<string, { from: string; to: string }> = {};
 for (const f of changed) {
  fieldChanges[f.key] = { from: f.original, to: f.current.trim() };
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

 const renderField = (field: FieldEdit) => {
 const i = fields.indexOf(field);
 const isDirty = field.current.trim() !== field.original.trim();
 return (
  <div key={field.key} className="flex flex-col gap-1.5">
  <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
   {field.label}
   {isDirty && (
   <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[0.62rem] font-extrabold tracking-wide text-warning uppercase">
    {field.isEmpty ? "Added" : "Changed"}
   </span>
   )}
  </label>
  {field.kind === "select" && field.options ? (
   <select
   className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
   value={field.current}
   onChange={(e) => handleFieldChange(i, e.target.value)}
   aria-label={field.label}
   >
   {/* A stored value outside the vocabulary stays selectable so the
       modal opens without phantom changes; the vocabulary is what new
       values are drawn from, not a rewrite of history. */}
   {field.original !== "" && !field.options.includes(field.original) && (
    <option value={field.original}>{field.original} (current)</option>
   )}
   {field.original === "" && <option value="">— Select —</option>}
   {field.options.map((o) => (
    <option key={o} value={o}>
    {field.key === "item_type" ? (CATEGORY_LABELS[o] ?? o) : o}
    </option>
   ))}
   </select>
  ) : field.kind === "textarea" ? (
   <Textarea
   value={field.current}
   placeholder={field.placeholder}
   onChange={(e) => handleFieldChange(i, e.target.value)}
   aria-label={field.label}
   rows={2}
   />
  ) : (
   <Input
   type={field.kind === "number" ? "number" : "text"}
   value={field.current}
   placeholder={field.placeholder}
   onChange={(e) => handleFieldChange(i, e.target.value)}
   aria-label={field.label}
   />
  )}
  {field.help && !isDirty && (
   <span className="text-muted-foreground text-xs">{field.help}</span>
  )}
  {isDirty && !field.isEmpty && (
   <span className="text-muted-foreground text-xs italic">
   Was: {field.original}
   </span>
  )}
  </div>
 );
 };

 return (
 <>
  <Button
  id="suggest-edit-btn"
  onClick={() => setIsOpen(true)}
  >
  ✏️ Suggest Edit
  </Button>

  <Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="sm:max-w-[580px] max-h-[85dvh] overflow-y-auto">
   <DialogHeader>
   <DialogTitle>✏️ Suggest Edit</DialogTitle>
   <DialogDescription>
    Editing: <strong>&ldquo;{catalogItem.title}&rdquo;</strong> by {catalogItem.maker}
   </DialogDescription>
   </DialogHeader>

   <div className="flex flex-col gap-5">
   {/* What the entry already says */}
   <div className="flex flex-col gap-4">
    {filled.map(renderField)}
   </div>

   {/* What it is missing — the reason most members open this form.
       Separated and labelled so a sparse entry reads as an invitation
       rather than a dead end. */}
   {empty.length > 0 && (
    <div className="flex flex-col gap-4">
    <div className="border-t border-input pt-3">
     <h4 className="text-sm font-bold text-foreground">
     Missing from this entry
     </h4>
     <p className="text-muted-foreground mt-0.5 text-xs">
     Know any of these? Filling in even one helps every collector
     who looks this model up after you.
     </p>
    </div>
    {empty.map(renderField)}
    </div>
   )}

   {/* Reason */}
   <div className="flex flex-col gap-1.5">
    <label className="text-sm font-semibold text-foreground">
    Reason for change <span className="text-destructive">*</span>
    </label>
    <Textarea
    placeholder="Where does this come from? (e.g. 'The 2019 Breyer catalog lists this as Dark Bay', 'I own one — photo on my stable page')"
    value={reason}
    onChange={(e) => setReason(e.target.value)}
    rows={2}
    />
   </div>

   {error && (
    <p className="text-destructive text-sm font-semibold" role="alert">
    {error}
    </p>
   )}

   <div className="flex justify-end gap-2">
    <Button variant="outline" onClick={() => setIsOpen(false)}>
    Cancel
    </Button>
    <Button onClick={handleSubmit} disabled={isPending || !hasChanges}>
    {isPending ? "Submitting…" : hasChanges
     ? `Submit ${changed.length} ${changed.length === 1 ? "change" : "changes"}`
     : "Submit"}
    </Button>
   </div>
   </div>
  </DialogContent>
  </Dialog>
 </>
 );
}
