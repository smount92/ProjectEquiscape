"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  compressImage,
  compressImageWithWatermark,
  validateImageFile,
  createImagePreviewUrl,
  revokeImagePreviewUrl,
} from "@/lib/utils/imageCompression";
import type { AngleProfile, FinishType, AssetCategory } from "@/lib/types/database";
import UnifiedReferenceSearch from "@/components/UnifiedReferenceSearch";
import type { CatalogItem } from "@/app/actions/reference";
import CollectionPicker from "@/components/CollectionPicker";
import { notifyHorsePublic } from "@/app/actions/horse-events";
import { initializeHoofprint } from "@/app/actions/hoofprint";
import { createHorseRecord, finalizeHorseImages } from "@/app/actions/horse";
import { getProfile } from "@/app/actions/settings";
import { setHorseCollections } from "@/app/actions/collections";
import ImageCropModal from "@/components/ImageCropModal";

// ---- AI Detection types ----
interface AiDetectionResult {
  manufacturer: string;
  mold_name: string;
  scale: string;
  confidence_score: number;
}

interface AiToast {
  message: string;
  type: "success" | "error" | "info";
  id: number;
}

// ---- Constants ----

const STEPS = [
  { label: "Gallery", icon: "📸" },
  { label: "Reference", icon: "🔗" },
  { label: "Identity", icon: "🏷️" },
  { label: "Vault", icon: "🔒" },
];

const CONDITION_GRADES = [
  { value: "Mint", label: "Mint — Flawless, like new" },
  { value: "Near Mint", label: "Near Mint — Minimal handling wear" },
  { value: "Excellent", label: "Excellent — Very light wear, no breaks" },
  { value: "Very Good", label: "Very Good — Minor rubs or scuffs" },
  { value: "Good", label: "Good — Noticeable wear, still displays well" },
  { value: "Body Quality", label: "Body Quality — Suitable for customizing" },
  { value: "Fair", label: "Fair — Visible flaws, repairs, or damage" },
  { value: "Poor", label: "Poor — Significant damage or missing parts" },
];

const GALLERY_SLOTS: { angle: AngleProfile; label: string; primary?: boolean }[] = [
  { angle: "Primary_Thumbnail", label: "Near-Side (Required)", primary: true },
  { angle: "Right_Side", label: "Off-Side" },
  { angle: "Front_Chest", label: "Front / Chest" },
  { angle: "Back_Hind", label: "Hindquarters / Tail" },
  { angle: "Belly_Makers_Mark", label: "Belly / Maker's Mark" },
];

// ---- Types ----

interface ImageSlot {
  file: File;
  previewUrl: string;
}

// ---- Component ----

