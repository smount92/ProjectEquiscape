import { createClient } from"@/lib/supabase/server";
import { redirect, notFound } from"next/navigation";
import Link from"next/link";
import { getPublicImageUrls } from"@/lib/utils/storage";
import MarketValueBadge from"@/components/MarketValueBadge";
import PassportGallery from"@/components/PassportGallery";
import ShareButton from"@/components/ShareButton";
import FavoriteButton from"@/components/FavoriteButton";
import { getPosts } from"@/app/actions/posts";
import UniversalFeed from"@/components/UniversalFeed";
import ShowRecordTimeline from"@/components/ShowRecordTimeline";
import PedigreeCard from"@/components/PedigreeCard";
import HoofprintTimeline from"@/components/HoofprintTimeline";
import { getHoofprint } from"@/app/actions/hoofprint";
import ReportButton from"@/components/ReportButton";
import MessageSellerButton from"@/components/MessageSellerButton";
import TrustedBadge from"@/components/TrustedBadge";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import AssetDetailRenderer from"@/components/AssetDetailRenderer";
import { getAssetConfig } from"@/lib/config/assetFields";
import type { AssetCategory } from"@/lib/types/database";

// Force fresh data on every request — prevents stale comments/favorites

const ANGLE_LABELS: Record<string, string> = {
 Primary_Thumbnail:"Near-Side",
 Left_Side:"Left Side",
 Right_Side:"Off-Side",
 Front_Chest:"Front / Chest",
 Back_Hind:"Hindquarters",
 Belly_Makers_Mark:"Belly / Mark",
 Detail_Face_Eyes:"Face & Eyes",
 Detail_Ears:"Ears",
 Detail_Hooves:"Hooves",
 Flaw_Rub_Damage:"Flaws",
 extra_detail:"Detail",
 Other:"Other",
};

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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params;
 const supabase = await createClient();

 const { data: horse } = await supabase
 .from("user_horses")
 .select("custom_name, finish_type, condition_grade, catalog_items:catalog_id(title, maker)")
 .eq("id", id)
 .in("visibility", ["public","unlisted"])
 .single();

 if (!horse) {
 return {
 title:"Horse Not Found — The Show Ring",
 description:"This horse could not be found.",
 };
 }

 // Get primary thumbnail for OG image
 const { data: img } = await supabase
 .from("horse_images")
 .select("image_url")
 .eq("horse_id", id)
 .eq("angle_profile","Primary_Thumbnail")
 .single();

 const h = horse;

 const title = `${h.custom_name} — Model Horse Hub`;
 const catalogInfo = h.catalog_items ? `${h.catalog_items.maker} ${h.catalog_items.title}` :"";
 const description = [catalogInfo, h.finish_type, h.condition_grade].filter(Boolean).join(" ·");

 // Build public image URL (horse-images bucket may be public or need signed URL)
 const imageUrl = img?.image_url || null;

 return {
 title,
 description: description || `View ${h.custom_name} in the community showcase.`,
 openGraph: {
 title,
 description: description || `View ${h.custom_name} on Model Horse Hub`,
 images: imageUrl ? [{ url: imageUrl, width: 800, height: 600, alt: h.custom_name }] : [],
 type:"article" as const,
 siteName:"Model Horse Hub",
 },
 twitter: {
 card: (imageUrl ?"summary_large_image" :"summary") as"summary_large_image" |"summary",
 title,
 description: description || `View ${h.custom_name} on Model Horse Hub`,
 images: imageUrl ? [imageUrl] : [],
 },
 };
}

