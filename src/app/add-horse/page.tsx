"use client";

import { useState, useEffect, useCallback, useRef } from"react";
import { useRouter } from"next/navigation";
import Link from"next/link";
import { createClient } from"@/lib/supabase/client";
import {
 compressImage,
 compressImageWithWatermark,
 validateImageFile,
 createImagePreviewUrl,
 revokeImagePreviewUrl,
} from"@/lib/utils/imageCompression";
import type { AngleProfile, FinishType, AssetCategory } from"@/lib/types/database";
import UnifiedReferenceSearch from"@/components/UnifiedReferenceSearch";
import type { CatalogItem } from"@/app/actions/reference";
import CollectionPicker from"@/components/CollectionPicker";
import { notifyHorsePublic } from"@/app/actions/horse-events";
import { initializeHoofprint } from"@/app/actions/hoofprint";
import { createHorseRecord, finalizeHorseImages } from"@/app/actions/horse";
import { getProfile } from"@/app/actions/settings";
import { setHorseCollections } from"@/app/actions/collections";
import ImageCropModal from"@/components/ImageCropModal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import FocusLayout from"@/components/layouts/FocusLayout";

// ---- AI Detection types ----
interface AiDetectionResult {
 manufacturer: string;
 mold_name: string;
 scale: string;
 confidence_score: number;
}

interface AiToast {
 message: string;
 type:"success" |"error" |"info";
 id: number;
}

// ---- Constants ----

const STEPS = [
 { label:"Gallery", icon:"📸" },
 { label:"Reference", icon:"🔗" },
 { label:"Identity", icon:"🏷️" },
 { label:"Vault", icon:"🔒" },
];

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

