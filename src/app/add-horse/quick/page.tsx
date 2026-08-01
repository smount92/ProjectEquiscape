"use client";

import { useState, useEffect } from"react";
import Link from"next/link";
import { useRouter } from"next/navigation";
import { finalizeHorseImages, quickAddHorse } from"@/app/actions/horse";
import { getProfile } from"@/app/actions/settings";
import UnifiedReferenceSearch from"@/components/UnifiedReferenceSearch";
import type { CatalogItem } from"@/app/actions/reference";
import { createClient } from"@/lib/supabase/client";
import {
 compressImage,
 compressImageWithWatermark,
 generateThumbnail,
 validateImageFile,
 type UserTier,
} from"@/lib/utils/imageCompression";
import { uploadImageWithRetry } from"@/lib/utils/uploadWithRetry";
import { Input } from "@/components/ui/input";
import FocusLayout from"@/components/layouts/FocusLayout";
import PageMasthead from"@/components/layouts/PageMasthead";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { CONDITION_GRADES } from "@/lib/conditionGrades";

const FINISH_TYPES = ["OF","Custom","Artist Resin"];
// Grade values come from the shared module (single source of truth with
// Add Horse and Edit) — Quick Add shows the short names only.
const CONDITION_VALUES = CONDITION_GRADES.map((g) => g.value);

interface RecentAdd {
 id: string;
 name: string;
 finish: string;
 condition: string;
 timestamp: number;
 isPublic: boolean;
 hasPhoto: boolean;
}

