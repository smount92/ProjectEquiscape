"use client";

import { useState } from"react";
import { submitSuggestion } from"@/app/actions/suggestions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

interface SuggestReferenceModalProps {
 isOpen: boolean;
 searchTerm: string;
 onClose: () => void;
 onSubmitted: (searchTerm: string) => void;
}

const SUGGESTION_TYPES = [
 {
 value:"mold",
 label:"🐴 Mold / Sculpt",
 description:"A specific sculpt (e.g., Breyer Alborozo, Stone Ideal Stock Horse)",
 },
 {
 value:"release",
 label:"🎨 Specific Release / Color",
 description:"A specific release or color run of an existing mold",
 },
 { value:"resin", label:"✨ Artist Resin", description:"An artist resin sculpt not in our database" },
] as const;

export default function SuggestReferenceModal({
 isOpen,
 searchTerm,
 onClose,
 onSubmitted,
}: SuggestReferenceModalProps) {
 const [name, setName] = useState(searchTerm);
 const [suggestionType, setSuggestionType] = useState<"mold" |"release" |"resin">("mold");
 const [details, setDetails] = useState("");
 const [status, setStatus] = useState<"idle" |"submitting" |"success" |"error">("idle");
 const [errorMsg, setErrorMsg] = useState("");

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!name.trim() || status ==="submitting") return;

 setStatus("submitting");
 setErrorMsg("");

 const result = await submitSuggestion({
 suggestionType,
 name: name.trim(),
 details: details.trim() || undefined,
 });

 if (result.success) {
 setStatus("success");
 setTimeout(() => {
 onSubmitted(name.trim());
 }, 1500);
 } else {
 setErrorMsg(result.error ||"Failed to submit suggestion.");
 setStatus("error");
 }
 };

 const handleClose = () => {
 if (status ==="submitting") return;
 onClose();
 };

 return (
 <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
 <DialogContent className="sm:max-w-[520px]">
 {status ==="success" ? (
 <div className="px-4 py-5 text-center">
 <div className="mb-4 text-[3rem]">✅</div>
 <DialogHeader>
 <DialogTitle>Suggestion Submitted!</DialogTitle>
 <DialogDescription>
 Our team will review your suggestion. If approved, it will appear in the reference database.
 </DialogDescription>
 </DialogHeader>
 </div>
 ) : (
 <form onSubmit={handleSubmit}>
 <DialogHeader>
 <DialogTitle>📝 Suggest a Reference</DialogTitle>
 <DialogDescription>
 Help us grow the database! Tell us about the model you couldn&apos;t find.
 </DialogDescription>
 </DialogHeader>

 {/* Suggestion Type */}
 <div className="mb-6 mt-4">
 <label className="text-ink mb-1 block text-sm font-semibold">
 What are you suggesting?
 </label>
 <div className="flex flex-col gap-1">
 {SUGGESTION_TYPES.map((type) => (
 <label
 key={type.value}
 className={`flex cursor-pointer items-start gap-2 rounded-sm border px-4 py-2 transition-all duration-200 ${
 suggestionType === type.value
 ? "border-[var(--color-accent-primary)] bg-[rgba(61,90,62,0.08)]"
 : "border-[var(--color-border)] bg-transparent"
 }`}
 >
 <input
 type="radio"
 name="suggestion-type"
 value={type.value}
 checked={suggestionType === type.value}
 onChange={() => setSuggestionType(type.value)}
 className="mt-[3px] accent-[var(--color-accent-primary)]"
 />
 <div>
 <div className="text-sm font-semibold">{type.label}</div>
 <div className="text-muted text-xs">{type.description}</div>
 </div>
 </label>
 ))}
 </div>
 </div>

 {/* Name */}
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">
 Name <span className="text-[#e74c6f]">*</span>
 </label>
 <Input
 type="text"
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="e.g. Breyer Alborozo, Stone Ideal Stock Horse"
 maxLength={200}
 required
 autoFocus
 id="suggest-name"
 />
 </div>

 {/* Details */}
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Additional Details</label>
 <Textarea
 value={details}
 onChange={(e) => setDetails(e.target.value)}
 placeholder={
 suggestionType ==="mold"
 ?"Manufacturer, scale, year introduced, model number…"
 : suggestionType ==="release"
 ?"Color name, mold it belongs to, year released, regular/special run…"
 :"Sculptor, scale, approximate edition size…"
 }
 maxLength={1000}
 rows={3}
 id="suggest-details"
 />
 <small className="text-muted text-xs">
 The more detail you provide, the faster we can add it.
 </small>
 </div>

 {status ==="error" && errorMsg && <div className="mt-2 text-sm text-danger mb-4">{errorMsg}</div>}

 <div className="flex justify-end gap-2">
 <button
 type="button"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={handleClose}
 disabled={status ==="submitting"}
 >
 Cancel
 </button>
 <button
 type="submit"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 disabled={!name.trim() || status ==="submitting"}
 >
 {status ==="submitting" ?"Submitting…" :"📤 Submit Suggestion"}
 </button>
 </div>
 </form>
 )}
 </DialogContent>
 </Dialog>
 );
}
