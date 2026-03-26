"use client";

import { useState, useEffect } from"react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { enterShow } from"@/app/actions/shows";
import { createClient } from"@/lib/supabase/client";
import { getPublicImageUrl } from"@/lib/utils/storage";
import { Input } from "@/components/ui/input";

interface ClassDetail {
 id: string;
 name: string;
 divisionName: string;
 allowedScales?: string[] | null;
 isNanQualifying?: boolean;
 maxEntries?: number | null;
 currentEntryCount?: number;
}

interface ShowEntryFormProps {
 showId: string;
 userHorses: { id: string; name: string }[];
 classes?: ClassDetail[];
}

interface HorsePhoto {
 id: string;
 imageUrl: string;
 publicUrl: string;
 angleProfile: string;
 storagePath: string;
}

const ANGLE_LABELS: Record<string, string> = {
 Primary_Thumbnail:"Primary",
 Left_Side:"Left Side",
 Right_Side:"Off-Side",
 Front_Chest:"Front",
 Back_Hind:"Hind",
 Belly_Makers_Mark:"Belly/Mark",
 Detail_Face_Eyes:"Face",
 Detail_Ears:"Ears",
 Detail_Hooves:"Hooves",
 Flaw_Rub_Damage:"Flaws",
 extra_detail:"Detail",
 Other:"Other",
};