export default function QuickAddPage() {
 const router = useRouter();
 const [selectedCatalog, setSelectedCatalog] = useState<CatalogItem | null>(null);
 const [customName, setCustomName] = useState("");
 const [finishType, setFinishType] = useState("OF");
 const [conditionGrade, setConditionGrade] = useState("Mint");
 const [collectionId, setCollectionId] = useState("");
 const [collections, setCollections] = useState<{ id: string; name: string }[]>([]);
 const [isAdding, setIsAdding] = useState(false);
 const [recentAdds, setRecentAdds] = useState<RecentAdd[]>([]);
 const [error, setError] = useState<string | null>(null);
 // Batch 3: Quick Add horses default to PUBLIC so they can actually
 // enter shows (they were hardcoded private, which silently made
 // them un-enterable), plus an optional single photo.
 const [isPublic, setIsPublic] = useState(true);
 const [photo, setPhoto] = useState<{ file: File; previewUrl: string } | null>(null);
 const [photoNote, setPhotoNote] = useState<string | null>(null);
 // Above-the-fold success confirmation (the only feedback used to be the
 // below-fold "Recently Added" list) + double-tap guard: after a success
 // the Add button stays disabled until something on the form changes.
 const [justAdded, setJustAdded] = useState<{ id: string; name: string; hasPhoto: boolean } | null>(null);
 const [addedSignature, setAddedSignature] = useState<string | null>(null);
 const [userTier, setUserTier] = useState<UserTier>("free");
 const [watermarkEnabled, setWatermarkEnabled] = useState(false);
 const [userAlias, setUserAlias] = useState("");
 const [userWatermarkText, setUserWatermarkText] = useState("");

 // Load user collections + tier + watermark preference
 useEffect(() => {
 async function loadCollections() {
 const supabase = createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) return;
 if (user.app_metadata?.tier) setUserTier(user.app_metadata.tier as UserTier);
 const { data } = await supabase
 .from("user_collections")
 .select("id, name")
 .eq("user_id", user.id)
 .order("name");
 if (data) setCollections(data as { id: string; name: string }[]);
 }
 loadCollections();
 getProfile().then((profile) => {
 if (profile) {
 setWatermarkEnabled(profile.watermarkPhotos);
 setUserAlias(profile.aliasName);
 setUserWatermarkText(profile.watermarkText);
 }
 }).catch(() => {});
 }, []);

 const handlePhotoSelect = (file: File) => {
 const invalid = validateImageFile(file);
 if (invalid) {
 setPhotoNote(invalid);
 return;
 }
 setPhotoNote(null);
 if (photo) URL.revokeObjectURL(photo.previewUrl);
 setPhoto({ file, previewUrl: URL.createObjectURL(file) });
 };

 /** Same 2-step pipeline as the full form: client compress + direct
 * Storage upload (with retry + thumbnail), then finalize metadata.
 * Non-fatal — the horse is already saved when this runs. */
 const uploadQuickPhoto = async (horseId: string, file: File): Promise<boolean> => {
 try {
 const supabase = createClient();
 const compressed =
 watermarkEnabled && userAlias
 ? await compressImageWithWatermark(file, userAlias, userTier, userWatermarkText)
 : await compressImage(file, userTier);
 const filePath = `horses/${horseId}/Primary_Thumbnail_${Date.now()}.webp`;
 const { error: uploadError } = await uploadImageWithRetry(
 supabase, "horse-images", filePath, compressed,
 );
 if (uploadError) return false;

 // Thumbnail is best-effort — grids fall back to full-res.
 try {
 const thumbnail = await generateThumbnail(file);
 const thumbPath = filePath.replace(/\.webp$/, "_thumb.webp");
 await supabase.storage
 .from("horse-images")
 .upload(thumbPath, thumbnail, { contentType: "image/webp" });
 } catch {
 // non-fatal
 }

 const finalize = await finalizeHorseImages(horseId, [
 { path: filePath, angle: "Primary_Thumbnail" },
 ]);
 return finalize.success;
 } catch {
 return false;
 }
 };

 /** One string per distinct form state — used to keep the Add button
  * disabled after a success until the user actually changes something
  * (guards the accidental second tap that created duplicate horses). */
 const formSignature = JSON.stringify({
 c: selectedCatalog?.id ?? null,
 n: customName.trim(),
 f: finishType,
 g: conditionGrade,
 col: collectionId,
 p: isPublic,
 ph: photo?.previewUrl ?? null,
 });

 const handleAdd = async () => {
 setIsAdding(true);
 setError(null);
 setPhotoNote(null);
 try {
 const result = await quickAddHorse({
 catalogId: selectedCatalog?.id,
 customName: customName.trim() || undefined,
 finishType,
 conditionGrade,
 collectionId: collectionId || undefined,
 isPublic,
 });

 if (!result.success) {
 setError(result.error ||"Failed to add horse.");
 return;
 }

 track("add_horse", { category: "model", quick: true });

 // Optional photo — reuses the full form's upload pipeline.
 let hasPhoto = false;
 if (photo) {
 hasPhoto = await uploadQuickPhoto(result.horseId!, photo.file);
 if (!hasPhoto) {
 setPhotoNote(
 "The horse saved, but its photo didn't upload — add one from the horse's page.",
 );
 }
 URL.revokeObjectURL(photo.previewUrl);
 setPhoto(null);
 }

 setRecentAdds((prev) =>
 [
 {
 id: result.horseId!,
 name: result.horseName!,
 finish: finishType,
 condition: conditionGrade,
 timestamp: Date.now(),
 isPublic,
 hasPhoto,
 },
 ...prev,
 ].slice(0, 10),
 );

 // Success is confirmed at the top of the form (not only in the
 // below-fold list), and the button locks until the form changes.
 setJustAdded({ id: result.horseId!, name: result.horseName!, hasPhoto });
 // Lock against the form state as it will look AFTER the clears
 // below (name consumed, photo consumed) so an unchanged form
 // can't be double-submitted.
 setAddedSignature(
 JSON.stringify({
 c: selectedCatalog?.id ?? null,
 n:"",
 f: finishType,
 g: conditionGrade,
 col: collectionId,
 p: isPublic,
 ph: null,
 }),
 );
 // Custom-entry name is consumed; the catalog selection is kept on
 // purpose — it feeds"Duplicate as New Finish".
 setCustomName("");

 // Don't clear catalog selection — supports"Duplicate as New"
 } catch {
 setError("An unexpected error occurred.");
 } finally {
 setIsAdding(false);
 }
 };

 const handleDuplicate = () => {
 // Keep catalog, reset only finish for a different variant
 setFinishType("OF");
 setConditionGrade("Mint");
 setCustomName("");
 if (photo) URL.revokeObjectURL(photo.previewUrl);
 setPhoto(null);
 };

 const timeSince = (ts: number) => {
 const secs = Math.floor((Date.now() - ts) / 1000);
 if (secs < 5) return"just now";
 if (secs < 60) return `${secs}s ago`;
 return `${Math.floor(secs / 60)}m ago`;
 };

 return (
  <FocusLayout noHeader>
  <PageMasthead
   compact
   icon="⚡"
   title="Quick Add"
   subtitle="Rapidly add horses to your stable"
   backHref="/dashboard"
   backLabel="Dashboard"
  />
 <div className="animate-fade-in-up mx-auto max-w-[640px]">
 {/* Above-the-fold success confirmation */}
 {justAdded && (
 <div
 className="border-success/40 bg-success/10 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-3 text-sm"
 role="status"
 aria-live="polite"
 >
 <span className="font-semibold text-forest">✅ {justAdded.name} added to your stable</span>
 <span className="text-muted-foreground text-xs">
 {justAdded.hasPhoto
 ?"Show-ready — public with a photo."
 :"Add a photo before entering a show."}
 </span>
 <Link
 href={`/stable/${justAdded.id}`}
 className="ml-auto font-semibold text-forest hover:underline"
 >
 View →
 </Link>
 </div>
 )}
 <div className="bg-card border-input rounded-lg border p-8 shadow-md transition-all">
 {/* Catalog Search */}
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">🔍 Search Catalog</label>
 <UnifiedReferenceSearch
 selectedCatalogId={selectedCatalog?.id || null}
 onCatalogSelect={(catalogId, item) => {
 setSelectedCatalog(item);
 setCustomName("");
 }}
 onCustomEntry={(name) => {
 setSelectedCatalog(null);
 setCustomName(name);
 }}
 />
 {selectedCatalog && (
 <div className="ring-2 ring-forest bg-forest/5">
 ✅ {selectedCatalog.maker} — {selectedCatalog.title}
 <span className="text-muted-foreground text-xs"> ({selectedCatalog.itemType})</span>
 </div>
 )}
 {!selectedCatalog && customName && (
 <div className="ring-2 ring-forest bg-forest/5">✍️ Custom entry: {customName}</div>
 )}
 </div>

 {/* Custom Name (optional if catalog selected) */}
 {!selectedCatalog && (
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">Name</label>
 <Input
 
 type="text"
 value={customName}
 onChange={(e) => setCustomName(e.target.value)}
 placeholder="e.g. My Black Beauty"
 />
 </div>
 )}

 {/* Quick Selectors Row */}
 <div className="quick-add-selectors max-sm:grid-cols-1">
 <div>
 <label className="text-foreground mb-1 block text-sm font-semibold">Finish</label>
 <select
 className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={finishType}
 onChange={(e) => setFinishType(e.target.value)}
 id="quick-finish"
 title="Select finish type"
 >
 {FINISH_TYPES.map((f) => (
 <option key={f} value={f}>
 {f}
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="text-foreground mb-1 block text-sm font-semibold">Condition</label>
 <select
 className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={conditionGrade}
 onChange={(e) => setConditionGrade(e.target.value)}
 id="quick-condition"
 title="Select condition grade"
 >
 {CONDITION_VALUES.map((c) => (
 <option key={c} value={c}>
 {c}
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="text-foreground mb-1 block text-sm font-semibold">Collection</label>
 <select
 className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={collectionId}
 onChange={(e) => setCollectionId(e.target.value)}
 id="quick-collection"
 title="Select collection"
 >
 <option value="">— None —</option>
 {collections.map((c) => (
 <option key={c.id} value={c.id}>
 {c.name}
 </option>
 ))}
 </select>
 </div>
 </div>

 {/* Visibility — Public by default so the horse can show */}
 <div className="mt-6 mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">Visibility</label>
 <div className="flex flex-wrap gap-2" role="group" aria-label="Visibility">
 {[
 { value: true, icon:"🌐", label:"Public" },
 { value: false, icon:"🔒", label:"Private" },
 ].map((opt) => (
 <button
 key={opt.label}
 type="button"
 className={`flex min-w-[110px] cursor-pointer items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all ${isPublic === opt.value ?"border-forest bg-forest/10 text-forest" :"border-input bg-card text-secondary-foreground hover:border-forest/40"}`}
 onClick={() => setIsPublic(opt.value)}
 aria-pressed={isPublic === opt.value}
 id={`quick-visibility-${opt.label.toLowerCase()}`}
 >
 <span aria-hidden="true">{opt.icon}</span> {opt.label}
 </button>
 ))}
 </div>
 <span className="text-muted-foreground mt-1 block text-xs">
 Public horses can enter shows and appear in the Show Ring.
 </span>
 </div>

 {/* Optional single photo — one clear shot makes it show-ready */}
 <div className="mb-6">
 <label
 htmlFor="quick-photo-input"
 className="relative flex min-h-[88px] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input bg-card p-4 text-center transition-all hover:border-forest hover:bg-forest/5"
 onDragOver={(e) => e.preventDefault()}
 onDrop={(e) => {
 e.preventDefault();
 const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
 if (file) handlePhotoSelect(file);
 }}
 >
 <input
 id="quick-photo-input"
 type="file"
 accept="image/jpeg,image/png,image/webp,image/gif"
 className="hidden"
 title="Upload a photo"
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (file) handlePhotoSelect(file);
 e.target.value ="";
 }}
 />
 <span className="text-foreground text-sm font-medium">
 <strong>Photo (optional)</strong>
 </span>
 <span className="text-muted-foreground text-xs">
 One clear side shot makes it show-ready · Click or drag a file here
 </span>
 </label>
 {photo && (
 <div className="border-input relative mt-3 h-[100px] w-[100px] overflow-hidden rounded-md border">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={photo.previewUrl} alt="Photo preview" className="h-full w-full object-cover" />
 <button
 className="bg-black/70 absolute top-[6px] right-[6px] z-[2] flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-full border-0 text-[0.85rem] text-white transition-colors"
 onClick={() => {
 URL.revokeObjectURL(photo.previewUrl);
 setPhoto(null);
 }}
 aria-label="Remove photo"
 type="button"
 >
 ✕
 </button>
 </div>
 )}
 {photoNote && (
 <p className="mt-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning" role="alert">
 {photoNote}
 </p>
 )}
 </div>

 {/* Error */}
 {error && (
 <div className="text-destructive mt-2 mt-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm">
 ⚠️ {error}
 </div>
 )}

 {/* Action Buttons */}
 <div className="flex flex-wrap items-center gap-4">
 <Button
 onClick={handleAdd}
 disabled={
 isAdding ||
 (!selectedCatalog && !customName.trim()) ||
 // Just added exactly this — change something (or Duplicate) first.
 formSignature === addedSignature
 }
 id="quick-add-submit"
 >
 {isAdding ?"Adding…" : formSignature === addedSignature ?"✅ Added" :"🐴 Add to Stable"}
 </Button>
 {selectedCatalog && recentAdds.length > 0 && (
 <Button variant="outline" size="wide"
 onClick={handleDuplicate}
 id="quick-duplicate"
 >
 + Duplicate as New Finish
 </Button>
 )}
 </div>
 </div>

 {/* Link to full form */}
 <div className="text-muted-foreground mt-4 text-center text-sm">
 Need photos or more details?{""}
 <Link href="/add-horse" className="text-forest">
 Use the full intake form →
 </Link>
 </div>

 {/* Recent Adds */}
 {recentAdds.length > 0 && (
 <div className="border-input mt-8 rounded-lg border bg-card p-6">
 <h3 className="mb-2 text-base">Recently Added</h3>
 {recentAdds.map((item) => (
 <div
 key={item.id}
 className="border-input mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card px-4 py-3 first:mt-0"
 >
 <span className="font-semibold">✅ {item.name}</span>
 <span className="text-muted-foreground text-sm">
 {item.finish} · {item.condition} — {timeSince(item.timestamp)}
 </span>
 <Button asChild variant="outline" className="ml-auto px-4 text-xs"><Link
 href={`/stable/${item.id}`}
 >
 View →
 </Link></Button>
 <span className="text-muted-foreground block w-full text-xs">
 {!item.isPublic
 ?"Private — set it public to enter shows."
 : item.hasPhoto
 ?"Show-ready — public with a photo."
 :"Add a photo before entering a show."}
 </span>
 </div>
 ))}
 <Button variant="outline" size="wide" className="mt-4 w-full"
 onClick={() => router.push("/dashboard")}
 >
 ← Back to Dashboard ({recentAdds.length} added)
 </Button>
 </div>
 )}
 </div>
 </FocusLayout>
 );
}
