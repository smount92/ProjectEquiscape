import { createClient } from"@/lib/supabase/server";
import LinkifiedText from "@/components/LinkifiedText";
import { redirect, notFound } from"next/navigation";
import Link from"next/link";
import MarketValueBadge from"@/components/MarketValueBadge";
import { getPublicImageUrls } from"@/lib/utils/storage";
import PassportGallery from"@/components/PassportGallery";
import RegistryLink from "@/components/catalog/RegistryLink";
import VaultReveal from"@/components/VaultReveal";
import DeleteHorseModal from"@/components/DeleteHorseModal";
import ShowRecordTimeline from"@/components/ShowRecordTimeline";
import PedigreeCard from"@/components/PedigreeCard";
import HoofprintTimeline from"@/components/HoofprintTimeline";
import MakingChapter from"@/components/making/MakingChapter";
import { getMakingForHorse } from"@/app/actions/work-records";
import TransferModal from"@/components/TransferModal";
import ParkedExportPanel from"@/components/ParkedExportPanel";
import { getHoofprint } from"@/app/actions/hoofprint";
import { getConditionHistory } from"@/app/actions/conditionHistory";
import ConditionLedger from"@/components/ConditionLedger";
import QualificationCardsSection, { type PassportQualificationCard } from"@/components/shows/QualificationCardsSection";
import TitlesSection from"@/components/shows/TitlesSection";
import { getHorseTitles, getOwnerHorseLadder } from"@/lib/shows/horseTitles";
import { titlePrefix } from"@/lib/shows/titles";
import { resolvePlacingHrefs } from"@/lib/shows/placingShare";
import { RESULTS_STATUSES } from"@/lib/shows/gallery";
import type { CardStatus, ShowStatus } from"@/lib/shows/types";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import PageMasthead from"@/components/layouts/PageMasthead";
import AssetDetailRenderer from"@/components/AssetDetailRenderer";
import { getAssetConfig } from"@/lib/config/assetFields";
import type { AssetCategory } from"@/lib/types/database";
import { Button } from "@/components/ui/button";
import { PARCHMENT_INK } from"@/lib/theme/parchment";
import { getHorseViewStats, viewStatsLabel } from"@/lib/metrics/sellerViews";


// Types
interface VaultData {
 purchase_price: number | null;
 purchase_date: string | null;
 estimated_current_value: number | null;
 insurance_notes: string | null;
 purchase_date_text: string | null;
 is_trade: boolean | null;
}