const GALLERY_SLOTS: { angle: AngleProfile; label: string; primary?: boolean }[] = [
 { angle:"Primary_Thumbnail", label:"Near-Side (Required)", primary: true },
 { angle:"Right_Side", label:"Off-Side" },
 { angle:"Front_Chest", label:"Front / Chest" },
 { angle:"Back_Hind", label:"Hindquarters / Tail" },
 { angle:"Belly_Makers_Mark", label:"Belly / Maker's Mark" },
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
 const [finishType, setFinishType] = useState<FinishType |"">("");
 const [conditionGrade, setConditionGrade] = useState("");
 const [visibility, setVisibility] = useState<"public" |"unlisted" |"private">("public");
 const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
 const [tradeStatus, setTradeStatus] = useState("Not for Sale");
 const [listingPrice, setListingPrice] = useState("");
 const [marketplaceNotes, setMarketplaceNotes] = useState("");
 const [lifeStage, setLifeStage] = useState("completed");
 const [assetCategory, setAssetCategory] = useState<AssetCategory>("model");

 // Watermark preference
 const [watermarkEnabled, setWatermarkEnabled] = useState(false);
 const [userAlias, setUserAlias] = useState("");

 const isModel = assetCategory ==="model";

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
 const showToast = useCallback((message: string, type: AiToast["type"] ="info") => {
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
 showToast("Upload a Primary Thumbnail first.","error");
 return;
 }

 setAiDetecting(true);
 setAiResult(null);

 try {
 const formData = new FormData();
 formData.append("image", primarySlot.file);

 const res = await fetch("/api/identify-mold", {
 method:"POST",
 body: formData,
 });

 const data = await res.json();

 if (!res.ok) {
 throw new Error(data.error ||"AI detection failed.");
 }

 // Non-equine image detection
 if (data.error && data.not_equine) {
 throw new Error(
"This doesn't appear to be a model horse. Please upload a photo of an equine model or figurine.",
 );
 }

 const result = data as AiDetectionResult;
 setAiResult(result);

 // Show success toast with confidence
 const pct =
 typeof result.confidence_score ==="number"
 ? result.confidence_score <= 1
 ? Math.round(result.confidence_score * 100)
 : Math.round(result.confidence_score)
 : 0;
 showToast(`✨ AI identified: ${result.mold_name} (${pct}% confidence)`,"success");

 // Auto-navigate to Reference step (now index 1) and inject search
 setAiSearchQuery(result.mold_name);
 setCurrentStep(1); // Reference is step index 1
 window.scrollTo({ top: 0, behavior:"smooth" });

 // Give the search a moment to execute, then try to auto-select from catalog
 setTimeout(async () => {
 const { searchCatalogAction } = await import("@/app/actions/reference");
 const items = await searchCatalogAction(result.mold_name);
 if (items.length > 0) {
 const exactMatch = items.find((m) => m.title.toLowerCase() === result.mold_name.toLowerCase());
 const bestMatch = exactMatch || items[0];
 setSelectedCatalogId(bestMatch.id);
 setSelectedCatalogItem(bestMatch);
 }
 }, 600);
 } catch (err) {
 const msg = err instanceof Error ? err.message :"AI detection failed.";
 showToast(msg,"error");
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

 const canProceedStep = (step: number): boolean => {
 switch (step) {
 case 0:
 return true; // Gallery is optional (but thumbnail encouraged)
 case 1:
 return true; // Reference is optional — users can use"Custom Entry" escape hatch
 case 2:
 return customName.trim().length > 0 && (isModel ? finishType !=="" && conditionGrade !=="" : true);
 case 3:
 return true; // Financial vault is optional
 default:
 return false;
 }
 };

 const goNext = () => {
 if (currentStep < STEPS.length - 1 && canProceedStep(currentStep)) {
 setCurrentStep(currentStep + 1);
 window.scrollTo({ top: 0, behavior:"smooth" });
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
 setIsSubmitting(true);
 setSubmitError(null);

 try {
 // 1. Get current user
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) throw new Error("You must be logged in.");

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
 throw new Error(result.error ||"Failed to save horse.");
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
 const compressed =
 watermarkEnabled && userAlias
 ? await compressImageWithWatermark(slot.file, userAlias)
 : await compressImage(slot.file);
 const filePath = `horses/${horseId}/${angle}_${Date.now()}.webp`;
 const { error: uploadError } = await supabase.storage
 .from("horse-images")
 .upload(filePath, compressed, { contentType:"image/webp" });

 if (!uploadError) {
 uploadedImages.push({ path: filePath, angle });
 }
 }

 // Compress and upload extra detail images
 for (let i = 0; i < extraFiles.length; i++) {
 const compressed =
 watermarkEnabled && userAlias
 ? await compressImageWithWatermark(extraFiles[i].file, userAlias)
 : await compressImage(extraFiles[i].file);
 const filePath = `horses/${horseId}/extra_detail_${Date.now()}_${i}.webp`;
 const { error: uploadError } = await supabase.storage
 .from("horse-images")
 .upload(filePath, compressed, { contentType:"image/webp" });

 if (!uploadError) {
 uploadedImages.push({ path: filePath, angle:"extra_detail" });
 }
 }

 // Step 3: Finalize image metadata on server
 if (uploadedImages.length > 0) {
 await finalizeHorseImages(horseId, uploadedImages);
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
 setSubmitError(err instanceof Error ? err.message :"Something went wrong.");
 } finally {
 setIsSubmitting(false);
 }
 };

 // ---- RENDER ----

 // Success overlay
 if (showSuccess) {
 return (
 <div className="success-overlay">
          <div className="animate-fade-in-up max-w-[480px] rounded-xl border border-stone-200 bg-white p-12 text-center shadow-lg">
 <div className="success-icon">🎉</div>
 <h2>
 <span className="text-forest">{savedHorseName}</span> Added!
 </h2>
 <p>
 Your {assetCategory ==="model" ?"model" : assetCategory} has been successfully cataloged in
 your Digital Stable.
 </p>
 <div className="flex justify-center gap-4">
 <Link
 href="/add-horse"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={() => window.location.reload()}
 >
 Add Another
 </Link>
 <Link
 href="/dashboard"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 >
 View Stable
 </Link>
 </div>
 </div>
 </div>
 );
 }

 return (
 <FocusLayout title="Add Horse" description="Add a new model to your digital stable.">
 {/* Page Header */}
 <div className="animate-fade-in-up">
          <h1 className="text-2xl font-bold tracking-tight">
            Add to <span className="text-forest">Stable</span>
          </h1>
          <p className="mt-2 text-sm text-ink-light">
 {isModel
 ?"Catalog a new model horse in your digital collection"
 : assetCategory ==="tack"
 ?"Catalog tack & gear for your collection"
 : assetCategory ==="prop"
 ?"Add a prop to your collection"
 :"Document a diorama setup"}
 </p>
 </div>

 {/* Asset Category Toggle */}
 <div className="animate-fade-in-up mb-8 flex gap-2">
 {[
 { value:"model" as const, icon:"🐎", label:"Model Horse" },
 { value:"tack" as const, icon:"🏇", label:"Tack & Gear" },
 { value:"prop" as const, icon:"🌲", label:"Prop" },
 { value:"diorama" as const, icon:"🎭", label:"Diorama" },
 ].map((cat) => (
 <button
 key={cat.value}
 type="button"
              className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 px-5 py-3 transition-all ${assetCategory === cat.value ? "border-forest bg-forest/5 shadow-sm" : "border-stone-200 bg-white hover:border-stone-300"}`}
 onClick={() => setAssetCategory(cat.value)}
 id={`category-${cat.value}`}
 >
 <span className="text-2xl">{cat.icon}</span>
              <span className="text-sm font-semibold text-ink-light">{cat.label}</span>
 </button>
 ))}
 </div>

 {/* Step Indicator */}
 <div
 className="relative mb-10 flex items-start justify-center"
 role="navigation"
 aria-label="Form progress"
 >
 {STEPS.map((step, i) => (
 <div
 key={step.label}
 className="relative flex flex-col items-center"
 style={{ width: `${100 / STEPS.length}%` }}
 >
 {/* Connecting line (before the dot) */}
 {i > 0 && (
 <div
 className={`absolute top-4 right-1/2 h-0.5 w-full ${i <= currentStep ? "bg-forest" : "bg-gray-300"}`}
 />
 )}
 {/* Dot */}
 <div
 className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold transition-all ${
 i === currentStep
 ? "border-forest bg-forest text-white"
 : i < currentStep
 ? "border-forest bg-forest text-white"
 : "border-gray-300 bg-white text-muted"
 }`}
 aria-current={i === currentStep ?"step" : undefined}
 >
 {i < currentStep ? "✓" : i + 1}
 </div>
 {/* Label */}
 <span
 className={`mt-2 text-xs font-medium ${
 i === currentStep ? "text-forest" : i < currentStep ? "text-ink" : "text-muted"
 }`}
 >
 {step.label}
 </span>
 </div>
 ))}
 </div>

 {/* Error banner */}
 {submitError && (
 <div
 className="text-danger mt-2 mb-8 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm"
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
 <div className="relative overflow-visible rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
 <div className="mb-6 flex items-center gap-3">
 <div className="text-2xl">
 📸
 </div>
 <div>
 <h2>Photo Gallery</h2>
 <p>Upload photos from specific angles to build a complete profile</p>
 </div>
 </div>

 <p className="mb-6 text-sm">
 Click any slot below to upload a photo. Images are automatically compressed before saving.
 The <strong>Primary Thumbnail</strong> will be shown on your Digital Shelf.
 </p>

 <div className="grid-cols-[repeat(3,1fr)] grid gap-4">
 {GALLERY_SLOTS.map((slot) => {
 const existing = imageSlots[slot.angle];
 const isPrimary = slot.angle ==="Primary_Thumbnail";
 return (
 <div
 key={slot.angle}
 className={`gallery-slot ${slot.primary ?"primary" :""} ${
 existing ?"has-image" :""
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
 className="bg-[rgba(0,0,0,0.7)] absolute top-[6px] right-[6px] z-[2] flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-full border-0 text-[0.85rem] text-white transition-colors"
 onClick={(e) => {
 e.stopPropagation();
 handleImageRemove(slot.angle);
 }}
 aria-label={`Remove ${slot.label} photo`}
 >
 ✕
 </button>
 <div className="bg-success text-inverse absolute bottom-[6px] left-[6px] z-[2] flex h-[24px] w-[24px] items-center justify-center rounded-full text-[0.7rem] font-extrabold">
 ✓
 </div>

 {/* AI Auto-Detect button — hidden for now */}
 {false && isPrimary && (
 <button
 className={`ai-detect-btn ${aiDetecting ?"detecting" :""}`}
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
 <span
 className="ai-detect-spinner"
 aria-hidden="true"
 />
 <span className="text-xs">Analyzing…</span>
 </>
 ) : (
 <>
 <svg
 className="ai-detect-sparkle"
 width="18"
 height="18"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
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
 <span className="text-muted text-[1.8rem] transition-colors">
 {isPrimary ?"🖼️" :"📷"}
 </span>
 <span className="hover:text-forest hover:border-forest hover:bg-[var(--color-accent-primary-glow)]-label absolute inset-0 cursor-pointer opacity-[0]">
 {slot.label}
 </span>
 {/* AI hint hidden for now */}
 </>
 )}
 <Input
 type="file"
 accept="image/jpeg,image/png,image/webp,image/gif"
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (file) handleImageSelect(slot.angle, file);
 e.target.value =""; // Reset so same file can be re-selected
 }}
 aria-label={`Upload ${slot.label} photo`}
 />
 </div>
 );
 })}
 </div>

 {/* Extra Details Multi-Upload Zone */}
 <div className="border-edge mt-6 border-t pt-6">
 <div
 className="opacity-[0.4]"
 onClick={() => extraInputRef.current?.click()}
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
 role="button"
 tabIndex={0}
 >
 <Input
 ref={extraInputRef}
 type="file"
 accept="image/*"
 multiple
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
 style={{ display:"none" }}
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
 >
 <line x1="12" y1="5" x2="12" y2="19" />
 <line x1="5" y1="12" x2="19" y2="12" />
 </svg>
 <span>
 <strong>Extra Details & Flaws</strong> — Upload up to 10
 </span>
 <span className="text-muted text-xs">
 {extraFiles.length}/10 photos · Click or drag files here
 </span>
 </div>
 {extraFiles.length > 0 && (
 <div className="mt-4 flex flex-wrap gap-2">
 {extraFiles.map((ef, i) => (
 <div
 key={i}
 className="border-edge relative h-[100px] w-[100px] overflow-hidden rounded-md border"
 >
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={ef.previewUrl} alt={`Extra detail ${i + 1}`} />
 <button
 className="bg-[rgba(0,0,0,0.7)] absolute top-[6px] right-[6px] z-[2] flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-full border-0 text-[0.85rem] text-white transition-colors"
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
 className="bg-[rgba(0,0,0,0.7)] absolute right-[4px] bottom-[4px] flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full border-0 text-[13px] leading-none text-white opacity-0 transition-opacity"
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
 <div className="text-forest shrink-0">
 <svg
 width="16"
 height="16"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
 </svg>
 <span>
 AI Detected: <strong>{aiResult.mold_name}</strong> · {aiResult.manufacturer} ·{""}
 {aiResult.scale}
 </span>
 </div>
 )}
 </div>

 <div className="mt-8 flex items-center justify-between gap-4">
 <div className="mt-8-spacer flex items-center justify-between gap-4" />
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={goNext}
 id="step-1-next"
 >
 Next: Reference Link →
 </button>
 </div>
 </div>
 )}

 {/* ================================================================
 STEP 2 (index 1): Reference Link
 — Use CSS display instead of unmounting to preserve component state
 ================================================================ */}
 <div className="step-content" key="step-1" style={{ display: currentStep === 1 ?"block" :"none" }}>
 <div className="relative overflow-visible rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
 <div className="mb-6 flex items-center gap-3">
 <div className="text-2xl">
 🔗
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
 externalSearchQuery={aiSearchQuery}
 aiNotice={
 aiResult ? (
 <div className="text-forest mb-6 shrink-0">
 <svg
 width="16"
 height="16"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
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

 <div className="mt-8 flex items-center justify-between gap-4">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={goBack}
 id="step-2-back"
 >
 ← Back
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={goNext}
 disabled={!canProceedStep(1)}
 id="step-2-next"
 >
 {selectedCatalogId ?"Next: Identity →" :"Skip → No Reference"}
 </button>
 </div>
 </div>

 {/* ================================================================
 STEP 3 (index 2): Identity
 ================================================================ */}
 {currentStep === 2 && (
 <div className="step-content" key="step-2">
 <div className="relative overflow-visible rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
 {/* Reference summary badge */}
 {selectedCatalogItem && (
 <div className="mt-4 mb-6 rounded-lg border border-stone-200 bg-stone-50 px-6 py-4 text-sm leading-relaxed">
 🔗 Linked to: <strong>{selectedCatalogItem.title}</strong> · {selectedCatalogItem.maker}
 </div>
 )}

 <div className="mb-6 flex items-center gap-3">
 <div className="text-2xl">
 🏷️
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
 <label htmlFor="custom-name" className="text-ink mb-1 block text-sm font-semibold">
 Custom Name *
 </label>
 <Input
 id="custom-name"
 type="text"
 
 placeholder="e.g. Midnight Star, Patches, Stormy…"
 value={customName}
 onChange={(e) => setCustomName(e.target.value)}
 autoFocus
 maxLength={100}
 />
 <span className="text-muted mt-1 block text-xs">
 What do you call this model? This can be a show name, pet name, or whatever you like.
 </span>
 </div>

 <div className="mb-6">
 <label htmlFor="sculptor" className="text-ink mb-1 block text-sm font-semibold">
 Sculptor / Artist
 </label>
 <Input
 id="sculptor"
 type="text"
 
 placeholder="e.g. Sarah Rose, Brigitte Eberl, Kathleen Moody…"
 value={sculptor}
 onChange={(e) => setSculptor(e.target.value)}
 maxLength={100}
 />
 <span className="text-muted mt-1 block text-xs">
 Optional — tag the sculptor or artist, especially for Artist Resins or custom work.
 </span>
 </div>

 <div className="mb-6">
 <label htmlFor="finishing-artist" className="text-ink mb-1 block text-sm font-semibold">
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
 <span className="text-muted mt-1 block text-xs">
 The artist who painted/finished this model (if different from sculptor).
 </span>
 </div>

 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">📋 Edition Info</label>
 <div className="gap-2" style={{ display:"flex", alignItems:"center" }}>
 <Input
 type="number"
 
 placeholder="#"
 value={editionNumber}
 onChange={(e) => setEditionNumber(e.target.value)}
 style={{ width: 80 }}
 min="1"
 />
 <span className="text-muted">of</span>
 <Input
 type="number"
 
 placeholder="Total"
 value={editionSize}
 onChange={(e) => setEditionSize(e.target.value)}
 style={{ width: 80 }}
 min="1"
 />
 </div>
 <span className="text-muted mt-1 block text-xs">
 e.g., &quot;3 of 50&quot; for limited edition runs.
 </span>
 </div>

 {/* Finish Type — model only */}
 {isModel && (
 <div className="mb-6">
 <label htmlFor="finish-type" className="text-ink mb-1 block text-sm font-semibold">
 Finish Type *
 </label>
 <select
 id="finish-type"
 className="flex h-10 w-full rounded-md border border-edge bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Finish Details</label>
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
 <label className="text-ink mb-1 block text-sm font-semibold">Public Notes</label>
 <Textarea
 
 value={publicNotes}
 onChange={(e) => setPublicNotes(e.target.value)}
 placeholder="Visible on your passport — e.g. comes with original box, factory rubs on near leg"
 maxLength={500}
 rows={2}
 id="public-notes"
 />
 <small className="text-muted text-[var(--font-size-xs)]">
 These notes will be visible to anyone viewing this horse&apos;s passport.
 </small>
 </div>

 {/* ── Show Bio (Optional) ── */}
 <div className="my-5 text-muted mt-4 mb-3 flex items-center gap-4 text-sm">
 <h4 className="text-ink-light font-semibold text-[var(--font-size-md)]">
 🏅 Show Bio <span className="font-normal text-[var(--font-size-sm)]">(Optional)</span>
 </h4>
 <small className="text-muted mt-1" style={{ display:"block" }}>
 The show identity you assign for competition — breed, gender, and age for show ring
 divisions.
 </small>
 </div>

 <div
 className="form-row gap-4 max-md:flex-col max-md:gap-4"
 style={{ display:"flex", flexWrap:"wrap" }}
 >
 <div className="mb-6" style={{ flex:"1 1 200px" }}>
 <label className="text-ink mb-1 block text-sm font-semibold">Assigned Breed</label>
 <Input
 
 type="text"
 value={assignedBreed}
 onChange={(e) => setAssignedBreed(e.target.value)}
 placeholder="e.g. Andalusian, Arabian, Quarter Horse"
 maxLength={100}
 id="assigned-breed"
 />
 </div>
 <div className="mb-6" style={{ flex:"1 1 150px" }}>
 <label className="text-ink mb-1 block text-sm font-semibold">Assigned Gender</label>
 <select
 className="flex h-10 w-full rounded-md border border-edge bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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

 <div
 className="form-row gap-4 max-md:flex-col max-md:gap-4"
 style={{ display:"flex", flexWrap:"wrap" }}
 >
 <div className="mb-6" style={{ flex:"1 1 150px" }}>
 <label className="text-ink mb-1 block text-sm font-semibold">Assigned Age</label>
 <Input
 
 type="text"
 value={assignedAge}
 onChange={(e) => setAssignedAge(e.target.value)}
 placeholder="e.g. Foal, Yearling, Adult, 5 years"
 maxLength={50}
 id="assigned-age"
 />
 </div>
 <div className="mb-6" style={{ flex:"1 1 200px" }}>
 <label className="text-ink mb-1 block text-sm font-semibold">Regional Show ID</label>
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

 {/* Condition Grade — model only */}
 {isModel && (
 <div className="mb-6">
 <label htmlFor="condition-grade" className="text-ink mb-1 block text-sm font-semibold">
 Condition Grade *
 </label>
 <select
 id="condition-grade"
 className="flex h-10 w-full rounded-md border border-edge bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
 <div className="mb-6">
 <label htmlFor="life-stage" className="text-ink mb-1 block text-sm font-semibold">
 🐾 Life Stage
 </label>
 <select
 id="life-stage"
 className="flex h-10 w-full rounded-md border border-edge bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={lifeStage}
 onChange={(e) => setLifeStage(e.target.value)}
 >
 <option value="blank">🎨 Blank / Unpainted</option>
 <option value="stripped">🛁 Stripped / Body</option>
 <option value="in_progress">🔧 Work in Progress</option>
 <option value="completed">✅ Completed</option>
 <option value="for_sale">💲 For Sale</option>
 </select>
 <span className="text-muted mt-1 block text-xs">
 This sets the life stage on your Hoofprint™ timeline.
 </span>
 </div>
 )}

 <CollectionPicker
 selectedCollectionIds={selectedCollectionIds}
 onSelect={setSelectedCollectionIds}
 />

 {/* Trade / Marketplace Status */}
 <div className="mb-6">
 <label htmlFor="trade-status" className="text-ink mb-1 block text-sm font-semibold">
 Marketplace Status
 </label>
 <select
 id="trade-status"
 className="flex h-10 w-full rounded-md border border-edge bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
 <div className="bg-[rgba(34,197,94,0.05)] border-[rgba(34,197,94,0.15)] animate-fade-in-up mt-4 rounded-md border p-4">
 <div className="mb-6">
 <label
 htmlFor="listing-price"
 className="text-ink mb-1 block text-sm font-semibold"
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
 <span className="text-muted mt-1 block text-xs">
 Optional — leave blank for &ldquo;Contact for price&rdquo;
 </span>
 </div>
 <div className="mb-6">
 <label
 htmlFor="marketplace-notes"
 className="text-ink mb-1 block text-sm font-semibold"
 >
 📝 Seller Notes
 </label>
 <Textarea
 id="marketplace-notes"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-4 py-2 text-sm font-semibold no-underline transition-all"
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
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={goBack}
 id="step-3-back"
 >
 ← Back
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={goNext}
 disabled={!canProceedStep(2)}
 id="step-3-next"
 >
 Next: Financial Vault →
 </button>
 </div>

 {/* Community visibility selector */}
 <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 px-6 py-4">
 <div
 className="flex items-center justify-between gap-2 gap-6"
 style={{ flexDirection:"column" }}
 >
 <span className="text-ink text-base font-semibold">
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
 className={`bg-surface-primary font-inherit text-ink hover:border-forest hover:bg-surface-secondary flex min-w-[120px] flex-1 cursor-pointer flex-col items-center gap-1 rounded-lg border-2 px-2 py-3 transition-all ${visibility === opt.value ?"border-forest bg-[rgba(44,85,69,0.1)]" :"border-edge"}`}
 onClick={() => setVisibility(opt.value)}
 id={`visibility-${opt.value}`}
 >
 <span className="text-2xl">{opt.icon}</span>
 <span className="text-sm font-semibold">{opt.label}</span>
 <span className="text-muted text-center text-xs">{opt.hint}</span>
 </button>
 ))}
 </div>
 </div>
 </div>
 </div>
 )}

 {/* ================================================================
 STEP 4: Financial Vault
 ================================================================ */}
 {currentStep === 3 && (
 <div className="step-content" key="step-3">
 {/* Reference summary badge */}
 {selectedCatalogItem && (
 <div className="mt-4 mb-6 rounded-lg border border-stone-200 bg-stone-50 px-6 py-4 text-sm leading-relaxed">
 🔗 Linked to: <strong>{selectedCatalogItem.title}</strong> · {selectedCatalogItem.maker}
 </div>
 )}

 <div className="relative overflow-visible rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
 {/* Vault Header */}
 <div className="border-[rgba(240,160,108,0.2)] mb-8 flex items-center gap-4 border-b pb-6">
 <div className="vault-icon">🔒</div>
 <div>
 <h2>The Financial Vault</h2>
 <p>Optional — record purchase details and valuations</p>
 </div>
 </div>

 {/* Privacy reassurance */}
 <div
 className="bg-[rgba(240,160,108,0.08)] border-[rgba(240,160,108,0.2)] mb-8 flex items-start gap-2 rounded-md border p-4"
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

 <div className="grid grid-cols-2 gap-6">
 <div className="mb-6">
 <label htmlFor="purchase-price" className="text-ink mb-1 block text-sm font-semibold">
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
 />
 </div>

 <div className="mb-6">
 <label htmlFor="purchase-date" className="text-ink mb-1 block text-sm font-semibold">
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
 <label className="text-ink mb-1 block text-sm font-semibold">
 Approximate Purchase Date
 </label>
 <Input
 
 type="text"
 value={purchaseDateText}
 onChange={(e) => setPurchaseDateText(e.target.value)}
 placeholder="e.g. BreyerFest 2017, Summer 2015, Christmas 2020"
 id="purchase-date-text"
 />
 <small className="text-muted text-[var(--font-size-xs)]">
 Use this when you don&apos;t remember the exact date.
 </small>
 </div>

 <div className="grid grid-cols-2 gap-6">
 <div className="mb-6">
 <label htmlFor="estimated-value" className="text-ink mb-1 block text-sm font-semibold">
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
 />
 </div>

 <div className="mb-6">
 <label htmlFor="insurance-notes" className="text-ink mb-1 block text-sm font-semibold">
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

 <div className="border-edge mt-6 border-t pt-6 text-center">
 <p>
 💡 All fields are optional. You can always add or update financial details later from
 your Horse Passport view.
 </p>
 </div>
 </div>

 <div className="mt-8 flex items-center justify-between gap-4">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={goBack}
 id="step-4-back"
 >
 ← Back
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleSubmit}
 disabled={isSubmitting || !canProceedStep(2)}
 id="submit-horse"
 >
 {isSubmitting ? (
 <>
 <span
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 aria-hidden="true"
 />
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
 <div
 className="fixed top-20 right-6 z-50 flex flex-col gap-2"
 aria-live="polite"
 >
 {aiToasts.map((toast) => (
 <div key={toast.id} className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg ${toast.type === "success" ? "border-green-200 bg-green-50 text-green-800" : toast.type === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-blue-200 bg-blue-50 text-blue-800"}`} role="status">
 <span className="shrink-0 text-lg">
 {toast.type ==="success" ?"✨" : toast.type ==="error" ?"⚠️" :"ℹ️"}
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
