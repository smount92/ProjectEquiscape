"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { FinishType, AngleProfile, AssetCategory } from "@/lib/types/database";
import UnifiedReferenceSearch from "@/components/UnifiedReferenceSearch";
import type { CatalogItem } from "@/app/actions/reference";
import CollectionPicker from "@/components/CollectionPicker";
import { compressImage, compressImageWithWatermark } from "@/lib/utils/imageCompression";
import { updateLifeStage } from "@/app/actions/hoofprint";
import { updateHorseAction, deleteHorseImageAction, finalizeHorseImages } from "@/app/actions/horse";
import { getProfile } from "@/app/actions/settings";
import { getHorseCollections, setHorseCollections } from "@/app/actions/collections";
import ImageCropModal from "@/components/ImageCropModal";
import { getPublicImageUrl } from "@/lib/utils/storage";

// ---- Types ----

interface VaultData {
  purchase_price: number | null;
  purchase_date: string | null;
  estimated_current_value: number | null;
  insurance_notes: string | null;
  purchase_date_text: string | null;
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
  { value: "Body Quality", label: "Body Quality — Suitable for customizing" },
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
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public");
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
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
  const [finishDetails, setFinishDetails] = useState("");
  const [publicNotes, setPublicNotes] = useState("");
  const [assignedBreed, setAssignedBreed] = useState("");
  const [assignedGender, setAssignedGender] = useState("");
  const [assignedAge, setAssignedAge] = useState("");
  const [regionalId, setRegionalId] = useState("");
  const [purchaseDateText, setPurchaseDateText] = useState("");

  // Multi-angle image management
  const [existingImages, setExistingImages] = useState<Partial<Record<AngleProfile, ExistingImage>>>({});
  const [newFiles, setNewFiles] = useState<Partial<Record<AngleProfile, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<AngleProfile, string>>>({});
  const [draggingAngle, setDraggingAngle] = useState<AngleProfile | null>(null);
  const fileInputRefs = useRef<Partial<Record<AngleProfile, HTMLInputElement>>>({});

