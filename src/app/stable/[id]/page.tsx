import { createClient } from"@/lib/supabase/server";
import { redirect, notFound } from"next/navigation";
import Link from"next/link";
import MarketValueBadge from"@/components/MarketValueBadge";
import { getPublicImageUrls } from"@/lib/utils/storage";
import PassportGallery from"@/components/PassportGallery";
import VaultReveal from"@/components/VaultReveal";
import DeleteHorseModal from"@/components/DeleteHorseModal";
import ShowRecordTimeline from"@/components/ShowRecordTimeline";
import PedigreeCard from"@/components/PedigreeCard";
import HoofprintTimeline from"@/components/HoofprintTimeline";
import TransferModal from"@/components/TransferModal";
import ParkedExportPanel from"@/components/ParkedExportPanel";
import { getHoofprint } from"@/app/actions/hoofprint";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import AssetDetailRenderer from"@/components/AssetDetailRenderer";
import { getAssetConfig } from"@/lib/config/assetFields";
import type { AssetCategory } from"@/lib/types/database";


// Types
interface VaultData {
 purchase_price: number | null;
 purchase_date: string | null;
 estimated_current_value: number | null;
 insurance_notes: string | null;
 purchase_date_text: string | null;
}

const ANGLE_LABELS: Record<string, string> = {
 Primary_Thumbnail:"Primary Thumbnail",
 Left_Side:"Left Side",
 Right_Side:"Right Side",
 Front_Chest:"Front / Chest",
 Back_Hind:"Back / Hind",
 Belly_Makers_Mark:"Belly / Mark",
 Detail_Face_Eyes:"Face & Eyes Detail",
 Detail_Ears:"Ears Detail",
 Detail_Hooves:"Hooves Detail",
 Flaw_Rub_Damage:"Flaws / Damage",
 extra_detail:"Detail",
 Other:"Other",
};

// Priority for sorting images (thumbnail first)
const ANGLE_ORDER: string[] = [
"Primary_Thumbnail",
"Right_Side",
"Front_Chest",
"Back_Hind",
"Belly_Makers_Mark",
"Left_Side",
"Detail_Face_Eyes",
"Detail_Ears",
"Detail_Hooves",
"Flaw_Rub_Damage",
"extra_detail",
"Other",
];

