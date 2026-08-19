import { createClient } from"@/lib/supabase/server";
import { notFound } from"next/navigation";
import Link from"next/link";
import { getPublicImageUrls } from"@/lib/utils/storage";
import HorseshoeIcon from"@/components/icons/HorseshoeIcon";
import MarketValueBadge from"@/components/MarketValueBadge";
import PassportGallery from"@/components/PassportGallery";
import ShareButton from"@/components/ShareButton";
import FavoriteButton from"@/components/FavoriteButton";
import { getPosts } from"@/app/actions/posts";
import UniversalFeed from"@/components/UniversalFeed";
import ShowRecordTimeline from"@/components/ShowRecordTimeline";
import PedigreeCard from"@/components/PedigreeCard";
import HoofprintTimeline from"@/components/HoofprintTimeline";
import TitlesSection from"@/components/shows/TitlesSection";
import { getHorseTitles } from"@/lib/shows/horseTitles";
import { titlePrefix } from"@/lib/shows/titles";
import { getHoofprint } from"@/app/actions/hoofprint";
import ReportButton from"@/components/ReportButton";
import MessageSellerButton from"@/components/MessageSellerButton";
import WishlistButton from"@/components/WishlistButton";
import TrustedBadge from"@/components/TrustedBadge";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import PageMasthead from"@/components/layouts/PageMasthead";
import AssetDetailRenderer from"@/components/AssetDetailRenderer";
import { getAssetConfig } from"@/lib/config/assetFields";
import type { AssetCategory } from"@/lib/types/database";
import { Button } from "@/components/ui/button";
import { referenceHref, referencePagesEnabled } from"@/lib/catalog/referenceUrl";
import AnonPassport from"@/components/passport/AnonPassport";
import PublicCardsSection from"@/components/shows/PublicCardsSection";
import { PARCHMENT_INK } from"@/lib/theme/parchment";
import PassportMasthead from"@/components/passport/PassportMasthead";
import BuyerPanel from"@/components/passport/BuyerPanel";
import { passportV2Enabled } from"@/lib/shows/flags";
import { summarizeShowRecords } from"@/lib/market/recordSummary";
import { getPublicHorseCards } from"@/lib/shows/publicCards";
import { getMarketPrice } from"@/app/actions/market";

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

 const title = `${h.custom_name}`;
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

 // Logged-out visitors get a read-only public passport (get_public_passport
 // RPC); the full interactive passport below is unchanged for members.
 if (!user) {
 return <AnonPassport horseId={horseId} />;
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
 catalog_items:catalog_id(title, maker, scale, item_type, attributes, maker_slug, slug)
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
 'id, show_name, show_date, show_id, division, class_name,"placing", ribbon_color, judge_name, is_nan, notes, show_location, section_name, award_category, competition_level, show_date_text, verification_tier',
 )
 .eq("horse_id", horseId)
 .order("show_date", { ascending: false, nullsFirst: false });

 const showRecords = (rawRecords ?? []).map(
 (r) => ({
 id: r.id,
 showName: r.show_name,
 showId: r.show_id,
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

 // Link to this model's public reference-catalog entry (flag-gated). Shown to
 // logged-in viewers now; becomes anon-visible once the passport is opened up.
 const refHref =
 referencePagesEnabled() && horse.catalog_id && cat
 ? referenceHref({
 id: horse.catalog_id,
 maker: cat.maker,
 title: cat.title,
 maker_slug: cat.maker_slug,
 slug: cat.slug,
 })
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

 // ── Passport v2 (NEXT_PUBLIC_PASSPORT_V2) — masthead + buyer panel.
 // Flag OFF: every v2 branch below is dead and the page renders its
 // current tree byte-identically.
 const v2 = passportV2Enabled();
 const isForSale = horse.trade_status === "For Sale" || horse.trade_status === "Open to Offers";
 const recordSummary = v2
 ? (summarizeShowRecords(
 (rawRecords ?? []).map((r) => ({
 horse_id: horseId,
 placing: r.placing,
 ribbon_color: r.ribbon_color,
 verification_tier: r.verification_tier,
 })),
 ).get(horseId) ?? null)
 : null;
 // Parallel: independent reads must not stack round trips (perf).
 const [publicCardsForCount, publicTitles] = await Promise.all([
 v2 && isForSale ? getPublicHorseCards(horseId) : Promise.resolve([]),
 getHorseTitles(horseId),
 ]);
 const cardsCount = publicCardsForCount.length;
 const refName = refInfo ? `${refInfo.maker} — ${refInfo.name}` : null;
 const publicNamePrefix = titlePrefix(publicTitles.map((t) => t.code));
 // The estimate caption must never render orphaned: MarketValueBadge
 // hides itself client-side when the mold has no sales, so check the
 // volume server-side before rendering the adjacent-estimate block.
 const marketEstimate =
 v2 && isForSale && horse.catalog_id ? await getMarketPrice(horse.catalog_id) : null;
 const hasMarketEstimate = !!marketEstimate && marketEstimate.transactionVolume > 0;

 return (
 <ExplorerLayout noHeader>
 {/* v2: the stolen/missing banner stays above EVERYTHING */}
 {v2 && horse.trade_status ==="Stolen/Missing" && (
 <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-4">
 <span className="text-[1.3em]">🚨</span>
 <div>
 <strong className="text-destructive">Stolen / Missing</strong>
 <p className="mt-1 text-muted-foreground text-sm">
 This model has been flagged by its owner. Transfers and offers are blocked.
 </p>
 </div>
 </div>
 )}
 {v2 ? (
 <PassportMasthead
 horseName={
 publicNamePrefix ? `${publicNamePrefix} ${horse.custom_name}` : horse.custom_name
 }
 ownerAlias={ownerAlias}
 referenceName={refName}
 referenceHref={refHref}
 backHref="/community"
 backLabel="Show Ring"
 />
 ) : (
 <PageMasthead compact icon="🏆" title="Show Ring" subtitle="Public passport" backHref="/community" backLabel="Show Ring" />
 )}

 {/* Two-column layout: Gallery | Ledger Card */}
 <div className="animate-fade-in-up grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
 {/* Left: Gallery */}
 <div className="self-start overflow-hidden rounded-2xl shadow-md" id={v2 ?"passport-photos" : undefined}>
 <PassportGallery images={galleryImages} />
 </div>

 {/* Right: The Ledger Card */}
 <div className="flex min-h-[100%] flex-col gap-2 rounded-3xl border border-input bg-[#C8B596] px-6 py-8 shadow-sm md:px-10" style={PARCHMENT_INK}>
 {/* Stolen/Missing Banner (v2 moves it above the masthead) */}
 {!v2 && horse.trade_status ==="Stolen/Missing" && (
 <div
 className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-4"
 >
 <span className="text-[1.3em]">🚨</span>
 <div>
 <strong className="text-destructive">Stolen / Missing</strong>
 <p className="mt-1 text-muted-foreground text-sm">
 This model has been flagged by its owner. Transfers and offers are blocked.
 </p>
 </div>
 </div>
 )}

 {/* v2 buyer panel — the ONE honest commerce surface. Supersedes the
     Wave 5a standalone For-Sale block AND the old h1 title block
     (the masthead now carries the name + reference). The market
     ESTIMATE sits adjacent but visually distinct: asking price and
     estimate must never read as the same number. */}
 {v2 && isForSale && (
 <>
 <BuyerPanel
 horseId={horseId}
 horseName={horse.custom_name}
 tradeStatus={horse.trade_status as"For Sale" |"Open to Offers"}
 listingPrice={horse.listing_price}
 conditionGrade={horse.condition_grade}
 recordSummary={recordSummary}
 cardsCount={cardsCount}
 variant="member"
 sellerId={horse.owner_id}
 isOwner={isOwnHorse}
 hoofprintHref="#passport-hoofprint"
 />
 {hasMarketEstimate && horse.catalog_id && (
 <div data-testid="market-estimate">
 <MarketValueBadge catalogId={horse.catalog_id} />
 <p className="mt-1 mb-0 text-xs text-muted-foreground italic">
 Market estimate from recent sales of this reference — not the asking price above.
 </p>
 </div>
 )}
 </>
 )}

 {/* Free-floating Title — no card wrapper (v2: the masthead is the
     title; exactly one h1 on the page, the horse's name) */}
 {!v2 && (
 <div className="p-0">
 <h1 className="mb-1 font-serif text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
 {horse.custom_name}
 </h1>
 {refInfo ? (
 <p className="mb-1 text-base text-secondary-foreground">
 {refHref ? (<Link href={refHref} className="font-semibold text-forest underline decoration-2 underline-offset-2">{refInfo.maker} — {refInfo.name} <span aria-hidden="true" className="text-forest">→</span></Link>) : (<>{refInfo.maker} — {refInfo.name}</>)}
 </p>
 ) : (
 <p
 className="mb-1 text-base italic text-secondary-foreground opacity-60"
 >
 Unlisted / Custom Entry
 </p>
 )}
 </div>
 )}

 {/* Owner Pill */}
 <Link
 href={`/profile/${encodeURIComponent(ownerAlias)}`}
 className="py-1.5 pr-3.5 pl-1.5 bg-card border-input text-foreground inline-flex w-fit items-center gap-1 rounded-full border text-sm font-semibold no-underline shadow-md transition-all"
 >
 <span className="bg-muted border-input text-muted-foreground flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full border">
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
 className="text-muted-foreground text-sm no-underline transition-all"
 id="see-more-seller"
 >
 See all models from @{ownerAlias} →
 </Link>
 )}

 {/* Model Details Card */}
 <div className="bg-card/40 p-4 border-input rounded-lg border shadow-md transition-all">
 <h3>
 <span aria-hidden="true">📋</span>{""}
 {(horse.asset_category ||"model") ==="model"
 ?"Model Details"
 : `${(horse.asset_category ||"model").charAt(0).toUpperCase() + (horse.asset_category ||"model").slice(1)} Details`}
 </h3>

 {horse.asset_category && horse.asset_category !=="model" && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-secondary-foreground text-sm font-medium">
 Category
 </span>
 <span className="text-foreground max-w-[60%] text-right text-sm font-semibold">
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
 <span className="text-secondary-foreground text-sm font-medium">
 Finish Type
 </span>
 <span className="text-foreground max-w-[60%] text-right text-sm font-semibold">
 {horse.finish_type}
 </span>
 </div>
 )}

 {horse.condition_grade && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-secondary-foreground text-sm font-medium">
 Condition
 </span>
 <span className="text-success inline-flex items-center gap-[4px] rounded-full border border-success/30 bg-success/10 px-[10px] py-[2px] text-sm font-semibold">
 {horse.condition_grade}
 </span>
 </div>
 )}

 {refInfo ? (
 <>
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-secondary-foreground text-sm font-medium">
 {refInfo.type}
 </span>
 <span className="text-foreground max-w-[60%] text-right text-sm font-semibold">
 {refInfo.name}
 </span>
 </div>

 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-secondary-foreground text-sm font-medium">
 {refInfo.type ==="Mold" ?"Manufacturer" :"Sculptor"}
 </span>
 <span className="text-foreground max-w-[60%] text-right text-sm font-semibold">
 {refInfo.maker}
 </span>
 </div>

 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-secondary-foreground text-sm font-medium">
 Scale
 </span>
 <span className="text-foreground max-w-[60%] text-right text-sm font-semibold">
 {refInfo.scale}
 </span>
 </div>

 {refInfo.extra && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-secondary-foreground text-sm font-medium">
 {refInfo.type ==="Mold" ?"Released" :"Medium"}
 </span>
 <span className="text-foreground max-w-[60%] text-right text-sm font-semibold">
 {refInfo.extra}
 </span>
 </div>
 )}
 </>
 ) : (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-secondary-foreground text-sm font-medium">
 Reference
 </span>
 <span
 className="text-foreground max-w-[60%] text-right text-sm font-semibold italic opacity-60"
 >
 Not linked to database — Custom Entry
 </span>
 </div>
 )}

 {releaseInfo && (
 <>
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-secondary-foreground text-sm font-medium">
 Release
 </span>
 <span className="text-foreground max-w-[60%] text-right text-sm font-semibold">
 {releaseInfo.name}
 </span>
 </div>

 {releaseInfo.modelNumber && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-secondary-foreground text-sm font-medium">
 Model #
 </span>
 <span className="text-foreground max-w-[60%] text-right text-sm font-semibold">
 #{releaseInfo.modelNumber}
 </span>
 </div>
 )}

 {releaseInfo.color && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-secondary-foreground text-sm font-medium">
 Color
 </span>
 <span className="text-foreground max-w-[60%] text-right text-sm font-semibold">
 {releaseInfo.color}
 </span>
 </div>
 )}

 {releaseInfo.yearStart && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-secondary-foreground text-sm font-medium">
 Release Years
 </span>
 <span className="text-foreground max-w-[60%] text-right text-sm font-semibold">
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
 <span className="text-secondary-foreground text-sm font-medium">
 🎨 Finished by
 </span>
 <span className="text-foreground max-w-[60%] text-right text-sm font-semibold">
 {horse.finishing_artist}
 {horse.finishing_artist_verified && (
 <span
 className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-forest/10 px-2 py-0.5 text-xs font-semibold text-success"
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
 <span className="text-secondary-foreground text-sm font-medium">
 📋 Edition
 </span>
 <span className="text-foreground max-w-[60%] text-right text-sm font-semibold">
 {horse.edition_number && horse.edition_size
 ? `${horse.edition_number} of ${horse.edition_size}`
 : horse.edition_size
 ? `Limited to ${horse.edition_size}`
 : `#${horse.edition_number}`}
 </span>
 </div>
 )}

 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-secondary-foreground text-sm font-medium">Added</span>
 <span className="text-foreground max-w-[60%] text-right text-sm font-semibold">
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
 <div className="bg-card/40 p-4 border-input rounded-lg border shadow-md transition-all">
 <h3>
 <span aria-hidden="true">✨</span> Finish
 </h3>
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-secondary-foreground text-sm font-medium">
 Finish Details
 </span>
 <span className="text-foreground max-w-[60%] text-right text-sm font-semibold">
 {horse.finish_details}
 </span>
 </div>
 </div>
 )}

  {/* Show Bio — model only */}
  {assetConfig.showShowBio && (horse.assigned_breed || horse.assigned_gender || horse.assigned_age || horse.regional_id) && (
 <div className="bg-card/40 p-4 border-input rounded-lg border shadow-md transition-all">
 <h3>
 <span aria-hidden="true">🏅</span> Show Identity
 </h3>
 {horse.assigned_breed && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-muted-foreground text-sm font-medium">
 Breed
 </span>
 <span className="text-foreground max-w-[60%] text-right text-sm font-semibold">
 {horse.assigned_breed}
 </span>
 </div>
 )}
 {horse.assigned_gender && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-muted-foreground text-sm font-medium">
 Gender
 </span>
 <span className="text-foreground max-w-[60%] text-right text-sm font-semibold">
 {horse.assigned_gender}
 </span>
 </div>
 )}
 {horse.assigned_age && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-muted-foreground text-sm font-medium">
 Age
 </span>
 <span className="text-foreground max-w-[60%] text-right text-sm font-semibold">
 {horse.assigned_age}
 </span>
 </div>
 )}
 {horse.regional_id && (
 <div className="border-white/20 flex items-center justify-between border-b px-0 py-[5px]">
 <span className="text-muted-foreground text-sm font-medium">
 Regional ID
 </span>
 <span className="text-foreground max-w-[60%] text-right text-sm font-semibold">
 {horse.regional_id}
 </span>
 </div>
 )}
 </div>
 )}

 {/* Public Notes */}
 {horse.public_notes && (
 <div className="bg-card/40 p-4 border-input rounded-lg border shadow-md transition-all">
 <h3>
 <span aria-hidden="true">📝</span> Notes
 </h3>
 <p className="text-secondary-foreground m-0 leading-[1.6] whitespace-pre-wrap">{horse.public_notes}</p>
 </div>
 )}

 {/* 🔒 NO Financial Vault section — this is a PUBLIC view */}

 {/* Market Value Badge (v2 + for-sale: moved adjacent to the buyer
     panel above with its estimate framing) */}
 {!(v2 && isForSale) && horse.catalog_id && <MarketValueBadge catalogId={horse.catalog_id} />}

 {/* For Sale — price + status a signed-in buyer can actually see.
     Mirrors the AnonPassport block (AnonPassport.tsx) so members and
     visitors read the same ledger line. For Sale / Open to Offers only.
     SUPERSEDED by the v2 buyer panel when the flag is on. */}
 {!v2 && (horse.trade_status === "For Sale" || horse.trade_status === "Open to Offers") && (
 <div className="rounded-lg border border-forest/30 bg-forest/5 p-4" id="passport-for-sale">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <span className={horse.trade_status === "For Sale" ? "stamp stamp-red" : "stamp"}>
 {horse.trade_status}
 </span>
 <span className="font-serif text-2xl font-bold text-foreground">
 {horse.listing_price != null
 ? `$${Number(horse.listing_price).toLocaleString("en-US")}`
 : "Open to offers"}
 </span>
 </div>
 {!isOwnHorse && (
 <p className="mt-2 mb-0 text-sm text-secondary-foreground">
 {horse.listing_price != null
 ? "Asking price — make an offer or ask the seller a question below."
 : "No asking price set — the seller is taking offers."}
 </p>
 )}
 </div>
 )}

 {/* Action Bar — split layout: icon row + full-width CTA */}
 <div className="passport-action-bar">
 <div className="flex flex-wrap items-center justify-center gap-1">
 <FavoriteButton
 horseId={horseId}
 initialIsFavorited={!!userFav}
 initialCount={favoriteCount ?? 0}
 />
 {horse.catalog_id && <WishlistButton catalogId={horse.catalog_id} />}
 <ShareButton
 title={`${horse.custom_name}`}
 text={`Check out ${horse.custom_name} on Model Horse Hub!`}
 label="Share"
 variant="full"
 />
 {!isOwnHorse && <ReportButton targetType="horse" targetId={horseId} />}
 {/* v2: contact actions live in the buyer panel — one honest panel,
     no duplicate CTAs in the icon row */}
 {!v2 &&
 !isOwnHorse &&
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
 <Button asChild><Link
 href={`/stable/${horse.id}`}
 >
 🔒 My Passport
 </Link></Button>
 )}
 </div>
  {assetConfig.showHoofprint && (
  <Button asChild variant="outline" size="wide"><Link
  href={`/community/${horseId}/hoofprint`}
  >
  <HorseshoeIcon /> View Hoofprint
  </Link></Button>
  )}
 </div>
 </div>
 </div>

 {/* Provenance — Read Only */}
 {(showRecords.length > 0 || pedigree) && (
 <div className="animate-fade-in-up mt-8" id={v2 ?"passport-show-record" : undefined}>
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

 {/* MHH Titles (159) — public record; renders nothing when empty */}
 <TitlesSection titles={publicTitles} />

 {/* MHH Qualification Cards — public trust section (anon-safe RPC,
     migration 141). Renders nothing until the migration is applied
     or when the horse holds no live cards. */}
 <PublicCardsSection horseId={horseId} />

 {/* 🐾 Hoofprint — Public Read-Only */}
 {await (async () => {
 const {
 timeline: hfTimeline,
 ownershipChain: hfChain,
 lifeStage: hfStage,
 } = await getHoofprint(horseId);
 if (hfTimeline.length === 0 && hfChain.length === 0) return null;
 return (
 <div className="animate-fade-in-up mt-8" id={v2 ?"passport-hoofprint" : undefined}>
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
