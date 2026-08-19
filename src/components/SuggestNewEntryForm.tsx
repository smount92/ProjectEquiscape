"use client";

import { useState, useTransition } from"react";
import { useRouter } from"next/navigation";
import { createSuggestion } from"@/app/actions/catalog-suggestions";
import { ARTIST_ATTRIBUTED_CATEGORIES, CANONICAL_SCALES } from "@/lib/catalog/taxonomy";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

// "Stone" and "Peter Stone" are the same maker (collapsed), and
// "Artist Resin" is an entry TYPE, not a maker — both fixed here.
// North Light: commercially produced OF resins (North Light factory,
// England — later Wade Ceramics). A FACTORY maker, so its models are
// molds/releases, never "Artist Resin" (owner-approved 2026-08 after
// a user request; 15 catalog items exist under maker_slug north-light).
const MAKERS = ["Breyer","Peter Stone","Hartland","Hagen-Renaker","North Light","Other"];
// Taxonomy v2: canonical DB values (legacy release/mold/resin values in
// old pending suggestions still translate — see taxonomy.ts).
const ITEM_TYPES = [
 { value:"plastic_release", label:"Release (specific color/year of a mold)" },
 { value:"plastic_mold", label:"Mold (sculpture, not a specific release)" },
 { value:"artist_resin", label:"Artist Resin" },
 { value:"factory_resin", label:"Factory Resin (OF resin — Stone, North Light…)" },
 { value:"china", label:"China / Ceramic" },
 { value:"micro_mini", label:"Micro Mini" },
 { value:"medallion", label:"Medallion" },
 { value:"tack", label:"Tack / Accessory" },
];

interface SuggestNewEntryFormProps {
 /** Prefill the title — e.g. the search term that found nothing. */
 initialTitle?: string;
 /** "dialog": hosted inside a Dialog (add-horse picker). Cancel and the
  *  success CTA hand control back to the host instead of navigating. */
 variant?:"page" |"dialog";
 /** Dialog mode: called when the user continues after a successful submit. */
 onSubmitted?: (title: string) => void;
 /** Dialog mode: called when the user cancels. */
 onCancel?: () => void;
}