export default async function HorsePassportPage({ params }: { params: Promise<{ id: string }> }) {
 const { id: horseId } = await params;
 const supabase = await createClient();

 // Check auth
 const {
 data: { user },
 } = await supabase.auth.getUser();

 if (!user) {
 redirect("/login");
 }

 // Fetch horse with reference data
 const { data: rawHorse } = await supabase
 .from("user_horses")
 .select(
 `
  id, owner_id, custom_name, finish_type, condition_grade, asset_category, attributes,
  is_for_sale, is_public, created_at, sculptor, finishing_artist, finishing_artist_verified, edition_number, edition_size, catalog_id, trade_status,
 finish_details, public_notes, assigned_breed, assigned_gender, assigned_age, regional_id,
 catalog_items:catalog_id(title, maker, scale, item_type, attributes)
 `,
 )
 .eq("id", horseId)
 .single();

 if (!rawHorse) {
 notFound();
 }

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const horse = rawHorse as any;
 const assetCat = (horse.asset_category as AssetCategory) || "model";
 const assetConfig = getAssetConfig(assetCat);
 const horseAttributes = (horse.attributes as Record<string, any>) || {};

 // Only the owner can see the full passport for now
 if (horse.owner_id !== user.id) {
 notFound();
 }

 // Check wishlist demand (only for owner, unlisted horses with catalog_id)
 let wishlistDemand = 0;
 if (horse.trade_status ==="Not for Sale" && horse.catalog_id) {
 const { count } = await supabase
 .from("user_wishlists")
 .select("id", { count:"exact", head: true })
 .eq("catalog_id", horse.catalog_id)
 .neq("user_id", user.id);
 wishlistDemand = count || 0;
 }

 // Fetch all images
 const { data: rawImages } = await supabase
 .from("horse_images")
 .select("id, image_url, angle_profile, uploaded_at, short_slug")
 .eq("horse_id", horseId)
 .order("uploaded_at");

 const images = rawImages ?? [];

 // Sort by angle priority
 images.sort((a, b) => {
 const aIdx = ANGLE_ORDER.indexOf(a.angle_profile);
 const bIdx = ANGLE_ORDER.indexOf(b.angle_profile);
 return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
 });

 // Generate signed URLs for all images
 const imageUrls = images.map((img) => img.image_url);
 const signedUrlMap = getPublicImageUrls(imageUrls);

 const galleryImages = images.map((img) => ({
 signedUrl: signedUrlMap.get(img.image_url) || img.image_url,
 angle_profile: img.angle_profile,
 label: ANGLE_LABELS[img.angle_profile] || img.angle_profile,
 shortSlug: img.short_slug || null,
 }));

 // Fetch financial vault (owner-only via RLS)
 const { data: rawVault } = await supabase
 .from("financial_vault")
 .select("purchase_price, purchase_date, estimated_current_value, insurance_notes, purchase_date_text")
 .eq("horse_id", horseId)
 .single<VaultData>();

 const vault = rawVault ?? null;

 // Fetch owner's currency symbol
 const { data: ownerProfile } = await supabase.from("users").select("currency_symbol").eq("id", user.id).single();
 const currencySymbol = (ownerProfile as { currency_symbol: string } | null)?.currency_symbol ||"$";

 // ================================================================
 // PROVENANCE: Show Records + Pedigree
 // ================================================================

 const { data: rawRecords } = await supabase
 .from("show_records")
 .select(
 'id, show_name, show_date, division, class_name,"placing", ribbon_color, judge_name, is_nan, notes, show_location, section_name, award_category, competition_level, show_date_text, verification_tier',
 )
 .eq("horse_id", horseId)
 .order("show_date", { ascending: false, nullsFirst: false });

 const showRecords = (rawRecords ?? []).map(
 (r) => ({
 id: r.id,
 showName: r.show_name,
 showDate: r.show_date,
 division: r.division,
 className: r.class_name,
 placing: r.placing,
 ribbonColor: r.ribbon_color,
 judgeName: r.judge_name,
 isNan: r.is_nan,
 notes: r.notes,
 showLocation: r.show_location,
 sectionName: r.section_name,
 awardCategory: r.award_category,
 competitionLevel: r.competition_level,
 showDateText: r.show_date_text,
 verificationTier: r.verification_tier,
 }),
 );

 const { data: rawPedigree } = await supabase
 .from("horse_pedigrees")
 .select("id, sire_name, dam_name, sire_id, dam_id, sculptor, cast_number, edition_size, lineage_notes")
 .eq("horse_id", horseId)
 .maybeSingle();

 const pedigree = rawPedigree
 ? {
 id: rawPedigree.id,
 sireName: rawPedigree.sire_name,
 damName: rawPedigree.dam_name,
 sireId: rawPedigree.sire_id,
 damId: rawPedigree.dam_id,
 sculptor: rawPedigree.sculptor,
 castNumber: rawPedigree.cast_number,
 editionSize: rawPedigree.edition_size,
 lineageNotes: rawPedigree.lineage_notes,
 }
 : null;

 // Hoofprint data
 const { timeline, ownershipChain, lifeStage } = await getHoofprint(horseId);

 // Check if horse is parked (for Parked Export panel)
 const isParked = lifeStage ==="parked";
 let existingPin: string | null = null;
 if (isParked) {
 const { data: activeTransfer } = await supabase
 .from("horse_transfers")
 .select("claim_pin")
 .eq("horse_id", horseId)
 .eq("sender_id", user.id)
 .eq("status","pending")
 .not("claim_pin","is", null)
 .order("created_at", { ascending: false })
 .limit(1)
 .maybeSingle();
 existingPin = (activeTransfer as { claim_pin: string } | null)?.claim_pin || null;
 }

 // Reference display info
 const cat = horse.catalog_items;
 const attrs = (cat?.attributes ?? {}) as Record<string, unknown>;
 const refInfo = cat
 ? {
 type: cat.item_type ==="artist_resin" ?"Artist Resin" :"Mold",
 name: cat.title,
 maker: cat.maker,
 scale: cat.scale ||"Unknown",
 extra:
 cat.item_type ==="artist_resin"
 ? (attrs.cast_medium as string | null)
 : attrs.release_year_start
 ? `First released ${attrs.release_year_start}`
 : null,
 }
 : null;

 const releaseInfo =
 cat && cat.item_type ==="plastic_release"
 ? {
 name: cat.title,
 modelNumber: attrs.model_number as string | null,
 color: attrs.color_description as string | null,
 yearStart: attrs.release_year_start as number | null,
 yearEnd: attrs.release_year_end as number | null,
 }
 : null;

 return (
 <ExplorerLayout title={horse.custom_name} description="Horse passport and provenance.">
 {/* Breadcrumb */}
 <nav className="text-stone-600 animate-fade-in-up mb-6 flex items-center gap-2 text-sm" aria-label="Breadcrumb">
 <Link href="/dashboard">Digital Stable</Link>
 <span className="separator" aria-hidden="true">
 /
 </span>
 <span>{horse.custom_name}</span>
 </nav>

 {/* Wishlist demand banner */}
 {wishlistDemand > 0 && (
 <div className="animate-fade-in-up mt-4 mb-6 rounded-lg border border-emerald-200 border-red-200 bg-emerald-50/80 bg-red-50 px-6 py-4 text-sm leading-relaxed">
 🔥{" "}
 <strong>
 {wishlistDemand} collector{wishlistDemand > 1 ?"s" :""}
 </strong>{" "}
 {wishlistDemand > 1 ?"are" :"is"} looking for this model! List it for sale to notify them.
 </div>
 )}

 {/* Two-column layout: Gallery | Ledger Card */}
 <div className="animate-fade-in-up grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
 {/* Left: Gallery */}
 <div className="overflow-hidden rounded-2xl shadow-md">
 <PassportGallery images={galleryImages} />
 </div>

 {/* Right: The Ledger Card */}
 <div className="flex min-h-[100%] flex-col gap-2 rounded-3xl border border-input bg-[#C8B596] px-6 py-8 shadow-sm md:px-10">
 {/* Title */}
 <div>
 <h1 className="mb-1 font-serif text-4xl font-bold leading-tight tracking-tight text-[#2D2318] md:text-5xl">
 {horse.custom_name}
 </h1>
 {refInfo ? (
 <p className="mb-1 text-base text-[#59493A]">
 {refInfo.maker} — {refInfo.name}
 </p>
 ) : (
 <p
 className="mb-1 text-base italic text-[#59493A] opacity-[0.6]"
 >
 Unlisted / Custom Entry
 </p>
 )}
 </div>

 {/* Model Details Card */}
 <div className="rounded-lg border border-[#b8a484]/30 bg-white/10 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-widest text-[#59493A] uppercase">
                <span aria-hidden="true">📋</span>{" "}
 {(horse.asset_category ||"model") ==="model"
 ?"Model Details"
 : `${(horse.asset_category ||"model").charAt(0).toUpperCase() + (horse.asset_category ||"model").slice(1)} Details`}
 </h3>

 {horse.asset_category && (
 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">
 Category
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
  {horse.asset_category === "tack"
  ?"🏇 Tack & Gear"
  : horse.asset_category === "prop"
  ?"🌲 Prop"
  : horse.asset_category === "diorama"
  ?"🎭 Diorama"
  : "🐄 Other Model"}
 </span>
 </div>
 )}

 {horse.finish_type && (
 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">
 Finish Type
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
 {horse.finish_type}
 </span>
 </div>
 )}

 {horse.condition_grade && (
 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">
 Condition
 </span>
 <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
 {horse.condition_grade}
 </span>
 </div>
 )}

 {refInfo ? (
 <>
 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">
 {refInfo.type}
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
 {refInfo.name}
 </span>
 </div>

 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">
 {refInfo.type ==="Mold" ?"Manufacturer" :"Sculptor"}
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
 {refInfo.maker}
 </span>
 </div>

 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">
 Scale
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
 {refInfo.scale}
 </span>
 </div>

 {refInfo.extra && (
 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">
 {refInfo.type ==="Mold" ?"Released" :"Medium"}
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
 {refInfo.extra}
 </span>
 </div>
 )}
 </>
 ) : (
              <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
                <span className="text-sm font-medium text-[#59493A]">
 Reference
 </span>
 <span
 className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318] italic opacity-60"
 >
 Not linked to database — Custom Entry
 </span>
 </div>
 )}

 {releaseInfo && (
 <>
 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">
 Release
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
 {releaseInfo.name}
 </span>
 </div>

 {releaseInfo.modelNumber && (
 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">
 Model #
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
 #{releaseInfo.modelNumber}
 </span>
 </div>
 )}

 {releaseInfo.color && (
 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">
 Color
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
 {releaseInfo.color}
 </span>
 </div>
 )}

 {releaseInfo.yearStart && (
 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">
 Release Years
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
 {releaseInfo.yearStart}
 {releaseInfo.yearEnd && releaseInfo.yearEnd !== releaseInfo.yearStart
 ? `–${releaseInfo.yearEnd}`
 :""}
 </span>
 </div>
 )}
 </>
 )}

 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">Added</span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
 {new Date(horse.created_at).toLocaleDateString("en-US", {
 month:"long",
 day:"numeric",
 year:"numeric",
 })}
 </span>
 </div>

 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">Photos</span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
 {images.length} uploaded
 </span>
 </div>

 {horse.sculptor && (
 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">
 Sculptor / Artist
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
 {horse.sculptor}
 </span>
 </div>
 )}

 {horse.finishing_artist && (
 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">
 🎨 Finished by
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
 {horse.finishing_artist}
 {horse.finishing_artist_verified && (
 <span
 className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-forest/10 px-2 py-0.5 text-xs font-semibold text-emerald-600"
 title="Verified via commission delivery"
 >
 ✅ Verified
 </span>
 )}
 </span>
 </div>
 )}

 {(horse.edition_number || horse.edition_size) && (
 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">
 📋 Edition
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
 {horse.edition_number && horse.edition_size
 ? `${horse.edition_number} of ${horse.edition_size}`
 : horse.edition_size
 ? `Limited to ${horse.edition_size}`
 : `#${horse.edition_number}`}
 </span>
 </div>
 )}
 </div>

 {/* Category-Specific Attributes */}
 {assetCat !== "model" && Object.keys(horseAttributes).length > 0 && (
 <div className="mt-2">
 <AssetDetailRenderer category={assetCat} attributes={horseAttributes} />
 </div>
 )}

 {/* Finish Details */}
 {horse.finish_details && (
 <div className="rounded-lg border border-[#b8a484]/30 bg-white/10 p-5">
 <h3>
 <span aria-hidden="true">✨</span> Finish
 </h3>
 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">
 Finish Details
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
 {horse.finish_details}
 </span>
 </div>
 </div>
 )}

 {/* Show Bio — model only */}
 {assetConfig.showShowBio && (horse.assigned_breed || horse.assigned_gender || horse.assigned_age || horse.regional_id) && (
            <div className="rounded-lg border border-[#b8a484]/30 bg-white/10 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-widest text-[#59493A] uppercase">
                <span aria-hidden="true">🏅</span> Show Identity
              </h3>
 {horse.assigned_breed && (
 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">
 Breed
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
 {horse.assigned_breed}
 </span>
 </div>
 )}
 {horse.assigned_gender && (
 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">
 Gender
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
 {horse.assigned_gender}
 </span>
 </div>
 )}
 {horse.assigned_age && (
 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">
 Age
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
 {horse.assigned_age}
 </span>
 </div>
 )}
 {horse.regional_id && (
 <div className="flex items-center justify-between border-b border-dashed border-[#b8a484]/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-[#59493A]">
 Regional ID
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-[#2D2318]">
 {horse.regional_id}
 </span>
 </div>
 )}
 </div>
 )}

 {/* Public Notes */}
 {horse.public_notes && (
            <div className="rounded-lg border border-[#b8a484]/30 bg-white/10 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-widest text-[#59493A] uppercase">
                <span aria-hidden="true">📝</span> Notes
              </h3>
 <p className="text-stone-600 m-0 leading-[1.6] whitespace-pre-wrap">{horse.public_notes}</p>
 </div>
 )}

 {/* Market Value Badge */}
 {horse.catalog_id && <MarketValueBadge catalogId={horse.catalog_id} />}

 {/* Show Records */}
 <ShowRecordTimeline horseId={horseId} records={showRecords} isOwner={true} />

 {/* Pedigree Card */}
 <PedigreeCard horseId={horseId} pedigree={pedigree} isOwner={true} />

 {/* 🐾 Hoofprint™ Timeline — model + other_model only */}
 {assetConfig.showHoofprint && (
 <HoofprintTimeline
 horseId={horseId}
 timeline={timeline}
 ownershipChain={ownershipChain}
 lifeStage={lifeStage}
 isOwner={true}
 currentUserId={user.id}
 />
 )}

 {/* Financial Vault */}
 <VaultReveal vault={vault} currencySymbol={currencySymbol} />

 {/* Actions */}
 <div className="flex flex-wrap gap-4">
 <Link
 href="/dashboard"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 id="back-to-stable"
 >
 ← Back to Stable
 </Link>
 <Link
 href={`/stable/${horseId}/edit`}
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 id="edit-horse-button"
 >
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
 <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
 <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
 </svg>
 Edit Details
 </Link>
 <ParkedExportPanel
 horseId={horseId}
 horseName={horse.custom_name}
 isParked={isParked}
 existingPin={existingPin}
 />
 <TransferModal horseId={horseId} horseName={horse.custom_name} />
 <DeleteHorseModal
 horseId={horseId}
 horseName={horse.custom_name}
 imageUrls={images.map((img) => img.image_url)}
 />
 </div>
 </div>
 </div>
 </ExplorerLayout>
 );
}
