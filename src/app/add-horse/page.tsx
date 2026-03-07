"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  compressImage,
  validateImageFile,
  createImagePreviewUrl,
  revokeImagePreviewUrl,
} from "@/lib/utils/imageCompression";
import type { AngleProfile, FinishType } from "@/lib/types/database";
import UnifiedReferenceSearch from "@/components/UnifiedReferenceSearch";
import type { ReleaseDetail } from "@/components/UnifiedReferenceSearch";
import CollectionPicker from "@/components/CollectionPicker";
import { notifyHorsePublic } from "@/app/actions/horse-events";
import { initializeHoofprint } from "@/app/actions/hoofprint";

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

  // AI Vision Detection
  const [aiDetecting, setAiDetecting] = useState(false);
  const [aiResult, setAiResult] = useState<AiDetectionResult | null>(null);
  const [aiToasts, setAiToasts] = useState<AiToast[]>([]);
  const toastIdRef = useRef(0);

  // Step 2 (index 1): Reference
  const [selectedMoldId, setSelectedMoldId] = useState<string | null>(null);
  const [selectedResinId, setSelectedResinId] = useState<string | null>(null);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [releases, setReleases] = useState<ReleaseDetail[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [nameAutoFilled, setNameAutoFilled] = useState(false);
  const [aiSearchQuery, setAiSearchQuery] = useState<string | undefined>(undefined);

  // Step 3 (index 2): Identity
  const [customName, setCustomName] = useState("");
  const [sculptor, setSculptor] = useState("");
  const [finishType, setFinishType] = useState<FinishType | "">("");
  const [conditionGrade, setConditionGrade] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [tradeStatus, setTradeStatus] = useState("Not for Sale");
  const [listingPrice, setListingPrice] = useState("");
  const [marketplaceNotes, setMarketplaceNotes] = useState("");

  // Step 4 (index 3): Financial Vault
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [insuranceNotes, setInsuranceNotes] = useState("");

  // ---- Fetch releases when a mold is selected (cascading dropdown) ----

  // Fetch releases when a mold is selected (cascading dropdown)
  useEffect(() => {
    if (!selectedMoldId) {
      setReleases([]);
      return;
    }

    let cancelled = false;
    const fetchReleases = async () => {
      setLoadingReleases(true);
      const { data } = await supabase
        .from("reference_releases")
        .select("id, mold_id, model_number, release_name, color_description, release_year_start, release_year_end")
        .eq("mold_id", selectedMoldId)
        .order("release_year_start", { ascending: true, nullsFirst: false });

      if (!cancelled) {
        setReleases((data as ReleaseDetail[]) ?? []);
        setLoadingReleases(false);
      }
    };

    fetchReleases();
    return () => { cancelled = true; };
  }, [selectedMoldId, supabase]);

  // Auto-fill custom_name when a release is selected
  useEffect(() => {
    if (selectedReleaseId) {
      const release = releases.find((r) => r.id === selectedReleaseId);
      if (release && (!customName.trim() || nameAutoFilled)) {
        setCustomName(release.release_name);
        setNameAutoFilled(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReleaseId]);

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

      // Give the search a moment to execute, then try to auto-select the mold
      setTimeout(async () => {
        const { data: matchedMolds } = await supabase
          .from("reference_molds")
          .select("id, manufacturer, mold_name, scale, release_year_start")
          .ilike("mold_name", `%${result.mold_name}%`)
          .limit(10);

        if (matchedMolds && matchedMolds.length > 0) {
          const exactMatch = matchedMolds.find(
            (m: { id: string; mold_name: string }) =>
              m.mold_name.toLowerCase() === result.mold_name.toLowerCase()
          );
          const bestMatch = exactMatch || matchedMolds[0];
          setSelectedMoldId(bestMatch.id);
          setSelectedResinId(null);
        }
      }, 600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI detection failed.";
      showToast(msg, "error");
    } finally {
      setAiDetecting(false);
    }
  }, [imageSlots, showToast, supabase]);

  // ---- Handlers ----

  const handleImageSelect = async (angle: AngleProfile, file: File) => {
    const validationError = validateImageFile(file);
    if (validationError) {
      alert(validationError);
      return;
    }

    // Revoke old preview
    const existingSlot = imageSlots[angle];
    if (existingSlot) revokeImagePreviewUrl(existingSlot.previewUrl);

    const previewUrl = createImagePreviewUrl(file);
    setImageSlots((prev) => ({
      ...prev,
      [angle]: { file, previewUrl },
    }));
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
        return customName.trim().length > 0 && finishType !== "" && conditionGrade !== "";
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in.");

      // 2. Insert horse record
      const horseInsert: Record<string, unknown> = {
        owner_id: user.id,
        custom_name: customName.trim(),
        finish_type: finishType,
        condition_grade: conditionGrade,
        is_public: isPublic,
        trade_status: tradeStatus,
      };

      if (selectedMoldId) horseInsert.reference_mold_id = selectedMoldId;
      if (selectedResinId) horseInsert.artist_resin_id = selectedResinId;
      if (selectedReleaseId) horseInsert.release_id = selectedReleaseId;
      if (selectedCollectionId) horseInsert.collection_id = selectedCollectionId;
      if (sculptor.trim()) horseInsert.sculptor = sculptor.trim();

      // Marketplace fields (only when listing)
      if (tradeStatus !== "Not for Sale") {
        if (listingPrice) horseInsert.listing_price = parseFloat(listingPrice);
        if (marketplaceNotes.trim()) horseInsert.marketplace_notes = marketplaceNotes.trim();
      }

      const { data: horse, error: horseError } = await supabase
        .from("user_horses")
        .insert(horseInsert)
        .select("id")
        .single<{ id: string }>();

      if (horseError || !horse) throw new Error(horseError?.message || "Failed to save horse.");

      const horseId = horse.id;

      // 3. Upload images to storage & insert records
      const imageEntries = Object.entries(imageSlots) as [AngleProfile, ImageSlot][];

      for (const [angle, slot] of imageEntries) {
        // Compress before upload
        const compressed = await compressImage(slot.file);

        const filePath = `${user.id}/${horseId}/${angle}_${Date.now()}.webp`;

        const { error: uploadError } = await supabase.storage
          .from("horse-images")
          .upload(filePath, compressed, {
            contentType: "image/webp",
            upsert: false,
          });

        if (uploadError) {
          console.error(`Upload error for ${angle}:`, uploadError);
          continue; // Don't block on single image failure
        }

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from("horse-images").getPublicUrl(filePath);

        // Insert image record
        await supabase.from("horse_images").insert({
          horse_id: horseId,
          image_url: publicUrl,
          angle_profile: angle,
        } as Record<string, unknown>);
      }

      // 3b. Upload extra detail files
      for (let i = 0; i < extraFiles.length; i++) {
        const compressed = await compressImage(extraFiles[i].file);
        const filePath = `${user.id}/${horseId}/extra_detail_${Date.now()}_${i}.webp`;

        const { error: uploadError } = await supabase.storage
          .from("horse-images")
          .upload(filePath, compressed, { contentType: "image/webp", upsert: false });

        if (uploadError) {
          console.error(`Upload error for extra ${i}:`, uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage.from("horse-images").getPublicUrl(filePath);

        await supabase.from("horse_images").insert({
          horse_id: horseId,
          image_url: publicUrl,
          angle_profile: "extra_detail",
        } as Record<string, unknown>);
      }

      // 4. Insert Financial Vault (if any data was entered)
      const hasVaultData =
        purchasePrice || purchaseDate || estimatedValue || insuranceNotes;

      if (hasVaultData) {
        const vaultInsert: Record<string, unknown> = {
          horse_id: horseId,
        };
        if (purchasePrice) vaultInsert.purchase_price = parseFloat(purchasePrice);
        if (purchaseDate) vaultInsert.purchase_date = purchaseDate;
        if (estimatedValue) vaultInsert.estimated_current_value = parseFloat(estimatedValue);
        if (insuranceNotes) vaultInsert.insurance_notes = insuranceNotes;

        const { error: vaultError } = await supabase
          .from("financial_vault")
          .insert(vaultInsert);

        if (vaultError) {
          console.error("Vault error:", vaultError);
          // Non-blocking — horse is already saved
        }
      }

      // 5. Activity event if public (fire-and-forget)
      if (isPublic) {
        notifyHorsePublic({
          userId: user.id,
          horseId,
          horseName: customName.trim(),
          finishType: finishType as string,
          tradeStatus: tradeStatus as string,
          moldId: selectedMoldId || null,
          releaseId: selectedReleaseId || null,
        });
      }

      // 6. Initialize Hoofprint (fire-and-forget)
      initializeHoofprint({
        horseId,
        horseName: customName.trim(),
        lifeStage: "completed",
      });

      // 7. Show success!
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
        <div className="success-card card animate-fade-in-up">
          <div className="success-icon">🎉</div>
          <h2>
            <span className="text-gradient">{savedHorseName}</span> Added!
          </h2>
          <p>
            Your model has been successfully cataloged in your Digital Stable.
          </p>
          <div className="success-actions">
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
      <div className="form-page-header animate-fade-in-up">
        <h1>
          Add to <span className="text-gradient">Stable</span>
        </h1>
        <p>Catalog a new model horse in your digital collection</p>
      </div>

      {/* Step Indicator */}
      <div className="stepper" role="navigation" aria-label="Form progress">
        {STEPS.map((step, i) => (
          <div
            key={step.label}
            className={`stepper-step ${i === currentStep ? "active" : ""
              } ${i < currentStep ? "completed" : ""}`}
          >
            <div className="stepper-dot" aria-current={i === currentStep ? "step" : undefined}>
              {i < currentStep ? "✓" : i + 1}
            </div>
            <span className="stepper-label">{step.label}</span>
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
          <div className="step-card">
            <div className="step-card-header">
              <div className="step-card-icon">📸</div>
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

            <div className="gallery-grid">
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
                          className="gallery-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImageRemove(slot.angle);
                          }}
                          aria-label={`Remove ${slot.label} photo`}
                        >
                          ✕
                        </button>
                        <div className="gallery-slot-check">✓</div>

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
                                <span className="ai-detect-label">Analyzing…</span>
                              </>
                            ) : (
                              <>
                                <svg className="ai-detect-sparkle" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
                                </svg>
                                <span className="ai-detect-label">Auto-Detect Mold</span>
                              </>
                            )}
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="gallery-slot-icon">{isPrimary ? "🖼️" : "📷"}</span>
                        <span className="gallery-slot-label">{slot.label}</span>
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
            <div className="extras-upload-zone">
              <div
                className="extras-dropzone"
                onClick={() => extraInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
                  const newExtras = files.map(file => ({ file, previewUrl: URL.createObjectURL(file) }));
                  setExtraFiles(prev => [...prev, ...newExtras]);
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
                    const newExtras = files.map(file => ({ file, previewUrl: URL.createObjectURL(file) }));
                    setExtraFiles(prev => [...prev, ...newExtras]);
                    e.target.value = "";
                  }}
                  style={{ display: "none" }}
                />
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span><strong>Extra Details & Flaws</strong> — Upload as many as needed</span>
                <span style={{ fontSize: "calc(var(--font-size-xs) * var(--font-scale))", color: "var(--color-text-muted)" }}>Click or drag multiple files here</span>
              </div>
              {extraFiles.length > 0 && (
                <div className="extras-preview-grid">
                  {extraFiles.map((ef, i) => (
                    <div key={i} className="extras-preview-item">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ef.previewUrl} alt={`Extra detail ${i + 1}`} />
                      <button
                        className="gallery-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          URL.revokeObjectURL(ef.previewUrl);
                          setExtraFiles(prev => prev.filter((_, idx) => idx !== i));
                        }}
                        aria-label={`Remove extra photo ${i + 1}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI result badge (shown after detection) */}
            {aiResult && (
              <div className="ai-result-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
                </svg>
                <span>
                  AI Detected: <strong>{aiResult.mold_name}</strong> · {aiResult.manufacturer} · {aiResult.scale}
                </span>
              </div>
            )}
          </div>

          <div className="step-nav">
            <div className="step-nav-spacer" />
            <button className="btn btn-primary" onClick={goNext} id="step-1-next">
              Next: Reference Link →
            </button>
          </div>
        </div>
      )}

      {/* ================================================================
          STEP 2 (index 1): Reference Link
          ================================================================ */}
      {currentStep === 1 && (
        <div className="step-content" key="step-1">
          <div className="step-card">
            <div className="step-card-header">
              <div className="step-card-icon">🔗</div>
              <div>
                <h2>Reference Link</h2>
                <p>Search by mold name, release name (paint job), or artist resin</p>
              </div>
            </div>

            <UnifiedReferenceSearch
              selectedMoldId={selectedMoldId}
              selectedResinId={selectedResinId}
              selectedReleaseId={selectedReleaseId}
              onSelectionChange={(sel) => {
                setSelectedMoldId(sel.moldId);
                setSelectedResinId(sel.resinId);
                setSelectedReleaseId(sel.releaseId);
              }}
              onCustomEntry={(searchTerm) => {
                // Clear any existing reference selections
                setSelectedMoldId(null);
                setSelectedResinId(null);
                setSelectedReleaseId(null);
                // Drop the search term into custom_name
                if (!customName.trim() || nameAutoFilled) {
                  setCustomName(searchTerm);
                  setNameAutoFilled(true);
                }
                // Skip to Step 3 (Identity)
                setCurrentStep(2);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              externalSearchQuery={aiSearchQuery}
              aiNotice={
                aiResult ? (
                  <div className="ai-result-badge" style={{ marginBottom: "var(--space-lg)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
                    </svg>
                    <span>
                      AI pre-filled: <strong>{aiResult.mold_name}</strong> — you can change it below
                    </span>
                  </div>
                ) : undefined
              }
              releases={releases}
              loadingReleases={loadingReleases}
              releaseHint={
                selectedReleaseId ? (
                  <span className="form-hint" style={{ marginTop: "var(--space-xs)", display: "block", color: "var(--color-accent-primary)" }}>
                    ✨ This will auto-fill the Custom Name in the Identity step
                  </span>
                ) : undefined
              }
            />
          </div>

          <div className="step-nav">
            <button className="btn btn-ghost" onClick={goBack} id="step-2-back">
              ← Back
            </button>
            <button
              className="btn btn-primary"
              onClick={goNext}
              disabled={!canProceedStep(1)}
              id="step-2-next"
            >
              {selectedMoldId || selectedResinId ? "Next: Identity →" : "Skip → No Reference"}
            </button>
          </div>
        </div>
      )}

      {/* ================================================================
          STEP 3 (index 2): Identity
          ================================================================ */}
      {currentStep === 2 && (
        <div className="step-content" key="step-2">
          <div className="step-card">
            <div className="step-card-header">
              <div className="step-card-icon">🏷️</div>
              <div>
                <h2>Model Identity</h2>
                <p>Give your model a name and describe its characteristics</p>
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
              <label htmlFor="finish-type" className="form-label">
                Finish Type *
              </label>
              <select
                id="finish-type"
                className="form-select"
                value={finishType}
                onChange={(e) => {
                  setFinishType(e.target.value as FinishType);
                  // Reset reference selection when finish type changes
                  setSelectedMoldId(null);
                  setSelectedResinId(null);
                  setSelectedReleaseId(null);
                }}
              >
                <option value="">Select finish type…</option>
                <option value="OF">OF (Original Finish)</option>
                <option value="Custom">Custom (Repaint / Body Mod)</option>
                <option value="Artist Resin">Artist Resin</option>
              </select>
            </div>

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

            <CollectionPicker
              selectedCollectionId={selectedCollectionId}
              onSelect={setSelectedCollectionId}
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
              </select>
            </div>

            {/* Conditional marketplace fields */}
            {(tradeStatus === "For Sale" || tradeStatus === "Open to Offers") && (
              <div className="marketplace-fields animate-fade-in-up">
                <div className="form-group">
                  <label htmlFor="listing-price" className="form-label">
                    💲 Listing Price ($)
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

          <div className="step-nav">
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

          {/* Community visibility toggle */}
          <div className="community-toggle-section">
            <div className="community-toggle-row">
              <div className="community-toggle-info">
                <span className="community-toggle-label">🏆 Show in Public Community Feed</span>
                <span className="community-toggle-hint">
                  When enabled, this model will appear in the Show Ring for
                  other collectors to admire. Your financial data is always private.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                className={`toggle-switch ${isPublic ? "toggle-on" : "toggle-off"}`}
                onClick={() => setIsPublic(!isPublic)}
                id="is-public-toggle"
              >
                <span className="toggle-knob" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          STEP 4: Financial Vault
          ================================================================ */}
      {currentStep === 3 && (
        <div className="step-content" key="step-3">
          <div className="step-card vault-section">
            {/* Vault Header */}
            <div className="vault-header">
              <div className="vault-icon">🔒</div>
              <div>
                <h2>The Financial Vault</h2>
                <p>Optional — record purchase details and valuations</p>
              </div>
            </div>

            {/* Privacy reassurance */}
            <div className="vault-privacy-notice" role="note" aria-label="Financial privacy notice">
              <span style={{ fontSize: "1.3em", flexShrink: 0, marginTop: "2px" }}>🛡️</span>
              <p>
                <strong>This data is encrypted and only visible to you.</strong> No
                other user, not even community members who can see your public
                horses, will ever have access to your financial information. Your
                purchase prices, valuations, and insurance notes are protected by
                strict Row Level Security.
              </p>
            </div>

            <div className="vault-row">
              <div className="form-group">
                <label htmlFor="purchase-price" className="form-label">
                  Purchase Price ($)
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

            <div className="vault-row">
              <div className="form-group">
                <label htmlFor="estimated-value" className="form-label">
                  Estimated Current Value ($)
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

            <div className="vault-skip">
              <p>
                💡 All fields are optional. You can always add or update financial
                details later from your Horse Passport view.
              </p>
            </div>
          </div>

          <div className="step-nav">
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
      )}

      {/* ── AI Toast Notifications ── */}
      <div className="ai-toast-container" aria-live="polite">
        {aiToasts.map((toast) => (
          <div
            key={toast.id}
            className={`ai-toast ai-toast-${toast.type}`}
            role="status"
          >
            <span className="ai-toast-icon">
              {toast.type === "success" ? "✨" : toast.type === "error" ? "⚠️" : "ℹ️"}
            </span>
            <span className="ai-toast-msg">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
