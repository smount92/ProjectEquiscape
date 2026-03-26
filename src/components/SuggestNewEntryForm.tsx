"use client";

import { useState, useTransition } from"react";
import { useRouter } from"next/navigation";
import { createSuggestion } from"@/app/actions/catalog-suggestions";
import { Input } from "@/components/ui/input";

const MAKERS = ["Breyer","Stone","Hartland","Hagen-Renaker","Peter Stone","Artist Resin","Other"];
const ITEM_TYPES = [
 { value:"release", label:"Release (specific color/year of a mold)" },
 { value:"mold", label:"Mold (sculpture, not a specific release)" },
 { value:"resin", label:"Artist Resin" },
 { value:"tack", label:"Tack / Accessory" },
];

export default function SuggestNewEntryForm() {
 const router = useRouter();
 const [isPending, startTransition] = useTransition();
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState(false);

 const [title, setTitle] = useState("");
 const [maker, setMaker] = useState("");
 const [customMaker, setCustomMaker] = useState("");
 const [itemType, setItemType] = useState("release");
 const [scale, setScale] = useState("");
 const [color, setColor] = useState("");
 const [year, setYear] = useState("");
 const [moldName, setMoldName] = useState("");
 const [reason, setReason] = useState("");

 const handleSubmit = () => {
 if (!title.trim()) {
 setError("Title is required.");
 return;
 }
 if (!reason.trim() || reason.trim().length < 10) {
 setError("Please provide a reason (at least 10 characters).");
 return;
 }

 const effectiveMaker = maker ==="Other" ? customMaker.trim() : maker;

 startTransition(async () => {
 setError(null);
 const result = await createSuggestion({
 catalogItemId: null, // null = new entry suggestion
 suggestionType:"addition",
 fieldChanges: {
 title: title.trim(),
 maker: effectiveMaker || undefined,
 item_type: itemType,
 scale: scale || undefined,
 color: color || undefined,
 year: year ? parseInt(year, 10) : undefined,
 mold_name: moldName || undefined,
 },
 reason: reason.trim(),
 });

 if (result.success) {
 setSuccess(true);
 } else {
 setError(result.error ||"Failed to submit suggestion.");
 }
 });
 };

 if (success) {
 return (
 <div className="p-8 text-center">
 <div className="mb-4 text-[3rem]">✅</div>
 <h2 className="mb-2 font-display">
 Suggestion Submitted!
 </h2>
 <p className="text-muted mb-6">
 Your new entry suggestion is now pending review. The community can vote and discuss it.
 </p>
 <div className="flex justify-center gap-4">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={() => router.push("/catalog/suggestions")}
 >
 View All Suggestions
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => {
 setSuccess(false);
 setTitle("");
 setReason("");
 }}
 >
 Submit Another
 </button>
 </div>
 </div>
 );
 }

 return (
 <div className="flex flex-col gap-4">
 {/* Title */}
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold" htmlFor="new-entry-title">
 Title / Name *
 </label>
 <Input
 id="new-entry-title"
 
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 placeholder="e.g. Breyer #712 — Misty of Chincoteague"
 maxLength={200}
 />
 </div>

 {/* Item Type */}
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold" htmlFor="new-entry-type">
 Entry Type
 </label>
 <select
 id="new-entry-type"
 className="flex h-10 w-full rounded-md border border-edge bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={itemType}
 onChange={(e) => setItemType(e.target.value)}
 >
 {ITEM_TYPES.map((t) => (
 <option key={t.value} value={t.value}>
 {t.label}
 </option>
 ))}
 </select>
 </div>

 {/* Maker */}
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold" htmlFor="new-entry-maker">
 Maker / Manufacturer
 </label>
 <select
 id="new-entry-maker"
 className="flex h-10 w-full rounded-md border border-edge bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={maker}
 onChange={(e) => setMaker(e.target.value)}
 >
 <option value="">— Select —</option>
 {MAKERS.map((m) => (
 <option key={m} value={m}>
 {m}
 </option>
 ))}
 </select>
 {maker ==="Other" && (
 <Input
 className="mt-2"
 value={customMaker}
 onChange={(e) => setCustomMaker(e.target.value)}
 placeholder="Enter maker name"
 maxLength={100}
 />
 )}
 </div>

 {/* Two-column row: Scale + Color */}
 <div className="grid grid-cols-2 gap-4">
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold" htmlFor="new-entry-scale">
 Scale
 </label>
 <select
 id="new-entry-scale"
 className="flex h-10 w-full rounded-md border border-edge bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={scale}
 onChange={(e) => setScale(e.target.value)}
 >
 <option value="">— Select —</option>
 <option value="Traditional">Traditional</option>
 <option value="Classic">Classic</option>
 <option value="Stablemate">Stablemate</option>
 <option value="Paddock Pal">Paddock Pal</option>
 <option value="Mini Whinnies">Mini Whinnies</option>
 <option value="Other">Other</option>
 </select>
 </div>
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold" htmlFor="new-entry-color">
 Color
 </label>
 <Input
 id="new-entry-color"
 
 value={color}
 onChange={(e) => setColor(e.target.value)}
 placeholder="e.g. Bay, Palomino"
 maxLength={100}
 />
 </div>
 </div>

 {/* Two-column row: Mold + Year */}
 <div className="grid grid-cols-2 gap-4">
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold" htmlFor="new-entry-mold">
 Mold Name
 </label>
 <Input
 id="new-entry-mold"
 
 value={moldName}
 onChange={(e) => setMoldName(e.target.value)}
 placeholder="e.g. Family Arabian Stallion"
 maxLength={200}
 />
 </div>
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold" htmlFor="new-entry-year">
 Year
 </label>
 <Input
 id="new-entry-year"
 type="number"
 
 value={year}
 onChange={(e) => setYear(e.target.value)}
 placeholder="e.g. 1995"
 min={1950}
 max={2030}
 />
 </div>
 </div>

 {/* Reason */}
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold" htmlFor="new-entry-reason">
 Reason / Evidence *
 </label>
 <textarea
 id="new-entry-reason"
 className="inline-flex min-h-[36px] w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-4 py-2 text-sm font-semibold no-underline transition-all resize-y"
 value={reason}
 onChange={(e) => setReason(e.target.value)}
 rows={3}
 maxLength={2000}
 placeholder="Explain why this entry should be added. Include sources if available (e.g. 'Listed in the 2019 Breyer dealer catalog, page 12')."
 />
 <span
 className="text-muted mt-[4] block text-right text-xs"
 >
 {reason.length}/2000
 </span>
 </div>

 {error && (
 <p className="text-danger mt-2 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm">
 {error}
 </p>
 )}

 {/* Actions */}
 <div className="flex justify-end gap-4">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => router.back()}
 disabled={isPending}
 >
 Cancel
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleSubmit}
 disabled={isPending || !title.trim() || !reason.trim()}
 >
 {isPending ?"Submitting…" :"📗 Submit Suggestion"}
 </button>
 </div>
 </div>
 );
}
