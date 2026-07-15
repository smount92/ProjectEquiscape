"use client";

import { useState, useEffect, useRef } from"react";
import { useRouter, useSearchParams } from"next/navigation";
import Link from"next/link";
import { createClient } from"@/lib/supabase/client";
import {
 compressImage,
 compressImageWithWatermark,
 validateImageFile,
 createImagePreviewUrl,
 revokeImagePreviewUrl,
 generateThumbnail,
} from"@/lib/utils/imageCompression";
import type { UserTier } from"@/lib/utils/imageCompression";
import type { AngleProfile, FinishType, AssetCategory } from"@/lib/types/database";
import UnifiedReferenceSearch from"@/components/UnifiedReferenceSearch";
import type { CatalogItem } from"@/app/actions/reference";
import { getCatalogItem } from"@/app/actions/reference";
import CollectionPicker from"@/components/CollectionPicker";
import { notifyHorsePublic } from"@/app/actions/horse-events";
import { initializeHoofprint } from"@/app/actions/hoofprint";
import { createHorseRecord, finalizeHorseImages, getMyTier } from"@/app/actions/horse";
import { getProfile } from"@/app/actions/settings";
import { setHorseCollections } from"@/app/actions/collections";
import ImageCropModal from"@/components/ImageCropModal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import FocusLayout from"@/components/layouts/FocusLayout";
import PageMasthead from"@/components/layouts/PageMasthead";
import { getGallerySlots, getSteps, isFieldVisible, getFieldLabel, getAssetConfig, validateAttributes } from "@/lib/config/assetFields";
import TackFormFields from "@/components/forms/TackFormFields";
import PropFormFields from "@/components/forms/PropFormFields";
import DioramaFormFields from "@/components/forms/DioramaFormFields";
import OtherModelFormFields from "@/components/forms/OtherModelFormFields";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { Camera, Link2, Tag } from "lucide-react";

// ---- Constants ----

const CONDITION_GRADES = [
 { value:"Mint", label:"Mint — Flawless, like new" },
 { value:"Near Mint", label:"Near Mint — Minimal handling wear" },
 { value:"Excellent", label:"Excellent — Very light wear, no breaks" },
 { value:"Very Good", label:"Very Good — Minor rubs or scuffs" },
 { value:"Good", label:"Good — Noticeable wear, still displays well" },
 { value:"Body Quality", label:"Body Quality — Suitable for customizing" },
 { value:"Fair", label:"Fair — Visible flaws, repairs, or damage" },
 { value:"Poor", label:"Poor — Significant damage or missing parts" },
];

// ---- Types ----

interface ImageSlot {
 file: File;
 previewUrl: string;
}

// ---- Component ----