  // Extra detail images (unlimited)
  const [existingExtras, setExistingExtras] = useState<ExistingImage[]>([]);
  const [newExtraFiles, setNewExtraFiles] = useState<{ file: File; previewUrl: string }[]>([]);
  const [dragExtraIdx, setDragExtraIdx] = useState<number | null>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);

  // Deferred image deletions (only executed on save)
  const [pendingImageDeletes, setPendingImageDeletes] = useState<{ recordId: string, path: string | null }[]>([]);

  // Crop modal state
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropAngle, setCropAngle] = useState<AngleProfile | null>(null);
  const [extraCropQueue, setExtraCropQueue] = useState<File[]>([]);
  const [isCroppingExtra, setIsCroppingExtra] = useState(false);
  const [reCropExtraIdx, setReCropExtraIdx] = useState<number | null>(null);

  // Watermark preference
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [userAlias, setUserAlias] = useState("");

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
        .select("id, owner_id, custom_name, sculptor, finishing_artist, edition_number, edition_size, finish_type, condition_grade, is_public, visibility, collection_id, catalog_id, trade_status, listing_price, marketplace_notes, life_stage, asset_category, finish_details, public_notes, assigned_breed, assigned_gender, assigned_age, regional_id")
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
          visibility: string | null;
          collection_id: string | null;
          catalog_id: string | null;
          trade_status: string;
          listing_price: number | null;
          marketplace_notes: string | null;
          life_stage: string | null;
          asset_category: AssetCategory | null;
          finish_details: string | null;
          public_notes: string | null;
          assigned_breed: string | null;
          assigned_gender: string | null;
          assigned_age: string | null;
          regional_id: string | null;
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
      // Map visibility from DB (fallback to is_public for pre-migration data)
      const vis = horse.visibility as "public" | "unlisted" | "private" | null;
      if (vis) {
        setVisibility(vis);
      } else {
        setVisibility(horse.is_public ? "public" : "private");
      }
      // Load collection IDs from junction table
      getHorseCollections(horseId).then(ids => {
        if (ids.length > 0) {
          setSelectedCollectionIds(ids);
        } else if (horse.collection_id) {
          // Fallback to legacy FK
          setSelectedCollectionIds([horse.collection_id]);
        }
      });
      setTradeStatus(horse.trade_status || "Not for Sale");
      if (horse.listing_price !== null) setListingPrice(String(horse.listing_price));
      setMarketplaceNotes(horse.marketplace_notes || "");
      setLifeStage(horse.life_stage || "completed");
      setFinishDetails(horse.finish_details || "");
      setPublicNotes(horse.public_notes || "");
      setAssignedBreed(horse.assigned_breed || "");
      setAssignedGender(horse.assigned_gender || "");
      setAssignedAge(horse.assigned_age || "");
      setRegionalId(horse.regional_id || "");

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
        .select("purchase_price, purchase_date, estimated_current_value, insurance_notes, purchase_date_text")
        .eq("horse_id", horseId)
        .single<VaultData>();

      if (vault) {
        setHasExistingVault(true);
        if (vault.purchase_price !== null) setPurchasePrice(String(vault.purchase_price));
        if (vault.purchase_date !== null) setPurchaseDate(vault.purchase_date);
        if (vault.estimated_current_value !== null) setEstimatedValue(String(vault.estimated_current_value));
        if (vault.insurance_notes !== null) setInsuranceNotes(vault.insurance_notes);
        if (vault.purchase_date_text !== null) setPurchaseDateText(vault.purchase_date_text);
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
          previewMap[img.angle_profile] = getPublicImageUrl(img.image_url);
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
              imageUrl: getPublicImageUrl(img.image_url),
              storagePath: urlParts.length > 1 ? urlParts[1] : null,
            };
          });
        setExistingExtras(extras);
      }

      setIsLoading(false);
    }

    loadHorse();
    // Fetch watermark preference
    getProfile().then((profile) => {
      if (profile) {
        setWatermarkEnabled(profile.watermarkPhotos);
        setUserAlias(profile.aliasName);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horseId]);



  // ---- Photo Studio handlers ----
  const handleSlotSelect = (angle: AngleProfile, file: File) => {
    if (!file.type.startsWith("image/")) return;
    // Open crop modal instead of directly setting
    setCropFile(file);
    setCropAngle(angle);
  };

  const handleCropComplete = (croppedFile: File) => {
    // Re-cropping an existing new extra
    if (reCropExtraIdx !== null) {
      const oldUrl = newExtraFiles[reCropExtraIdx]?.previewUrl;
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      setNewExtraFiles(prev => prev.map((ef, i) => i === reCropExtraIdx ? { file: croppedFile, previewUrl: URL.createObjectURL(croppedFile) } : ef));
      setReCropExtraIdx(null);
      setCropFile(null);
      return;
    }

    // Cropping an extra from the queue
    if (isCroppingExtra) {
      const previewUrl = URL.createObjectURL(croppedFile);
      setNewExtraFiles(prev => [...prev, { file: croppedFile, previewUrl }]);
      setCropFile(null);
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
    setNewFiles((prev) => ({ ...prev, [cropAngle]: croppedFile }));
    const reader = new FileReader();
    reader.onloadend = () => setPreviews((prev) => ({ ...prev, [cropAngle]: reader.result as string }));
    reader.readAsDataURL(croppedFile);
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
        is_public: visibility === "public" || visibility === "unlisted",
        visibility,
        trade_status: tradeStatus,
        listing_price: tradeStatus !== "Not for Sale" && listingPrice ? parseFloat(listingPrice) : null,
        marketplace_notes: tradeStatus !== "Not for Sale" && marketplaceNotes.trim() ? marketplaceNotes.trim() : null,
        collection_id: selectedCollectionIds[0] || null,
        catalog_id: selectedCatalogId,
        life_stage: isModel ? lifeStage : null,
        finish_details: finishDetails.trim() || null,
        public_notes: publicNotes.trim() || null,
        assigned_breed: assignedBreed.trim() || null,
        assigned_gender: assignedGender.trim() || null,
        assigned_age: assignedAge.trim() || null,
        regional_id: regionalId.trim() || null,
      };

      const hasVaultData = purchasePrice || purchaseDate || estimatedValue || insuranceNotes || purchaseDateText;
      const vaultData: Record<string, unknown> | null = hasVaultData ? {
        purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
        purchase_date: purchaseDate || null,
        estimated_current_value: estimatedValue ? parseFloat(estimatedValue) : null,
        insurance_notes: insuranceNotes || null,
        purchase_date_text: purchaseDateText.trim() || null,
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

      // Update multi-collection assignments via junction table
      await setHorseCollections(horseId, selectedCollectionIds);

      // Process deferred image deletions (only now that save succeeded)
      for (const del of pendingImageDeletes) {
        await deleteHorseImageAction(del.recordId, del.path);
      }

      // Step 2: Upload NEW images directly from browser → Supabase Storage
      const uploadedImages: { path: string; angle: string }[] = [];
      const uploadErrors: string[] = [];

      for (const slot of PHOTO_STUDIO_SLOTS) {
        const angle = slot.angle;
        if (newFiles[angle]) {
          const compressed = watermarkEnabled && userAlias
            ? await compressImageWithWatermark(newFiles[angle], userAlias)
            : await compressImage(newFiles[angle]);

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

          if (uploadError) {
            console.error(`Upload failed for ${angle}:`, uploadError);
            uploadErrors.push(`${slot.label}: ${uploadError.message}`);
          } else {
            uploadedImages.push({ path: filePath, angle });
          }
        }
      }

      // Upload new extra detail images
      for (let i = 0; i < newExtraFiles.length; i++) {
        const compressed = watermarkEnabled && userAlias
          ? await compressImageWithWatermark(newExtraFiles[i].file, userAlias)
          : await compressImage(newExtraFiles[i].file);
        const filePath = `horses/${horseId}/extra_detail_${Date.now()}_${i}.webp`;
        const { error: uploadError } = await supabase.storage
          .from("horse-images")
          .upload(filePath, compressed, { contentType: "image/webp" });

        if (uploadError) {
          console.error(`Upload failed for extra detail ${i}:`, uploadError);
          uploadErrors.push(`Extra photo ${i + 1}: ${uploadError.message}`);
        } else {
          uploadedImages.push({ path: filePath, angle: "extra_detail" });
        }
      }

      // Step 3: Finalize image metadata on server
      if (uploadedImages.length > 0) {
        const finalizeResult = await finalizeHorseImages(horseId, uploadedImages);
        if (!finalizeResult.success) {
          console.error("Finalize failed:", finalizeResult.error);
          uploadErrors.push(`Save failed: ${finalizeResult.error || "Unknown error"}`);
        }
      }

      // Show upload errors but still redirect (text fields saved successfully)
      if (uploadErrors.length > 0) {
        console.error("Photo upload errors:", uploadErrors);
        // Don't block — text data saved, show partial-success toast
      }

      // Activity event if public
      if (visibility === "public") {
        // Count total photos: remaining existing (minus pending deletes) + newly uploaded
        const remainingExisting = Object.keys(existingImages).length
          + existingExtras.length
          - pendingImageDeletes.length;
        const totalPhotos = Math.max(0, remainingExisting) + uploadedImages.length;

        import("@/app/actions/horse-events").then((m) => {
          m.notifyHorsePublic({
            userId: user.id,
            horseId,
            horseName: customName.trim(),
            finishType: finishType as string,
            tradeStatus: tradeStatus as string,
            catalogId: selectedCatalogId || null,
            photoCount: totalPhotos,
          });
        }).catch(() => { });
      }

      // ⚡ REMOVED: addTimelineEvent for listed status — now derived from view

      // Redirect — use Next.js router instead of window.location for serverless safety
      const uploadCount = uploadedImages.length;
      const hadNewPhotos = Object.keys(newFiles).length > 0 || newExtraFiles.length > 0;
      let toastParam = "updated";
      if (uploadErrors.length > 0) {
        toastParam = "photo_error";
      } else if (uploadCount > 0) {
        toastParam = "photos_updated";
      }
      router.push(`/dashboard?toast=${toastParam}&name=${encodeURIComponent(customName.trim())}&photos=${uploadCount}&expected=${hadNewPhotos ? Object.keys(newFiles).length + newExtraFiles.length : 0}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  // ---- RENDER ----

  if (isLoading) {
    return (
      <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6 py-12 px-[0]">
        <div className="py-12 px-[0] max-w-[680px] mx-auto" style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
          <div className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-spinner" style={{ width: 36, height: 36, margin: "0 auto var(--space-lg)", borderWidth: 3, borderColor: "var(--color-border)", borderTopColor: "var(--color-accent-primary)" }} />
          <p>Loading horse details…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6 py-12 px-[0]">
        <div className="text-center py-[var(--space-3xl)] px-8 bg-card border border-edge rounded-lg p-12 shadow-md transition-all">
          <div className="text-center py-[var(--space-3xl)] px-8-icon">🚫</div>
          <h1>Access Denied</h1>
          <p>{error}</p>
          <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm">Back to Stable</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6 py-12 px-[0]">
      <nav className="flex items-center gap-2 mb-6 text-sm text-muted animate-fade-in-up" aria-label="Breadcrumb">
        <Link href="/dashboard">Digital Stable</Link>
        <span className="separator" aria-hidden="true">/</span>
        <Link href={`/stable/${horseId}`}>{customName}</Link>
        <span className="separator" aria-hidden="true">/</span>
        <span>Edit</span>
      </nav>

      <div className="py-12 px-[0] max-w-[680px] mx-auto animate-fade-in-up">
        <h1 style={{ marginBottom: "var(--space-xl)" }}>
          Edit <span className="text-forest">{customName}</span>
        </h1>

        {saveError && (
          <div className="flex items-center gap-2 mt-2 py-2 px-4 bg-[rgba(240,108,126,0.1)] border border-[rgba(240,108,126,0.3)] rounded-md text-danger text-sm" role="alert" style={{ marginBottom: "var(--space-xl)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {saveError}
          </div>
        )}

        {/* ===== Photo Studio ===== */}
        <div className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 mb-8">
          <div className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 mb-8-sticky top-0 z-[100] h-[var(--header-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">
            <div className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 mb-8-icon">📸</div>
            <h2>Photo Studio</h2>
          </div>
          <p style={{ color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))", marginBottom: "var(--space-md)" }}>
            Upload up to 4 standardized angles. The primary photo is used as the thumbnail everywhere.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {PHOTO_STUDIO_SLOTS.map((slot) => {
              const preview = previews[slot.angle];
              const hasNew = !!newFiles[slot.angle];
              const isDrag = draggingAngle === slot.angle;

              return (
                <div key={slot.angle} className="flex flex-col">
                  <div className="flex items-center gap-1 mb-1 text-sm font-semibold text-ink">
                    {slot.label}
                    {slot.primary && <span className="text-xs font-bold text-[#2C5545] bg-[rgba(44, 85, 69, 0.1)] py-[2px] px-[8px] rounded-full">Required</span>}
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
                      <div className="relative w-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preview} alt={slot.label} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[rgba(0,0,0,0.6)] opacity-[0] transition-all text-white text-sm font-medium">
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
                      <div className="flex flex-col items-center gap-2 p-8 text-muted">
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
                      className="inline-flex items-center gap-[4px] mt-2 py-[6px] px-[14px] bg-[rgba(251,146,60,0.1)] border border-[rgba(251,146,60,0.3)] rounded-full text-[#fb923c] text-xs font-semibold cursor-pointer font-[inherit] transition-all hover:0.2)] hover:0.5)]"
                      onClick={(e) => { e.stopPropagation(); handleSlotRevert(slot.angle); }}
                    >
                      ↩ Revert
                    </button>
                  )}
                  {!hasNew && preview && !slot.primary && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-[4px] mt-2 py-[6px] px-[14px] bg-[rgba(251,146,60,0.1)] border border-[rgba(251,146,60,0.3)] rounded-full text-[#fb923c] text-xs font-semibold cursor-pointer font-[inherit] transition-all hover:0.2)] hover:0.5)]"
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
          <div className="mt-6 border-t border-edge pt-6">
            <div className="flex items-center gap-1 mb-1 text-sm font-semibold text-ink" style={{ marginBottom: "var(--space-xs)" }}>
              Extra Details & Flaws
              <span style={{ fontWeight: 400, color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-xs) * var(--font-scale))" }}>{existingExtras.length + newExtraFiles.length}/10</span>
            </div>
            <div
              className="opacity-[0.4]"
              onClick={() => extraInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
                if (existingExtras.length + newExtraFiles.length + files.length > 10) {
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
                  if (existingExtras.length + newExtraFiles.length + files.length > 10) {
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
              <span>Upload up to 10 · Click or drag files here</span>
            </div>

            {/* Existing extras — drag to reorder */}
            {(existingExtras.length > 0 || newExtraFiles.length > 0) && (
              <div className="flex flex-wrap gap-2 mt-4">
                {existingExtras.map((ex, idx) => (
                  <div
                    key={ex.recordId}
                    className={`extras-preview-item group cursor-grab ${dragExtraIdx === idx ? "opacity-40 outline-2 outline-dashed outline-accent-primary" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      setDragExtraIdx(idx);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      if (dragExtraIdx === null || dragExtraIdx === idx) return;
                      const reordered = [...existingExtras];
                      const [moved] = reordered.splice(dragExtraIdx, 1);
                      reordered.splice(idx, 0, moved);
                      setExistingExtras(reordered);
                      setDragExtraIdx(null);
                      // Persist reorder
                      const { reorderHorseImages } = await import("@/app/actions/horse");
                      await reorderHorseImages(horseId, reordered.map(r => r.recordId));
                    }}
                    onDragEnd={() => setDragExtraIdx(null)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ex.imageUrl} alt="Extra detail" />
                    <div className="absolute top-1 right-7 bg-black/50 text-white w-5.5 h-5.5 rounded-sm flex items-center justify-center text-xs cursor-grab opacity-0 group-hover:opacity-100 transition-opacity z-[3]" title="Drag to reorder">⠇</div>
                    <button
                      className="absolute top-[6px] right-[6px] w-[28px] h-[28px] rounded-full bg-[rgba(0, 0, 0, 0.7)] text-white border-0 cursor-pointer flex items-center justify-center text-[0.85rem] z-[2] transition-colors"
                      onClick={async (e) => {
                        e.stopPropagation();
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
                  <div key={`new-${i}`} className="relative w-[100px] h-[100px] rounded-md overflow-hidden border border-edge">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ef.previewUrl} alt={`New extra ${i + 1}`} />
                    <button
                      className="absolute top-[6px] right-[6px] w-[28px] h-[28px] rounded-full bg-[rgba(0, 0, 0, 0.7)] text-white border-0 cursor-pointer flex items-center justify-center text-[0.85rem] z-[2] transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        URL.revokeObjectURL(ef.previewUrl);
                        setNewExtraFiles(prev => prev.filter((_, idx) => idx !== i));
                      }}
                      aria-label={`Remove new extra ${i + 1}`}
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
        </div>

        {/* ===== Section 1: Identity ===== */}
        <div className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 mb-8">
          <div className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 mb-8-sticky top-0 z-[100] h-[var(--header-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">
            <div className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 mb-8-icon">🏷️</div>
            <h2>Model Identity</h2>
          </div>

          <div className="mb-6">
            <label htmlFor="edit-name" className="block text-sm font-semibold text-ink mb-1">Custom Name *</label>
            <input id="edit-name" type="text" className="form-input" value={customName}
              onChange={(e) => setCustomName(e.target.value)} maxLength={100} />
          </div>

          <div className="mb-6">
            <label htmlFor="edit-sculptor" className="block text-sm font-semibold text-ink mb-1">Sculptor / Artist</label>
            <input id="edit-sculptor" type="text" className="form-input" value={sculptor}
              onChange={(e) => setSculptor(e.target.value)} maxLength={100}
              placeholder="e.g. Sarah Rose, Brigitte Eberl…" />
            <span className="block mt-1 text-xs text-muted">
              Optional — tag the sculptor or artist, especially for Artist Resins or custom work.
            </span>
          </div>

          <div className="mb-6">
            <label htmlFor="edit-finishing-artist" className="block text-sm font-semibold text-ink mb-1">🎨 Finishing Artist</label>
            <input id="edit-finishing-artist" type="text" className="form-input" value={finishingArtist}
              onChange={(e) => setFinishingArtist(e.target.value)} maxLength={100}
              placeholder="Who painted or customized this model?" />
            <span className="block mt-1 text-xs text-muted">
              The artist who painted/finished this model (if different from sculptor).
            </span>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-ink mb-1">📋 Edition Info</label>
            <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
              <input type="number" className="form-input" placeholder="#"
                value={editionNumber} onChange={(e) => setEditionNumber(e.target.value)}
                style={{ width: 80 }} min="1" />
              <span style={{ color: "var(--color-text-muted)" }}>of</span>
              <input type="number" className="form-input" placeholder="Total"
                value={editionSize} onChange={(e) => setEditionSize(e.target.value)}
                style={{ width: 80 }} min="1" />
            </div>
            <span className="block mt-1 text-xs text-muted">e.g., &quot;3 of 50&quot; for limited edition runs.</span>
          </div>

          {/* Finish Details */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-ink mb-1">Finish Details</label>
            <input className="form-input" type="text" value={finishDetails}
              onChange={(e) => setFinishDetails(e.target.value)}
              placeholder="e.g. Glossy, Matte, Satin, Chalky" maxLength={100} id="edit-finish-details" />
          </div>

          {/* Public Notes */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-ink mb-1">Public Notes</label>
            <textarea className="block w-full min-h-[var(--inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-min-h)] py-2 px-4 font-sans text-base text-ink bg-input border border-edge-input rounded-md outline-none transition-all duration-150" value={publicNotes}
              onChange={(e) => setPublicNotes(e.target.value)}
              placeholder="Visible on your passport — e.g. comes with original box, factory rubs on near leg"
              maxLength={500} rows={2} id="edit-public-notes" />
            <small style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
              These notes will be visible to anyone viewing this horse&apos;s passport.
            </small>
          </div>

          {/* Show Bio */}
          <div className="flex items-center gap-4 m-[var(--space-xl) 0] text-muted text-sm" style={{ margin: "var(--space-lg) 0 var(--space-md)" }}>
            <h4 style={{ fontSize: "var(--font-size-md)", fontWeight: 600, color: "var(--color-text-secondary)" }}>
              🏅 Show Bio <span style={{ fontWeight: 400, fontSize: "var(--font-size-sm)" }}>(Optional)</span>
            </h4>
            <small style={{ color: "var(--color-text-muted)", display: "block", marginTop: "var(--space-xs)" }}>
              The show identity you assign for competition — breed, gender, and age for show ring divisions.
            </small>
          </div>
          <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap" }}>
            <div className="mb-6" style={{ flex: "1 1 200px" }}>
              <label className="block text-sm font-semibold text-ink mb-1">Assigned Breed</label>
              <input className="form-input" type="text" value={assignedBreed}
                onChange={(e) => setAssignedBreed(e.target.value)}
                placeholder="e.g. Andalusian, Arabian" maxLength={100} id="edit-assigned-breed" />
            </div>
            <div className="mb-6" style={{ flex: "1 1 150px" }}>
              <label className="block text-sm font-semibold text-ink mb-1">Assigned Gender</label>
              <select className="form-select" value={assignedGender}
                onChange={(e) => setAssignedGender(e.target.value)} id="edit-assigned-gender">
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
          <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap" }}>
            <div className="mb-6" style={{ flex: "1 1 150px" }}>
              <label className="block text-sm font-semibold text-ink mb-1">Assigned Age</label>
              <input className="form-input" type="text" value={assignedAge}
                onChange={(e) => setAssignedAge(e.target.value)}
                placeholder="e.g. Foal, Yearling, Adult" maxLength={50} id="edit-assigned-age" />
            </div>
            <div className="mb-6" style={{ flex: "1 1 200px" }}>
              <label className="block text-sm font-semibold text-ink mb-1">Regional Show ID</label>
              <input className="form-input" type="text" value={regionalId}
                onChange={(e) => setRegionalId(e.target.value)}
                placeholder="e.g. RX number, Texas System ID" maxLength={50} id="edit-regional-id" />
            </div>
          </div>

          {/* Finish Type & Condition — model only */}
          {isModel && (
            <div className="grid grid-cols-2 gap-6">
              <div className="mb-6">
                <label htmlFor="edit-finish" className="block text-sm font-semibold text-ink mb-1">Finish Type *</label>
                <select id="edit-finish" className="form-select" value={finishType}
                  onChange={(e) => setFinishType(e.target.value as FinishType)}>
                  <option value="">Select finish type…</option>
                  <option value="OF">OF (Original Finish)</option>
                  <option value="Custom">Custom (Repaint / Body Mod)</option>
                  <option value="Artist Resin">Artist Resin</option>
                </select>
              </div>

              <div className="mb-6">
                <label htmlFor="edit-condition" className="block text-sm font-semibold text-ink mb-1">Condition Grade *</label>
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
                      className="block w-full min-h-[var(--inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-min-h)] py-2 px-4 font-sans text-base text-ink bg-input border border-edge-input rounded-md outline-none transition-all duration-150"
                      rows={2}
                      maxLength={300}
                      placeholder="What happened? (optional — visible on Hoofprint™)"
                      value={conditionNote}
                      onChange={(e) => setConditionNote(e.target.value)}
                      style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}
                    />
                    <span className="block mt-1 text-xs text-muted">
                      e.g., &quot;Minor rub discovered on left hip during cleaning&quot;
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Life Stage — model only */}
          {isModel && (
            <div className="mb-6">
              <label htmlFor="edit-life-stage" className="block text-sm font-semibold text-ink mb-1">🐾 Life Stage</label>
              <select
                id="edit-life-stage"
                className="form-select"
                value={lifeStage}
                onChange={(e) => {
                  setLifeStage(e.target.value);
                  // Auto-create timeline event for stage changes
                  updateLifeStage(horseId, e.target.value as "blank" | "stripped" | "in_progress" | "completed" | "for_sale");
                }}
              >
                <option value="blank">🎨 Blank / Unpainted</option>
                <option value="stripped">🛁 Stripped / Body</option>
                <option value="in_progress">🔧 Work in Progress</option>
                <option value="completed">✅ Completed</option>
                <option value="for_sale">💲 For Sale</option>
              </select>
              <span className="block mt-1 text-xs text-muted">
                Changing this will add a stage update to the Hoofprint™ timeline.
              </span>
            </div>
          )}

          <CollectionPicker
            selectedCollectionIds={selectedCollectionIds}
            onSelect={setSelectedCollectionIds}
          />

          {/* Marketplace Status */}
          <div className="mb-6">
            <label htmlFor="edit-trade-status" className="block text-sm font-semibold text-ink mb-1">Marketplace Status</label>
            <select id="edit-trade-status" className="form-select" value={tradeStatus}
              onChange={(e) => setTradeStatus(e.target.value)}>
              <option value="Not for Sale">Not for Sale</option>
              <option value="For Sale">For Sale</option>
              <option value="Open to Offers">Open to Offers</option>
              <option value="Stolen/Missing">🚨 Stolen/Missing</option>
            </select>
          </div>

          {/* Conditional marketplace fields */}
          {(tradeStatus === "For Sale" || tradeStatus === "Open to Offers") && (
            <div className="mt-4 p-4 bg-[rgba(34, 197, 94, 0.05)] border border-[rgba(34, 197, 94, 0.15)] rounded-md animate-fade-in-up">
              <div className="mb-6">
                <label htmlFor="edit-listing-price" className="block text-sm font-semibold text-ink mb-1">💲 Listing Price</label>
                <input id="edit-listing-price" type="number" className="form-input"
                  placeholder="0.00" min="0" step="0.01" value={listingPrice}
                  onChange={(e) => setListingPrice(e.target.value)} />
                <span className="block mt-1 text-xs text-muted">Optional — leave blank for &ldquo;Contact for price&rdquo;</span>
              </div>
              <div className="mb-6">
                <label htmlFor="edit-marketplace-notes" className="block text-sm font-semibold text-ink mb-1">📝 Seller Notes</label>
                <textarea id="edit-marketplace-notes" className="block w-full min-h-[var(--inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-min-h)] py-2 px-4 font-sans text-base text-ink bg-input border border-edge-input rounded-md outline-none transition-all duration-150" rows={3}
                  maxLength={500} placeholder="e.g. Will ship anywhere, Trades welcome..."
                  value={marketplaceNotes} onChange={(e) => setMarketplaceNotes(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Community visibility selector */}
        <div className="mt-6 py-4 px-6 rounded-lg bg-[rgba(44, 85, 69, 0.04)] border border-[rgba(44, 85, 69, 0.12)]">
          <div className="flex items-center justify-between gap-6" style={{ flexDirection: "column", gap: "var(--space-sm)" }}>
            <span className="text-[calc(var(--font-size-md)*var(--font-scale))] font-semibold text-ink">👁️ Visibility</span>
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
                  id={`edit-visibility-${opt.value}`}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <span className="font-semibold text-sm">{opt.label}</span>
                  <span className="text-xs text-muted text-center">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ===== Section 2: Reference Link (Unified Search) ===== */}
        <div className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 mb-8">
          <div className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 mb-8-sticky top-0 z-[100] h-[var(--header-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">
            <div className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 mb-8-icon">🔗</div>
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
        <div className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 mb-8 relative overflow-hidden">
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-[rgba(240, 160, 108, 0.2)]">
            <div className="vault-icon">🔒</div>
            <div>
              <h2>Financial Vault</h2>
              <p>Optional — update purchase details and valuations</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-4 bg-[rgba(240, 160, 108, 0.08)] border border-[rgba(240, 160, 108, 0.2)] rounded-md mb-8" role="note">
            <span style={{ fontSize: "1.3em", flexShrink: 0, marginTop: "2px" }}>🛡️</span>
            <p>
              <strong>This data is encrypted and only visible to you.</strong> Protected by
              strict Row Level Security.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="mb-6">
              <label htmlFor="edit-price" className="block text-sm font-semibold text-ink mb-1">Purchase Price</label>
              <input id="edit-price" type="number" className="form-input" placeholder="0.00"
                min="0" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
            </div>
            <div className="mb-6">
              <label htmlFor="edit-date" className="block text-sm font-semibold text-ink mb-1">Purchase Date</label>
              <input id="edit-date" type="date" className="form-input" value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
          </div>

          {/* Fuzzy Purchase Date */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-ink mb-1">Approximate Purchase Date</label>
            <input className="form-input" type="text" value={purchaseDateText}
              onChange={(e) => setPurchaseDateText(e.target.value)}
              placeholder="e.g. BreyerFest 2017, Summer 2015" id="edit-purchase-date-text" />
            <small style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
              Use this when you don&apos;t remember the exact date.
            </small>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="mb-6">
              <label htmlFor="edit-value" className="block text-sm font-semibold text-ink mb-1">Estimated Current Value</label>
              <input id="edit-value" type="number" className="form-input" placeholder="0.00"
                min="0" step="0.01" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} />
            </div>
            <div className="mb-6">
              <label htmlFor="edit-insurance" className="block text-sm font-semibold text-ink mb-1">Insurance Notes</label>
              <input id="edit-insurance" type="text" className="form-input"
                placeholder="Policy number, coverage details, etc."
                value={insuranceNotes} onChange={(e) => setInsuranceNotes(e.target.value)} />
            </div>
          </div>
        </div>

        {/* ===== Actions ===== */}
        <div className="flex gap-4 justify-end">
          <Link href={`/stable/${horseId}`} className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" id="edit-cancel">
            Cancel
          </Link>
          <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm" onClick={handleSave}
            disabled={isSaving || !customName.trim() || !finishType || !conditionGrade}
            id="edit-save">
            {isSaving ? (
              <>
                <span className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-spinner" aria-hidden="true" />
                {Object.keys(newFiles).length > 0 ? "Uploading…" : "Saving…"}
              </>
            ) : (
              <>✅ Save Changes</>
            )}
          </button>
        </div>
      </div>

      {/* ── Image Crop Modal ── */}
      {cropFile && (
        <ImageCropModal
          file={cropFile}
          onCrop={handleCropComplete}
          onCancel={() => {
            setCropFile(null);
            setCropAngle(null);
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
    </div>
  );
}
