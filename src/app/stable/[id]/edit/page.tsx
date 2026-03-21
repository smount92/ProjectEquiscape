"use client";

import { useState, useEffect, useRef } from"react";
import { useRouter, useParams } from"next/navigation";
import Link from"next/link";
import { createClient } from"@/lib/supabase/client";
import type { FinishType, AngleProfile, AssetCategory } from"@/lib/types/database";
import UnifiedReferenceSearch from"@/components/UnifiedReferenceSearch";
import type { CatalogItem } from"@/app/actions/reference";
import CollectionPicker from"@/components/CollectionPicker";
import { compressImage, compressImageWithWatermark } from"@/lib/utils/imageCompression";
import { updateLifeStage } from"@/app/actions/hoofprint";
import { updateHorseAction, deleteHorseImageAction, finalizeHorseImages } from"@/app/actions/horse";
import { getProfile } from"@/app/actions/settings";
import { getHorseCollections, setHorseCollections } from"@/app/actions/collections";
import ImageCropModal from"@/components/ImageCropModal";
import { getPublicImageUrl } from"@/lib/utils/storage";

// ---- Types ----

interface VaultData {
 purchase_price: number | null;
 purchase_date: string | null;
 estimated_current_value: number | null;
 insurance_notes: string | null;
 purchase_date_text: string | null;
}

const PHOTO_STUDIO_SLOTS: { angle: AngleProfile; label: string; primary?: boolean }[] = [
 { angle:"Primary_Thumbnail", label:"Near-Side", primary: true },
 { angle:"Right_Side", label:"Off-Side" },
 { angle:"Front_Chest", label:"Front / Chest" },
 { angle:"Back_Hind", label:"Hindquarters / Tail" },
 { angle:"Belly_Makers_Mark", label:"Belly / Maker's Mark" },
];