export default function AddHorsePage() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const supabase = createClient();

 // Step management
 const [currentStep, setCurrentStep] = useState(0);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const isSubmittingRef = useRef(false);
 const [submitError, setSubmitError] = useState<string | null>(null);
 const [showSuccess, setShowSuccess] = useState(false);
 const [savedHorseName, setSavedHorseName] = useState("");
 const [newHorseId, setNewHorseId] = useState<string | null>(null);
 // Non-fatal photo problem discovered during finalize — the horse
 // saved, so this renders as a warning on the success screen.
 const [photoWarning, setPhotoWarning] = useState<string | null>(null);
 // Viewer tier gates the Pro-only extra-detail dropzone honestly.
 const [viewerTier, setViewerTier] = useState<string | null>(null);
 useEffect(() => {
 getMyTier().then(setViewerTier).catch(() => setViewerTier(null));
 }, []);

 // Validation feedback
 const [validationErrors, setValidationErrors] = useState<string[]>([]);
 const [shakeFields, setShakeFields] = useState(false);

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

 // Step 2 (index 1): Reference
 const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
 const [selectedCatalogItem, setSelectedCatalogItem] = useState<CatalogItem | null>(null);
 const [nameAutoFilled, setNameAutoFilled] = useState(false);

 // Step 3 (index 2): Identity
 const [customName, setCustomName] = useState("");
 const [sculptor, setSculptor] = useState("");
 const [finishingArtist, setFinishingArtist] = useState("");
 const [editionNumber, setEditionNumber] = useState("");
 const [editionSize, setEditionSize] = useState("");
 const [finishType, setFinishType] = useState<FinishType |"">("");
 const [conditionGrade, setConditionGrade] = useState("");
 const [visibility, setVisibility] = useState<"public" |"unlisted" |"private">("public");
 const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
 const [tradeStatus, setTradeStatus] = useState("Not for Sale");
 const [listingPrice, setListingPrice] = useState("");
 const [marketplaceNotes, setMarketplaceNotes] = useState("");
 const [lifeStage, setLifeStage] = useState("completed");
 const [assetCategory, setAssetCategory] = useState<AssetCategory>("model");

 // Category-specific attributes (stored in JSONB)
 const [tackType, setTackType] = useState("");
 const [discipline, setDiscipline] = useState("");
 const [attrMaterials, setAttrMaterials] = useState<string[]>([]);
 const [fitsMolds, setFitsMolds] = useState("");
 const [workingParts, setWorkingParts] = useState<string[]>([]);
 const [propCategory, setPropCategory] = useState("");
 const [dimensions, setDimensions] = useState("");
 const [terrainSetting, setTerrainSetting] = useState("");
 const [sceneTheme, setSceneTheme] = useState("");
 const [dioComponents, setDioComponents] = useState("");
 const [baseDimensions, setBaseDimensions] = useState("");
 const [documentationNotes, setDocumentationNotes] = useState("");
 const [species, setSpecies] = useState("");
 const [otherBreed, setOtherBreed] = useState("");
 const [manufacturer, setManufacturer] = useState("");
 const [modelNumber, setModelNumber] = useState("");

 // Watermark preference
 const [watermarkEnabled, setWatermarkEnabled] = useState(false);
 const [userAlias, setUserAlias] = useState("");
 const [userWatermarkText, setUserWatermarkText] = useState("");

 // User tier for compression quality
 const [userTier, setUserTier] = useState<UserTier>("free");

 const isModel = assetCategory ==="model";
 const isModelLike = assetCategory === "model" || assetCategory === "other_model";

 // Dynamic config from shared assetFields
 const activeConfig = getAssetConfig(assetCategory);
 const activeGallerySlots = getGallerySlots(assetCategory);
 const activeSteps = getSteps(assetCategory);

 // Step 4 (index 3): Financial Vault
 const [purchasePrice, setPurchasePrice] = useState("");
 const [purchaseDate, setPurchaseDate] = useState("");
 const [estimatedValue, setEstimatedValue] = useState("");
 const [insuranceNotes, setInsuranceNotes] = useState("");
 const [isTrade, setIsTrade] = useState(false);

 useEffect(() => {
   if (isTrade) {
     setPurchasePrice("");
     setEstimatedValue("");
   }
 }, [isTrade]);
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

 // Preselect a catalog reference from ?catalog=<id> (e.g. the reference
 // page's "Add to your stable" CTA). One-time on mount; skips if the param
 // is absent or a reference is already chosen so existing flows aren't broken.
 useEffect(() => {
 const catalogParam = searchParams.get("catalog");
 if (!catalogParam || selectedCatalogId) return;
 setSelectedCatalogId(catalogParam);
 getCatalogItem(catalogParam).then((item) => {
 if (item) setSelectedCatalogItem(item);
 });
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 // Fetch watermark preference + user tier
 useEffect(() => {
 getProfile().then((profile) => {
 if (profile) {
 setWatermarkEnabled(profile.watermarkPhotos);
 setUserAlias(profile.aliasName);
 setUserWatermarkText(profile.watermarkText);
 }
 });
 // Read tier from JWT app_metadata
 supabase.auth.getUser().then(({ data: { user: u } }) => {
 if (u?.app_metadata?.tier) {
 setUserTier(u.app_metadata.tier as UserTier);
 }
 });
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

  // Clear condition grade if life stage changes to Work in Progress (in_progress)
  useEffect(() => {
    if (lifeStage === "in_progress") {
      setConditionGrade("");
    }
  }, [lifeStage]);

 // Clean up preview URLs on unmount
 useEffect(() => {
 return () => {
 Object.values(imageSlots).forEach((slot) => {
 if (slot?.previewUrl) revokeImagePreviewUrl(slot.previewUrl);
 });
 };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

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
 setExtraFiles((prev) =>
 prev.map((ef, i) =>
 i === reCropExtraIdx ? { file: croppedFile, previewUrl: URL.createObjectURL(croppedFile) } : ef,
 ),
 );
 setReCropExtraIdx(null);
 setCropFile(null);
 return;
 }

 // Cropping an extra from the queue
 if (isCroppingExtra) {
 const previewUrl = URL.createObjectURL(croppedFile);
 setExtraFiles((prev) => [...prev, { file: croppedFile, previewUrl }]);
 setCropFile(null);
 // Process next in queue
 setExtraCropQueue((prev) => {
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

 // Determine which step index is the "identity/details" step
 const identityStepIdx = activeConfig.showReferenceStep ? 2 : 1;

 const canProceedStep = (step: number): boolean => {
   if (step === identityStepIdx) {
    return customName.trim().length > 0 && (isModel ? finishType !=="" && (lifeStage === "in_progress" || conditionGrade !=="") : true);
   }
  return true; // Gallery, Reference, and Vault are all optional
 };

   const goNext = () => {
     if (currentStep < activeSteps.length - 1) {
       if (canProceedStep(currentStep)) {
         setValidationErrors([]);
         setCurrentStep(currentStep + 1);
         window.scrollTo({ top: 0, behavior:"smooth" });
       } else {
         // Show which fields are missing
         const errors: string[] = [];
         if (currentStep === identityStepIdx) {
           if (!customName.trim()) errors.push("Custom Name");
           if (isModel && !finishType) errors.push("Finish Type");
           if (isModel && lifeStage !== "in_progress" && !conditionGrade) errors.push("Condition Grade");
         }
         setValidationErrors(errors);
         setShakeFields(true);
         setTimeout(() => setShakeFields(false), 600);
         if (!customName.trim()) {
           document.getElementById("custom-name")?.focus();
         } else if (isModel && !finishType) {
           document.getElementById("finish-type")?.focus();
         } else if (isModel && lifeStage !== "in_progress" && !conditionGrade) {
           document.getElementById("condition-grade")?.focus();
         }
       }
     }
   };

 const goBack = () => {
  if (currentStep > 0) {
   setCurrentStep(currentStep - 1);
   window.scrollTo({ top: 0, behavior:"smooth" });
  }
 };

 // ---- SUBMIT handler ----

 const handleSubmit = async () => {
 // Re-entrancy guard (mirrors the edit form): prevents a double-submit during
 // the create + slow photo-upload window from creating duplicate photos or a
 // duplicate horse. A synchronous ref beats the async isSubmitting state.
 if (isSubmittingRef.current) return;
 isSubmittingRef.current = true;
 setIsSubmitting(true);
 setSubmitError(null);

 try {
 // 1. Get current user
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) throw new Error("You must be logged in.");

 // Build category-specific attributes JSONB
 let rawAttributes: Record<string, unknown> = {};
 if (assetCategory === "tack") rawAttributes = { tack_type: tackType, discipline, materials: attrMaterials, fits_molds: fitsMolds, working_parts: workingParts };
 else if (assetCategory === "prop") rawAttributes = { prop_category: propCategory, dimensions, terrain_setting: terrainSetting, materials: attrMaterials };
 else if (assetCategory === "diorama") rawAttributes = { scene_theme: sceneTheme, discipline, components: dioComponents, base_dimensions: baseDimensions, documentation_notes: documentationNotes };
 else if (assetCategory === "other_model") rawAttributes = { species, breed: otherBreed, manufacturer, model_number: modelNumber };
 const { cleaned: attributes } = validateAttributes(assetCategory, rawAttributes);

 // Step 1: Create DB record (no files through server)
 const result = await createHorseRecord({
 customName: customName.trim(),
 finishType: isModel ? finishType :"",
 conditionGrade: isModel ? conditionGrade || undefined : undefined,
 isPublic: visibility ==="public" || visibility ==="unlisted",
 tradeStatus: tradeStatus || undefined,
 lifeStage: isModel ? lifeStage || undefined : undefined,
 catalogId: selectedCatalogId || undefined,
 selectedCollectionId: selectedCollectionIds[0] || undefined,
 sculptor: sculptor.trim() || undefined,
 finishingArtist: finishingArtist.trim() || undefined,
 editionNumber: isModel && editionNumber ? parseInt(editionNumber) : undefined,
 editionSize: isModel && editionSize ? parseInt(editionSize) : undefined,
 listingPrice: tradeStatus !=="Not for Sale" && listingPrice ? parseFloat(listingPrice) : undefined,
 marketplaceNotes:
 tradeStatus !=="Not for Sale" && marketplaceNotes.trim() ? marketplaceNotes.trim() : undefined,
 purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
 purchaseDate: purchaseDate || undefined,
 estimatedValue: estimatedValue ? parseFloat(estimatedValue) : undefined,
 insuranceNotes: insuranceNotes.trim() || undefined,
 isTrade,
 assetCategory,
 finishDetails: finishDetails.trim() || undefined,
 publicNotes: publicNotes.trim() || undefined,
 assignedBreed: assignedBreed.trim() || undefined,
 assignedGender: assignedGender.trim() || undefined,
 assignedAge: assignedAge.trim() || undefined,
 regionalId: regionalId.trim() || undefined,
 purchaseDateText: purchaseDateText.trim() || undefined,
 attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
 });

 if (!result.success || !result.horseId) {
 throw new Error(result.error ||"Failed to save horse.");
 }

 const horseId = result.horseId;

 // Set multi-collection assignments via junction table
 if (selectedCollectionIds.length > 0) {
 await setHorseCollections(horseId, selectedCollectionIds);
 }

 // Step 2: Upload images directly from browser to Supabase Storage
 const uploadedImages: { path: string; angle: string }[] = [];

 // Compress and upload slot images + thumbnails
 const imageEntries = Object.entries(imageSlots) as [AngleProfile, ImageSlot][];
 for (const [angle, slot] of imageEntries) {
 const compressed =
 watermarkEnabled && userAlias
 ? await compressImageWithWatermark(slot.file, userAlias, userTier, userWatermarkText)
 : await compressImage(slot.file, userTier);
 const filePath = `horses/${horseId}/${angle}_${Date.now()}.webp`;
 const { error: uploadError } = await supabase.storage
 .from("horse-images")
 .upload(filePath, compressed, { contentType:"image/webp" });

 if (!uploadError) {
 uploadedImages.push({ path: filePath, angle });

 // Generate and upload thumbnail (400px WebP)
 try {
 const thumbnail = await generateThumbnail(slot.file);
 const thumbPath = filePath.replace(/\.webp$/, "_thumb.webp");
 await supabase.storage
 .from("horse-images")
 .upload(thumbPath, thumbnail, { contentType:"image/webp" });
 } catch {
 // Non-fatal — grid will fall back to full-res
 }
 }
 }

 // Compress and upload extra detail images
 for (let i = 0; i < extraFiles.length; i++) {
 const compressed =
 watermarkEnabled && userAlias
 ? await compressImageWithWatermark(extraFiles[i].file, userAlias, userTier, userWatermarkText)
 : await compressImage(extraFiles[i].file, userTier);
 const filePath = `horses/${horseId}/extra_detail_${Date.now()}_${i}.webp`;
 const { error: uploadError } = await supabase.storage
 .from("horse-images")
 .upload(filePath, compressed, { contentType:"image/webp" });

 if (!uploadError) {
 uploadedImages.push({ path: filePath, angle:"extra_detail" });
 }
 }

 // Step 3: Finalize image metadata on server. The horse row
 // already exists, so a photo problem must NOT fail the submit —
 // it surfaces as a warning on the success screen instead.
 if (uploadedImages.length > 0) {
 const finalizeResult = await finalizeHorseImages(horseId, uploadedImages);
 if (!finalizeResult.success) {
 setPhotoWarning(
 `Your ${assetCategory === "model" ? "model" : assetCategory} was saved, but the photos could not be attached: ${finalizeResult.error ?? "unknown error"}`,
 );
 } else if (finalizeResult.skippedReason) {
 setPhotoWarning(finalizeResult.skippedReason);
 }
 }

 // 4. Activity event if public
 if (visibility ==="public") {
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

 // 5. Initialize Hoofprint (model + other_model only)
 if (activeConfig.showHoofprint) {
 initializeHoofprint({
 horseId,
 horseName: customName.trim(),
 lifeStage,
 });
 }

 // 6. Show success!
 setSavedHorseName(customName.trim());
 setNewHorseId(horseId);
 setShowSuccess(true);
 track("add_horse", { category: assetCategory, has_catalog: !!selectedCatalogId });
 if (tradeStatus === "For Sale" || tradeStatus === "Open to Offers") {
 track("list_for_sale", { status: tradeStatus, has_price: !!listingPrice });
 }
 } catch (err) {
 setSubmitError(err instanceof Error ? err.message :"Something went wrong.");
 // Reset the guard only on error — on success the form is replaced by the
 // success screen, so keeping it set blocks any duplicate submit.
 setIsSubmitting(false);
 isSubmittingRef.current = false;
 }
 };

 // ---- RENDER ----

 // Success overlay
 if (showSuccess) {
 return (
 <div className="success-overlay">
          <div className="animate-fade-in-up max-w-[480px] rounded-xl border border-input bg-card p-12 text-center shadow-lg">
 <div className="success-icon">🎉</div>
 <h2>
 <span className="text-forest">{savedHorseName}</span> Added!
 </h2>
 <p>
 Your {assetCategory ==="model" ?"model" : assetCategory} has been successfully cataloged in
 your Digital Stable.
 </p>
 {photoWarning && (
 <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-left text-sm text-warning" role="alert">
 {photoWarning}
 </div>
 )}
 <div className="flex flex-col items-center gap-4">
 {newHorseId && (
 <Button asChild size="wide"><Link
 href={visibility ==="public" ? `/community/${newHorseId}` : `/stable/${newHorseId}`}
 >
 View Passport →
 </Link></Button>
 )}
 <div className="flex justify-center gap-4">
 <Button asChild variant="outline"><Link
 href="/add-horse"
 onClick={() => window.location.reload()}
 >
 Add Another
 </Link></Button>
 <Button asChild variant="outline" size="wide"><Link
 href="/dashboard"
 >
 View Stable
 </Link></Button>
 </div>
 </div>
 </div>
 </div>
 );
 }

 return (
 <FocusLayout noHeader>
 <PageMasthead compact icon="🐴" title="Add a Horse" subtitle="Add a new model to your digital stable" />
 {/* Page Header */}
 <div className="animate-fade-in-up">
          <p className="mt-2 text-sm text-secondary-foreground">
 {activeConfig.label === "Model Horse"
 ?"Catalog a new model horse in your digital collection"
 : `Add ${activeConfig.label.toLowerCase()} to your collection`}
 </p>
 </div>

 {/* Asset Category Toggle */}
 <div className="animate-fade-in-up mb-8 flex flex-wrap gap-2">
 {[
 { value:"model" as const, icon:"🐎", label:"Model Horse" },
 { value:"tack" as const, icon:"🏇", label:"Tack & Gear" },
 { value:"prop" as const, icon:"🌲", label:"Prop" },
 { value:"diorama" as const, icon:"🎭", label:"Diorama" },
 { value:"other_model" as const, icon:"🐄", label:"Other Model" },
 ].map((cat) => (
 <button
 key={cat.value}
 type="button"
              className={`group flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 px-5 py-3 transition-all ${assetCategory === cat.value ? "border-forest bg-forest/10 shadow-sm" : "border-input bg-card hover:border-forest/40"}`}
 onClick={() => setAssetCategory(cat.value)}
 >
 <span className={`text-2xl transition-all ${assetCategory === cat.value ? "" : "opacity-60 grayscale group-hover:opacity-90 group-hover:grayscale-0"}`}>{cat.icon}</span>
              <span className={`text-sm font-semibold ${assetCategory === cat.value ? "text-forest" : "text-secondary-foreground"}`}>{cat.label}</span>
 </button>
 ))}
 </div>

 {/* Step Indicator */}
 <div
 className="relative mb-10 flex items-start justify-center"
 role="navigation"
 aria-label="Form progress"
 >
 {activeSteps.map((step, i) => (
 <button
 type="button"
 key={step.label}
 className={`${activeSteps.length <= 3 ? 'w-1/3' : 'w-1/4'} relative flex cursor-pointer flex-col items-center bg-transparent border-0 p-0`}
  onClick={() => {
    if (i <= currentStep || canProceedStep(i - 1)) {
      setValidationErrors([]);
      setCurrentStep(i);
    } else {
      const blockingStep = i - 1;
      if (blockingStep === identityStepIdx) {
        const errors: string[] = [];
        if (!customName.trim()) errors.push("Custom Name");
        if (isModel && !finishType) errors.push("Finish Type");
        if (isModel && lifeStage !== "in_progress" && !conditionGrade) errors.push("Condition Grade");
        setValidationErrors(errors);
        setShakeFields(true);
        setTimeout(() => setShakeFields(false), 600);
        setCurrentStep(blockingStep);
        window.scrollTo({ top: 0, behavior:"smooth" });
      }
    }
  }}
  aria-label={`Go to step ${i + 1}: ${step.label}`}
 >
 {/* Connecting line (before the dot) */}
 {i > 0 && (
 <div
 className={`absolute top-4 right-1/2 h-0.5 w-full ${i <= currentStep ? "bg-forest" : "bg-muted"}`}
 />
 )}
 {/* Dot */}
 <div
 className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold transition-all ${
 i === currentStep
 ? "border-forest bg-forest text-white"
 : i < currentStep
 ? "border-forest bg-forest text-white"
 : "border-input bg-card text-muted-foreground"
 }`}
 aria-current={i === currentStep ?"step" : undefined}
 >
 {i < currentStep ? "✓" : i + 1}
 </div>
 {/* Label */}
 <span
 className={`mt-2 text-xs font-medium ${
 i === currentStep ? "text-forest" : i < currentStep ? "text-foreground" : "text-muted-foreground"
 }`}
 >
 {step.label}
  </span>
  </button>
  ))}
 </div>

 {/* Error banner */}
 {submitError && (
 <div
 className="text-destructive mt-2 mb-8 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm"
 role="alert"
 >
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
 <circle cx="12" cy="12" r="10" />
 <line x1="15" y1="9" x2="9" y2="15" />
 <line x1="9" y1="9" x2="15" y2="15" />
 </svg>
 {submitError}
 </div>
 )}

 {/* ================================================================
 STEP 1 (index 0): Gallery Upload
 ================================================================ */}
 {currentStep === 0 && (
 <div className="step-content" key="step-0">
 <div className="relative overflow-visible rounded-xl border border-input bg-card p-6 shadow-sm">
 <div className="mb-6 flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-forest/10 text-forest">
 <Camera className="h-5 w-5" />
 </div>
 <div>
 <h2>Photo Gallery</h2>
 <p>Upload photos from specific angles to build a complete profile</p>
 </div>
 </div>

 <p className="mb-4 text-sm text-muted-foreground">
 Just cataloguing? <Link href="/add-horse/quick" className="text-sm text-muted-foreground hover:text-forest">Try Quick Add →</Link>
 </p>

 <p className="mb-6 text-sm">
 Click any slot below to upload a photo. Images are automatically compressed before saving.
 The <strong>Primary Thumbnail</strong> will be shown on your Digital Shelf.
 </p>
 <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
 {activeGallerySlots.map((slot) => {
 const existing = imageSlots[slot.angle as AngleProfile];
 const isPrimary = slot.angle ==="Primary_Thumbnail";
 return (
 <div
 key={slot.angle}
 className={`relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 transition-all hover:bg-forest/5 ${
 existing
 ? "border-solid border-forest bg-forest/5 shadow-sm"
 : "border-dashed border-input bg-card"
 }`}
 >
 {existing ? (
 <>
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={existing.previewUrl}
 alt={slot.label}
 className="absolute inset-0 h-full w-full object-cover"
 />
 <button
 className="bg-black/70 absolute top-[6px] right-[6px] z-[2] flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-full border-0 text-[0.85rem] text-white transition-colors"
 onClick={(e) => {
 e.stopPropagation();
 handleImageRemove(slot.angle as AngleProfile);
 }}
 aria-label={`Remove ${slot.label} photo`}
 >
 ✕
 </button>
 <div className="bg-success text-white absolute bottom-[6px] left-[6px] z-[2] flex h-[24px] w-[24px] items-center justify-center rounded-full text-[0.7rem] font-extrabold">
 ✓
 </div>
 </>
 ) : (
 <div className="flex w-full flex-col items-center gap-2 p-2 text-center text-muted-foreground">
 <span className="text-3xl opacity-50 transition-colors group-hover:opacity-100">
 {isPrimary ? "🖼️" : "📷"}
 </span>
 <span className="text-sm font-medium">{slot.label}</span>
 </div>
 )}
 <input
 type="file"
 accept="image/jpeg,image/png,image/webp,image/gif"
 className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (file) handleImageSelect(slot.angle as AngleProfile, file);
 e.target.value =""; // Reset so same file can be re-selected
 }}
 aria-label={`Upload ${slot.label} photo`}
 />
 </div>
 );
 })}
 </div>

 {/* Extra Details Multi-Upload Zone — Pro feature; free-tier
 users get an honest notice instead of a dropzone whose
 uploads the finalize step would discard. */}
 {viewerTier === "free" ? (
 <div className="mt-6 flex min-h-[80px] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-muted/40 p-6 text-center">
 <p className="text-sm font-semibold text-secondary-foreground">
 Extra detail photos (up to 30) are an MHH Pro feature
 </p>
 <p className="text-xs text-muted-foreground">
 Your five standard angle photos above are always free.{" "}
 <Link href="/upgrade" className="text-forest hover:underline">See MHH Pro →</Link>
 </p>
 </div>
 ) : (
 <div className="mt-6">
 <label
 htmlFor="extra-photos-input"
 className="relative flex min-h-[120px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-input bg-card p-6 text-center transition-all hover:border-forest hover:bg-forest/5"
 onDragOver={(e) => e.preventDefault()}
 onDrop={(e) => {
 e.preventDefault();
 const files = Array.from(e.dataTransfer.files).filter((f) =>
 f.type.startsWith("image/"),
 );
 if (extraFiles.length + files.length > 10) {
 alert("Maximum 10 extra detail photos allowed.");
 return;
 }
 startExtraCropQueue(files);
 }}
 >
 <input
 id="extra-photos-input"
 ref={extraInputRef}
 type="file"
 accept="image/*"
 multiple
 className="hidden"
 title="Upload extra photos"
 onChange={(e) => {
 const files = Array.from(e.target.files || []).filter((f) =>
 f.type.startsWith("image/"),
 );
 if (extraFiles.length + files.length > 10) {
 alert("Maximum 10 extra detail photos allowed.");
 e.target.value ="";
 return;
 }
 startExtraCropQueue(files);
 e.target.value ="";
 }}
 />
 <svg
 width="24"
 height="24"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="1.5"
 strokeLinecap="round"
 strokeLinejoin="round"
 className="text-muted-foreground"
 >
 <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
 <circle cx="12" cy="13" r="3" />
 <line x1="21" y1="9" x2="21.01" y2="9" />
 </svg>
 <span className="text-foreground text-sm font-medium">
 <strong>Additional photos (up to 10)</strong>
 </span>
 <span className="text-muted-foreground text-xs">
 {extraFiles.length}/10 photos · Click or drag files here
 </span>
 </label>
 {extraFiles.length > 0 && (
 <div className="mt-4 flex flex-wrap gap-2">
 {extraFiles.map((ef, i) => (
 <div
 key={i}
 className="border-input relative h-[100px] w-[100px] overflow-hidden rounded-md border"
 >
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={ef.previewUrl} alt={`Extra detail ${i + 1}`} />
 <button
 className="bg-black/70 absolute top-[6px] right-[6px] z-[2] flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-full border-0 text-[0.85rem] text-white transition-colors"
 onClick={(e) => {
 e.stopPropagation();
 URL.revokeObjectURL(ef.previewUrl);
 setExtraFiles((prev) => prev.filter((_, idx) => idx !== i));
 }}
 aria-label={`Remove extra photo ${i + 1}`}
 >
 ✕
 </button>
 <button
 className="bg-black/70 absolute right-[4px] bottom-[4px] flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full border-0 text-[13px] leading-none text-white opacity-0 transition-opacity"
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
 )}

 </div>

 <div className="mt-8 flex items-center justify-between gap-4">
 <div className="mt-8-spacer flex items-center justify-between gap-4" />
 <Button
 onClick={goNext}
 id="step-1-next"
 >
 {activeConfig.showReferenceStep ? "Next: Reference Link →" : `Next: ${activeConfig.label} Details →`}
 </Button>
 </div>
 </div>
 )}

 {/* ================================================================
 STEP 2 (index 1): Reference Link
 — Use CSS display instead of unmounting to preserve component state
 ================================================================ */}
 <div className={`step-content ${activeConfig.showReferenceStep && currentStep === 1 ?"block" :"hidden"}`} key="step-1">
 <div className="relative overflow-visible rounded-xl border border-input bg-card p-6 shadow-sm">
 <div className="mb-6 flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-forest/10 text-forest">
 <Link2 className="h-5 w-5" />
 </div>
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
 if (item?.itemType ==="artist_resin" && item.maker && !sculptor.trim()) {
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
 window.scrollTo({ top: 0, behavior:"smooth" });
 }}
 />
 </div>

 <div className="mt-8 flex items-center justify-between gap-4">
 <Button variant="outline" size="wide"
 onClick={goBack}
 id="step-2-back"
 >
 ← Back
 </Button>
 <Button
 onClick={goNext}
 disabled={!canProceedStep(1)}
 id="step-2-next"
 >
 {selectedCatalogId ?"Next: Identity →" :"Skip → No Reference"}
 </Button>
 </div>
 </div>

 {/* ================================================================
 STEP: Identity / Details (index varies by category)
 ================================================================ */}
 {currentStep === identityStepIdx && (
 <div className="step-content" key="step-2">
 <div className="relative overflow-visible rounded-xl border border-input bg-card p-6 shadow-sm">
 {/* Reference summary badge */}
 {selectedCatalogItem && (
 <div className="mt-4 mb-6 rounded-lg border border-input bg-muted px-6 py-4 text-sm leading-relaxed">
 🔗 Linked to: <strong>{selectedCatalogItem.title}</strong> · {selectedCatalogItem.maker}
 </div>
 )}

 <div className="mb-6 flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-forest/10 text-forest">
 <Tag className="h-5 w-5" />
 </div>
 <div>
 <h2>
 {isModel
 ?"Model Identity"
 : `${assetCategory.charAt(0).toUpperCase() + assetCategory.slice(1)} Details`}
 </h2>
 <p>
 {isModel
 ?"Give your model a name and describe its characteristics"
 : `Name and describe your ${assetCategory}`}
 </p>
 </div>
 </div>

 <div className="mb-6">
 <label htmlFor="custom-name" className="text-foreground mb-1 block text-sm font-semibold">
 Custom Name *
 </label>
 <Input
 id="custom-name"
 type="text"
 className={`${validationErrors.includes("Custom Name") ? "ring-2 ring-destructive/50 border-destructive" : ""} ${shakeFields && validationErrors.includes("Custom Name") ? "animate-shake" : ""}`}
 placeholder="e.g. Midnight Star, Patches, Stormy…"
 value={customName}
 onChange={(e) => {
 setCustomName(e.target.value);
 if (validationErrors.length > 0) setValidationErrors((prev) => prev.filter((f) => f !== "Custom Name"));
 }}
 autoFocus
 maxLength={100}
 />
 {validationErrors.includes("Custom Name") && (
 <span className="mt-1 block text-xs font-medium text-destructive">⚠ Required — give your model a name</span>
 )}
 <span className="text-muted-foreground mt-1 block text-xs">
 What do you call this model? This can be a show name, pet name, or whatever you like.
 </span>
 </div>

 {isFieldVisible(assetCategory, "sculptor") && (
 <div className="mb-6">
 <label htmlFor="sculptor" className="text-foreground mb-1 block text-sm font-semibold">
 {getFieldLabel(assetCategory, "sculptor")}
 </label>
 <Input
 id="sculptor"
 type="text"
 placeholder="e.g. Sarah Rose, Brigitte Eberl, Kathleen Moody…"
 value={sculptor}
 onChange={(e) => setSculptor(e.target.value)}
 maxLength={100}
 />
 </div>
 )}

 {isFieldVisible(assetCategory, "finishing_artist") && (
 <div className="mb-6">
 <label htmlFor="finishing-artist" className="text-foreground mb-1 block text-sm font-semibold">
 🎨 Finishing Artist
 </label>
 <Input
 id="finishing-artist"
 type="text"
 placeholder="Who painted or customized this model?"
 value={finishingArtist}
 onChange={(e) => setFinishingArtist(e.target.value)}
 maxLength={100}
 />
 </div>
 )}

 {isFieldVisible(assetCategory, "edition_info") && (
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">📋 Edition Info</label>
 <div className="flex items-center gap-2">
 <Input type="number" placeholder="#" value={editionNumber} onChange={(e) => setEditionNumber(e.target.value)} className="w-20" min="1" />
 <span className="text-muted-foreground">of</span>
 <Input type="number" placeholder="Total" value={editionSize} onChange={(e) => setEditionSize(e.target.value)} className="w-20" min="1" />
 </div>
 <span className="text-muted-foreground mt-1 block text-xs">e.g., &quot;3 of 50&quot; for limited edition runs.</span>
 </div>
 )}

 {/* Finish Type — model only */}
 {isModel && (
 <div className="mb-6">
 <label htmlFor="finish-type" className="text-foreground mb-1 block text-sm font-semibold">
 Finish Type *
 </label>
 <select
 id="finish-type"
 className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
 validationErrors.includes("Finish Type")
 ? "border-destructive ring-2 ring-destructive/50 bg-destructive/10"
 : "border-input bg-card"
 } ${shakeFields && validationErrors.includes("Finish Type") ? "animate-shake" : ""}`}
 value={finishType}
 onChange={(e) => {
 setFinishType(e.target.value as FinishType);
 if (validationErrors.length > 0) setValidationErrors((prev) => prev.filter((f) => f !== "Finish Type"));
 }}
 >
 <option value="">Select finish type…</option>
 <option value="OF">OF (Original Finish)</option>
 <option value="Custom">Custom (Repaint / Body Mod)</option>
 <option value="Artist Resin">Artist Resin</option>
 </select>
 {validationErrors.includes("Finish Type") && (
 <span className="mt-1 block text-xs font-medium text-destructive">⚠ Required — select a finish type</span>
 )}
 </div>
 )}

 {/* Finish Details */}
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">Finish Details</label>
 <Input
 
 type="text"
 value={finishDetails}
 onChange={(e) => setFinishDetails(e.target.value)}
 placeholder="e.g. Glossy, Matte, Satin, Chalky"
 maxLength={100}
 id="finish-details"
 />
 </div>

 {/* Public Notes */}
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">Public Notes</label>
 <Textarea
 
 value={publicNotes}
 onChange={(e) => setPublicNotes(e.target.value)}
 placeholder="Visible on your passport — e.g. comes with original box, factory rubs on near leg"
 maxLength={500}
 rows={2}
 id="public-notes"
 />
 <small className="text-muted-foreground text-[var(--font-size-xs)]">
 These notes will be visible to anyone viewing this horse&apos;s passport.
 </small>
 </div>

 {/* ── Category-specific sub-form fields ── */}
 {assetCategory === "tack" && <TackFormFields tackType={tackType} setTackType={setTackType} discipline={discipline} setDiscipline={setDiscipline} materials={attrMaterials} setMaterials={setAttrMaterials} fitsMolds={fitsMolds} setFitsMolds={setFitsMolds} workingParts={workingParts} setWorkingParts={setWorkingParts} />}
 {assetCategory === "prop" && <PropFormFields propCategory={propCategory} setPropCategory={setPropCategory} dimensions={dimensions} setDimensions={setDimensions} terrainSetting={terrainSetting} setTerrainSetting={setTerrainSetting} materials={attrMaterials} setMaterials={setAttrMaterials} />}
 {assetCategory === "diorama" && <DioramaFormFields sceneTheme={sceneTheme} setSceneTheme={setSceneTheme} discipline={discipline} setDiscipline={setDiscipline} components={dioComponents} setComponents={setDioComponents} baseDimensions={baseDimensions} setBaseDimensions={setBaseDimensions} documentationNotes={documentationNotes} setDocumentationNotes={setDocumentationNotes} />}
 {assetCategory === "other_model" && <OtherModelFormFields species={species} setSpecies={setSpecies} breed={otherBreed} setBreed={setOtherBreed} manufacturer={manufacturer} setManufacturer={setManufacturer} modelNumber={modelNumber} setModelNumber={setModelNumber} />}

 {/* ── Show Bio (Optional — model only) ── */}
 {activeConfig.showShowBio && (
 <>
 <div className="my-5 text-muted-foreground mt-4 mb-3 flex items-center gap-4 text-sm">
 <h4 className="text-secondary-foreground font-semibold text-[var(--font-size-md)]">
 🏅 Show Bio <span className="font-normal text-[var(--font-size-sm)]">(Optional)</span>
 </h4>
 <small className="mt-1 block text-muted-foreground">
 The show identity you assign for competition — breed, gender, and age for show ring
 divisions.
 </small>
 </div>

 <div
 className="form-row flex flex-wrap gap-4 max-md:flex-col max-md:gap-4"
 >
 <div className="mb-6 min-w-[200px] flex-1">
 <label className="text-foreground mb-1 block text-sm font-semibold">Assigned Breed</label>
 <Input
 
 type="text"
 value={assignedBreed}
 onChange={(e) => setAssignedBreed(e.target.value)}
 placeholder="e.g. Andalusian, Arabian, Quarter Horse"
 maxLength={100}
 id="assigned-breed"
 />
 </div>
 <div className="mb-6 min-w-[150px] flex-1">
 <label className="text-foreground mb-1 block text-sm font-semibold">Assigned Gender</label>
 <select
 className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={assignedGender}
 onChange={(e) => setAssignedGender(e.target.value)}
 id="assigned-gender"
 title="Select assigned gender"
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

 <div
 className="form-row flex flex-wrap gap-4 max-md:flex-col max-md:gap-4"
 >
 <div className="mb-6 min-w-[150px] flex-1">
 <label className="text-foreground mb-1 block text-sm font-semibold">Assigned Age</label>
 <Input
 
 type="text"
 value={assignedAge}
 onChange={(e) => setAssignedAge(e.target.value)}
 placeholder="e.g. Foal, Yearling, Adult, 5 years"
 maxLength={50}
 id="assigned-age"
 />
 </div>
 <div className="mb-6 min-w-[200px] flex-1">
 <label className="text-foreground mb-1 block text-sm font-semibold">Regional Show ID</label>
 <Input
 
 type="text"
 value={regionalId}
 onChange={(e) => setRegionalId(e.target.value)}
 placeholder="e.g. RX number, Texas System ID"
 maxLength={50}
 id="regional-id"
 />
 </div>
 </div>
 </>
 )}

 {/* Condition Grade */}
 {isModel && (
 <div className={`mb-6 ${lifeStage === "in_progress" ? "opacity-40 pointer-events-none" : ""}`}>
 <label htmlFor="condition-grade" className="text-foreground mb-1 block text-sm font-semibold">
 Condition Grade {lifeStage !== "in_progress" && "*"}
 </label>
 <select
 id="condition-grade"
 className={`flex h-9 w-full rounded-md border px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
 validationErrors.includes("Condition Grade")
 ? "border-destructive ring-2 ring-destructive/50 bg-destructive/10"
 : "border-input bg-card"
 } ${shakeFields && validationErrors.includes("Condition Grade") ? "animate-shake" : ""}`}
 value={conditionGrade}
 onChange={(e) => {
 setConditionGrade(e.target.value);
 if (validationErrors.length > 0) setValidationErrors((prev) => prev.filter((f) => f !== "Condition Grade"));
 }}
 disabled={lifeStage === "in_progress"}
 >
 <option value="">Select condition…</option>
 {CONDITION_GRADES.map((grade) => (
 <option key={grade.value} value={grade.value}>
 {grade.label}
 </option>
 ))}
 </select>
 {lifeStage === "in_progress" && (
   <p className="text-xs text-muted-foreground mt-1">
     Condition grade is not applicable for Work in Progress horses.
   </p>
 )}
 </div>
 )}

 {/* Life Stage — model only */}
 {isModel && (
 <div className="mb-6">
 <label htmlFor="life-stage" className="text-foreground mb-1 block text-sm font-semibold">
 🐾 Life Stage
 </label>
 <select
 id="life-stage"
 className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={lifeStage}
 onChange={(e) => setLifeStage(e.target.value)}
 >
 <option value="blank">🎨 Blank / Unpainted</option>
 <option value="stripped">🛁 Stripped / Body</option>
 <option value="in_progress">🔧 Work in Progress</option>
 <option value="completed">✅ Completed</option>
 <option value="for_sale">💲 For Sale</option>
 </select>
 <span className="text-muted-foreground mt-1 block text-xs">
 This sets the life stage on your Hoofprint timeline.
 </span>
 </div>
 )}

 <CollectionPicker
 selectedCollectionIds={selectedCollectionIds}
 onSelect={setSelectedCollectionIds}
 />

 {/* Trade / Marketplace Status */}
 <div className="mb-6">
 <label htmlFor="trade-status" className="text-foreground mb-1 block text-sm font-semibold">
 Marketplace Status
 </label>
 <select
 id="trade-status"
 className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
 {(tradeStatus ==="For Sale" || tradeStatus ==="Open to Offers") && (
 <div className="bg-success/10 border-success/30 animate-fade-in-up mt-4 rounded-md border p-4">
 <div className="mb-6">
 <label
 htmlFor="listing-price"
 className="text-foreground mb-1 block text-sm font-semibold"
 >
 💲 Listing Price
 </label>
 <Input
 id="listing-price"
 type="number"
 
 placeholder="0.00"
 min="0"
 step="0.01"
 value={listingPrice}
 onChange={(e) => setListingPrice(e.target.value)}
 />
 <span className="text-muted-foreground mt-1 block text-xs">
 Optional — leave blank for &ldquo;Contact for price&rdquo;
 </span>
 </div>
 <div className="mb-6">
 <label
 htmlFor="marketplace-notes"
 className="text-foreground mb-1 block text-sm font-semibold"
 >
 📝 Seller Notes
 </label>
 <Textarea
 id="marketplace-notes"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-4 py-2 text-sm font-semibold no-underline transition-all"
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

 <div className="mt-8 flex items-center justify-between gap-4">
 <Button variant="outline" size="wide"
 onClick={goBack}
 id="step-3-back"
 >
 ← Back
 </Button>
 <Button
 onClick={goNext}
 disabled={!canProceedStep(2)}
 id="step-3-next"
 >
 Next: Financial Vault →
 </Button>
 </div>

 {/* Community visibility selector */}
 <div className="mt-6 rounded-lg border border-input bg-muted px-6 py-4">
 <div
 className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"
 >
 <span className="text-foreground text-base font-semibold">
 👁️ Visibility
 </span>
 <div className="flex flex-wrap gap-2">
 {[
 {
 value:"public" as const,
 icon:"🌐",
 label:"Public",
 hint:"Visible in the Show Ring",
 },
 {
 value:"unlisted" as const,
 icon:"🔗",
 label:"Unlisted",
 hint:"Anyone with the link can see it",
 },
 {
 value:"private" as const,
 icon:"🔒",
 label:"Private",
 hint:"Only you can see it",
 },
 ].map((opt) => (
 <button
 key={opt.value}
 type="button"
 className={`bg-card font-inherit text-foreground hover:border-success hover:bg-muted flex min-w-[120px] flex-1 cursor-pointer flex-col items-center gap-1 rounded-lg border-2 px-2 py-3 transition-all ${visibility === opt.value ?"border-forest bg-forest/10" :"border-input"}`}
 onClick={() => setVisibility(opt.value)}
 id={`visibility-${opt.value}`}
 >
 <span className="text-2xl">{opt.icon}</span>
 <span className="text-sm font-semibold">{opt.label}</span>
 <span className="text-muted-foreground text-center text-xs">{opt.hint}</span>
 </button>
 ))}
 </div>
 </div>
 </div>
 </div>
 )}

 {/* ================================================================
 STEP: Financial Vault (always the last step)
 ================================================================ */}
 {currentStep === activeSteps.length - 1 && (
 <div className="step-content" key="step-3">
 {/* Reference summary badge */}
 {selectedCatalogItem && (
 <div className="mt-4 mb-6 rounded-lg border border-input bg-muted px-6 py-4 text-sm leading-relaxed">
 🔗 Linked to: <strong>{selectedCatalogItem.title}</strong> · {selectedCatalogItem.maker}
 </div>
 )}

 <div className="relative overflow-visible rounded-xl border border-input bg-card p-6 shadow-sm">
 {/* Vault Header */}
 <div className="border-warning/30 mb-8 flex items-center gap-4 border-b pb-6">
 <div className="vault-icon">🔒</div>
 <div>
 <h2>The Financial Vault</h2>
 <p>Optional — record purchase details and valuations</p>
 </div>
 </div>

 {/* Privacy reassurance */}
 <div
 className="bg-warning/10 border-warning/30 mb-8 flex items-start gap-2 rounded-md border p-4"
 role="note"
 aria-label="Financial privacy notice"
 >
 <span className="mt-[2px] shrink-0 text-[1.3em]">🛡️</span>
 <p>
 <strong>This data is encrypted and only visible to you.</strong> No other user, not even
 community members who can see your public horses, will ever have access to your
 financial information. Your purchase prices, valuations, and insurance notes are
 protected by strict Row Level Security.
 </p>
 </div>

 <div className="flex items-center gap-2 mb-6">
   <input
     id="is-trade"
     type="checkbox"
     className="h-4 w-4 rounded border-input text-forest focus:ring-forest accent-forest"
     checked={isTrade}
     onChange={(e) => setIsTrade(e.target.checked)}
   />
   <label htmlFor="is-trade" className="text-sm font-medium text-foreground cursor-pointer select-none">
     Acquired via trade (no cash exchanged)
   </label>
 </div>

 <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
 <div className="mb-6">
 <label htmlFor="purchase-price" className={`text-foreground mb-1 block text-sm font-semibold ${isTrade ? "opacity-50" : ""}`}>
 Purchase Price
 </label>
 <Input
 id="purchase-price"
 type="number"
 
 placeholder="0.00"
 min="0"
 step="0.01"
 value={purchasePrice}
 onChange={(e) => setPurchasePrice(e.target.value)}
 disabled={isTrade}
 className={isTrade ? "opacity-50 pointer-events-none" : ""}
 />
 </div>

 <div className="mb-6">
 <label htmlFor="purchase-date" className="text-foreground mb-1 block text-sm font-semibold">
 Purchase Date
 </label>
 <Input
 id="purchase-date"
 type="date"
 
 value={purchaseDate}
 onChange={(e) => setPurchaseDate(e.target.value)}
 />
 </div>
 </div>

 {/* Fuzzy Purchase Date */}
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">
 Approximate Purchase Date
 </label>
 <Input
 
 type="text"
 value={purchaseDateText}
 onChange={(e) => setPurchaseDateText(e.target.value)}
 placeholder="e.g. BreyerFest 2017, Summer 2015, Christmas 2020"
 id="purchase-date-text"
 />
 <small className="text-muted-foreground text-[var(--font-size-xs)]">
 Use this when you don&apos;t remember the exact date.
 </small>
 </div>

 <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
 <div className="mb-6">
 <label htmlFor="estimated-value" className={`text-foreground mb-1 block text-sm font-semibold ${isTrade ? "opacity-50" : ""}`}>
 Estimated Current Value
 </label>
 <Input
 id="estimated-value"
 type="number"
 
 placeholder="0.00"
 min="0"
 step="0.01"
 value={estimatedValue}
 onChange={(e) => setEstimatedValue(e.target.value)}
 disabled={isTrade}
 className={isTrade ? "opacity-50 pointer-events-none" : ""}
 />
 </div>

 <div className="mb-6">
 <label htmlFor="insurance-notes" className="text-foreground mb-1 block text-sm font-semibold">
 Insurance Notes
 </label>
 <Input
 id="insurance-notes"
 type="text"
 
 placeholder="Policy number, coverage details, etc."
 value={insuranceNotes}
 onChange={(e) => setInsuranceNotes(e.target.value)}
 />
 </div>
 </div>

 <div className="border-input mt-6 border-t pt-6 text-center">
 <p>
 💡 All fields are optional. You can always add or update financial details later from
 your Horse Passport view.
 </p>
 </div>
 </div>

 <div className="mt-8 flex items-center justify-between gap-4">
 <Button variant="outline" size="wide"
 onClick={goBack}
 id="step-4-back"
 >
 ← Back
 </Button>
 <Button
 onClick={handleSubmit}
 disabled={isSubmitting || !canProceedStep(2)}
 id="submit-horse"
 >
 {isSubmitting ? (
 <>
 <span
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 aria-hidden="true"
 />
 Saving to Stable…
 </>
 ) : (
 <>🐴 Add to Stable</>
 )}
 </Button>
 </div>
 </div>
 )}

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
 setExtraCropQueue((prev) => {
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
 </FocusLayout>
 );
}
