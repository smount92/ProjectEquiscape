"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { FinishType, AngleProfile, AssetCategory } from "@/lib/types/database";
import UnifiedReferenceSearch from "@/components/UnifiedReferenceSearch";
import type { CatalogItem } from "@/app/actions/reference";
import CollectionPicker from "@/components/CollectionPicker";
import { compressImage } from "@/lib/utils/imageCompression";
import { updateLifeStage } from "@/app/actions/hoofprint";
import { updateHorseAction, deleteHorseImageAction, finalizeHorseImages } from "@/app/actions/horse";

// ---- Types ----

interface VaultData {
  purchase_price: number | null;
  purchase_date: string | null;
  estimated_current_value: number | null;
  insurance_notes: string | null;
}

const PHOTO_STUDIO_SLOTS: { angle: AngleProfile; label: string; primary?: boolean }[] = [
  { angle: "Primary_Thumbnail", label: "Near-Side", primary: true },
  { angle: "Right_Side", label: "Off-Side" },
  { angle: "Front_Chest", label: "Front / Chest" },
  { angle: "Back_Hind", label: "Hindquarters / Tail" },
  { angle: "Belly_Makers_Mark", label: "Belly / Maker's Mark" },
];

interface ExistingImage {
  recordId: string;
  imageUrl: string;
  storagePath: string | null;
}

const CONDITION_GRADES = [
  { value: "Mint", label: "Mint — Flawless, like new" },
  { value: "Near Mint", label: "Near Mint — Minimal handling wear" },
  { value: "Excellent", label: "Excellent — Very light wear, no breaks" },
  { value: "Very Good", label: "Very Good — Minor rubs or scuffs" },
  { value: "Good", label: "Good — Noticeable wear, still displays well" },
  { value: "Fair", label: "Fair — Visible flaws, repairs, or damage" },
  { value: "Poor", label: "Poor — Significant damage or missing parts" },
];