export default async function PublicPassportPage({ params }: { params: Promise<{ id: string }> }) {
 const { id: horseId } = await params;
 const supabase = await createClient();

 // Auth check — needed for RLS (we redirect to login, not block)
 const {
 data: { user },
 } = await supabase.auth.getUser();

 if (!user) {
 redirect("/login");
 }

 // ================================================================
 // PUBLIC QUERY: Fetch horse if visibility = 'public' or 'unlisted'
 // 🔒 financial_vault is NEVER queried here.
 // 🔒 Only alias_name from users — never email or full_name.
 // ================================================================
 const { data: rawHorse } = await supabase
 .from("user_horses")
 .select(
 `
  id, owner_id, custom_name, finish_type, condition_grade, asset_category, attributes,
  is_public, created_at, finishing_artist, finishing_artist_verified, edition_number, edition_size, catalog_id,
 trade_status, listing_price,
 finish_details, public_notes, assigned_breed, assigned_gender, assigned_age, regional_id,
 users!inner(alias_name),
 catalog_items:catalog_id(title, maker, scale, item_type, attributes)
 `,
 )
 .eq("id", horseId)
 .in("visibility", ["public","unlisted"])
 .single();

 if (!rawHorse) {
 notFound();
 }

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const horse = rawHorse as any;

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

 // Generate signed URLs
 const imageUrls = images.map((img) => img.image_url);
 const signedUrlMap = getPublicImageUrls(imageUrls);

 const galleryImages = images.map((img) => ({
 signedUrl: signedUrlMap.get(img.image_url) || img.image_url,
 angle_profile: img.angle_profile,
 label: ANGLE_LABELS[img.angle_profile] || img.angle_profile,
 shortSlug: img.short_slug || null,
 }));

 // ================================================================
 // SOCIAL: Favorites + Comments
 // ================================================================

 // Favorite count
 const { count: favoriteCount } = await supabase
 .from("horse_favorites")
 .select("id", { count:"exact", head: true })
 .eq("horse_id", horseId);

 // Current user's favorite status
 const { data: userFav } = await supabase
 .from("horse_favorites")
 .select("id")
 .eq("horse_id", horseId)
 .eq("user_id", user.id)
 .maybeSingle();

 // Comments — now via universal posts table
 const comments = await getPosts({ horseId }, { includeReplies: true, limit: 50 });

 // ================================================================
 // PROVENANCE: Show Records + Pedigree (read-only)
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

 const ownerAlias = horse.users?.alias_name ??"Unknown";
  const isOwnHorse = horse.owner_id === user.id;
  const assetCat = (horse.asset_category || "model") as AssetCategory;
  const assetConfig = getAssetConfig(assetCat);
  const horseAttributes = (horse.attributes ?? {}) as Record<string, unknown>;

 // Check if owner is a Community Trusted seller
 const { data: trustedData } = await supabase
 .from("mv_trusted_sellers")
 .select("user_id")
 .eq("user_id", horse.owner_id)
 .maybeSingle();
 const isTrustedSeller = !!trustedData;

 return (
 <ExplorerLayout title={horse.custom_name} description="View this model in the community showcase.">
 {/* Breadcrumb */}
 <nav className="text-stone-600 animate-fade-in-up mb-6 flex items-center gap-2 text-sm" aria-label="Breadcrumb">
 <Link href="/community">Show Ring</Link>
 <span className="separator" aria-hidden="true">
 /
 </span>
 <span>{horse.custom_name}</span>
 </nav>

 {/* Two-column layout: Gallery | Ledger Card */}
 <div className="animate-fade-in-up grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
 {/* Left: Gallery */}
 <div className="overflow-hidden rounded-2xl shadow-md">
 <PassportGallery images={galleryImages} />
 </div>

 {/* Right: The Ledger Card */}
 <div className="flex min-h-[100%] flex-col gap-2 rounded-3xl border border-stone-200 bg-[#C8B596] px-6 py-8 shadow-sm md:px-10">
 {/* Stolen/Missing Banner */}
 {horse.trade_status ==="Stolen/Missing" && (
 <div
 className="flex items-center gap-2 rounded-md border border-red-600/30 bg-gradient-to-br from-red-600/15 to-red-600/10 p-4"
 >
 <span className="text-[1.3em]">🚨</span>
 <div>
 <strong className="text-[rgb(220,38,38)]">Stolen / Missing</strong>
 <p className="m-[4px 0 0] text-stone-500 text-sm">
 This model has been flagged by its owner. Transfers and offers are blocked.
 </p>
 </div>
 </div>
 )}

 {/* Free-floating Title — no card wrapper */}
 <div className="p-0">
 <h1 className="mb-1 font-serif text-4xl font-bold leading-tight tracking-tight text-[#2D2318] md:text-5xl">
 {horse.custom_name}
 </h1>
 {refInfo ? (
 <p className="mb-1 text-base text-[#59493A]">
 {refInfo.maker} — {refInfo.name}
 </p>
 ) : (
 <p
 className="mb-1 text-base italic text-[#59493A] opacity-60"
 >
 Unlisted / Custom Entry
 </p>
 )}
 </div>

 {/* Owner Pill */}
 <Link
 href={`/profile/${encodeURIComponent(ownerAlias)}`}
 className="p-[6px 14px 6px 6px] bg-white border-stone-200 text-stone-900 inline-flex w-fit items-center gap-1 rounded-full rounded-lg border text-sm font-semibold no-underline shadow-md transition-all"
 >
 <span className="bg-stone-50 border-stone-200 text-stone-500 flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full border">
 <svg
 width="14"
 height="14"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 aria-hidden="true"
 >
 <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
 <circle cx="12" cy="7" r="4" />
 </svg>
 </span>
 <span>@{ownerAlias}</span>
 {isTrustedSeller && <TrustedBadge />}
 {isOwnHorse && (
 <span className="bg-forest inline-flex rounded-sm px-2 py-[2px] text-xs font-bold tracking-wider text-white uppercase">
 You
 </span>
 )}
 </Link>

 {!isOwnHorse && (
 <Link
 href={`/profile/${encodeURIComponent(ownerAlias)}`}
 className="text-stone-500 text-sm no-underline transition-all"
 id="see-more-seller"
 >
 See all models from @{ownerAlias} →
 </Link>
 )}

 {/* Model Details Card */}
 <div className="bg-white/40 p-4 border-stone-200 rounded-lg border shadow-md transition-all">
 <h3>
 <span aria-hidden="true">📋</span>{""}
 {(horse.asset_category ||"model") ==="model"
 ?"Model Details"
 : `${(horse.asset_category ||"model").charAt(0).toUpperCase() + (horse.asset_category ||"model").slice(1)} Details`}
 </h3>

 {horse.asset_category && horse.asset_category !=="model" && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-600 text-sm font-medium">
 Category
 </span>
 <span className="text-stone-900 max-w-[60%] text-right text-sm font-semibold">
  {horse.asset_category ==="tack"
  ?"🏇 Tack & Gear"
  : horse.asset_category ==="prop"
  ?"🌲 Prop"
  : horse.asset_category ==="diorama"
  ?"🎭 Diorama"
  : "🐄 Other Model"}
 </span>
 </div>
 )}

 {horse.finish_type && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-600 text-sm font-medium">
 Finish Type
 </span>
 <span className="text-stone-900 max-w-[60%] text-right text-sm font-semibold">
 {horse.finish_type}
 </span>
 </div>
 )}

 {horse.condition_grade && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-600 text-sm font-medium">
 Condition
 </span>
 <span className="text-emerald-700 inline-flex items-center gap-[4px] rounded-full border border-emerald-200/50 bg-emerald-50/20 px-[10px] py-[2px] text-sm font-semibold">
 {horse.condition_grade}
 </span>
 </div>
 )}

 {refInfo ? (
 <>
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-600 text-sm font-medium">
 {refInfo.type}
 </span>
 <span className="text-stone-900 max-w-[60%] text-right text-sm font-semibold">
 {refInfo.name}
 </span>
 </div>

 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-600 text-sm font-medium">
 {refInfo.type ==="Mold" ?"Manufacturer" :"Sculptor"}
 </span>
 <span className="text-stone-900 max-w-[60%] text-right text-sm font-semibold">
 {refInfo.maker}
 </span>
 </div>

 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-600 text-sm font-medium">
 Scale
 </span>
 <span className="text-stone-900 max-w-[60%] text-right text-sm font-semibold">
 {refInfo.scale}
 </span>
 </div>

 {refInfo.extra && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-600 text-sm font-medium">
 {refInfo.type ==="Mold" ?"Released" :"Medium"}
 </span>
 <span className="text-stone-900 max-w-[60%] text-right text-sm font-semibold">
 {refInfo.extra}
 </span>
 </div>
 )}
 </>
 ) : (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-600 text-sm font-medium">
 Reference
 </span>
 <span
 className="text-stone-900 max-w-[60%] text-right text-sm font-semibold italic opacity-60"
 >
 Not linked to database — Custom Entry
 </span>
 </div>
 )}

 {releaseInfo && (
 <>
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-600 text-sm font-medium">
 Release
 </span>
 <span className="text-stone-900 max-w-[60%] text-right text-sm font-semibold">
 {releaseInfo.name}
 </span>
 </div>

 {releaseInfo.modelNumber && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-600 text-sm font-medium">
 Model #
 </span>
 <span className="text-stone-900 max-w-[60%] text-right text-sm font-semibold">
 #{releaseInfo.modelNumber}
 </span>
 </div>
 )}

 {releaseInfo.color && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-600 text-sm font-medium">
 Color
 </span>
 <span className="text-stone-900 max-w-[60%] text-right text-sm font-semibold">
 {releaseInfo.color}
 </span>
 </div>
 )}

 {releaseInfo.yearStart && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-600 text-sm font-medium">
 Release Years
 </span>
 <span className="text-stone-900 max-w-[60%] text-right text-sm font-semibold">
 {releaseInfo.yearStart}
 {releaseInfo.yearEnd && releaseInfo.yearEnd !== releaseInfo.yearStart
 ? `–${releaseInfo.yearEnd}`
 :""}
 </span>
 </div>
 )}
 </>
 )}

 {horse.finishing_artist && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-600 text-sm font-medium">
 🎨 Finished by
 </span>
 <span className="text-stone-900 max-w-[60%] text-right text-sm font-semibold">
 {horse.finishing_artist}
 {horse.finishing_artist_verified && (
 <span
 className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-forest/10 px-2 py-0.5 text-xs font-semibold text-[var(--color-accent-success,#22c55e)]"
 title="Verified via commission delivery"
 >
 ✅ Verified
 </span>
 )}
 </span>
 </div>
 )}

 {(horse.edition_number || horse.edition_size) && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-600 text-sm font-medium">
 📋 Edition
 </span>
 <span className="text-stone-900 max-w-[60%] text-right text-sm font-semibold">
 {horse.edition_number && horse.edition_size
 ? `${horse.edition_number} of ${horse.edition_size}`
 : horse.edition_size
 ? `Limited to ${horse.edition_size}`
 : `#${horse.edition_number}`}
 </span>
 </div>
 )}

 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-600 text-sm font-medium">Added</span>
 <span className="text-stone-900 max-w-[60%] text-right text-sm font-semibold">
 {new Date(horse.created_at).toLocaleDateString("en-US", {
 year:"numeric",
 month:"long",
 day:"numeric",
 })}
 </span>
 </div>
 </div>

  {/* Category-Specific Attributes */}
  {assetCat !== "model" && Object.keys(horseAttributes).length > 0 && (
  <div className="mt-2">
  <AssetDetailRenderer category={assetCat} attributes={horseAttributes} />
  </div>
  )}

 {/* Finish Details */}
 {horse.finish_details && (
 <div className="bg-white/40 p-4 border-stone-200 rounded-lg border shadow-md transition-all">
 <h3>
 <span aria-hidden="true">✨</span> Finish
 </h3>
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-600 text-sm font-medium">
 Finish Details
 </span>
 <span className="text-stone-900 max-w-[60%] text-right text-sm font-semibold">
 {horse.finish_details}
 </span>
 </div>
 </div>
 )}

  {/* Show Bio — model only */}
  {assetConfig.showShowBio && (horse.assigned_breed || horse.assigned_gender || horse.assigned_age || horse.regional_id) && (
 <div className="bg-white/40 p-4 border-stone-200 rounded-lg border shadow-md transition-all">
 <h3>
 <span aria-hidden="true">🏅</span> Show Identity
 </h3>
 {horse.assigned_breed && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-500 text-sm font-medium">
 Breed
 </span>
 <span className="text-stone-900 max-w-[60%] text-right text-sm font-semibold">
 {horse.assigned_breed}
 </span>
 </div>
 )}
 {horse.assigned_gender && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-500 text-sm font-medium">
 Gender
 </span>
 <span className="text-stone-900 max-w-[60%] text-right text-sm font-semibold">
 {horse.assigned_gender}
 </span>
 </div>
 )}
 {horse.assigned_age && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-500 text-sm font-medium">
 Age
 </span>
 <span className="text-stone-900 max-w-[60%] text-right text-sm font-semibold">
 {horse.assigned_age}
 </span>
 </div>
 )}
 {horse.regional_id && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-stone-500 text-sm font-medium">
 Regional ID
 </span>
 <span className="text-stone-900 max-w-[60%] text-right text-sm font-semibold">
 {horse.regional_id}
 </span>
 </div>
 )}
 </div>
 )}

 {/* Public Notes */}
 {horse.public_notes && (
 <div className="bg-white/40 p-4 border-stone-200 rounded-lg border shadow-md transition-all">
 <h3>
 <span aria-hidden="true">📝</span> Notes
 </h3>
 <p className="text-stone-600 m-0 leading-[1.6] whitespace-pre-wrap">{horse.public_notes}</p>
 </div>
 )}

 {/* 🔒 NO Financial Vault section — this is a PUBLIC view */}

 {/* Market Value Badge */}
 {horse.catalog_id && <MarketValueBadge catalogId={horse.catalog_id} />}

 {/* Action Bar — split layout: icon row + full-width CTA */}
 <div className="passport-action-bar">
 <div className="flex flex-wrap items-center justify-center gap-1">
 <FavoriteButton
 horseId={horseId}
 initialIsFavorited={!!userFav}
 initialCount={favoriteCount ?? 0}
 />
 <ShareButton
 title={`${horse.custom_name} — Model Horse Hub`}
 text={`Check out ${horse.custom_name} on Model Horse Hub!`}
 label="Share"
 variant="full"
 />
 {!isOwnHorse && <ReportButton targetType="horse" targetId={horseId} />}
 {!isOwnHorse &&
 horse.trade_status !=="Stolen/Missing" &&
 (horse.trade_status ==="For Sale" || horse.trade_status ==="Open to Offers") && (
 <MessageSellerButton
 sellerId={horse.owner_id}
 horseId={horseId}
 horseName={horse.custom_name}
 tradeStatus={horse.trade_status}
 askingPrice={horse.listing_price}
 />
 )}
 {isOwnHorse && (
 <Link
 href={`/stable/${horse.id}`}
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 >
 🔒 My Passport
 </Link>
 )}
 </div>
  {assetConfig.showHoofprint && (
  <Link
  href={`/community/${horseId}/hoofprint`}
  className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
  >
  🐾 View Hoofprint
  </Link>
  )}
 </div>

 {/* Back link */}
 <Link
 href="/community"
 className="px-0 py-1 text-center text-sm text-[#59493A] no-underline opacity-[0.6] transition-all"
 >
 ← Back to Show Ring
 </Link>
 </div>
 </div>

 {/* Provenance — Read Only */}
 {(showRecords.length > 0 || pedigree) && (
 <div className="animate-fade-in-up mt-8">
 {showRecords.length > 0 && (
 <ShowRecordTimeline horseId={horseId} records={showRecords} isOwner={false} />
 )}
 {pedigree && (
 <div className="mt-6">
 <PedigreeCard horseId={horseId} pedigree={pedigree} isOwner={false} />
 </div>
 )}
 </div>
 )}

 {/* 🐾 Hoofprint™ — Public Read-Only */}
 {await (async () => {
 const {
 timeline: hfTimeline,
 ownershipChain: hfChain,
 lifeStage: hfStage,
 } = await getHoofprint(horseId);
 if (hfTimeline.length === 0 && hfChain.length === 0) return null;
 return (
 <div className="animate-fade-in-up mt-8">
 <HoofprintTimeline
 horseId={horseId}
 timeline={hfTimeline}
 ownershipChain={hfChain}
 lifeStage={hfStage}
 isOwner={false}
 />
 </div>
 );
 })()}

 {/* Comments */}
 <div className="animate-fade-in-up mt-8">
 <UniversalFeed
 initialPosts={comments}
 context={{ horseId }}
 currentUserId={user.id}
 showComposer={true}
 composerPlaceholder="Leave a comment on this model…"
 label="Comments"
 />
 </div>
 </ExplorerLayout>
 );
}
