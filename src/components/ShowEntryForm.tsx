"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { enterShow } from "@/app/actions/shows";
import { createClient } from "@/lib/supabase/client";
import { getPublicImageUrl } from "@/lib/utils/storage";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import ImageCropModal from "@/components/ImageCropModal";

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
  userHorses: { id: string; name: string; thumbnailUrl: string | null }[];
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
  Primary_Thumbnail: "Primary",
  Left_Side: "Left Side",
  Right_Side: "Off-Side",
  Front_Chest: "Front",
  Back_Hind: "Hind",
  Belly_Makers_Mark: "Belly/Mark",
  Detail_Face_Eyes: "Face",
  Detail_Ears: "Ears",
  Detail_Hooves: "Hooves",
  Flaw_Rub_Damage: "Flaws",
  extra_detail: "Detail",
  Other: "Other",
};

export default function ShowEntryForm({ showId, userHorses, classes }: ShowEntryFormProps) {
  // Core state
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedHorse, setSelectedHorse] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [horsePhotos, setHorsePhotos] = useState<HorsePhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<"select-horse" | "choose-photo">("select-horse");

  // Search / filter
  const [classSearch, setClassSearch] = useState("");
  const [horseScale, setHorseScale] = useState<string | null>(null);

  // Horse search within modal
  const [horseSearch, setHorseSearch] = useState("");

  // Crop state
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);
  const [uploadingCrop, setUploadingCrop] = useState(false);

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
          const primary = photos.find((p) => p.angleProfile === "Primary_Thumbnail");
          setSelectedPhoto(primary?.storagePath || photos[0].storagePath);
        } else {
          setHorsePhotos([]);
          setSelectedPhoto(null);
        }
        setLoadingPhotos(false);
      });

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

  // Handle crop: fetch image as File, open crop modal
  const handleCropClick = async () => {
    if (!selectedPhotoObj) return;
    try {
      const resp = await fetch(selectedPhotoObj.publicUrl);
      const blob = await resp.blob();
      const file = new File([blob], `entry_photo.${blob.type.split("/")[1] || "jpg"}`, { type: blob.type });
      setCropFile(file);
      setShowCropModal(true);
    } catch {
      setErrorMsg("Failed to load photo for cropping.");
    }
  };

  // After crop completes: upload cropped file to storage
  const handleCropComplete = async (croppedFile: File) => {
    setShowCropModal(false);
    setCropFile(null);
    setUploadingCrop(true);

    try {
      const supabase = createClient();
      const ext = croppedFile.name.split(".").pop() || "webp";
      const storagePath = `show-entries/${showId}/${selectedHorse}_${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("horse-images")
        .upload(storagePath, croppedFile, { upsert: true });

      if (uploadErr) {
        setErrorMsg(`Upload failed: ${uploadErr.message}`);
        setUploadingCrop(false);
        return;
      }

      // Use the cropped image as the entry photo
      setSelectedPhoto(storagePath);
      setCroppedPreviewUrl(URL.createObjectURL(croppedFile));
    } catch {
      setErrorMsg("Failed to upload cropped photo.");
    }
    setUploadingCrop(false);
  };

  // Handle entry submission
  const handleSubmit = async () => {
    if (!selectedHorse || status === "submitting") return;

    setStatus("submitting");
    setErrorMsg("");

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
      setSelectedClassId(null);
      setSelectedPhoto(null);
      setCaption("");
      setHorsePhotos([]);
      setHorseScale(null);
      setCroppedPreviewUrl(null);
      setModalOpen(false);
      setModalStep("select-horse");
      setTimeout(() => setStatus("idle"), 4000);
    } else {
      setErrorMsg(result.error || "Failed to enter show.");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  // Open modal for a specific class
  const openEntryModal = (classId: string | null) => {
    setSelectedClassId(classId);
    setSelectedHorse("");
    setSelectedPhoto(null);
    setCaption("");
    setHorsePhotos([]);
    setHorseScale(null);
    setHorseSearch("");
    setModalStep("select-horse");
    setModalOpen(true);
  };

  // Horse selection handler
  const handleHorseSelect = (horseId: string) => {
    setSelectedHorse(horseId);
    setModalStep("choose-photo");
  };

  if (userHorses.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-stone-500">You need at least one public horse to enter shows.</p>
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

  // Filter horses by search
  const filteredHorses = userHorses.filter(
    (h) => h.name.toLowerCase().includes(horseSearch.toLowerCase()),
  );

  const selectedHorseName = userHorses.find((h) => h.id === selectedHorse)?.name || "";
  const selectedClassName = selectedClassId ? classes?.find((c) => c.id === selectedClassId)?.name : "General";
  const selectedPhotoObj = horsePhotos.find((p) => p.storagePath === selectedPhoto);
  const hasClasses = classes && classes.length > 0;

  return (
    <>
      {/* Success Toast */}
      {status === "success" && (
        <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-[#22C55E]">
          ✅ Entry submitted successfully!
        </div>
      )}

      {/* Guidance tip */}
      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm leading-relaxed">
        💡 <strong>How it works:</strong>{" "}
        {hasClasses
          ? "Pick a class below, then select your horse and entry photo."
          : "Click the button below to pick your horse and entry photo."}
      </div>

      {/* ─── View 1: Class Browser (when classes exist) ─── */}
      {hasClasses ? (
        <div className="mt-4">
          <label className="mb-1 block text-sm font-semibold text-stone-900">
            📋 Select a Class to Enter
          </label>
          <Input
            type="text"
            className="mb-2"
            placeholder="Search classes…"
            value={classSearch}
            onChange={(e) => setClassSearch(e.target.value)}
          />
          <div className="max-h-[320px] overflow-y-auto rounded-md border border-input bg-muted">
            {Array.from(divisionGroups.entries()).map(([divName, items]) => (
              <div key={divName}>
                <div className="border-b border-input bg-stone-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-stone-500">
                  {divName}
                </div>
                {items.map((c) => (
                  <div
                    key={c.id}
                    className="class-browser-item"
                  >
                    <span className="flex-1 text-sm font-medium text-stone-900">
                      {c.name}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {c.currentEntryCount !== undefined && (
                        <span className="text-xs text-stone-500">
                          {c.currentEntryCount}{" "}
                          {c.currentEntryCount === 1 ? "entry" : "entries"}
                        </span>
                      )}
                      {c.isNanQualifying && (
                        <span className="inline-flex items-center gap-[2px] rounded-full bg-amber-50 px-[6px] py-[1px] text-xs font-semibold whitespace-nowrap text-[#f59e0b]">
                          NAN
                        </span>
                      )}
                      <button
                        type="button"
                        className="inline-flex min-h-[28px] cursor-pointer items-center gap-1 rounded-md border-0 bg-forest px-3 py-0.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-forest/90"
                        onClick={() => openEntryModal(c.id)}
                      >
                        🐴 Enter
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            ))}
            {filteredClasses.length === 0 && classSearch && (
              <div className="px-4 py-3 text-sm italic text-stone-500">
                No classes match &ldquo;{classSearch}&rdquo;
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ─── No Classes: Simple Entry Button ─── */
        <div className="mt-4">
          <button
            type="button"
            className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest/90"
            onClick={() => openEntryModal(null)}
          >
            🐴 Enter a Horse
          </button>
        </div>
      )}

      {/* ─── Entry Modal (2-step: Horse → Photo+Caption) ─── */}
      <Dialog open={modalOpen} onOpenChange={(open) => {
        if (!open) {
          setModalOpen(false);
          setModalStep("select-horse");
          setSelectedHorse("");
          setHorsePhotos([]);
        }
      }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {modalStep === "select-horse"
                ? `🐴 Pick a Horse${selectedClassName ? ` — ${selectedClassName}` : ""}`
                : `📸 Choose Photo — ${selectedHorseName}`}
            </DialogTitle>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {/* ─── Step 1: Horse Picker Grid ─── */}
            {modalStep === "select-horse" && (
              <motion.div
                key="select-horse"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                {userHorses.length > 6 && (
                  <Input
                    type="text"
                    className="mb-3"
                    placeholder="Search your horses…"
                    value={horseSearch}
                    onChange={(e) => setHorseSearch(e.target.value)}
                  />
                )}
                <div className="grid max-h-[400px] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
                  {filteredHorses.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-input bg-card p-2 transition-all hover:ring-2 hover:ring-forest"
                      onClick={() => handleHorseSelect(h.id)}
                    >
                      {h.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={h.thumbnailUrl}
                          alt={h.name}
                          className="aspect-square w-full rounded-md object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center rounded-md bg-stone-100 text-3xl">
                          🐴
                        </div>
                      )}
                      <span className="max-w-full truncate text-xs font-medium text-stone-900">
                        {h.name}
                      </span>
                    </button>
                  ))}
                  {filteredHorses.length === 0 && (
                    <div className="col-span-full py-6 text-center text-sm text-stone-500">
                      No horses match your search.
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ─── Step 2: Photo Picker + Caption ─── */}
            {modalStep === "choose-photo" && (
              <motion.div
                key="choose-photo"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-4"
              >
                {/* Back button */}
                <button
                  type="button"
                  className="self-start text-sm text-forest hover:underline"
                  onClick={() => {
                    setModalStep("select-horse");
                    setSelectedHorse("");
                    setHorsePhotos([]);
                    setSelectedPhoto(null);
                  }}
                >
                  ← Choose different horse
                </button>

                {/* Photo Grid */}
                <div>
                  <label className="mb-1 block text-sm font-semibold text-stone-900">
                    📸 Select Entry Photo
                  </label>
                  {loadingPhotos ? (
                    <p className="text-sm text-stone-500">Loading photos…</p>
                  ) : horsePhotos.length === 0 ? (
                    <p className="text-sm text-stone-500">
                      No photos found. Upload photos to your horse&apos;s passport first.
                    </p>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1">
                      {horsePhotos.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => {
                            setSelectedPhoto(photo.storagePath);
                            setCroppedPreviewUrl(null); // Reset crop when switching photos
                          }}
                          className={`show-entry-photo-btn ${selectedPhoto === photo.storagePath ? "selected" : ""}`}
                          title={ANGLE_LABELS[photo.angleProfile] || photo.angleProfile}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.publicUrl}
                            alt={ANGLE_LABELS[photo.angleProfile] || photo.angleProfile}
                            loading="lazy"
                          />
                          {selectedPhoto === photo.storagePath && (
                            <div className="absolute top-[2px] right-[2px] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-forest text-[0.65rem] font-bold text-white">
                              ✓
                            </div>
                          )}
                          <div className="absolute right-0 bottom-0 left-0 overflow-hidden bg-black/55 px-[4px] py-[1px] text-center text-[0.55rem] text-ellipsis whitespace-nowrap text-white">
                            {ANGLE_LABELS[photo.angleProfile] || photo.angleProfile}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected photo preview + Crop button */}
                {selectedPhotoObj && (
                  <div>
                    <div className="overflow-hidden rounded-md border border-input">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={croppedPreviewUrl || selectedPhotoObj.publicUrl}
                        alt={selectedHorseName}
                        className="aspect-[4/3] w-full object-contain bg-stone-100"
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input bg-card px-3 py-1.5 text-xs font-semibold text-stone-700 transition-all hover:bg-muted"
                        onClick={handleCropClick}
                        disabled={uploadingCrop}
                      >
                        {uploadingCrop ? "Uploading…" : "✂️ Crop for Show (4:3)"}
                      </button>
                      {croppedPreviewUrl && (
                        <span className="text-xs text-emerald-600">✓ Cropped</span>
                      )}
                      <span className="text-xs text-stone-400">Shows display at 4:3 ratio</span>
                    </div>
                  </div>
                )}

                {/* Caption */}
                <div>
                  <label className="mb-1 block text-sm font-semibold text-stone-900" htmlFor="entry-caption">
                    ✏️ Caption <span className="font-normal text-stone-500">(optional)</span>
                  </label>
                  <textarea
                    id="entry-caption"
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-forest"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    maxLength={280}
                    rows={2}
                    placeholder="Tell judges what makes this model special…"
                  />
                  <span
                    className={`float-right text-xs ${caption.length > 250 ? "text-red-700" : "text-stone-500"}`}
                  >
                    {caption.length}/280
                  </span>
                </div>

                {/* Error */}
                {status === "error" && errorMsg && (
                  <p className="text-sm text-red-700">{errorMsg}</p>
                )}

                {/* Submit */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="inline-flex min-h-[36px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest/90 disabled:opacity-50"
                    onClick={handleSubmit}
                    disabled={!selectedPhoto || status === "submitting"}
                  >
                    {status === "submitting" ? "Entering…" : "✅ Submit Entry"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* Crop Modal */}
      {showCropModal && cropFile && (
        <ImageCropModal
          file={cropFile}
          aspectRatio={4 / 3}
          onCrop={handleCropComplete}
          onCancel={() => {
            setShowCropModal(false);
            setCropFile(null);
          }}
        />
      )}
    </>
  );
}