// ---- Component ----
export default function EditHorsePage() {
  const router = useRouter();
  const params = useParams();
  const horseId = params.id as string;
  const supabase = createClient();

  // Loading / error
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Identity fields
  const [customName, setCustomName] = useState("");
  const [sculptor, setSculptor] = useState("");
  const [finishingArtist, setFinishingArtist] = useState("");
  const [editionNumber, setEditionNumber] = useState("");
  const [editionSize, setEditionSize] = useState("");
  const [finishType, setFinishType] = useState<FinishType | "">("");
  const [conditionGrade, setConditionGrade] = useState("");
  const [originalCondition, setOriginalCondition] = useState("");
  const [conditionNote, setConditionNote] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [tradeStatus, setTradeStatus] = useState("Not for Sale");
  const [listingPrice, setListingPrice] = useState("");
  const [marketplaceNotes, setMarketplaceNotes] = useState("");
  const [lifeStage, setLifeStage] = useState("completed");
  const [assetCategory, setAssetCategory] = useState<AssetCategory>("model");

  const isModel = assetCategory === "model";

  // Reference fields (controlled by UnifiedReferenceSearch)
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<CatalogItem | null>(null);

  // Financial Vault
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [insuranceNotes, setInsuranceNotes] = useState("");
  const [hasExistingVault, setHasExistingVault] = useState(false);

  // Multi-angle image management
  const [existingImages, setExistingImages] = useState<Partial<Record<AngleProfile, ExistingImage>>>({});
  const [newFiles, setNewFiles] = useState<Partial<Record<AngleProfile, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<AngleProfile, string>>>({});
  const [draggingAngle, setDraggingAngle] = useState<AngleProfile | null>(null);
  const fileInputRefs = useRef<Partial<Record<AngleProfile, HTMLInputElement>>>({});

  // Extra detail images (unlimited)
  const [existingExtras, setExistingExtras] = useState<ExistingImage[]>([]);
  const [newExtraFiles, setNewExtraFiles] = useState<{ file: File; previewUrl: string }[]>([]);
  const extraInputRef = useRef<HTMLInputElement>(null);

  // Deferred image deletions (only executed on save)
  const [pendingImageDeletes, setPendingImageDeletes] = useState<{ recordId: string, path: string | null }[]>([]);

  // ---- Load existing data ----
  useEffect(() => {
    async function loadHorse() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: horse, error: horseErr } = await supabase
        .from("user_horses")
        .select("id, owner_id, custom_name, sculptor, finishing_artist, edition_number, edition_size, finish_type, condition_grade, is_public, collection_id, catalog_id, trade_status, listing_price, marketplace_notes, life_stage, asset_category")
        .eq("id", horseId)
        .single<{
          id: string;
          owner_id: string;
          custom_name: string;
          sculptor: string | null;
          finishing_artist: string | null;
          edition_number: number | null;
          edition_size: number | null;
          finish_type: FinishType | null;
          condition_grade: string | null;
          is_public: boolean;
          collection_id: string | null;
          catalog_id: string | null;
          trade_status: string;
          listing_price: number | null;
          marketplace_notes: string | null;
          life_stage: string | null;
          asset_category: AssetCategory | null;
        }>();

      if (horseErr || !horse || horse.owner_id !== user.id) {
        setError("Horse not found or access denied.");
        setIsLoading(false);
        return;
      }

      setCustomName(horse.custom_name);
      setSculptor(horse.sculptor || "");
      setFinishingArtist(horse.finishing_artist || "");
      setEditionNumber(horse.edition_number ? String(horse.edition_number) : "");
      setEditionSize(horse.edition_size ? String(horse.edition_size) : "");
      setFinishType(horse.finish_type || "");
      setConditionGrade(horse.condition_grade || "");
      setOriginalCondition(horse.condition_grade || "");
      setAssetCategory(horse.asset_category || "model");
      setIsPublic(horse.is_public);
      setSelectedCollectionId(horse.collection_id);
      setTradeStatus(horse.trade_status || "Not for Sale");
      if (horse.listing_price !== null) setListingPrice(String(horse.listing_price));
      setMarketplaceNotes(horse.marketplace_notes || "");
      setLifeStage(horse.life_stage || "completed");

      if (horse.catalog_id) {
        setSelectedCatalogId(horse.catalog_id);
        // Load the catalog item details for display
        import("@/app/actions/reference").then(({ getCatalogItem }) => {
          getCatalogItem(horse.catalog_id!).then((item) => {
            if (item) setSelectedCatalogItem(item);
          });
        });
      }

      const { data: vault } = await supabase
        .from("financial_vault")
        .select("purchase_price, purchase_date, estimated_current_value, insurance_notes")
        .eq("horse_id", horseId)
        .single<VaultData>();

      if (vault) {
        setHasExistingVault(true);
        if (vault.purchase_price !== null) setPurchasePrice(String(vault.purchase_price));
        if (vault.purchase_date !== null) setPurchaseDate(vault.purchase_date);
        if (vault.estimated_current_value !== null) setEstimatedValue(String(vault.estimated_current_value));
        if (vault.insurance_notes !== null) setInsuranceNotes(vault.insurance_notes);
      }

      // Load all existing images for this horse
      const { data: allImages } = await supabase
        .from("horse_images")
        .select("id, image_url, angle_profile")
        .eq("horse_id", horseId);

      if (allImages) {
        const existingMap: Partial<Record<AngleProfile, ExistingImage>> = {};
        const previewMap: Partial<Record<AngleProfile, string>> = {};
        for (const img of allImages as { id: string; image_url: string; angle_profile: AngleProfile }[]) {
          const urlParts = img.image_url.split("/horse-images/");
          existingMap[img.angle_profile] = {
            recordId: img.id,
            imageUrl: img.image_url,
            storagePath: urlParts.length > 1 ? urlParts[1] : null,
          };
          previewMap[img.angle_profile] = img.image_url;
        }
        setExistingImages(existingMap);
        setPreviews(previewMap);

        // Separate out extra_detail images
        const extras = (allImages as { id: string; image_url: string; angle_profile: string }[])
          .filter(img => img.angle_profile === "extra_detail")
          .map(img => {
            const urlParts = img.image_url.split("/horse-images/");
            return {
              recordId: img.id,
              imageUrl: img.image_url,
              storagePath: urlParts.length > 1 ? urlParts[1] : null,
            };
          });
        setExistingExtras(extras);
      }

      setIsLoading(false);
    }

    loadHorse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horseId]);



  // ---- Photo Studio handlers ----
  const handleSlotSelect = (angle: AngleProfile, file: File) => {
    if (!file.type.startsWith("image/")) return;
    setNewFiles((prev) => ({ ...prev, [angle]: file }));
    const reader = new FileReader();
    reader.onloadend = () => setPreviews((prev) => ({ ...prev, [angle]: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSlotDrop = (angle: AngleProfile, e: React.DragEvent) => {
    e.preventDefault();
    setDraggingAngle(null);
    const file = e.dataTransfer.files?.[0];
    if (file) handleSlotSelect(angle, file);
  };

  const handleSlotRevert = (angle: AngleProfile) => {
    setNewFiles((prev) => { const u = { ...prev }; delete u[angle]; return u; });
    setPreviews((prev) => ({
      ...prev,
      [angle]: existingImages[angle]?.imageUrl || undefined,
    }) as Partial<Record<AngleProfile, string>>);
    const ref = fileInputRefs.current[angle];
    if (ref) ref.value = "";
  };

  const handleSlotRemove = (angle: AngleProfile) => {
    const existing = existingImages[angle];
    if (existing && existing.recordId) {
      // Defer deletion until save — prevents data loss if user cancels
      setPendingImageDeletes(prev => [...prev, { recordId: existing.recordId, path: existing.storagePath || null }]);
    }
    setNewFiles((prev) => { const u = { ...prev }; delete u[angle]; return u; });
    setPreviews((prev) => { const u = { ...prev }; delete u[angle]; return u; });
    setExistingImages((prev) => { const u = { ...prev }; delete u[angle]; return u; });
  };

  // ---- Save handler ----
  const handleSave = async () => {
    if (!customName.trim()) {
      setSaveError("Please enter a name.");
      return;
    }
    if (isModel && (!finishType || !conditionGrade)) {
      setSaveError("Please fill in all required identity fields.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const horseUpdate: Record<string, unknown> = {
        custom_name: customName.trim(),
        sculptor: sculptor.trim() || null,
        finishing_artist: finishingArtist.trim() || null,
        edition_number: isModel && editionNumber ? parseInt(editionNumber) : null,
        edition_size: isModel && editionSize ? parseInt(editionSize) : null,
        finish_type: isModel ? finishType : null,
        condition_grade: isModel ? conditionGrade : null,
        asset_category: assetCategory,
        is_public: isPublic,
        trade_status: tradeStatus,
        listing_price: tradeStatus !== "Not for Sale" && listingPrice ? parseFloat(listingPrice) : null,
        marketplace_notes: tradeStatus !== "Not for Sale" && marketplaceNotes.trim() ? marketplaceNotes.trim() : null,
        collection_id: selectedCollectionId,
        catalog_id: selectedCatalogId,
        life_stage: isModel ? lifeStage : null,
      };

      const hasVaultData = purchasePrice || purchaseDate || estimatedValue || insuranceNotes;
      const vaultData: Record<string, unknown> | null = hasVaultData ? {
        purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
        purchase_date: purchaseDate || null,
        estimated_current_value: estimatedValue ? parseFloat(estimatedValue) : null,
        insurance_notes: insuranceNotes || null,
      } : null;

      const deleteVault = !hasVaultData && hasExistingVault;

      // Step 1: Update DB record (text only — no files)
      const result = await updateHorseAction(horseId, {
        horseUpdate,
        vaultData,
        hasExistingVault,
        deleteVault,
        conditionChange: conditionGrade !== originalCondition ? {
          newCondition: conditionGrade,
          note: conditionNote.trim() || null,
        } : null,
      });

      if (!result.success) throw new Error(result.error || "Failed to save.");

      // Process deferred image deletions (only now that save succeeded)
      for (const del of pendingImageDeletes) {
        await deleteHorseImageAction(del.recordId, del.path);
      }

      // Step 2: Upload NEW images directly from browser → Supabase Storage
      const uploadedImages: { path: string; angle: string }[] = [];

      for (const slot of PHOTO_STUDIO_SLOTS) {
        const angle = slot.angle;
        if (newFiles[angle]) {
          const compressed = await compressImage(newFiles[angle]);

          // Delete old image from storage + DB if it exists
          const existing = existingImages[angle];
          if (existing?.storagePath) {
            await supabase.storage.from("horse-images").remove([existing.storagePath]);
          }
          if (existing?.recordId) {
            await deleteHorseImageAction(existing.recordId, null);
          }

          const filePath = `horses/${horseId}/${angle}_${Date.now()}.webp`;
          const { error: uploadError } = await supabase.storage
            .from("horse-images")
            .upload(filePath, compressed, { contentType: "image/webp" });

          if (!uploadError) {
            uploadedImages.push({ path: filePath, angle });
          }
        }
      }

      // Upload new extra detail images
      for (let i = 0; i < newExtraFiles.length; i++) {
        const compressed = await compressImage(newExtraFiles[i].file);
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

      // Activity event if public (fire-and-forget)
      if (isPublic) {
        import("@/app/actions/horse-events").then((m) => {
          m.notifyHorsePublic({
            userId: user.id,
            horseId,
            horseName: customName.trim(),
            finishType: finishType as string,
            tradeStatus: tradeStatus as string,
            catalogId: selectedCatalogId || null,
          });
        }).catch(() => { });
      }

      // ⚡ REMOVED: addTimelineEvent for listed status — now derived from view

      // Hard redirect — clears all client state including isSaving
      window.location.href = "/dashboard?toast=updated&name=" + encodeURIComponent(customName.trim());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  // ---- RENDER ----

  if (isLoading) {
    return (
      <div className="page-container form-page">
        <div className="edit-page" style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
          <div className="btn-spinner" style={{ width: 36, height: 36, margin: "0 auto var(--space-lg)", borderWidth: 3, borderColor: "var(--color-border)", borderTopColor: "var(--color-accent-primary)" }} />
          <p>Loading horse details…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container form-page">
        <div className="passport-not-found card">
          <div className="passport-not-found-icon">🚫</div>
          <h1>Access Denied</h1>
          <p>{error}</p>
          <Link href="/dashboard" className="btn btn-primary">Back to Stable</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container form-page">
      <nav className="passport-breadcrumb animate-fade-in-up" aria-label="Breadcrumb">
        <Link href="/dashboard">Digital Stable</Link>
        <span className="separator" aria-hidden="true">/</span>
        <Link href={`/stable/${horseId}`}>{customName}</Link>
        <span className="separator" aria-hidden="true">/</span>
        <span>Edit</span>
      </nav>

      <div className="edit-page animate-fade-in-up">
        <h1 style={{ marginBottom: "var(--space-xl)" }}>
          Edit <span className="text-gradient">{customName}</span>
        </h1>

        {saveError && (
          <div className="form-error" role="alert" style={{ marginBottom: "var(--space-xl)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {saveError}
          </div>
        )}

        {/* ===== Photo Studio ===== */}
        <div className="edit-section">
          <div className="edit-section-header">
            <div className="edit-section-icon">📸</div>
            <h2>Photo Studio</h2>
          </div>
          <p style={{ color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))", marginBottom: "var(--space-md)" }}>
            Upload up to 4 standardized angles. The primary photo is used as the thumbnail everywhere.
          </p>

          <div className="photo-studio-grid">
            {PHOTO_STUDIO_SLOTS.map((slot) => {
              const preview = previews[slot.angle];
              const hasNew = !!newFiles[slot.angle];
              const isDrag = draggingAngle === slot.angle;

              return (
                <div key={slot.angle} className="photo-studio-slot">
                  <div className="photo-studio-label">
                    {slot.label}
                    {slot.primary && <span className="photo-studio-required">Required</span>}
                  </div>
                  <div
                    className={`image-upload-zone ${isDrag ? "drag-active" : ""} ${preview ? "has-preview" : ""}`}
                    onClick={() => fileInputRefs.current[slot.angle]?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDraggingAngle(slot.angle); }}
                    onDragLeave={() => setDraggingAngle(null)}
                    onDrop={(e) => handleSlotDrop(slot.angle, e)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Upload ${slot.label} photo`}
                  >
                    <input
                      ref={(el) => { if (el) fileInputRefs.current[slot.angle] = el; }}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleSlotSelect(slot.angle, f);
                      }}
                      style={{ display: "none" }}
                    />
                    {preview ? (
                      <div className="image-upload-preview">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preview} alt={slot.label} />
                        <div className="image-upload-overlay">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          <span>Replace</span>
                        </div>
                      </div>
                    ) : (
                      <div className="image-upload-placeholder">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                        <span>{slot.primary ? "+ Add Photo" : "+ Optional"}</span>
                      </div>
                    )}
                  </div>
                  {hasNew && (
                    <button
                      type="button"
                      className="image-revert-btn"
                      onClick={(e) => { e.stopPropagation(); handleSlotRevert(slot.angle); }}
                    >
                      ↩ Revert
                    </button>
                  )}
                  {!hasNew && preview && !slot.primary && (
                    <button
                      type="button"
                      className="image-revert-btn"
                      style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)" }}
                      onClick={(e) => { e.stopPropagation(); handleSlotRemove(slot.angle); }}
                    >
                      ✕ Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Extra Details Multi-Upload Zone */}
          <div className="extras-upload-zone">
            <div className="photo-studio-label" style={{ marginBottom: "var(--space-xs)" }}>
              Extra Details & Flaws
              <span style={{ fontWeight: 400, color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-xs) * var(--font-scale))" }}>Unlimited</span>
            </div>
            <div
              className="extras-dropzone"
              onClick={() => extraInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
                const newExtras = files.map(file => ({ file, previewUrl: URL.createObjectURL(file) }));
                setNewExtraFiles(prev => [...prev, ...newExtras]);
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
                  setNewExtraFiles(prev => [...prev, ...newExtras]);
                  e.target.value = "";
                }}
                style={{ display: "none" }}
              />
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Click or drag multiple files</span>
            </div>

            {/* Existing extras */}
            {(existingExtras.length > 0 || newExtraFiles.length > 0) && (
              <div className="extras-preview-grid">
                {existingExtras.map((ex) => (
                  <div key={ex.recordId} className="extras-preview-item">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ex.imageUrl} alt="Extra detail" />
                    <button
                      className="gallery-remove"
                      onClick={async (e) => {
                        e.stopPropagation();
                        // Delete from server storage + DB
                        await deleteHorseImageAction(ex.recordId, ex.storagePath || null);
                        setExistingExtras(prev => prev.filter(item => item.recordId !== ex.recordId));
                      }}
                      aria-label="Remove extra photo"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {newExtraFiles.map((ef, i) => (
                  <div key={`new-${i}`} className="extras-preview-item">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ef.previewUrl} alt={`New extra ${i + 1}`} />
                    <button
                      className="gallery-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        URL.revokeObjectURL(ef.previewUrl);
                        setNewExtraFiles(prev => prev.filter((_, idx) => idx !== i));
                      }}
                      aria-label={`Remove new extra ${i + 1}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ===== Section 1: Identity ===== */}
        <div className="edit-section">
          <div className="edit-section-header">
            <div className="edit-section-icon">🏷️</div>
            <h2>Model Identity</h2>
          </div>

          <div className="form-group">
            <label htmlFor="edit-name" className="form-label">Custom Name *</label>
            <input id="edit-name" type="text" className="form-input" value={customName}
              onChange={(e) => setCustomName(e.target.value)} maxLength={100} />
          </div>

          <div className="form-group">
            <label htmlFor="edit-sculptor" className="form-label">Sculptor / Artist</label>
            <input id="edit-sculptor" type="text" className="form-input" value={sculptor}
              onChange={(e) => setSculptor(e.target.value)} maxLength={100}
              placeholder="e.g. Sarah Rose, Brigitte Eberl…" />
            <span className="form-hint">
              Optional — tag the sculptor or artist, especially for Artist Resins or custom work.
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="edit-finishing-artist" className="form-label">🎨 Finishing Artist</label>
            <input id="edit-finishing-artist" type="text" className="form-input" value={finishingArtist}
              onChange={(e) => setFinishingArtist(e.target.value)} maxLength={100}
              placeholder="Who painted or customized this model?" />
            <span className="form-hint">
              The artist who painted/finished this model (if different from sculptor).
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">📋 Edition Info</label>
            <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
              <input type="number" className="form-input" placeholder="#"
                value={editionNumber} onChange={(e) => setEditionNumber(e.target.value)}
                style={{ width: 80 }} min="1" />
              <span style={{ color: "var(--color-text-muted)" }}>of</span>
              <input type="number" className="form-input" placeholder="Total"
                value={editionSize} onChange={(e) => setEditionSize(e.target.value)}
                style={{ width: 80 }} min="1" />
            </div>
            <span className="form-hint">e.g., &quot;3 of 50&quot; for limited edition runs.</span>
          </div>

          {/* Finish Type & Condition — model only */}
          {isModel && (
            <div className="edit-row">
              <div className="form-group">
                <label htmlFor="edit-finish" className="form-label">Finish Type *</label>
                <select id="edit-finish" className="form-select" value={finishType}
                  onChange={(e) => setFinishType(e.target.value as FinishType)}>
                  <option value="">Select finish type…</option>
                  <option value="OF">OF (Original Finish)</option>
                  <option value="Custom">Custom (Repaint / Body Mod)</option>
                  <option value="Artist Resin">Artist Resin</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit-condition" className="form-label">Condition Grade *</label>
                <select id="edit-condition" className="form-select" value={conditionGrade}
                  onChange={(e) => setConditionGrade(e.target.value)}>
                  <option value="">Select condition…</option>
                  {CONDITION_GRADES.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>

                {/* Condition Change Note - shows when condition was changed */}
                {originalCondition && conditionGrade && conditionGrade !== originalCondition && (
                  <div className="condition-change-note animate-fade-in-up" style={{ marginTop: "var(--space-sm)" }}>
                    <div style={{
                      fontSize: "calc(var(--font-size-xs) * var(--font-scale))",
                      color: "var(--color-accent-warning, #f59e0b)",
                      marginBottom: "var(--space-xs)",
                      fontWeight: 600,
                    }}>
                      📝 Condition changed: {originalCondition} → {conditionGrade}
                    </div>
                    <textarea
                      className="form-textarea"
                      rows={2}
                      maxLength={300}
                      placeholder="What happened? (optional — visible on Hoofprint™)"
                      value={conditionNote}
                      onChange={(e) => setConditionNote(e.target.value)}
                      style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}
                    />
                    <span className="form-hint">
                      e.g., &quot;Minor rub discovered on left hip during cleaning&quot;
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Life Stage — model only */}
          {isModel && (
            <div className="form-group">
              <label htmlFor="edit-life-stage" className="form-label">🐾 Life Stage</label>
              <select
                id="edit-life-stage"
                className="form-select"
                value={lifeStage}
                onChange={(e) => {
                  setLifeStage(e.target.value);
                  // Auto-create timeline event for stage changes
                  updateLifeStage(horseId, e.target.value as "blank" | "in_progress" | "completed" | "for_sale");
                }}
              >
                <option value="blank">🎨 Blank / Unpainted</option>
                <option value="in_progress">🔧 Work in Progress</option>
                <option value="completed">✅ Completed</option>
                <option value="for_sale">💲 For Sale</option>
              </select>
              <span className="form-hint">
                Changing this will add a stage update to the Hoofprint™ timeline.
              </span>
            </div>
          )}

          <CollectionPicker
            selectedCollectionId={selectedCollectionId}
            onSelect={setSelectedCollectionId}
          />

          {/* Marketplace Status */}
          <div className="form-group">
            <label htmlFor="edit-trade-status" className="form-label">Marketplace Status</label>
            <select id="edit-trade-status" className="form-select" value={tradeStatus}
              onChange={(e) => setTradeStatus(e.target.value)}>
              <option value="Not for Sale">Not for Sale</option>
              <option value="For Sale">For Sale</option>
              <option value="Open to Offers">Open to Offers</option>
            </select>
          </div>

          {/* Conditional marketplace fields */}
          {(tradeStatus === "For Sale" || tradeStatus === "Open to Offers") && (
            <div className="marketplace-fields animate-fade-in-up">
              <div className="form-group">
                <label htmlFor="edit-listing-price" className="form-label">💲 Listing Price ($)</label>
                <input id="edit-listing-price" type="number" className="form-input"
                  placeholder="0.00" min="0" step="0.01" value={listingPrice}
                  onChange={(e) => setListingPrice(e.target.value)} />
                <span className="form-hint">Optional — leave blank for &ldquo;Contact for price&rdquo;</span>
              </div>
              <div className="form-group">
                <label htmlFor="edit-marketplace-notes" className="form-label">📝 Seller Notes</label>
                <textarea id="edit-marketplace-notes" className="form-textarea" rows={3}
                  maxLength={500} placeholder="e.g. Will ship anywhere, Trades welcome..."
                  value={marketplaceNotes} onChange={(e) => setMarketplaceNotes(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Community visibility toggle */}
        <div className="community-toggle-section">
          <div className="community-toggle-row">
            <div className="community-toggle-info">
              <span className="community-toggle-label">🏆 Show in Public Community Feed</span>
              <span className="community-toggle-hint">
                When enabled, this model appears in the Show Ring.
                Your financial data is always private.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              className={`toggle-switch ${isPublic ? "toggle-on" : "toggle-off"}`}
              onClick={() => setIsPublic(!isPublic)}
              id="edit-is-public-toggle"
            >
              <span className="toggle-knob" />
            </button>
          </div>
        </div>

        {/* ===== Section 2: Reference Link (Unified Search) ===== */}
        <div className="edit-section">
          <div className="edit-section-header">
            <div className="edit-section-icon">🔗</div>
            <h2>Reference Link</h2>
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
              setSelectedCatalogId(null);
              setSelectedCatalogItem(null);
              setCustomName(searchTerm);
            }}
          />
        </div>

        {/* ===== Section 3: Financial Vault ===== */}
        <div className="edit-section vault-section">
          <div className="vault-header">
            <div className="vault-icon">🔒</div>
            <div>
              <h2>Financial Vault</h2>
              <p>Optional — update purchase details and valuations</p>
            </div>
          </div>

          <div className="vault-privacy-notice" role="note">
            <span style={{ fontSize: "1.3em", flexShrink: 0, marginTop: "2px" }}>🛡️</span>
            <p>
              <strong>This data is encrypted and only visible to you.</strong> Protected by
              strict Row Level Security.
            </p>
          </div>

          <div className="vault-row">
            <div className="form-group">
              <label htmlFor="edit-price" className="form-label">Purchase Price ($)</label>
              <input id="edit-price" type="number" className="form-input" placeholder="0.00"
                min="0" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="edit-date" className="form-label">Purchase Date</label>
              <input id="edit-date" type="date" className="form-input" value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
          </div>

          <div className="vault-row">
            <div className="form-group">
              <label htmlFor="edit-value" className="form-label">Estimated Current Value ($)</label>
              <input id="edit-value" type="number" className="form-input" placeholder="0.00"
                min="0" step="0.01" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="edit-insurance" className="form-label">Insurance Notes</label>
              <input id="edit-insurance" type="text" className="form-input"
                placeholder="Policy number, coverage details, etc."
                value={insuranceNotes} onChange={(e) => setInsuranceNotes(e.target.value)} />
            </div>
          </div>
        </div>

        {/* ===== Actions ===== */}
        <div className="edit-actions">
          <Link href={`/stable/${horseId}`} className="btn btn-ghost" id="edit-cancel">
            Cancel
          </Link>
          <button className="btn btn-primary" onClick={handleSave}
            disabled={isSaving || !customName.trim() || !finishType || !conditionGrade}
            id="edit-save">
            {isSaving ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                {Object.keys(newFiles).length > 0 ? "Uploading…" : "Saving…"}
              </>
            ) : (
              <>✅ Save Changes</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