export default function ShowEntryForm({ showId, userHorses, classes }: ShowEntryFormProps) {
 const [selectedHorse, setSelectedHorse] = useState("");
 const [selectedClassId, setSelectedClassId] = useState("");
 const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null); // storage path
 const [caption, setCaption] = useState("");
 const [horsePhotos, setHorsePhotos] = useState<HorsePhoto[]>([]);
 const [loadingPhotos, setLoadingPhotos] = useState(false);
 const [status, setStatus] = useState<"idle" |"submitting" |"success" |"error">("idle");
 const [errorMsg, setErrorMsg] = useState("");
 const [showPreview, setShowPreview] = useState(false);
 const [classSearch, setClassSearch] = useState("");
 const [horseScale, setHorseScale] = useState<string | null>(null);

 // Fetch horse photos + scale when a horse is selected
 useEffect(() => {
 if (!selectedHorse) {
 setHorsePhotos([]);
 setSelectedPhoto(null);
 setHorseScale(null);
 return;
 }

 setLoadingPhotos(true);
 const supabase = createClient();

 // Fetch photos
 supabase
 .from("horse_images")
 .select("id, image_url, angle_profile")
 .eq("horse_id", selectedHorse)
 .order("uploaded_at")
 .then(({ data }) => {
 if (data && data.length > 0) {
 const photos: HorsePhoto[] = (
 data as { id: string; image_url: string; angle_profile: string }[]
 ).map((img) => {
 const urlParts = img.image_url.split("/horse-images/");
 const storagePath = urlParts.length > 1 ? urlParts[1] : img.image_url;
 return {
 id: img.id,
 imageUrl: img.image_url,
 publicUrl: getPublicImageUrl(img.image_url),
 angleProfile: img.angle_profile,
 storagePath,
 };
 });
 setHorsePhotos(photos);
 const primary = photos.find((p) => p.angleProfile ==="Primary_Thumbnail");
 setSelectedPhoto(primary?.storagePath || photos[0].storagePath);
 } else {
 setHorsePhotos([]);
 setSelectedPhoto(null);
 }
 setLoadingPhotos(false);
 });

 // Fetch horse scale via catalog join
 supabase
 .from("user_horses")
 .select("catalog_items:catalog_id(scale)")
 .eq("id", selectedHorse)
 .single()
 .then(({ data }) => {
 const scale = (data as { catalog_items: { scale: string } | null } | null)?.catalog_items?.scale;
 setHorseScale(scale || null);
 });
 }, [selectedHorse]);

 const handleSubmit = async (e?: React.FormEvent) => {
 if (e) e.preventDefault();
 if (!selectedHorse || status ==="submitting") return;

 setStatus("submitting");
 setErrorMsg("");
 setShowPreview(false);

 const result = await enterShow(
 showId,
 selectedHorse,
 selectedClassId || undefined,
 selectedPhoto || undefined,
 caption.trim() || undefined,
 );
 if (result.success) {
 setStatus("success");
 setSelectedHorse("");
 setSelectedClassId("");
 setSelectedPhoto(null);
 setCaption("");
 setHorsePhotos([]);
 setHorseScale(null);
 setTimeout(() => setStatus("idle"), 3000);
 } else {
 setErrorMsg(result.error ||"Failed to enter show.");
 setStatus("error");
 setTimeout(() => setStatus("idle"), 3000);
 }
 };

 if (userHorses.length === 0) {
 return (
 <div className="gap-4-empty flex flex-col">
 <p className="text-muted">You need at least one public horse to enter shows.</p>
 </div>
 );
 }

 // Filter classes by search term
 const filteredClasses =
 classes?.filter(
 (c) =>
 c.name.toLowerCase().includes(classSearch.toLowerCase()) ||
 c.divisionName.toLowerCase().includes(classSearch.toLowerCase()),
 ) ?? [];

 // Group filtered classes by division
 const divisionGroups: Map<string, ClassDetail[]> = new Map();
 for (const c of filteredClasses) {
 const group = divisionGroups.get(c.divisionName) || [];
 group.push(c);
 divisionGroups.set(c.divisionName, group);
 }

 const selectedPhotoObj = horsePhotos.find((p) => p.storagePath === selectedPhoto);
 const selectedHorseName = userHorses.find((h) => h.id === selectedHorse)?.name ||"";
 const selectedClassName = classes?.find((c) => c.id === selectedClassId)?.name ||"";
 const canPreview = selectedHorse && selectedPhotoObj;

 // Preview modal rendered via portal
 const previewModal =
 showPreview && selectedPhotoObj && typeof document !=="undefined"
 && (
 <Dialog open={true} onOpenChange={() => setShowPreview(false)}>
 <DialogContent className="sm:max-w-[480px] text-center">
 
 <div className="text-muted mb-4 text-center text-xs tracking-[0.05em] uppercase">
 This is what judges & voters will see
 </div>
 <div className="mb-2 text-center">
 <span className="text-base font-bold">
 🐴 {selectedHorseName}
 </span>
 {selectedClassName && (
 <span className="text-forest ml-2 text-sm">
 · {selectedClassName}
 </span>
 )}
 </div>
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={selectedPhotoObj.publicUrl}
 alt={selectedHorseName}
 className="mx-auto block aspect-[4/3] w-full max-w-[400px] rounded-md object-cover shadow-lg"
 />
 {caption.trim() && (
 <p className="text-ink-light mt-2 text-sm leading-normal italic">
 &ldquo;{caption.trim()}&rdquo;
 </p>
 )}
 <div className="mt-6 flex flex-wrap justify-center gap-2">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={() => handleSubmit()}
 disabled={status ==="submitting"}
 >
 {status ==="submitting" ?"Entering…" :"✅ Looks Good — Submit Entry"}
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => setShowPreview(false)}
 >
 ← Choose Different Photo
 </button>
 </div>
 </DialogContent>
 </Dialog>
 );

 return (
 <>
 <form onSubmit={handleSubmit} className="flex flex-col gap-4">
 {/* Guidance tip */}
 <div className="mt-4 rounded-lg border border-[rgba(44,85,69,0.2)] bg-[rgba(44,85,69,0.08)] px-4 px-6 py-2 py-4 text-sm text-sm leading-relaxed">
 💡 <strong>How it works:</strong> Select a horse, pick your best photo, add an optional caption,
 then submit. For best results, upload clear, well-lit photos (at least 800×600) to your horse&apos;s
 passport first.
 </div>

 {/* Top row: Horse selector */}
 <div className="grid grid-cols-2 gap-4">
 <select
 className="flex h-10 w-full rounded-md border border-edge bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={selectedHorse}
 onChange={(e) => {
 setSelectedHorse(e.target.value);
 setSelectedClassId("");
 setClassSearch("");
 }}
 required
 title="Select horse to enter"
 >
 <option value="">Select a horse to enter…</option>
 {userHorses.map((h) => (
 <option key={h.id} value={h.id}>
 {h.name}
 </option>
 ))}
 </select>
 </div>

 {/* Smart Class Browser */}
 {classes && classes.length > 0 && selectedHorse && (
 <div className="mb-4">
 <label className="text-ink mb-1 block text-sm font-semibold">📋 Select Class</label>
 <Input
 type="text"
 className="mb-2"
 placeholder="Search classes…"
 value={classSearch}
 onChange={(e) => setClassSearch(e.target.value)}
 />
 <div className="border-edge bg-elevated max-h-[240px] overflow-y-auto rounded-md border">
 {/* No class option */}
 <button
 type="button"
 className={`class-browser-item ${selectedClassId ==="" ?"selected" :""}`}
 onClick={() => setSelectedClassId("")}
 >
 <span>General (no specific class)</span>
 </button>
 {Array.from(divisionGroups.entries()).map(([divName, items]) => (
 <div key={divName}>
 <div className="border-edge bg-elevated-division max-h-[240px] overflow-y-auto rounded-md border">
 {divName}
 </div>
 {items.map((c) => {
 const scaleMatch =
 c.allowedScales && c.allowedScales.length > 0 && horseScale
 ? c.allowedScales.includes(horseScale)
 : null;
 return (
 <button
 key={c.id}
 type="button"
 className={`class-browser-item ${selectedClassId === c.id ?"selected" :""}`}
 onClick={() => setSelectedClassId(c.id)}
 >
 <span className="border-edge bg-elevated-name max-h-[240px] overflow-y-auto rounded-md border">
 {c.name}
 </span>
 <span className="border-edge bg-elevated-meta max-h-[240px] overflow-y-auto rounded-md border">
 {c.currentEntryCount !== undefined && (
 <span className="text-muted text-xs">
 {c.currentEntryCount}{""}
 {c.currentEntryCount === 1 ?"entry" :"entries"}
 </span>
 )}
 {c.isNanQualifying && (
 <span className="class-inline-flex bg-[rgba(245,158,11,0.15)] items-center gap-[2px] rounded-full px-[6px] py-[1px] text-xs font-semibold whitespace-nowrap text-[#f59e0b]">
 NAN
 </span>
 )}
 {scaleMatch === true && (
 <span className="text-[0.85em]" title="Scale matches!">
 ✅
 </span>
 )}
 {scaleMatch === false && (
 <span
 className="class-scale-warn"
 title={`Your horse is ${horseScale}, this class requires ${c.allowedScales!.join(",")}`}
 >
 ⚠️
 </span>
 )}
 </span>
 </button>
 );
 })}
 </div>
 ))}
 {filteredClasses.length === 0 && classSearch && (
 <div className="border-edge bg-elevated-empty max-h-[240px] overflow-y-auto rounded-md border">
 No classes match &ldquo;{classSearch}&rdquo;
 </div>
 )}
 </div>
 </div>
 )}

 {/* Two-column layout: Photo picker left, Caption + Submit right */}
 {selectedHorse && (
 <div className="show-entry-body max-sm:grid-cols-1">
 {/* LEFT: Photo picker */}
 <div className="flex flex-col gap-1">
 <label className="text-ink mb-1 block text-sm font-semibold">📸 Choose Entry Photo</label>
 {loadingPhotos ? (
 <p className="text-muted text-sm">Loading photos…</p>
 ) : horsePhotos.length === 0 ? (
 <p className="text-muted text-sm">
 No photos found. Upload photos to your horse&apos;s passport first.
 </p>
 ) : (
 <>
 <div className="grid-cols-[repeat(auto-fill,minmax(72px,1fr))] grid gap-1">
 {horsePhotos.map((photo) => (
 <button
 key={photo.id}
 type="button"
 onClick={() => setSelectedPhoto(photo.storagePath)}
 className={`show-entry-photo-btn ${selectedPhoto === photo.storagePath ?"selected" :""}`}
 title={ANGLE_LABELS[photo.angleProfile] || photo.angleProfile}
 >
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={photo.publicUrl}
 alt={ANGLE_LABELS[photo.angleProfile] || photo.angleProfile}
 loading="lazy"
 />
 {selectedPhoto === photo.storagePath && (
 <div className="bg-[var(--color-accent-primary, #d4a574)] absolute top-[2px] right-[2px] flex h-[18px] w-[18px] items-center justify-center rounded-full text-[0.65rem] font-bold text-white">
 ✓
 </div>
 )}
 <div className="absolute right-0 bottom-0 left-0 overflow-hidden bg-[rgba(0,0,0,0.55)] px-[4px] py-[1px] text-center text-[0.55rem] text-ellipsis whitespace-nowrap text-white">
 {ANGLE_LABELS[photo.angleProfile] || photo.angleProfile}
 </div>
 </button>
 ))}
 </div>
 <p className="text-muted mt-1 block text-xs">
 Photos display at 4:3 in the show grid. 800×600 minimum recommended.
 </p>
 </>
 )}
 </div>

 {/* RIGHT: Preview + Caption + Submit */}
 <div className="flex flex-col gap-4">
 {/* Preview of selected photo */}
 {selectedPhotoObj && (
 <div className="h-full w-full object-cover">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={selectedPhotoObj.publicUrl} alt="Selected entry photo" />
 </div>
 )}

 {/* Caption */}
 <div>
 <label className="text-ink mb-1 block text-sm font-semibold" htmlFor="entry-caption">
 ✏️ Entry Caption <span className="text-muted font-normal">(optional)</span>
 </label>
 <textarea
 id="entry-caption"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-4 py-2 text-sm font-semibold no-underline transition-all"
 value={caption}
 onChange={(e) => setCaption(e.target.value)}
 maxLength={280}
 rows={3}
 placeholder="Describe your entry, photography setup, or what makes this model special…"
 />
 <span
 className={`text-xs float-right ${caption.length > 250 ? "text-danger" : "text-muted"}`}
 >
 {caption.length}/280
 </span>
 </div>

 {/* Submit + Preview buttons */}
 <div className="mt-2 flex flex-wrap gap-2">
 <button
 type="submit"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 disabled={!selectedHorse || status ==="submitting"}
 >
 {status ==="submitting" ?"Entering…" :"🐴 Enter Show"}
 </button>
 {canPreview && (
 <button
 type="button"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => setShowPreview(true)}
 >
 👁 Preview
 </button>
 )}
 </div>
 {status ==="success" && (
 <span className="rounded-md border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.1)] px-4 py-2 text-sm text-[#22C55E]">
 ✅ Entered!
 </span>
 )}
 {status ==="error" && errorMsg && <span className="mt-2 text-sm text-danger">{errorMsg}</span>}
 </div>
 </div>
 )}

 {/* Show submit button when no horse selected yet */}
 {!selectedHorse && (
 <button
 type="submit"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 disabled={true}
 >
 🐴 Enter Show
 </button>
 )}
 </form>
 {previewModal}
 </>
 );
}