const ANGLE_LABELS: Record<string, string> = {
 Primary_Thumbnail:"Primary Thumbnail",
 Left_Side:"Left Side",
 Right_Side:"Right Side",
 Front_Chest:"Front / Chest",
 Back_Hind:"Back / Hind",
 Belly_Makers_Mark:"Marks / Logos",
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
  is_for_sale, is_public, visibility, created_at, sculptor, finishing_artist, finishing_artist_verified, edition_number, edition_size, catalog_id, trade_status,
 finish_details, public_notes, assigned_breed, assigned_gender, assigned_age, regional_id,
 catalog_items:catalog_id(title, maker, scale, item_type, attributes, maker_slug, slug)
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

 // The Making — work records + reels (202; [] until pasted)
 const makingRecords = await getMakingForHorse(horseId);

 // Fetch financial vault (owner-only via RLS)
 const { data: rawVault } = await supabase
 .from("financial_vault")
 .select("purchase_price, purchase_date, estimated_current_value, insurance_notes, purchase_date_text, is_trade")
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
 '*',
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
 scoreTotal: (r as { score_total?: number | string | null }).score_total == null ? null : Number((r as { score_total?: number | string | null }).score_total),
 }),
 );

 // ── SHARE-YOUR-PLACING: record → public placing page ──
 // Records store no entry id (migration 138 added only show_id),
 // so v2-linked platform records are matched to this horse's own
 // entry by (show, class name) — deterministic, a horse enters a
 // class at most once. Results-published shows only: the placing
 // page 404s pre-publish, so no dead Share links render.
 let placingHrefs: Record<string, string> = {};
 {
 const linkedShowIds = [
 ...new Set(
 showRecords
 .filter((r) => r.showId && r.verificationTier ==="platform_generated")
 .map((r) => r.showId as string),
 ),
 ];
 if (linkedShowIds.length > 0) {
 const { data: linkedShows } = await supabase
 .from("shows")
 .select("id, status")
 .in("id", linkedShowIds);
 const publishedIds = (linkedShows ?? [])
 .filter((s) => RESULTS_STATUSES.includes(s.status as ShowStatus))
 .map((s) => s.id as string);
 if (publishedIds.length > 0) {
 const { data: entryRows } = await supabase
 .from("show_class_entries")
 .select("id, show_id, class_id, status")
 .eq("horse_id", horseId)
 .in("show_id", publishedIds);
 const liveEntries = (entryRows ?? []).filter((e) => e.status !=="scratched");
 const classIds = [...new Set(liveEntries.map((e) => e.class_id as string))];
 if (classIds.length > 0) {
 const { data: classRows } = await supabase
 .from("show_classes")
 .select("id, name")
 .in("id", classIds);
 const classNameById = new Map(
 (classRows ?? []).map((c) => [c.id as string, c.name as string]),
 );
 placingHrefs = resolvePlacingHrefs(
 showRecords.map((r) => ({
 id: r.id as string,
 showId: (r.showId as string | null) ?? null,
 className: (r.className as string | null) ?? null,
 verificationTier: (r.verificationTier as string | null) ?? null,
 })),
 liveEntries.map((e) => ({
 entryId: e.id as string,
 showId: e.show_id as string,
 className: classNameById.get(e.class_id as string) ?? null,
 })),
 );
 }
 }
 }
 }

 // ── MHH Qualification Cards (Phase F, flag-gated) ──
 // RLS scopes reads to the card's people; this page is owner-only,
 // and the owner is always current_owner_id (the Safe-Trade hook
 // re-points cards when the horse changes hands).
 let qualificationCards: PassportQualificationCard[] = [];
 {
 const { data: rawCards } = await supabase
 .from("qualification_cards")
 .select("id, earned_place, show_year, status, issued_at, shows(title), show_classes(name)")
 .eq("horse_id", horseId)
 .order("issued_at", { ascending: false });
 qualificationCards = (rawCards ?? []).map((c) => {
 const showRel = Array.isArray(c.shows) ? c.shows[0] : c.shows;
 const classRel = Array.isArray(c.show_classes) ? c.show_classes[0] : c.show_classes;
 return {
 code: c.id as string,
 earnedPlace: (c.earned_place as 1 | 2) ?? 1,
 showYear: (c.show_year as number | null) ?? null,
 status: c.status as CardStatus,
 issuedAt: c.issued_at as string,
 showTitle: (showRel as { title: string } | null)?.title ?? "Unknown show",
 className: (classRel as { name: string } | null)?.name ?? "Unknown class",
 };
 });
 }

 // ── MHH Titles (159) — permanent, public record; [] until pasted ──
 // Owner's passport also gets the LADDER: progress toward unearned
 // titles ("1 more card · a different judge"), career points.
 const [horseTitles, titleLadder] = await Promise.all([
 getHorseTitles(horseId),
 getOwnerHorseLadder(supabase, horseId),
 ]);
 const namePrefix = titlePrefix(horseTitles.map((t) => t.code));

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

 // Hoofprint data + the condition ledger (owner-read; see the RLS note
 // in getConditionHistory — the anon role has no read on this table at
 // all, so it stays on the owner's passport).
 const [{ timeline, ownershipChain, lifeStage }, conditionLedger] = await Promise.all([
 getHoofprint(horseId),
 getConditionHistory(horseId),
 ]);

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
 // The registry door: every place this card names the catalog entry
 // links to its reference page (RegistryLink).
 const registryItem = cat && horse.catalog_id
 ? {
 id: horse.catalog_id as string,
 maker: cat.maker,
 title: cat.title,
 maker_slug: (cat as { maker_slug?: string | null }).maker_slug ?? null,
 slug: (cat as { slug?: string | null }).slug ?? null,
 }
 : null;
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

 // Owner-only, and enforced in the RPC rather than here — the page has
 // already notFound()ed a non-owner, but get_horse_view_stats checks
 // ownership again because it is the read policy for a table that grants
 // SELECT to nobody. Null when 175 has not been pasted: the line vanishes.
 const viewStats = viewStatsLabel(await getHorseViewStats(supabase, horseId));

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
 <ExplorerLayout noHeader>
 <PageMasthead compact icon="🐴" title="Digital Stable" subtitle="Horse passport & provenance" backHref="/dashboard" backLabel="Stable" />

 {/* Quiet, and only you can see it — see lib/metrics/sellerViews.ts */}
 {viewStats && (
 <p className="text-muted-foreground mt-3 mb-0 text-xs" title="Only you can see this. Counts are per-object and anonymous.">
 👁 {viewStats}
 </p>
 )}

 {/* Wishlist demand banner */}
 {wishlistDemand > 0 && (
 <div className="animate-fade-in-up mt-4 mb-6 rounded-lg border border-warning/30 bg-warning/10 px-6 py-4 text-sm leading-relaxed">
 🔥{" "}
 <strong>
 {wishlistDemand} collector{wishlistDemand > 1 ?"s" :""}
 </strong>{" "}
 {wishlistDemand > 1 ?"are" :"is"} looking for this model! List it for sale to notify them.
 </div>
 )}

 {/* Two-column layout: Gallery | Ledger Card */}
 <div className="animate-fade-in-up grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
 {/* Left: Gallery, then The Making — the visual column reads
     what she looks like now, then how she came to be. */}
 <div>
 <div className="overflow-hidden rounded-2xl shadow-md">
 <PassportGallery images={galleryImages} />
 </div>
 <MakingChapter
 records={makingRecords}
 ownerId={horse.owner_id}
 horseId={horseId}
 showControls
 canAddCredit
 />
 </div>

 {/* Right: The Ledger Card */}
 <div className="flex min-h-[100%] flex-col gap-2 rounded-3xl border border-input bg-[#C8B596] px-6 py-8 shadow-sm md:px-10" style={PARCHMENT_INK}>
 {/* Title */}
 <div>
 <h1 className="mb-1 font-serif text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
 {namePrefix && (
 <span
 className="mr-2 align-middle text-[0.45em] font-bold tracking-[0.18em] text-[color:var(--brass-ink,#6b5327)]"
 title={horseTitles.map((t) => t.label).join(" · ")}
 >
 {namePrefix}
 </span>
 )}
 {horse.custom_name}
 </h1>
 {refInfo ? (
 <p className="mb-1 text-base text-secondary-foreground">
 {refInfo.maker} —{" "}
 {registryItem ? (
 <RegistryLink item={registryItem} className="text-secondary-foreground decoration-border-tan/60 hover:text-foreground underline underline-offset-2">
 {refInfo.name}
 </RegistryLink>
 ) : (
 refInfo.name
 )}
 </p>
 ) : (
 <p
 className="mb-1 text-base italic text-secondary-foreground opacity-[0.6]"
 >
 Unlisted / Custom Entry
 </p>
 )}
 </div>

 {/* Model Details Card */}
 <div className="rounded-lg border border-border-tan/30 bg-card/20 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-widest text-secondary-foreground uppercase">
                <span aria-hidden="true">📋</span>{" "}
 {(horse.asset_category ||"model") ==="model"
 ?"Model Details"
 : `${(horse.asset_category ||"model").charAt(0).toUpperCase() + (horse.asset_category ||"model").slice(1)} Details`}
 </h3>

 {horse.asset_category && horse.asset_category !== "model" && (
 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">
 Category
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
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
 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">
 Finish Type
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
 {horse.finish_type}
 </span>
 </div>
 )}

 {horse.condition_grade && (
 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">
 Condition
 </span>
 <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
 {horse.condition_grade}
 </span>
 </div>
 )}

 {refInfo ? (
 <>
 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">
 {refInfo.type}
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
 {registryItem ? <RegistryLink item={registryItem}>{refInfo.name}</RegistryLink> : refInfo.name}
 </span>
 </div>

 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">
 {refInfo.type ==="Mold" ?"Manufacturer" :"Sculptor"}
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
 {refInfo.maker}
 </span>
 </div>

 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">
 Scale
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
 {refInfo.scale}
 </span>
 </div>

 {refInfo.extra && (
 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">
 {refInfo.type ==="Mold" ?"Released" :"Medium"}
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
 {refInfo.extra}
 </span>
 </div>
 )}

 {registryItem && (
 <div className="flex items-center justify-end px-0 py-3">
 <RegistryLink item={registryItem} className="text-forest text-sm font-semibold hover:underline">
 View in Registry {"→"}
 </RegistryLink>
 </div>
 )}
 </>
 ) : (
              <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
                <span className="text-sm font-medium text-secondary-foreground">
 Reference
 </span>
 <span
 className="max-w-[60%] text-right text-sm font-semibold text-foreground italic opacity-60"
 >
 Not linked to database — Custom Entry
 </span>
 </div>
 )}

 {releaseInfo && (
 <>
 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">
 Release
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
 {registryItem ? <RegistryLink item={registryItem}>{releaseInfo.name}</RegistryLink> : releaseInfo.name}
 </span>
 </div>

 {releaseInfo.modelNumber && (
 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">
 Model #
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
 #{releaseInfo.modelNumber}
 </span>
 </div>
 )}

 {releaseInfo.color && (
 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">
 Color
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
 {releaseInfo.color}
 </span>
 </div>
 )}

 {releaseInfo.yearStart && (
 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">
 Release Years
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
 {releaseInfo.yearStart}
 {releaseInfo.yearEnd && releaseInfo.yearEnd !== releaseInfo.yearStart
 ? `–${releaseInfo.yearEnd}`
 :""}
 </span>
 </div>
 )}
 </>
 )}

 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">Added</span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
 {new Date(horse.created_at).toLocaleDateString("en-US", {
 month:"long",
 day:"numeric",
 year:"numeric",
 })}
 </span>
 </div>

 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">Photos</span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
 {images.length} uploaded
 </span>
 </div>

 {horse.sculptor && (
 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">
 Sculptor / Artist
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
 {horse.sculptor}
 </span>
 </div>
 )}

 {horse.finishing_artist && (
 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">
 🎨 Finished by
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
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
 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">
 📋 Edition
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
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
 <div className="rounded-lg border border-border-tan/30 bg-card/20 p-5">
 <h3>
 <span aria-hidden="true">✨</span> Finish
 </h3>
 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">
 Finish Details
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
 {horse.finish_details}
 </span>
 </div>
 </div>
 )}

 {/* Show Bio — model only */}
 {assetConfig.showShowBio && (horse.assigned_breed || horse.assigned_gender || horse.assigned_age || horse.regional_id) && (
            <div className="rounded-lg border border-border-tan/30 bg-card/20 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-widest text-secondary-foreground uppercase">
                <span aria-hidden="true">🏅</span> Show Identity
              </h3>
 {horse.assigned_breed && (
 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">
 Breed
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
 {horse.assigned_breed}
 </span>
 </div>
 )}
 {horse.assigned_gender && (
 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">
 Gender
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
 {horse.assigned_gender}
 </span>
 </div>
 )}
 {horse.assigned_age && (
 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">
 Age
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
 {horse.assigned_age}
 </span>
 </div>
 )}
 {horse.regional_id && (
 <div className="flex items-center justify-between border-b border-dashed border-border-tan/20 px-0 py-3 last:border-0">
 <span className="text-sm font-medium text-secondary-foreground">
 Regional ID
 </span>
 <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
 {horse.regional_id}
 </span>
 </div>
 )}
 </div>
 )}

 {/* Public Notes */}
 {horse.public_notes && (
            <div className="rounded-lg border border-border-tan/30 bg-card/20 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-widest text-secondary-foreground uppercase">
                <span aria-hidden="true">📝</span> Notes
              </h3>
 <p className="text-secondary-foreground m-0 leading-[1.6] whitespace-pre-wrap"><LinkifiedText text={horse.public_notes} /></p>
 </div>
 )}

 {/* Condition Ledger — every grade this model has carried.
  Renders nothing until the first regrade. */}
 <ConditionLedger entries={conditionLedger} />

 {/* Market Value Badge */}
 {horse.catalog_id && <MarketValueBadge catalogId={horse.catalog_id} />}

 {/* Show Records */}
 <ShowRecordTimeline horseId={horseId} records={showRecords} isOwner={true} placingHrefs={placingHrefs} />

 {/* MHH Titles (159) — earned plaques + the owner's progress ladder */}
 <TitlesSection titles={horseTitles} ladder={titleLadder} />

 {/* MHH Qualification Cards (Phase F) — renders nothing when empty */}
 <QualificationCardsSection cards={qualificationCards} />

 {/* Pedigree Card */}
 <PedigreeCard horseId={horseId} pedigree={pedigree} isOwner={true} />

 {/* 🐾 Hoofprint Timeline — model + other_model only */}
 {assetConfig.showHoofprint && (
 <HoofprintTimeline
 showRecordsListedElsewhere
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
 <Button asChild variant="outline" size="wide"><Link
 href="/dashboard"
 id="back-to-stable"
 >
 ← Back to Stable
 </Link></Button>
 {/* The same horse has two pages — this owner view and the public
     passport a buyer or judge sees — and nothing connected them, so
     checking "what does everyone else see?" meant guessing a URL.
     Private horses have no public page, so the link only appears when
     there is somewhere to go. */}
 {(horse.visibility === "public" || horse.visibility === "unlisted") && (
 <Button asChild variant="outline" size="wide"><Link
 href={`/community/${horseId}`}
 id="view-public-passport"
 title={
 horse.visibility === "unlisted"
 ? "Unlisted — anyone with the link can see this page"
 : "The passport everyone else sees"
 }
 >
 👁️ View public passport
 </Link></Button>
 )}
 <Button asChild><Link
 href={`/stable/${horseId}/edit`}
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
 </Link></Button>
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