interface ExistingImage {
 recordId: string;
 imageUrl: string;
 storagePath: string | null;
}

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
 const [finishType, setFinishType] = useState<FinishType |"">("");
 const [conditionGrade, setConditionGrade] = useState("");
 const [originalCondition, setOriginalCondition] = useState("");
 const [conditionNote, setConditionNote] = useState("");
 const [visibility, setVisibility] = useState<"public" |"unlisted" |"private">("public");
 const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
 const [tradeStatus, setTradeStatus] = useState("Not for Sale");
 const [listingPrice, setListingPrice] = useState("");
 const [marketplaceNotes, setMarketplaceNotes] = useState("");
 const [lifeStage, setLifeStage] = useState("completed");
 const [assetCategory, setAssetCategory] = useState<AssetCategory>("model");

 const isModel = assetCategory ==="model";

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
 const [pendingImageDeletes, setPendingImageDeletes] = useState<{ recordId: string; path: string | null }[]>([]);

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
 .select(
"id, owner_id, custom_name, sculptor, finishing_artist, edition_number, edition_size, finish_type, condition_grade, is_public, visibility, collection_id, catalog_id, trade_status, listing_price, marketplace_notes, life_stage, asset_category, finish_details, public_notes, assigned_breed, assigned_gender, assigned_age, regional_id",
 )
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
 setSculptor(horse.sculptor ||"");
 setFinishingArtist(horse.finishing_artist ||"");
 setEditionNumber(horse.edition_number ? String(horse.edition_number) :"");
 setEditionSize(horse.edition_size ? String(horse.edition_size) :"");
 setFinishType(horse.finish_type ||"");
 setConditionGrade(horse.condition_grade ||"");
 setOriginalCondition(horse.condition_grade ||"");
 setAssetCategory(horse.asset_category ||"model");
 // Map visibility from DB (fallback to is_public for pre-migration data)
 const vis = horse.visibility as"public" |"unlisted" |"private" | null;
 if (vis) {
 setVisibility(vis);
 } else {
 setVisibility(horse.is_public ?"public" :"private");
 }
 // Load collection IDs from junction table
 getHorseCollections(horseId).then((ids) => {
 if (ids.length > 0) {
 setSelectedCollectionIds(ids);
 } else if (horse.collection_id) {
 // Fallback to legacy FK
 setSelectedCollectionIds([horse.collection_id]);
 }
 });
 setTradeStatus(horse.trade_status ||"Not for Sale");
 if (horse.listing_price !== null) setListingPrice(String(horse.listing_price));
 setMarketplaceNotes(horse.marketplace_notes ||"");
 setLifeStage(horse.life_stage ||"completed");
 setFinishDetails(horse.finish_details ||"");
 setPublicNotes(horse.public_notes ||"");
 setAssignedBreed(horse.assigned_breed ||"");
 setAssignedGender(horse.assigned_gender ||"");
 setAssignedAge(horse.assigned_age ||"");
 setRegionalId(horse.regional_id ||"");

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
 .filter((img) => img.angle_profile ==="extra_detail")
 .map((img) => {
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
 setNewExtraFiles((prev) =>
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
 setNewExtraFiles((prev) => [...prev, { file: croppedFile, previewUrl }]);
 setCropFile(null);
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
 setNewFiles((prev) => {
 const u = { ...prev };
 delete u[angle];
 return u;
 });
 setPreviews(
 (prev) =>
 ({
 ...prev,
 [angle]: existingImages[angle]?.imageUrl || undefined,
 }) as Partial<Record<AngleProfile, string>>,
 );
 const ref = fileInputRefs.current[angle];
 if (ref) ref.value ="";
 };

 const handleSlotRemove = (angle: AngleProfile) => {
 const existing = existingImages[angle];
 if (existing && existing.recordId) {
 // Defer deletion until save — prevents data loss if user cancels
 setPendingImageDeletes((prev) => [
 ...prev,
 { recordId: existing.recordId, path: existing.storagePath || null },
 ]);
 }
 setNewFiles((prev) => {
 const u = { ...prev };
 delete u[angle];
 return u;
 });
 setPreviews((prev) => {
 const u = { ...prev };
 delete u[angle];
 return u;
 });
 setExistingImages((prev) => {
 const u = { ...prev };
 delete u[angle];
 return u;
 });
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
 const {
 data: { user },
 } = await supabase.auth.getUser();
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
 is_public: visibility ==="public" || visibility ==="unlisted",
 visibility,
 trade_status: tradeStatus,
 listing_price: tradeStatus !=="Not for Sale" && listingPrice ? parseFloat(listingPrice) : null,
 marketplace_notes:
 tradeStatus !=="Not for Sale" && marketplaceNotes.trim() ? marketplaceNotes.trim() : null,
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
 const vaultData: Record<string, unknown> | null = hasVaultData
 ? {
 purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
 purchase_date: purchaseDate || null,
 estimated_current_value: estimatedValue ? parseFloat(estimatedValue) : null,
 insurance_notes: insuranceNotes || null,
 purchase_date_text: purchaseDateText.trim() || null,
 }
 : null;

 const deleteVault = !hasVaultData && hasExistingVault;

 // Step 1: Update DB record (text only — no files)
 const result = await updateHorseAction(horseId, {
 horseUpdate,
 vaultData,
 hasExistingVault,
 deleteVault,
 conditionChange:
 conditionGrade !== originalCondition
 ? {
 newCondition: conditionGrade,
 note: conditionNote.trim() || null,
 }
 : null,
 });

 if (!result.success) throw new Error(result.error ||"Failed to save.");

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
 const compressed =
 watermarkEnabled && userAlias
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
 .upload(filePath, compressed, { contentType:"image/webp" });

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
 const compressed =
 watermarkEnabled && userAlias
 ? await compressImageWithWatermark(newExtraFiles[i].file, userAlias)
 : await compressImage(newExtraFiles[i].file);
 const filePath = `horses/${horseId}/extra_detail_${Date.now()}_${i}.webp`;
 const { error: uploadError } = await supabase.storage
 .from("horse-images")
 .upload(filePath, compressed, { contentType:"image/webp" });

 if (uploadError) {
 console.error(`Upload failed for extra detail ${i}:`, uploadError);
 uploadErrors.push(`Extra photo ${i + 1}: ${uploadError.message}`);
 } else {
 uploadedImages.push({ path: filePath, angle:"extra_detail" });
 }
 }

 // Step 3: Finalize image metadata on server
 if (uploadedImages.length > 0) {
 const finalizeResult = await finalizeHorseImages(horseId, uploadedImages);
 if (!finalizeResult.success) {
 console.error("Finalize failed:", finalizeResult.error);
 uploadErrors.push(`Save failed: ${finalizeResult.error ||"Unknown error"}`);
 }
 }

 // Show upload errors but still redirect (text fields saved successfully)
 if (uploadErrors.length > 0) {
 console.error("Photo upload errors:", uploadErrors);
 // Don't block — text data saved, show partial-success toast
 }

 // Activity event if public
 if (visibility ==="public") {
 // Count total photos: remaining existing (minus pending deletes) + newly uploaded
 const remainingExisting =
 Object.keys(existingImages).length + existingExtras.length - pendingImageDeletes.length;
 const totalPhotos = Math.max(0, remainingExisting) + uploadedImages.length;

 import("@/app/actions/horse-events")
 .then((m) => {
 m.notifyHorsePublic({
 userId: user.id,
 horseId,
 horseName: customName.trim(),
 finishType: finishType as string,
 tradeStatus: tradeStatus as string,
 catalogId: selectedCatalogId || null,
 photoCount: totalPhotos,
 });
 })
 .catch(() => {});
 }

 // ⚡ REMOVED: addTimelineEvent for listed status — now derived from view

 // Redirect — use Next.js router instead of window.location for serverless safety
 const uploadCount = uploadedImages.length;
 const hadNewPhotos = Object.keys(newFiles).length > 0 || newExtraFiles.length > 0;
 let toastParam ="updated";
 if (uploadErrors.length > 0) {
 toastParam ="photo_error";
 } else if (uploadCount > 0) {
 toastParam ="photos_updated";
 }
 router.push(
 `/dashboard?toast=${toastParam}&name=${encodeURIComponent(customName.trim())}&photos=${uploadCount}&expected=${hadNewPhotos ? Object.keys(newFiles).length + newExtraFiles.length : 0}`,
 );
 } catch (err) {
 setSaveError(err instanceof Error ? err.message :"Failed to save changes.");
 } finally {
 setIsSaving(false);
 }
 };

 // ---- RENDER ----

 if (isLoading) {
 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 px-[0] py-12 py-[0]">
 <div
 className="mx-auto max-w-[680px] p-[var(--space-3xl)] px-[0] py-12"
 style={{ textAlign:"center" }}
 >
 <div
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 style={{ borderTopColor:"var(--color-accent-primary)" }}
 />
 <p>Loading horse details…</p>
 </div>
 </div>
 );
 }

 if (error) {
 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 px-[0] py-12 py-[0]">
 <div className="bg-card border-edge rounded-lg border px-8 py-[var(--space-3xl)] text-center shadow-md transition-all">
 <div className="mb-4 text-5xl">🚫</div>
 <h1>Access Denied</h1>
 <p>{error}</p>
 <Link
 href="/dashboard"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 >
 Back to Stable
 </Link>
 </div>
 </div>
 );
 }

 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 px-[0] py-12 py-[0]">
 <nav className="text-muted animate-fade-in-up mb-6 flex items-center gap-2 text-sm" aria-label="Breadcrumb">
 <Link href="/dashboard">Digital Stable</Link>
 <span className="separator" aria-hidden="true">
 /
 </span>
 <Link href={`/stable/${horseId}`}>{customName}</Link>
 <span className="separator" aria-hidden="true">
 /
 </span>
 <span>Edit</span>
 </nav>

 <div className="animate-fade-in-up mx-auto max-w-[680px] px-[0] py-12">
 <h1 className="mb-8">
 Edit <span className="text-forest">{customName}</span>
 </h1>

 {saveError && (
 <div
 className="text-danger mt-2 mb-8 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm"
 role="alert"
 >
 <svg
 width="16"
 height="16"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 >
 <circle cx="12" cy="12" r="10" />
 <line x1="15" y1="9" x2="9" y2="15" />
 <line x1="9" y1="9" x2="15" y2="15" />
 </svg>
 {saveError}
 </div>
 )}

 {/* ===== Photo Studio ===== */}
 <div className="bg-card border-edge mb-8 rounded-lg border shadow-md transition-all">
 <div className="bg-card border-edge mb-8sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 <div className="bg-card border-edge mb-8-icon rounded-lg border shadow-md transition-all">
 📸
 </div>
 <h2>Photo Studio</h2>
 </div>
 <p className="text-muted mb-4 text-sm">
 Upload up to 4 standardized angles. The primary photo is used as the thumbnail everywhere.
 </p>

 <div className="grid grid-cols-2 gap-4">
 {PHOTO_STUDIO_SLOTS.map((slot) => {
 const preview = previews[slot.angle];
 const hasNew = !!newFiles[slot.angle];
 const isDrag = draggingAngle === slot.angle;

 return (
 <div key={slot.angle} className="flex flex-col">
 <div className="text-ink mb-1 flex items-center gap-1 text-sm font-semibold">
 {slot.label}
 {slot.primary && (
 <span className="bg-[rgba(44,85,69,0.1)] rounded-full px-[8px] py-[2px] text-xs font-bold text-[#2C5545]">
 Required
 </span>
 )}
 </div>
 <div
 className={`image-upload-zone ${isDrag ?"drag-active" :""} ${preview ?"has-preview" :""}`}
 onClick={() => fileInputRefs.current[slot.angle]?.click()}
 onDragOver={(e) => {
 e.preventDefault();
 setDraggingAngle(slot.angle);
 }}
 onDragLeave={() => setDraggingAngle(null)}
 onDrop={(e) => handleSlotDrop(slot.angle, e)}
 role="button"
 tabIndex={0}
 aria-label={`Upload ${slot.label} photo`}
 >
 <input
 ref={(el) => {
 if (el) fileInputRefs.current[slot.angle] = el;
 }}
 type="file"
 accept="image/*"
 onChange={(e) => {
 const f = e.target.files?.[0];
 if (f) handleSlotSelect(slot.angle, f);
 }}
 style={{ display:"none" }}
 />
 {preview ? (
 <div className="relative w-full">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={preview} alt={slot.label} />
 <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[rgba(0,0,0,0.6)] text-sm font-medium text-white opacity-[0] transition-all">
 <svg
 width="20"
 height="20"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
 <polyline points="17 8 12 3 7 8" />
 <line x1="12" y1="3" x2="12" y2="15" />
 </svg>
 <span>Replace</span>
 </div>
 </div>
 ) : (
 <div className="text-muted flex flex-col items-center gap-2 p-8">
 <svg
 width="28"
 height="28"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="1.5"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
 <circle cx="8.5" cy="8.5" r="1.5" />
 <polyline points="21 15 16 10 5 21" />
 </svg>
 <span>{slot.primary ?"+ Add Photo" :"+ Optional"}</span>
 </div>
 )}
 </div>
 {hasNew && (
 <button
 type="button"
 className="hover:0.2)] hover:0.5)] mt-2 inline-flex cursor-pointer items-center gap-[4px] rounded-full border border-[rgba(251,146,60,0.3)] bg-[rgba(251,146,60,0.1)] px-[14px] py-[6px] font-[inherit] text-xs font-semibold text-[#fb923c] transition-all"
 onClick={(e) => {
 e.stopPropagation();
 handleSlotRevert(slot.angle);
 }}
 >
 ↩ Revert
 </button>
 )}
 {!hasNew && preview && !slot.primary && (
 <button
 type="button"
 className="hover:0.2)] hover:0.5)] mt-2 inline-flex cursor-pointer items-center gap-[4px] rounded-full border border-[rgba(251,146,60,0.3)] bg-[rgba(251,146,60,0.1)] px-[14px] py-[6px] font-[inherit] text-xs font-semibold text-[#fb923c] transition-all"
 style={{
 color:"#ef4444",
 background:"rgba(239,68,68,0.1)",
 borderColor:"rgba(239,68,68,0.3)",
 }}
 onClick={(e) => {
 e.stopPropagation();
 handleSlotRemove(slot.angle);
 }}
 >
 ✕ Remove
 </button>
 )}
 </div>
 );
 })}
 </div>

 {/* Extra Details Multi-Upload Zone */}
 <div className="border-edge mt-6 border-t pt-6">
 <div className="text-ink mb-1 flex items-center gap-1 text-sm font-semibold">
 Extra Details & Flaws
 <span className="text-muted text-xs font-normal">
 {existingExtras.length + newExtraFiles.length}/10
 </span>
 </div>
 <div
 className="opacity-[0.4]"
 onClick={() => extraInputRef.current?.click()}
 onDragOver={(e) => e.preventDefault()}
 onDrop={(e) => {
 e.preventDefault();
 const files = Array.from(e.dataTransfer.files).filter((f) =>
 f.type.startsWith("image/"),
 );
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
 const files = Array.from(e.target.files || []).filter((f) =>
 f.type.startsWith("image/"),
 );
 if (existingExtras.length + newExtraFiles.length + files.length > 10) {
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
 <span>Upload up to 10 · Click or drag files here</span>
 </div>

 {/* Existing extras — drag to reorder */}
 {(existingExtras.length > 0 || newExtraFiles.length > 0) && (
 <div className="mt-4 flex flex-wrap gap-2">
 {existingExtras.map((ex, idx) => (
 <div
 key={ex.recordId}
 className={`extras-preview-item group cursor-grab ${dragExtraIdx === idx ?"outline-accent-primary opacity-40 outline-2 outline-dashed" :""}`}
 draggable
 onDragStart={(e) => {
 setDragExtraIdx(idx);
 e.dataTransfer.effectAllowed ="move";
 }}
 onDragOver={(e) => {
 e.preventDefault();
 e.dataTransfer.dropEffect ="move";
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
 await reorderHorseImages(
 horseId,
 reordered.map((r) => r.recordId),
 );
 }}
 onDragEnd={() => setDragExtraIdx(null)}
 >
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={ex.imageUrl} alt="Extra detail" />
 <div
 className="absolute top-1 right-7 z-[3] flex h-5.5 w-5.5 cursor-grab items-center justify-center rounded-sm bg-black/50 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
 title="Drag to reorder"
 >
 ⠇
 </div>
 <button
 className="bg-[rgba(0,0,0,0.7)] absolute top-[6px] right-[6px] z-[2] flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-full border-0 text-[0.85rem] text-white transition-colors"
 onClick={async (e) => {
 e.stopPropagation();
 await deleteHorseImageAction(ex.recordId, ex.storagePath || null);
 setExistingExtras((prev) =>
 prev.filter((item) => item.recordId !== ex.recordId),
 );
 }}
 aria-label="Remove extra photo"
 >
 ✕
 </button>
 </div>
 ))}
 {newExtraFiles.map((ef, i) => (
 <div
 key={`new-${i}`}
 className="border-edge relative h-[100px] w-[100px] overflow-hidden rounded-md border"
 >
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={ef.previewUrl} alt={`New extra ${i + 1}`} />
 <button
 className="bg-[rgba(0,0,0,0.7)] absolute top-[6px] right-[6px] z-[2] flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-full border-0 text-[0.85rem] text-white transition-colors"
 onClick={(e) => {
 e.stopPropagation();
 URL.revokeObjectURL(ef.previewUrl);
 setNewExtraFiles((prev) => prev.filter((_, idx) => idx !== i));
 }}
 aria-label={`Remove new extra ${i + 1}`}
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
 </div>

 {/* ===== Section 1: Identity ===== */}
 <div className="bg-card border-edge mb-8 rounded-lg border shadow-md transition-all">
 <div className="bg-card border-edge mb-8sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 <div className="bg-card border-edge mb-8-icon rounded-lg border shadow-md transition-all">
 🏷️
 </div>
 <h2>Model Identity</h2>
 </div>

 <div className="mb-6">
 <label htmlFor="edit-name" className="text-ink mb-1 block text-sm font-semibold">
 Custom Name *
 </label>
 <input
 id="edit-name"
 type="text"
 className="form-input"
 value={customName}
 onChange={(e) => setCustomName(e.target.value)}
 maxLength={100}
 />
 </div>

 <div className="mb-6">
 <label htmlFor="edit-sculptor" className="text-ink mb-1 block text-sm font-semibold">
 Sculptor / Artist
 </label>
 <input
 id="edit-sculptor"
 type="text"
 className="form-input"
 value={sculptor}
 onChange={(e) => setSculptor(e.target.value)}
 maxLength={100}
 placeholder="e.g. Sarah Rose, Brigitte Eberl…"
 />
 <span className="text-muted mt-1 block text-xs">
 Optional — tag the sculptor or artist, especially for Artist Resins or custom work.
 </span>
 </div>

 <div className="mb-6">
 <label htmlFor="edit-finishing-artist" className="text-ink mb-1 block text-sm font-semibold">
 🎨 Finishing Artist
 </label>
 <input
 id="edit-finishing-artist"
 type="text"
 className="form-input"
 value={finishingArtist}
 onChange={(e) => setFinishingArtist(e.target.value)}
 maxLength={100}
 placeholder="Who painted or customized this model?"
 />
 <span className="text-muted mt-1 block text-xs">
 The artist who painted/finished this model (if different from sculptor).
 </span>
 </div>

 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">📋 Edition Info</label>
 <div className="gap-2" style={{ display:"flex", alignItems:"center" }}>
 <input
 type="number"
 className="form-input"
 placeholder="#"
 value={editionNumber}
 onChange={(e) => setEditionNumber(e.target.value)}
 style={{ width: 80 }}
 min="1"
 />
 <span className="text-muted">of</span>
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
 <span className="text-muted mt-1 block text-xs">
 e.g., &quot;3 of 50&quot; for limited edition runs.
 </span>
 </div>

 {/* Finish Details */}
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Finish Details</label>
 <input
 className="form-input"
 type="text"
 value={finishDetails}
 onChange={(e) => setFinishDetails(e.target.value)}
 placeholder="e.g. Glossy, Matte, Satin, Chalky"
 maxLength={100}
 id="edit-finish-details"
 />
 </div>

 {/* Public Notes */}
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Public Notes</label>
 <textarea
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-4 py-2 text-sm font-semibold no-underline transition-all"
 value={publicNotes}
 onChange={(e) => setPublicNotes(e.target.value)}
 placeholder="Visible on your passport — e.g. comes with original box, factory rubs on near leg"
 maxLength={500}
 rows={2}
 id="edit-public-notes"
 />
 <small className="text-muted text-[var(--font-size-xs)]">
 These notes will be visible to anyone viewing this horse&apos;s passport.
 </small>
 </div>

 {/* Show Bio */}
 <div className="m-[var(--space-xl) 0] text-muted m-[var(--space-lg) 0 var(--space-md)] flex items-center gap-4 text-sm">
 <h4 className="text-ink-light font-semibold text-[var(--font-size-md)]">
 🏅 Show Bio <span className="font-normal text-[var(--font-size-sm)]">(Optional)</span>
 </h4>
 <small className="text-muted mt-1" style={{ display:"block" }}>
 The show identity you assign for competition — breed, gender, and age for show ring
 divisions.
 </small>
 </div>
 <div className="gap-4" style={{ display:"flex", flexWrap:"wrap" }}>
 <div className="mb-6" style={{ flex:"1 1 200px" }}>
 <label className="text-ink mb-1 block text-sm font-semibold">Assigned Breed</label>
 <input
 className="form-input"
 type="text"
 value={assignedBreed}
 onChange={(e) => setAssignedBreed(e.target.value)}
 placeholder="e.g. Andalusian, Arabian"
 maxLength={100}
 id="edit-assigned-breed"
 />
 </div>
 <div className="mb-6" style={{ flex:"1 1 150px" }}>
 <label className="text-ink mb-1 block text-sm font-semibold">Assigned Gender</label>
 <select
 className="form-select"
 value={assignedGender}
 onChange={(e) => setAssignedGender(e.target.value)}
 id="edit-assigned-gender"
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
 <div className="gap-4" style={{ display:"flex", flexWrap:"wrap" }}>
 <div className="mb-6" style={{ flex:"1 1 150px" }}>
 <label className="text-ink mb-1 block text-sm font-semibold">Assigned Age</label>
 <input
 className="form-input"
 type="text"
 value={assignedAge}
 onChange={(e) => setAssignedAge(e.target.value)}
 placeholder="e.g. Foal, Yearling, Adult"
 maxLength={50}
 id="edit-assigned-age"
 />
 </div>
 <div className="mb-6" style={{ flex:"1 1 200px" }}>
 <label className="text-ink mb-1 block text-sm font-semibold">Regional Show ID</label>
 <input
 className="form-input"
 type="text"
 value={regionalId}
 onChange={(e) => setRegionalId(e.target.value)}
 placeholder="e.g. RX number, Texas System ID"
 maxLength={50}
 id="edit-regional-id"
 />
 </div>
 </div>

 {/* Finish Type & Condition — model only */}
 {isModel && (
 <div className="grid grid-cols-2 gap-6">
 <div className="mb-6">
 <label htmlFor="edit-finish" className="text-ink mb-1 block text-sm font-semibold">
 Finish Type *
 </label>
 <select
 id="edit-finish"
 className="form-select"
 value={finishType}
 onChange={(e) => setFinishType(e.target.value as FinishType)}
 >
 <option value="">Select finish type…</option>
 <option value="OF">OF (Original Finish)</option>
 <option value="Custom">Custom (Repaint / Body Mod)</option>
 <option value="Artist Resin">Artist Resin</option>
 </select>
 </div>

 <div className="mb-6">
 <label htmlFor="edit-condition" className="text-ink mb-1 block text-sm font-semibold">
 Condition Grade *
 </label>
 <select
 id="edit-condition"
 className="form-select"
 value={conditionGrade}
 onChange={(e) => setConditionGrade(e.target.value)}
 >
 <option value="">Select condition…</option>
 {CONDITION_GRADES.map((g) => (
 <option key={g.value} value={g.value}>
 {g.label}
 </option>
 ))}
 </select>

 {/* Condition Change Note - shows when condition was changed */}
 {originalCondition && conditionGrade && conditionGrade !== originalCondition && (
 <div className="condition-change-note animate-fade-in-up mt-2">
 <div
 style={{
 fontSize:"calc(var(--font-size-xs) * var(--font-scale))",
 color:"var(--color-accent-warning, #f59e0b)",
 marginBottom:"var(--space-xs)",
 fontWeight: 600,
 }}
 >
 📝 Condition changed: {originalCondition} → {conditionGrade}
 </div>
 <textarea
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-4 py-2 text-sm font-semibold no-underline transition-all"
 rows={2}
 maxLength={300}
 placeholder="What happened? (optional — visible on Hoofprint™)"
 value={conditionNote}
 onChange={(e) => setConditionNote(e.target.value)}
 style={{ fontSize:"calc(var(--font-size-sm) * var(--font-scale))" }}
 />
 <span className="text-muted mt-1 block text-xs">
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
 <label htmlFor="edit-life-stage" className="text-ink mb-1 block text-sm font-semibold">
 🐾 Life Stage
 </label>
 <select
 id="edit-life-stage"
 className="form-select"
 value={lifeStage}
 onChange={(e) => {
 setLifeStage(e.target.value);
 // Auto-create timeline event for stage changes
 updateLifeStage(
 horseId,
 e.target.value as
 |"blank"
 |"stripped"
 |"in_progress"
 |"completed"
 |"for_sale",
 );
 }}
 >
 <option value="blank">🎨 Blank / Unpainted</option>
 <option value="stripped">🛁 Stripped / Body</option>
 <option value="in_progress">🔧 Work in Progress</option>
 <option value="completed">✅ Completed</option>
 <option value="for_sale">💲 For Sale</option>
 </select>
 <span className="text-muted mt-1 block text-xs">
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
 <label htmlFor="edit-trade-status" className="text-ink mb-1 block text-sm font-semibold">
 Marketplace Status
 </label>
 <select
 id="edit-trade-status"
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
 {(tradeStatus ==="For Sale" || tradeStatus ==="Open to Offers") && (
 <div className="bg-[rgba(34,197,94,0.05)] border-[rgba(34,197,94,0.15)] animate-fade-in-up mt-4 rounded-md border p-4">
 <div className="mb-6">
 <label
 htmlFor="edit-listing-price"
 className="text-ink mb-1 block text-sm font-semibold"
 >
 💲 Listing Price
 </label>
 <input
 id="edit-listing-price"
 type="number"
 className="form-input"
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
 htmlFor="edit-marketplace-notes"
 className="text-ink mb-1 block text-sm font-semibold"
 >
 📝 Seller Notes
 </label>
 <textarea
 id="edit-marketplace-notes"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-4 py-2 text-sm font-semibold no-underline transition-all"
 rows={3}
 maxLength={500}
 placeholder="e.g. Will ship anywhere, Trades welcome..."
 value={marketplaceNotes}
 onChange={(e) => setMarketplaceNotes(e.target.value)}
 />
 </div>
 </div>
 )}
 </div>

 {/* Community visibility selector */}
 <div className="bg-[rgba(44,85,69,0.04)] border-[rgba(44,85,69,0.12)] mt-6 rounded-lg border px-6 py-4">
 <div className="flex items-center justify-between gap-2 gap-6" style={{ flexDirection:"column" }}>
 <span className="text-ink text-[calc(var(--font-size-md)*var(--font-scale))] font-semibold">
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
 id={`edit-visibility-${opt.value}`}
 >
 <span className="text-2xl">{opt.icon}</span>
 <span className="text-sm font-semibold">{opt.label}</span>
 <span className="text-muted text-center text-xs">{opt.hint}</span>
 </button>
 ))}
 </div>
 </div>
 </div>

 {/* ===== Section 2: Reference Link (Unified Search) ===== */}
 <div className="bg-card border-edge mb-8 rounded-lg border shadow-md transition-all">
 <div className="bg-card border-edge mb-8sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 <div className="bg-card border-edge mb-8-icon rounded-lg border shadow-md transition-all">
 🔗
 </div>
 <h2>Reference Link</h2>
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
 setSelectedCatalogId(null);
 setSelectedCatalogItem(null);
 setCustomName(searchTerm);
 }}
 />
 </div>

 {/* ===== Section 3: Financial Vault ===== */}
 <div className="bg-card border-edge relative mb-8 overflow-hidden rounded-lg border shadow-md transition-all">
 <div className="border-[rgba(240,160,108,0.2)] mb-8 flex items-center gap-4 border-b pb-6">
 <div className="vault-icon">🔒</div>
 <div>
 <h2>Financial Vault</h2>
 <p>Optional — update purchase details and valuations</p>
 </div>
 </div>

 <div
 className="bg-[rgba(240,160,108,0.08)] border-[rgba(240,160,108,0.2)] mb-8 flex items-start gap-2 rounded-md border p-4"
 role="note"
 >
 <span className="mt-[2px] shrink-0 text-[1.3em]">🛡️</span>
 <p>
 <strong>This data is encrypted and only visible to you.</strong> Protected by strict Row
 Level Security.
 </p>
 </div>

 <div className="grid grid-cols-2 gap-6">
 <div className="mb-6">
 <label htmlFor="edit-price" className="text-ink mb-1 block text-sm font-semibold">
 Purchase Price
 </label>
 <input
 id="edit-price"
 type="number"
 className="form-input"
 placeholder="0.00"
 min="0"
 step="0.01"
 value={purchasePrice}
 onChange={(e) => setPurchasePrice(e.target.value)}
 />
 </div>
 <div className="mb-6">
 <label htmlFor="edit-date" className="text-ink mb-1 block text-sm font-semibold">
 Purchase Date
 </label>
 <input
 id="edit-date"
 type="date"
 className="form-input"
 value={purchaseDate}
 onChange={(e) => setPurchaseDate(e.target.value)}
 />
 </div>
 </div>

 {/* Fuzzy Purchase Date */}
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Approximate Purchase Date</label>
 <input
 className="form-input"
 type="text"
 value={purchaseDateText}
 onChange={(e) => setPurchaseDateText(e.target.value)}
 placeholder="e.g. BreyerFest 2017, Summer 2015"
 id="edit-purchase-date-text"
 />
 <small className="text-muted text-[var(--font-size-xs)]">
 Use this when you don&apos;t remember the exact date.
 </small>
 </div>

 <div className="grid grid-cols-2 gap-6">
 <div className="mb-6">
 <label htmlFor="edit-value" className="text-ink mb-1 block text-sm font-semibold">
 Estimated Current Value
 </label>
 <input
 id="edit-value"
 type="number"
 className="form-input"
 placeholder="0.00"
 min="0"
 step="0.01"
 value={estimatedValue}
 onChange={(e) => setEstimatedValue(e.target.value)}
 />
 </div>
 <div className="mb-6">
 <label htmlFor="edit-insurance" className="text-ink mb-1 block text-sm font-semibold">
 Insurance Notes
 </label>
 <input
 id="edit-insurance"
 type="text"
 className="form-input"
 placeholder="Policy number, coverage details, etc."
 value={insuranceNotes}
 onChange={(e) => setInsuranceNotes(e.target.value)}
 />
 </div>
 </div>
 </div>

 {/* ===== Actions ===== */}
 <div className="flex justify-end gap-4">
 <Link
 href={`/stable/${horseId}`}
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 id="edit-cancel"
 >
 Cancel
 </Link>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleSave}
 disabled={isSaving || !customName.trim() || !finishType || !conditionGrade}
 id="edit-save"
 >
 {isSaving ? (
 <>
 <span
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 aria-hidden="true"
 />
 {Object.keys(newFiles).length > 0 ?"Uploading…" :"Saving…"}
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
 </div>
 );
}