export default function SuggestNewEntryForm({
 initialTitle ="",
 variant ="page",
 onSubmitted,
 onCancel,
}: SuggestNewEntryFormProps = {}) {
 const router = useRouter();
 const [isPending, startTransition] = useTransition();
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState(false);
 const [submittedTitle, setSubmittedTitle] = useState("");

 const [title, setTitle] = useState(initialTitle);
 const [maker, setMaker] = useState("");
 const [customMaker, setCustomMaker] = useState("");
 const [sculptor, setSculptor] = useState("");
 // Artist categories: the primary attribution is a PERSON.
 const [artistName, setArtistName] = useState("");
 const [manufacturer, setManufacturer] = useState("");
 const [itemType, setItemType] = useState("plastic_release");
 const [scale, setScale] = useState("");
 const [color, setColor] = useState("");
 const [material, setMaterial] = useState("");
 const [year, setYear] = useState("");
 const [moldName, setMoldName] = useState("");
 const [reason, setReason] = useState("");
 // Duplicate speed bump: candidates from the server's title match.
 const [duplicates, setDuplicates] = useState<
 { id: string; title: string; maker: string | null; item_type: string }[] | null
 >(null);

 const handleSubmit = (confirmDuplicates = false) => {
 if (!title.trim()) {
 setError("Title is required.");
 return;
 }
 if (!reason.trim() || reason.trim().length < 10) {
 setError("Please provide a reason (at least 10 characters).");
 return;
 }

 // Attribution split: for artist pieces the person IS the primary
 // attribution (maker); for factory pieces the company is.
 const isArtistPiece = ARTIST_ATTRIBUTED_CATEGORIES.has(itemType);
 const effectiveMaker = isArtistPiece
 ? artistName.trim()
 : maker ==="Other" ? customMaker.trim() : maker;

 startTransition(async () => {
 setError(null);
 const result = await createSuggestion({
 catalogItemId: null, // null = new entry suggestion
 suggestionType:"addition",
 fieldChanges: {
 title: title.trim(),
 maker: effectiveMaker || undefined,
 manufacturer: isArtistPiece ? manufacturer.trim() || undefined : undefined,
 sculptor: isArtistPiece ? undefined : sculptor.trim() || undefined,
 item_type: itemType,
 scale: scale || undefined,
 color: color || undefined,
 material: material || undefined,
 year: year ? parseInt(year, 10) : undefined,
 mold_name: moldName || undefined,
 },
 reason: reason.trim(),
 confirmDuplicates,
 });

 if (result.success) {
 setDuplicates(null);
 setSubmittedTitle(title.trim());
 setSuccess(true);
 } else if (result.error ==="possible-duplicates" &&"duplicates" in result) {
 setDuplicates(result.duplicates ?? []);
 } else {
 setError(result.error ||"Failed to submit suggestion.");
 }
 });
 };

 const handleCancel = () => {
 if (variant ==="dialog" && onCancel) {
 onCancel();
 } else {
 router.back();
 }
 };

 if (success) {
 return (
 <div className="p-8 text-center">
 <div className="mb-4 text-[3rem]">✅</div>
 <h2 className="mb-2 font-display">
 Suggestion Submitted!
 </h2>
 <p className="text-muted-foreground mb-6">
 Your new entry suggestion is now pending review. The community can vote and discuss it.
 </p>
 <div className="flex flex-wrap justify-center gap-4">
 {variant ==="dialog" ? (
 <Button
 onClick={() => onSubmitted?.(submittedTitle)}
 >
 Continue →
 </Button>
 ) : (
 <>
 <Button
 onClick={() => router.push("/catalog/suggestions")}
 >
 View All Suggestions
 </Button>
 <Button variant="outline" size="wide"
 onClick={() => {
 setSuccess(false);
 setTitle("");
 setReason("");
 }}
 >
 Submit Another
 </Button>
 </>
 )}
 </div>
 </div>
 );
 }

 return (
 <div className="flex flex-col gap-4">
 {/* Title */}
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold" htmlFor="new-entry-title">
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
 <label className="text-foreground mb-1 block text-sm font-semibold" htmlFor="new-entry-type">
 Entry Type
 </label>
 <select
 id="new-entry-type"
 className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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

 {/* Attribution — category-aware (owner decision 2026-08-19):
     artist pieces credit a PERSON first (Artist) with an optional
     company; factory pieces credit a COMPANY first (Manufacturer)
     with an optional sculptor. */}
 {ARTIST_ATTRIBUTED_CATEGORIES.has(itemType) ? (
 <>
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold" htmlFor="new-entry-artist">
 Artist
 </label>
 <Input
 id="new-entry-artist"
 value={artistName}
 onChange={(e) => setArtistName(e.target.value)}
 placeholder="e.g. Sarah Rose, Maggie Bennett"
 maxLength={100}
 />
 </div>
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold" htmlFor="new-entry-manufacturer">
 Manufacturer / casting company <span className="font-normal text-muted-foreground">(optional)</span>
 </label>
 <Input
 id="new-entry-manufacturer"
 value={manufacturer}
 onChange={(e) => setManufacturer(e.target.value)}
 placeholder="e.g. Resins by Randy — leave blank if the artist casts their own"
 maxLength={100}
 />
 </div>
 </>
 ) : (
 <>
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold" htmlFor="new-entry-maker">
 Manufacturer
 </label>
 <select
 id="new-entry-maker"
 className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
 placeholder="Enter manufacturer name"
 maxLength={100}
 />
 )}
 </div>

 {/* Sculptor — credit, not maker. Separated after the North Light
     incident: factory pieces have a company maker AND a named
     sculpting artist; one field forced contributors to choose. */}
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold" htmlFor="new-entry-sculptor">
 Sculptor <span className="font-normal text-muted-foreground">(optional)</span>
 </label>
 <Input
 id="new-entry-sculptor"
 value={sculptor}
 onChange={(e) => setSculptor(e.target.value)}
 placeholder="e.g. Guy Pocock, Kathleen Moody"
 maxLength={100}
 />
 <p className="mt-1 mb-0 text-xs text-muted-foreground">
 Manufacturer is the company or brand (Breyer, North Light). Sculptor is the
 artist who sculpted it — worth crediting even on factory pieces.
 </p>
 </div>
 </>
 )}

 {/* Two-column row: Scale + Color */}
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold" htmlFor="new-entry-scale">
 Scale
 </label>
 <select
 id="new-entry-scale"
 className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={scale}
 onChange={(e) => setScale(e.target.value)}
 >
 <option value="">— Select —</option>
 {CANONICAL_SCALES.map((s) => (
 <option key={s} value={s}>{s}</option>
 ))}
 </select>
 </div>
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold" htmlFor="new-entry-color">
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
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold" htmlFor="new-entry-mold">
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
 <label className="text-foreground mb-1 block text-sm font-semibold" htmlFor="new-entry-year">
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

 {/* Material */}
 <div className="mb-6 sm:w-1/2 sm:pr-2">
 <label className="text-foreground mb-1 block text-sm font-semibold" htmlFor="new-entry-material">
 Material
 </label>
 <select
 id="new-entry-material"
 className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={material}
 onChange={(e) => setMaterial(e.target.value)}
 >
 <option value="">— Select —</option>
 <option value="Plastic">Plastic</option>
 <option value="Resin">Resin</option>
 <option value="Pewter">Pewter</option>
 <option value="China">China</option>
 <option value="Metal">Metal</option>
 <option value="Other">Other</option>
 </select>
 </div>

 {/* Reason */}
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold" htmlFor="new-entry-reason">
 Reason / Evidence *
 </label>
 <Textarea
 id="new-entry-reason"
 className="min-h-[72px] resize-y"
 value={reason}
 onChange={(e) => setReason(e.target.value)}
 rows={3}
 maxLength={2000}
 placeholder="Explain why this entry should be added. Include sources if available (e.g. 'Listed in the 2019 Breyer dealer catalog, page 12')."
 />
 <span
 className="text-muted-foreground mt-1 block text-right text-xs"
 >
 {reason.length}/2000
 </span>
 </div>

 {error && (
 <p className="text-destructive mt-2 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm">
 {error}
 </p>
 )}

 {/* Actions */}
 {duplicates && (
 <div className="mb-4 rounded-lg border border-input bg-muted/50 p-4" role="alert">
 <p className="m-0 mb-2 text-sm font-semibold">
 Is one of these already it? The catalog has similar entries:
 </p>
 <ul className="m-0 mb-3 flex list-none flex-col gap-1 p-0">
 {duplicates.map((d) => (
 <li key={d.id} className="text-sm">
 <a
 href={`/catalog/${d.id}`}
 target="_blank"
 rel="noreferrer"
 className="font-medium text-forest hover:underline"
 >
 {d.title}
 </a>{" "}
 <span className="text-muted-foreground">
 — {d.maker ?? "unknown maker"}
 </span>
 </li>
 ))}
 </ul>
 <p className="m-0 text-xs text-muted-foreground">
 If your model is one of these, link it from the search instead of suggesting a
 duplicate. If it really is new, submit anyway.
 </p>
 </div>
 )}
 <div className="flex justify-end gap-4">
 <Button variant="outline" size="wide"
 onClick={handleCancel}
 disabled={isPending}
 >
 Cancel
 </Button>
 <Button
 onClick={() => handleSubmit(duplicates !== null)}
 disabled={isPending || !title.trim() || !reason.trim()}
 >
 {isPending
 ?"Submitting…"
 : duplicates
 ?"It's new — submit anyway"
 :"📗 Submit Suggestion"}
 </Button>
 </div>
 </div>
 );
}