export default function AddHorsePage() {
  const router = useRouter();
  const supabase = createClient();

  // Step management
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedHorseName, setSavedHorseName] = useState("");

  // Step 1 (index 0): Gallery
  const [imageSlots, setImageSlots] = useState<Partial<Record<AngleProfile, ImageSlot>>>({});
  const [extraFiles, setExtraFiles] = useState<{ file: File; previewUrl: string }[]>([]);
  const extraInputRef = useRef<HTMLInputElement>(null);

  // Crop modal state
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropAngle, setCropAngle] = useState<AngleProfile | null>(null);
  const [extraCropQueue, setExtraCropQueue] = useState<File[]>([]);
  const [isCroppingExtra, setIsCroppingExtra] = useState(false);
  const [reCropExtraIdx, setReCropExtraIdx] = useState<number | null>(null);

  // AI Vision Detection
  const [aiDetecting, setAiDetecting] = useState(false);
  const [aiResult, setAiResult] = useState<AiDetectionResult | null>(null);
  const [aiToasts, setAiToasts] = useState<AiToast[]>([]);
  const toastIdRef = useRef(0);

  // Step 2 (index 1): Reference
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<CatalogItem | null>(null);
  const [nameAutoFilled, setNameAutoFilled] = useState(false);
  const [aiSearchQuery, setAiSearchQuery] = useState<string | undefined>(undefined);

  // Step 3 (index 2): Identity
  const [customName, setCustomName] = useState("");
  const [sculptor, setSculptor] = useState("");
  const [finishingArtist, setFinishingArtist] = useState("");
  const [editionNumber, setEditionNumber] = useState("");
  const [editionSize, setEditionSize] = useState("");
  const [finishType, setFinishType] = useState<FinishType | "">("");
  const [conditionGrade, setConditionGrade] = useState("");
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public");
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [tradeStatus, setTradeStatus] = useState("Not for Sale");
  const [listingPrice, setListingPrice] = useState("");
  const [marketplaceNotes, setMarketplaceNotes] = useState("");
  const [lifeStage, setLifeStage] = useState("completed");
  const [assetCategory, setAssetCategory] = useState<AssetCategory>("model");

  // Watermark preference
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [userAlias, setUserAlias] = useState("");

  const isModel = assetCategory === "model";

  // Step 4 (index 3): Financial Vault
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [insuranceNotes, setInsuranceNotes] = useState("");
  const [finishDetails, setFinishDetails] = useState("");
  const [publicNotes, setPublicNotes] = useState("");
  const [assignedBreed, setAssignedBreed] = useState("");
  const [assignedGender, setAssignedGender] = useState("");
  const [assignedAge, setAssignedAge] = useState("");
  const [regionalId, setRegionalId] = useState("");
  const [purchaseDateText, setPurchaseDateText] = useState("");

  // Auto-fill custom_name when a catalog item is selected
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedCatalogItem && (!customName.trim() || nameAutoFilled)) {
      setCustomName(selectedCatalogItem.title);
      setNameAutoFilled(true);
    }
  }, [selectedCatalogItem]);

  // Fetch watermark preference
  useEffect(() => {
    getProfile().then((profile) => {
      if (profile) {
        setWatermarkEnabled(profile.watermarkPhotos);
        setUserAlias(profile.aliasName);
      }
    });
  }, []);

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(imageSlots).forEach((slot) => {
        if (slot?.previewUrl) revokeImagePreviewUrl(slot.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Toast helper ----
  const showToast = useCallback((message: string, type: AiToast["type"] = "info") => {
    const id = ++toastIdRef.current;
    setAiToasts((prev) => [...prev, { message, type, id }]);
    setTimeout(() => {
      setAiToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  // ---- AI Mold Detection ----
  const handleAiDetect = useCallback(async () => {
    const primarySlot = imageSlots["Primary_Thumbnail"];
    if (!primarySlot) {
      showToast("Upload a Primary Thumbnail first.", "error");
      return;
    }

    setAiDetecting(true);
    setAiResult(null);

    try {
      const formData = new FormData();
      formData.append("image", primarySlot.file);

      const res = await fetch("/api/identify-mold", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "AI detection failed.");
      }

      // Non-equine image detection
      if (data.error && data.not_equine) {
        throw new Error("This doesn't appear to be a model horse. Please upload a photo of an equine model or figurine.");
      }

      const result = data as AiDetectionResult;
      setAiResult(result);

      // Show success toast with confidence
      const pct = typeof result.confidence_score === "number"
        ? result.confidence_score <= 1
          ? Math.round(result.confidence_score * 100)
          : Math.round(result.confidence_score)
        : 0;
      showToast(
        `✨ AI identified: ${result.mold_name} (${pct}% confidence)`,
        "success"
      );

      // Auto-navigate to Reference step (now index 1) and inject search
      setAiSearchQuery(result.mold_name);
      setCurrentStep(1); // Reference is step index 1
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Give the search a moment to execute, then try to auto-select from catalog
      setTimeout(async () => {
        const { searchCatalogAction } = await import("@/app/actions/reference");
        const items = await searchCatalogAction(result.mold_name);
        if (items.length > 0) {
          const exactMatch = items.find(
            (m) => m.title.toLowerCase() === result.mold_name.toLowerCase()
          );
          const bestMatch = exactMatch || items[0];
          setSelectedCatalogId(bestMatch.id);
          setSelectedCatalogItem(bestMatch);
        }
      }, 600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI detection failed.";
      showToast(msg, "error");
    } finally {
      setAiDetecting(false);
    }
  }, [imageSlots, showToast]);

  // ---- Handlers ----

  const handleImageSelect = async (angle: AngleProfile, file: File) => {
    const validationError = validateImageFile(file);
    if (validationError) {
      alert(validationError);
      return;
    }

    // Open crop modal
    setCropFile(file);
    setCropAngle(angle);
  };

  const handleCropComplete = (croppedFile: File) => {
    // Re-cropping an existing extra
    if (reCropExtraIdx !== null) {
      const oldUrl = extraFiles[reCropExtraIdx]?.previewUrl;
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      setExtraFiles(prev => prev.map((ef, i) => i === reCropExtraIdx ? { file: croppedFile, previewUrl: URL.createObjectURL(croppedFile) } : ef));
      setReCropExtraIdx(null);
      setCropFile(null);
      return;
    }

    // Cropping an extra from the queue
    if (isCroppingExtra) {
      const previewUrl = URL.createObjectURL(croppedFile);
      setExtraFiles(prev => [...prev, { file: croppedFile, previewUrl }]);
      setCropFile(null);
      // Process next in queue
      setExtraCropQueue(prev => {
        const remaining = prev.slice(1);
        if (remaining.length > 0) {
          setCropFile(remaining[0]);
        } else {
          setIsCroppingExtra(false);
        }
        return remaining;
      });
      return;
    }

    // Standard gallery slot crop
    if (!cropAngle) return;

    // Revoke old preview
    const existingSlot = imageSlots[cropAngle];
    if (existingSlot) revokeImagePreviewUrl(existingSlot.previewUrl);

    const previewUrl = createImagePreviewUrl(croppedFile);
    setImageSlots((prev) => ({
      ...prev,
      [cropAngle]: { file: croppedFile, previewUrl },
    }));

    // Close modal
    setCropFile(null);
    setCropAngle(null);
  };

  const startExtraCropQueue = (files: File[]) => {
    if (files.length === 0) return;
    setIsCroppingExtra(true);
    setExtraCropQueue(files);
    setCropFile(files[0]);
    setCropAngle(null);
  };

  const handleImageRemove = (angle: AngleProfile) => {
    const slot = imageSlots[angle];
    if (slot) revokeImagePreviewUrl(slot.previewUrl);
    setImageSlots((prev) => {
      const updated = { ...prev };
      delete updated[angle];
      return updated;
    });
  };

  const canProceedStep = (step: number): boolean => {
    switch (step) {
      case 0:
        return true; // Gallery is optional (but thumbnail encouraged)
      case 1:
        return true; // Reference is optional — users can use "Custom Entry" escape hatch
      case 2:
        return customName.trim().length > 0 && (isModel ? finishType !== "" && conditionGrade !== "" : true);
      case 3:
        return true; // Financial vault is optional
      default:
        return false;
    }
  };

  const goNext = () => {
    if (currentStep < STEPS.length - 1 && canProceedStep(currentStep)) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // ---- SUBMIT handler ----

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in.");

      // Step 1: Create DB record (no files through server)
      const result = await createHorseRecord({
        customName: customName.trim(),
        finishType: isModel ? finishType : "",
        conditionGrade: isModel ? conditionGrade || undefined : undefined,
        isPublic: visibility === "public" || visibility === "unlisted",
        tradeStatus: tradeStatus || undefined,
        lifeStage: isModel ? lifeStage || undefined : undefined,
        catalogId: selectedCatalogId || undefined,
        selectedCollectionId: selectedCollectionIds[0] || undefined,
        sculptor: sculptor.trim() || undefined,
        finishingArtist: finishingArtist.trim() || undefined,
        editionNumber: isModel && editionNumber ? parseInt(editionNumber) : undefined,
        editionSize: isModel && editionSize ? parseInt(editionSize) : undefined,
        listingPrice: (tradeStatus !== "Not for Sale" && listingPrice) ? parseFloat(listingPrice) : undefined,
        marketplaceNotes: (tradeStatus !== "Not for Sale" && marketplaceNotes.trim()) ? marketplaceNotes.trim() : undefined,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
        purchaseDate: purchaseDate || undefined,
        estimatedValue: estimatedValue ? parseFloat(estimatedValue) : undefined,
        insuranceNotes: insuranceNotes.trim() || undefined,
        assetCategory,
        finishDetails: finishDetails.trim() || undefined,
        publicNotes: publicNotes.trim() || undefined,
        assignedBreed: assignedBreed.trim() || undefined,
        assignedGender: assignedGender.trim() || undefined,
        assignedAge: assignedAge.trim() || undefined,
        regionalId: regionalId.trim() || undefined,
        purchaseDateText: purchaseDateText.trim() || undefined,
      });

      if (!result.success || !result.horseId) {
        throw new Error(result.error || "Failed to save horse.");
      }

      const horseId = result.horseId;

      // Set multi-collection assignments via junction table
      if (selectedCollectionIds.length > 0) {
        await setHorseCollections(horseId, selectedCollectionIds);
      }

      // Step 2: Upload images directly from browser to Supabase Storage
      const uploadedImages: { path: string; angle: string }[] = [];

      // Compress and upload slot images
      const imageEntries = Object.entries(imageSlots) as [AngleProfile, ImageSlot][];
      for (const [angle, slot] of imageEntries) {
        const compressed = watermarkEnabled && userAlias
          ? await compressImageWithWatermark(slot.file, userAlias)
          : await compressImage(slot.file);
        const filePath = `horses/${horseId}/${angle}_${Date.now()}.webp`;
        const { error: uploadError } = await supabase.storage
          .from("horse-images")
          .upload(filePath, compressed, { contentType: "image/webp" });

        if (!uploadError) {
          uploadedImages.push({ path: filePath, angle });
        }
      }

      // Compress and upload extra detail images
      for (let i = 0; i < extraFiles.length; i++) {
        const compressed = watermarkEnabled && userAlias
          ? await compressImageWithWatermark(extraFiles[i].file, userAlias)
          : await compressImage(extraFiles[i].file);
        const filePath = `horses/${horseId}/extra_detail_${Date.now()}_${i}.webp`;
        const { error: uploadError } = await supabase.storage
          .from("horse-images")
          .upload(filePath, compressed, { contentType: "image/webp" });

        if (!uploadError) {
          uploadedImages.push({ path: filePath, angle: "extra_detail" });
        }
      }

      // Step 3: Finalize image metadata on server
      if (uploadedImages.length > 0) {
        await finalizeHorseImages(horseId, uploadedImages);
      }

      // 4. Activity event if public
      if (visibility === "public") {
        notifyHorsePublic({
          userId: user.id,
          horseId,
          horseName: customName.trim(),
          finishType: finishType as string,
          tradeStatus: tradeStatus as string,
          catalogId: selectedCatalogId || null,
          photoCount: uploadedImages.length,
        });
      }

      // 5. Initialize Hoofprint
      initializeHoofprint({
        horseId,
        horseName: customName.trim(),
        lifeStage,
      });

      // 6. Show success!
      setSavedHorseName(customName.trim());
      setShowSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- RENDER ----

  // Success overlay
  if (showSuccess) {
    return (
      <div className="success-overlay">
        <div className="text-center max-w-[480px] p-[var(--space-3xl)] card animate-fade-in-up">
          <div className="success-icon">🎉</div>
          <h2>
            <span className="text-gradient">{savedHorseName}</span> Added!
          </h2>
          <p>
            Your {assetCategory === "model" ? "model" : assetCategory} has been successfully cataloged in your Digital Stable.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/add-horse" className="btn btn-primary" onClick={() => window.location.reload()}>
              Add Another
            </Link>
            <Link href="/dashboard" className="btn btn-ghost">
              View Stable
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container form-page">
      {/* Page Header */}
      <div className="mb-12 animate-fade-in-up">
        <h1>
          Add to <span className="text-gradient">Stable</span>
        </h1>
        <p>{isModel ? "Catalog a new model horse in your digital collection" :
          assetCategory === "tack" ? "Catalog tack & gear for your collection" :
            assetCategory === "prop" ? "Add a prop to your collection" :
              "Document a diorama setup"}</p>
      </div>

      {/* Asset Category Toggle */}
      <div className="flex gap-2 mb-8 animate-fade-in-up">
        {([
          { value: "model" as const, icon: "🐎", label: "Model Horse" },
          { value: "tack" as const, icon: "🏇", label: "Tack & Gear" },
          { value: "prop" as const, icon: "🌲", label: "Prop" },
          { value: "diorama" as const, icon: "🎭", label: "Diorama" },
        ]).map((cat) => (
          <button
            key={cat.value}
            type="button"
            className={`category-card ${assetCategory === cat.value ? "active" : ""}`}
            onClick={() => setAssetCategory(cat.value)}
            id={`category-${cat.value}`}
          >
            <span className="text-2xl">{cat.icon}</span>
            <span className="text-sm font-semibold text-[var(--color-text-secondary)]">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-[0] mb-12 relative" role="navigation" aria-label="Form progress">
        {STEPS.map((step, i) => (
          <div
            key={step.label}
            className={`stepper-step ${i === currentStep ? "active" : ""
              } ${i < currentStep ? "completed" : ""}`}
          >
            <div className="flex items-center justify-center gap-[0] mb-12 relative-dot" aria-current={i === currentStep ? "step" : undefined}>
              {i < currentStep ? "✓" : i + 1}
            </div>
            <span className="flex items-center justify-center gap-[0] mb-12 relative-label">{step.label}</span>
          </div>
        ))}
      </div>

      {/* Error banner */}
      {submitError && (
        <div className="form-error" role="alert" style={{ marginBottom: "var(--space-xl)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {submitError}
        </div>
      )}

      {/* ================================================================
          STEP 1 (index 0): Gallery Upload
          ================================================================ */}
      {currentStep === 0 && (
        <div className="step-content" key="step-0">
          <div className="bg-card border border-[rgba(44, 85, 69, 0.2)] rounded-lg p-12 shadow-md relative overflow-visible">
            <div className="bg-card border border-[rgba(44, 85, 69, 0.2)] rounded-lg p-12 shadow-md relative overflow-visible-header">
              <div className="bg-card border border-[rgba(44, 85, 69, 0.2)] rounded-lg p-12 shadow-md relative overflow-visible-icon">📸</div>
              <div>
                <h2>Photo Gallery</h2>
                <p>Upload photos from specific angles to build a complete profile</p>
              </div>
            </div>

            <p style={{ marginBottom: "var(--space-lg)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
              Click any slot below to upload a photo. Images are automatically
              compressed before saving. The <strong>Primary Thumbnail</strong> will
              be shown on your Digital Shelf.
            </p>

            <div className="grid grid-cols-[repeat(3, 1fr)] gap-4">
              {GALLERY_SLOTS.map((slot) => {
                const existing = imageSlots[slot.angle];
                const isPrimary = slot.angle === "Primary_Thumbnail";
                return (
                  <div
                    key={slot.angle}
                    className={`gallery-slot ${slot.primary ? "primary" : ""} ${existing ? "has-image" : ""
                      }`}
                  >
                    {existing ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={existing.previewUrl}
                          alt={slot.label}
                          className="gallery-preview"
                        />
                        <button
                          className="absolute top-[6px] right-[6px] w-[28px] h-[28px] rounded-full bg-[rgba(0, 0, 0, 0.7)] text-white border-0 cursor-pointer flex items-center justify-center text-[0.85rem] z-[2] transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImageRemove(slot.angle);
                          }}
                          aria-label={`Remove ${slot.label} photo`}
                        >
                          ✕
                        </button>
                        <div className="absolute bottom-[6px] left-[6px] w-[24px] h-[24px] rounded-full bg-success text-inverse flex items-center justify-center text-[0.7rem] font-extrabold z-[2]">✓</div>

                        {/* AI Auto-Detect button — hidden for now */}
                        {false && isPrimary && (
                          <button
                            className={`ai-detect-btn ${aiDetecting ? "detecting" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleAiDetect();
                            }}
                            disabled={aiDetecting}
                            id="ai-detect-mold"
                            title="Auto-Detect Mold"
                          >
                            {aiDetecting ? (
                              <>
                                <span className="ai-detect-spinner" aria-hidden="true" />
                                <span className="text-xs">Analyzing…</span>
                              </>
                            ) : (
                              <>
                                <svg className="ai-detect-sparkle" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
                                </svg>
                                <span className="text-xs">Auto-Detect Mold</span>
                              </>
                            )}
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-[1.8rem] text-muted transition-colors">{isPrimary ? "🖼️" : "📷"}</span>
                        <span className="gallery-slot hover:text-forest hover:border-forest hover:bg-[var(--color-accent-primary-glow)]-label">{slot.label}</span>
                        {/* AI hint hidden for now */}
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageSelect(slot.angle, file);
                        e.target.value = ""; // Reset so same file can be re-selected
                      }}
                      aria-label={`Upload ${slot.label} photo`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Extra Details Multi-Upload Zone */}
            <div className="mt-6 border-t border-edge pt-6">
              <div
                className="opacity-[0.4]"
                onClick={() => extraInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
                  if (extraFiles.length + files.length > 10) {
                    alert("Maximum 10 extra detail photos allowed.");
                    return;
                  }
                  startExtraCropQueue(files);
                }}
                role="button"
                tabIndex={0}
              >
                <input
                  ref={extraInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith("image/"));
                    if (extraFiles.length + files.length > 10) {
                      alert("Maximum 10 extra detail photos allowed.");
                      e.target.value = "";
                      return;
                    }
                    startExtraCropQueue(files);
                    e.target.value = "";
                  }}
                  style={{ display: "none" }}
                />
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span><strong>Extra Details & Flaws</strong> — Upload up to 10</span>
                <span style={{ fontSize: "calc(var(--font-size-xs) * var(--font-scale))", color: "var(--color-text-muted)" }}>{extraFiles.length}/10 photos · Click or drag files here</span>
              </div>
              {extraFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {extraFiles.map((ef, i) => (
                      <div key={i} className="relative w-[100px] h-[100px] rounded-md overflow-hidden border border-edge">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ef.previewUrl} alt={`Extra detail ${i + 1}`} />
                      <button
                        className="absolute top-[6px] right-[6px] w-[28px] h-[28px] rounded-full bg-[rgba(0, 0, 0, 0.7)] text-white border-0 cursor-pointer flex items-center justify-center text-[0.85rem] z-[2] transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          URL.revokeObjectURL(ef.previewUrl);
                          setExtraFiles(prev => prev.filter((_, idx) => idx !== i));
                        }}
                        aria-label={`Remove extra photo ${i + 1}`}
                      >
                        ✕
                      </button>
                      <button
                        className="absolute bottom-[4px] right-[4px] w-[22px] h-[22px] rounded-full bg-[rgba(0, 0, 0, 0.7)] text-white border-0 cursor-pointer text-[13px] flex items-center justify-center opacity-0 transition-opacity leading-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReCropExtraIdx(i);
                          setCropFile(ef.file);
                          setCropAngle(null);
                        }}
                        aria-label={`Re-crop extra photo ${i + 1}`}
                        title="Crop"
                      >
                        ✂
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI result badge (shown after detection) */}
            {aiResult && (
              <div className="shrink-0 text-forest">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
                </svg>
                <span>
                  AI Detected: <strong>{aiResult.mold_name}</strong> · {aiResult.manufacturer} · {aiResult.scale}
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center gap-4 mt-8">
            <div className="flex justify-between items-center gap-4 mt-8-spacer" />
            <button className="btn btn-primary" onClick={goNext} id="step-1-next">
              Next: Reference Link →
            </button>
          </div>
        </div>
      )}

      {/* ================================================================
          STEP 2 (index 1): Reference Link
          — Use CSS display instead of unmounting to preserve component state
          ================================================================ */}
      <div className="step-content" key="step-1" style={{ display: currentStep === 1 ? "block" : "none" }}>
        <div className="bg-card border border-[rgba(44, 85, 69, 0.2)] rounded-lg p-12 shadow-md relative overflow-visible">
          <div className="bg-card border border-[rgba(44, 85, 69, 0.2)] rounded-lg p-12 shadow-md relative overflow-visible-header">
            <div className="bg-card border border-[rgba(44, 85, 69, 0.2)] rounded-lg p-12 shadow-md relative overflow-visible-icon">🔗</div>
            <div>
              <h2>Reference Link</h2>
              <p>Search by mold name, release name (paint job), or artist resin</p>
            </div>
          </div>

          <UnifiedReferenceSearch
            selectedCatalogId={selectedCatalogId}
            onCatalogSelect={(id, item) => {
              setSelectedCatalogId(id);
              setSelectedCatalogItem(item);
              // Auto-fill sculptor for resins
              if (item?.itemType === "artist_resin" && item.maker && !sculptor.trim()) {
                setSculptor(item.maker);
              }
            }}
            onCustomEntry={(searchTerm) => {
              // Guard: confirm if reference was already selected
              if (selectedCatalogId) {
                if (!confirm("This will clear your current reference link. Continue?")) {
                  return;
                }
              }
              setSelectedCatalogId(null);
              setSelectedCatalogItem(null);
              // Drop the search term into custom_name
              if (!customName.trim() || nameAutoFilled) {
                setCustomName(searchTerm);
                setNameAutoFilled(true);
              }
              // Suggestion was already submitted via the modal — no need to fire-and-forget here
              // Skip to Step 3 (Identity)
              setCurrentStep(2);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            externalSearchQuery={aiSearchQuery}
            aiNotice={
              aiResult ? (
                <div className="shrink-0 text-forest" style={{ marginBottom: "var(--space-lg)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
                  </svg>
                  <span>
                    AI pre-filled: <strong>{aiResult.mold_name}</strong> — you can change it below
                  </span>
                </div>
              ) : undefined
            }
          />
        </div>

        <div className="flex justify-between items-center gap-4 mt-8">
          <button className="btn btn-ghost" onClick={goBack} id="step-2-back">
            ← Back
          </button>
          <button
            className="btn btn-primary"
            onClick={goNext}
            disabled={!canProceedStep(1)}
            id="step-2-next"
          >
            {selectedCatalogId ? "Next: Identity →" : "Skip → No Reference"}
          </button>
        </div>
      </div>

      {/* ================================================================
          STEP 3 (index 2): Identity
          ================================================================ */}
      {currentStep === 2 && (
        <div className="step-content" key="step-2">
          <div className="bg-card border border-[rgba(44, 85, 69, 0.2)] rounded-lg p-12 shadow-md relative overflow-visible">

            {/* Reference summary badge */}
            {selectedCatalogItem && (
              <div className="getting-started-tip" style={{ marginBottom: "var(--space-lg)" }}>
                🔗 Linked to: <strong>{selectedCatalogItem.title}</strong> · {selectedCatalogItem.maker}
              </div>
            )}

            <div className="bg-card border border-[rgba(44, 85, 69, 0.2)] rounded-lg p-12 shadow-md relative overflow-visible-header">
              <div className="bg-card border border-[rgba(44, 85, 69, 0.2)] rounded-lg p-12 shadow-md relative overflow-visible-icon">🏷️</div>
              <div>
                <h2>{isModel ? "Model Identity" : `${assetCategory.charAt(0).toUpperCase() + assetCategory.slice(1)} Details`}</h2>
                <p>{isModel ? "Give your model a name and describe its characteristics" : `Name and describe your ${assetCategory}`}</p>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="custom-name" className="form-label">
                Custom Name *
              </label>
              <input
                id="custom-name"
                type="text"
                className="form-input"
                placeholder="e.g. Midnight Star, Patches, Stormy…"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                autoFocus
                maxLength={100}
              />
              <span className="form-hint">
                What do you call this model? This can be a show name, pet name, or whatever you like.
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="sculptor" className="form-label">
                Sculptor / Artist
              </label>
              <input
                id="sculptor"
                type="text"
                className="form-input"
                placeholder="e.g. Sarah Rose, Brigitte Eberl, Kathleen Moody…"
                value={sculptor}
                onChange={(e) => setSculptor(e.target.value)}
                maxLength={100}
              />
              <span className="form-hint">
                Optional — tag the sculptor or artist, especially for Artist Resins or custom work.
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="finishing-artist" className="form-label">
                🎨 Finishing Artist
              </label>
              <input
                id="finishing-artist"
                type="text"
                className="form-input"
                placeholder="Who painted or customized this model?"
                value={finishingArtist}
                onChange={(e) => setFinishingArtist(e.target.value)}
                maxLength={100}
              />
              <span className="form-hint">
                The artist who painted/finished this model (if different from sculptor).
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">📋 Edition Info</label>
              <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
                <input
                  type="number"
                  className="form-input"
                  placeholder="#"
                  value={editionNumber}
                  onChange={(e) => setEditionNumber(e.target.value)}
                  style={{ width: 80 }}
                  min="1"
                />
                <span style={{ color: "var(--color-text-muted)" }}>of</span>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Total"
                  value={editionSize}
                  onChange={(e) => setEditionSize(e.target.value)}
                  style={{ width: 80 }}
                  min="1"
                />
              </div>
              <span className="form-hint">
                e.g., &quot;3 of 50&quot; for limited edition runs.
              </span>
            </div>

            {/* Finish Type — model only */}
            {isModel && (
              <div className="form-group">
                <label htmlFor="finish-type" className="form-label">
                  Finish Type *
                </label>
                <select
                  id="finish-type"
                  className="form-select"
                  value={finishType}
                  onChange={(e) => {
                    setFinishType(e.target.value as FinishType);
                  }}
                >
                  <option value="">Select finish type…</option>
                  <option value="OF">OF (Original Finish)</option>
                  <option value="Custom">Custom (Repaint / Body Mod)</option>
                  <option value="Artist Resin">Artist Resin</option>
                </select>
              </div>
            )}

            {/* Finish Details */}
            <div className="form-group">
              <label className="form-label">Finish Details</label>
              <input
                className="form-input"
                type="text"
                value={finishDetails}
                onChange={(e) => setFinishDetails(e.target.value)}
                placeholder="e.g. Glossy, Matte, Satin, Chalky"
                maxLength={100}
                id="finish-details"
              />
            </div>

            {/* Public Notes */}
            <div className="form-group">
              <label className="form-label">Public Notes</label>
              <textarea
                className="form-input"
                value={publicNotes}
                onChange={(e) => setPublicNotes(e.target.value)}
                placeholder="Visible on your passport — e.g. comes with original box, factory rubs on near leg"
                maxLength={500}
                rows={2}
                id="public-notes"
              />
              <small style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                These notes will be visible to anyone viewing this horse&apos;s passport.
              </small>
            </div>

            {/* ── Show Bio (Optional) ── */}
            <div className="flex items-center gap-4 m-[var(--space-xl) 0] text-muted text-sm" style={{ margin: "var(--space-lg) 0 var(--space-md)" }}>
              <h4 style={{ fontSize: "var(--font-size-md)", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                🏅 Show Bio <span style={{ fontWeight: 400, fontSize: "var(--font-size-sm)" }}>(Optional)</span>
              </h4>
              <small style={{ color: "var(--color-text-muted)", display: "block", marginTop: "var(--space-xs)" }}>
                The show identity you assign for competition — breed, gender, and age for show ring divisions.
              </small>
            </div>

            <div className="form-row" style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap" }}>
              <div className="form-group" style={{ flex: "1 1 200px" }}>
                <label className="form-label">Assigned Breed</label>
                <input
                  className="form-input"
                  type="text"
                  value={assignedBreed}
                  onChange={(e) => setAssignedBreed(e.target.value)}
                  placeholder="e.g. Andalusian, Arabian, Quarter Horse"
                  maxLength={100}
                  id="assigned-breed"
                />
              </div>
              <div className="form-group" style={{ flex: "1 1 150px" }}>
                <label className="form-label">Assigned Gender</label>
                <select
                  className="form-select"
                  value={assignedGender}
                  onChange={(e) => setAssignedGender(e.target.value)}
                  id="assigned-gender"
                >
                  <option value="">Select…</option>
                  <option value="Stallion">Stallion</option>
                  <option value="Mare">Mare</option>
                  <option value="Gelding">Gelding</option>
                  <option value="Foal">Foal</option>
                  <option value="Colt">Colt</option>
                  <option value="Filly">Filly</option>
                </select>
              </div>
            </div>

            <div className="form-row" style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap" }}>
              <div className="form-group" style={{ flex: "1 1 150px" }}>
                <label className="form-label">Assigned Age</label>
                <input
                  className="form-input"
                  type="text"
                  value={assignedAge}
                  onChange={(e) => setAssignedAge(e.target.value)}
                  placeholder="e.g. Foal, Yearling, Adult, 5 years"
                  maxLength={50}
                  id="assigned-age"
                />
              </div>
              <div className="form-group" style={{ flex: "1 1 200px" }}>
                <label className="form-label">Regional Show ID</label>
                <input
                  className="form-input"
                  type="text"
                  value={regionalId}
                  onChange={(e) => setRegionalId(e.target.value)}
                  placeholder="e.g. RX number, Texas System ID"
                  maxLength={50}
                  id="regional-id"
                />
              </div>
            </div>

            {/* Condition Grade — model only */}
            {isModel && (
              <div className="form-group">
                <label htmlFor="condition-grade" className="form-label">
                  Condition Grade *
                </label>
                <select
                  id="condition-grade"
                  className="form-select"
                  value={conditionGrade}
                  onChange={(e) => setConditionGrade(e.target.value)}
                >
                  <option value="">Select condition…</option>
                  {CONDITION_GRADES.map((grade) => (
                    <option key={grade.value} value={grade.value}>
                      {grade.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Life Stage — model only */}
            {isModel && (
              <div className="form-group">
                <label htmlFor="life-stage" className="form-label">
                  🐾 Life Stage
                </label>
                <select
                  id="life-stage"
                  className="form-select"
                  value={lifeStage}
                  onChange={(e) => setLifeStage(e.target.value)}
                >
                  <option value="blank">🎨 Blank / Unpainted</option>
                  <option value="stripped">🛁 Stripped / Body</option>
                  <option value="in_progress">🔧 Work in Progress</option>
                  <option value="completed">✅ Completed</option>
                  <option value="for_sale">💲 For Sale</option>
                </select>
                <span className="form-hint">
                  This sets the life stage on your Hoofprint™ timeline.
                </span>
              </div>
            )}

            <CollectionPicker
              selectedCollectionIds={selectedCollectionIds}
              onSelect={setSelectedCollectionIds}
            />

            {/* Trade / Marketplace Status */}
            <div className="form-group">
              <label htmlFor="trade-status" className="form-label">
                Marketplace Status
              </label>
              <select
                id="trade-status"
                className="form-select"
                value={tradeStatus}
                onChange={(e) => setTradeStatus(e.target.value)}
              >
                <option value="Not for Sale">Not for Sale</option>
                <option value="For Sale">For Sale</option>
                <option value="Open to Offers">Open to Offers</option>
                <option value="Stolen/Missing">🚨 Stolen/Missing</option>
              </select>
            </div>

            {/* Conditional marketplace fields */}
            {(tradeStatus === "For Sale" || tradeStatus === "Open to Offers") && (
              <div className="mt-4 p-4 bg-[rgba(34, 197, 94, 0.05)] border border-[rgba(34, 197, 94, 0.15)] rounded-md animate-fade-in-up">
                <div className="form-group">
                  <label htmlFor="listing-price" className="form-label">
                    💲 Listing Price
                  </label>
                  <input
                    id="listing-price"
                    type="number"
                    className="form-input"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={listingPrice}
                    onChange={(e) => setListingPrice(e.target.value)}
                  />
                  <span className="form-hint">
                    Optional — leave blank for &ldquo;Contact for price&rdquo;
                  </span>
                </div>
                <div className="form-group">
                  <label htmlFor="marketplace-notes" className="form-label">
                    📝 Seller Notes
                  </label>
                  <textarea
                    id="marketplace-notes"
                    className="form-textarea"
                    rows={3}
                    maxLength={500}
                    placeholder="e.g. Will ship anywhere, Trades welcome, Smoke-free home..."
                    value={marketplaceNotes}
                    onChange={(e) => setMarketplaceNotes(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center gap-4 mt-8">
            <button className="btn btn-ghost" onClick={goBack} id="step-3-back">
              ← Back
            </button>
            <button
              className="btn btn-primary"
              onClick={goNext}
              disabled={!canProceedStep(2)}
              id="step-3-next"
            >
              Next: Financial Vault →
            </button>
          </div>

          {/* Community visibility selector */}
          <div className="mt-6 py-4 px-6 rounded-lg bg-[rgba(44, 85, 69, 0.04)] border border-[rgba(44, 85, 69, 0.12)]">
            <div className="flex items-center justify-between gap-6" style={{ flexDirection: "column", gap: "var(--space-sm)" }}>
              <span className="community-toggle-label">👁️ Visibility</span>
              <div className="flex gap-2 flex-wrap">
                {([
                  { value: "public" as const, icon: "🌐", label: "Public", hint: "Visible in the Show Ring" },
                  { value: "unlisted" as const, icon: "🔗", label: "Unlisted", hint: "Anyone with the link can see it" },
                  { value: "private" as const, icon: "🔒", label: "Private", hint: "Only you can see it" },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`flex-1 min-w-[120px] flex flex-col items-center gap-1 py-3 px-2 border-2 rounded-lg bg-surface-primary cursor-pointer transition-all font-inherit text-ink hover:border-forest hover:bg-surface-secondary ${visibility === opt.value ? "border-forest bg-[rgba(44,85,69,0.1)]" : "border-edge"}`}
                    onClick={() => setVisibility(opt.value)}
                    id={`visibility-${opt.value}`}
                  >
                    <span className="text-2xl">{opt.icon}</span>
                    <span className="font-semibold text-sm">{opt.label}</span>
                    <span className="text-xs text-muted text-center">{opt.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )
      }

      {/* ================================================================
          STEP 4: Financial Vault
          ================================================================ */}
      {
        currentStep === 3 && (
          <div className="step-content" key="step-3">

            {/* Reference summary badge */}
            {selectedCatalogItem && (
              <div className="getting-started-tip" style={{ marginBottom: "var(--space-lg)" }}>
                🔗 Linked to: <strong>{selectedCatalogItem.title}</strong> · {selectedCatalogItem.maker}
              </div>
            )}

            <div className="bg-card border border-[rgba(44, 85, 69, 0.2)] rounded-lg p-12 shadow-md relative overflow-visible relative overflow-hidden">
              {/* Vault Header */}
              <div className="flex items-center gap-4 mb-8 pb-6 border-b border-[rgba(240, 160, 108, 0.2)]">
                <div className="vault-icon">🔒</div>
                <div>
                  <h2>The Financial Vault</h2>
                  <p>Optional — record purchase details and valuations</p>
                </div>
              </div>

              {/* Privacy reassurance */}
              <div className="flex items-start gap-2 p-4 bg-[rgba(240, 160, 108, 0.08)] border border-[rgba(240, 160, 108, 0.2)] rounded-md mb-8" role="note" aria-label="Financial privacy notice">
                <span style={{ fontSize: "1.3em", flexShrink: 0, marginTop: "2px" }}>🛡️</span>
                <p>
                  <strong>This data is encrypted and only visible to you.</strong> No
                  other user, not even community members who can see your public
                  horses, will ever have access to your financial information. Your
                  purchase prices, valuations, and insurance notes are protected by
                  strict Row Level Security.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="form-group">
                  <label htmlFor="purchase-price" className="form-label">
                    Purchase Price
                  </label>
                  <input
                    id="purchase-price"
                    type="number"
                    className="form-input"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="purchase-date" className="form-label">
                    Purchase Date
                  </label>
                  <input
                    id="purchase-date"
                    type="date"
                    className="form-input"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Fuzzy Purchase Date */}
              <div className="form-group">
                <label className="form-label">Approximate Purchase Date</label>
                <input
                  className="form-input"
                  type="text"
                  value={purchaseDateText}
                  onChange={(e) => setPurchaseDateText(e.target.value)}
                  placeholder="e.g. BreyerFest 2017, Summer 2015, Christmas 2020"
                  id="purchase-date-text"
                />
                <small style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                  Use this when you don&apos;t remember the exact date.
                </small>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="form-group">
                  <label htmlFor="estimated-value" className="form-label">
                    Estimated Current Value
                  </label>
                  <input
                    id="estimated-value"
                    type="number"
                    className="form-input"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="insurance-notes" className="form-label">
                    Insurance Notes
                  </label>
                  <input
                    id="insurance-notes"
                    type="text"
                    className="form-input"
                    placeholder="Policy number, coverage details, etc."
                    value={insuranceNotes}
                    onChange={(e) => setInsuranceNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="text-center mt-6 pt-6 border-t border-edge">
                <p>
                  💡 All fields are optional. You can always add or update financial
                  details later from your Horse Passport view.
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center gap-4 mt-8">
              <button className="btn btn-ghost" onClick={goBack} id="step-4-back">
                ← Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={isSubmitting || !canProceedStep(2)}
                id="submit-horse"
              >
                {isSubmitting ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true" />
                    Saving to Stable…
                  </>
                ) : (
                  <>🐴 Add to Stable</>
                )}
              </button>
            </div>
          </div>
        )
      }

      {/* ── AI Toast Notifications ── */}
      <div className="ai-fixed top-[calc(var(--header-height) + var(--space-md))] right-[var(--space-lg)] flex flex-col gap-2 z-[10000] max-w-[420px] w-full pointer-events-none" aria-live="polite">
        {aiToasts.map((toast) => (
          <div
            key={toast.id}
            className={`ai-toast ai-toast-${toast.type}`}
            role="status"
          >
            <span className="ai-text-[1.1rem] shrink-0">
              {toast.type === "success" ? "✨" : toast.type === "error" ? "⚠️" : "ℹ️"}
            </span>
            <span className="flex-1">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* ── Image Crop Modal ── */}
      {cropFile && (
        <ImageCropModal
          file={cropFile}
          onCrop={handleCropComplete}
          onCancel={() => {
            setCropFile(null);
            setCropAngle(null);
            // If cancelling an extra crop, skip to next in queue or finish
            if (isCroppingExtra) {
              setExtraCropQueue(prev => {
                const remaining = prev.slice(1);
                if (remaining.length > 0) {
                  setTimeout(() => setCropFile(remaining[0]), 50);
                } else {
                  setIsCroppingExtra(false);
                }
                return remaining;
              });
            }
            if (reCropExtraIdx !== null) {
              setReCropExtraIdx(null);
            }
          }}
        />
      )}
    </div >
  );
}
