import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import MarketValueBadge from "@/components/MarketValueBadge";
import { getSignedImageUrls } from "@/lib/utils/storage";
import PassportGallery from "@/components/PassportGallery";
import VaultReveal from "@/components/VaultReveal";
import DeleteHorseModal from "@/components/DeleteHorseModal";
import ShowRecordTimeline from "@/components/ShowRecordTimeline";
import PedigreeCard from "@/components/PedigreeCard";
import HoofprintTimeline from "@/components/HoofprintTimeline";
import TransferModal from "@/components/TransferModal";
import ParkedExportPanel from "@/components/ParkedExportPanel";
import { getHoofprint } from "@/app/actions/hoofprint";

export const dynamic = "force-dynamic";

// Types
interface HorseDetail {
  id: string;
  owner_id: string;
  custom_name: string;
  finish_type: string | null;
  condition_grade: string | null;
  asset_category: string;
  is_for_sale: boolean;
  is_public: boolean;
  created_at: string;
  sculptor: string | null;
  finishing_artist: string | null;
  edition_number: number | null;
  edition_size: number | null;
  catalog_id: string | null;
  catalog_items: {
    title: string;
    maker: string;
    scale: string | null;
    item_type: string;
    attributes: Record<string, unknown>;
  } | null;
}

interface HorseImage {
  id: string;
  image_url: string;
  angle_profile: string;
  uploaded_at: string;
}

interface VaultData {
  purchase_price: number | null;
  purchase_date: string | null;
  estimated_current_value: number | null;
  insurance_notes: string | null;
}

const ANGLE_LABELS: Record<string, string> = {
  Primary_Thumbnail: "Primary Thumbnail",
  Left_Side: "Left Side",
  Right_Side: "Right Side",
  Front_Chest: "Front / Chest",
  Back_Hind: "Back / Hind",
  Detail_Face_Eyes: "Face & Eyes Detail",
  Detail_Ears: "Ears Detail",
  Detail_Hooves: "Hooves Detail",
  Flaw_Rub_Damage: "Flaws / Damage",
  Other: "Other",
};

// Priority for sorting images (thumbnail first)
const ANGLE_ORDER: string[] = [
  "Primary_Thumbnail",
  "Left_Side",
  "Right_Side",
  "Front_Chest",
  "Back_Hind",
  "Detail_Face_Eyes",
  "Detail_Ears",
  "Detail_Hooves",
  "Flaw_Rub_Damage",
  "Other",
];

export default async function HorsePassportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
      id, owner_id, custom_name, finish_type, condition_grade, asset_category,
      is_for_sale, is_public, created_at, sculptor, finishing_artist, edition_number, edition_size, catalog_id,
      catalog_items:catalog_id(title, maker, scale, item_type, attributes)
    `
    )
    .eq("id", horseId)
    .single();

  if (!rawHorse) {
    notFound();
  }

  const horse = rawHorse as unknown as HorseDetail;

  // Only the owner can see the full passport for now
  if (horse.owner_id !== user.id) {
    notFound();
  }

  // Fetch all images
  const { data: rawImages } = await supabase
    .from("horse_images")
    .select("id, image_url, angle_profile, uploaded_at")
    .eq("horse_id", horseId)
    .order("uploaded_at");

  const images = (rawImages as unknown as HorseImage[]) ?? [];

  // Sort by angle priority
  images.sort((a, b) => {
    const aIdx = ANGLE_ORDER.indexOf(a.angle_profile);
    const bIdx = ANGLE_ORDER.indexOf(b.angle_profile);
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });

  // Generate signed URLs for all images
  const imageUrls = images.map((img) => img.image_url);
  const signedUrlMap = await getSignedImageUrls(supabase, imageUrls);

  const galleryImages = images.map((img) => ({
    signedUrl: signedUrlMap.get(img.image_url) || img.image_url,
    angle_profile: img.angle_profile,
    label: ANGLE_LABELS[img.angle_profile] || img.angle_profile,
  }));

  // Fetch financial vault (owner-only via RLS)
  const { data: rawVault } = await supabase
    .from("financial_vault")
    .select(
      "purchase_price, purchase_date, estimated_current_value, insurance_notes"
    )
    .eq("horse_id", horseId)
    .single<VaultData>();

  const vault = rawVault ?? null;

  // ================================================================
  // PROVENANCE: Show Records + Pedigree
  // ================================================================

  const { data: rawRecords } = await supabase
    .from("show_records")
    .select("id, show_name, show_date, division, \"placing\", ribbon_color, judge_name, is_nan, notes")
    .eq("horse_id", horseId)
    .order("show_date", { ascending: false, nullsFirst: false });

  const showRecords = (rawRecords ?? []).map((r: {
    id: string;
    show_name: string;
    show_date: string | null;
    division: string | null;
    placing: string | null;
    ribbon_color: string | null;
    judge_name: string | null;
    is_nan: boolean;
    notes: string | null;
  }) => ({
    id: r.id,
    showName: r.show_name,
    showDate: r.show_date,
    division: r.division,
    placing: r.placing,
    ribbonColor: r.ribbon_color,
    judgeName: r.judge_name,
    isNan: r.is_nan,
    notes: r.notes,
  }));

  const { data: rawPedigree } = await supabase
    .from("horse_pedigrees")
    .select("id, sire_name, dam_name, sculptor, cast_number, edition_size, lineage_notes")
    .eq("horse_id", horseId)
    .maybeSingle();

  const pedigree = rawPedigree ? {
    id: rawPedigree.id as string,
    sireName: (rawPedigree as { sire_name: string | null }).sire_name,
    damName: (rawPedigree as { dam_name: string | null }).dam_name,
    sculptor: (rawPedigree as { sculptor: string | null }).sculptor,
    castNumber: (rawPedigree as { cast_number: string | null }).cast_number,
    editionSize: (rawPedigree as { edition_size: string | null }).edition_size,
    lineageNotes: (rawPedigree as { lineage_notes: string | null }).lineage_notes,
  } : null;

  // Hoofprint data
  const { timeline, ownershipChain, lifeStage } = await getHoofprint(horseId);

  // Check if horse is parked (for Parked Export panel)
  const isParked = lifeStage === "parked";
  let existingPin: string | null = null;
  if (isParked) {
    const { data: activeTransfer } = await supabase
      .from("horse_transfers")
      .select("claim_pin")
      .eq("horse_id", horseId)
      .eq("sender_id", user.id)
      .eq("status", "pending")
      .not("claim_pin", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    existingPin = (activeTransfer as { claim_pin: string } | null)?.claim_pin || null;
  }

  // Reference display info
  const cat = horse.catalog_items;
  const refInfo = cat
    ? {
      type: cat.item_type === "artist_resin" ? "Artist Resin" : "Mold",
      name: cat.title,
      maker: cat.maker,
      scale: cat.scale || "Unknown",
      extra: cat.item_type === "artist_resin"
        ? (cat.attributes?.cast_medium as string | null)
        : (cat.attributes?.release_year_start
          ? `First released ${cat.attributes.release_year_start}`
          : null),
    }
    : null;

  const releaseInfo = (cat && cat.item_type === "plastic_release")
    ? {
      name: cat.title,
      modelNumber: (cat.attributes?.model_number as string | null),
      color: (cat.attributes?.color_description as string | null),
      yearStart: (cat.attributes?.release_year_start as number | null),
      yearEnd: (cat.attributes?.release_year_end as number | null),
    }
    : null;

  return (
    <div className="page-container form-page">
      {/* Breadcrumb */}
      <nav className="passport-breadcrumb animate-fade-in-up" aria-label="Breadcrumb">
        <Link href="/dashboard">Digital Stable</Link>
        <span className="separator" aria-hidden="true">
          /
        </span>
        <span>{horse.custom_name}</span>
      </nav>

      {/* Two-column layout: Gallery | Info */}
      <div className="passport-layout animate-fade-in-up">
        {/* Left: Gallery */}
        <div>
          <PassportGallery images={galleryImages} />
        </div>

        {/* Right: Info sidebar */}
        <div className="passport-sidebar">
          {/* Title */}
          <div>
            <h1 className="passport-title">{horse.custom_name}</h1>
            {refInfo ? (
              <p className="passport-subtitle">
                {refInfo.maker} — {refInfo.name}
              </p>
            ) : (
              <p className="passport-subtitle" style={{ opacity: 0.6, fontStyle: "italic" }}>
                Unlisted / Custom Entry
              </p>
            )}
          </div>

          {/* Model Details Card */}
          <div className="passport-detail-card">
            <h3>
              <span aria-hidden="true">📋</span> {(horse.asset_category || "model") === "model" ? "Model Details" : `${(horse.asset_category || "model").charAt(0).toUpperCase() + (horse.asset_category || "model").slice(1)} Details`}
            </h3>

            {horse.asset_category && horse.asset_category !== "model" && (
              <div className="passport-detail-row">
                <span className="passport-detail-label">Category</span>
                <span className="passport-detail-value">
                  {horse.asset_category === "tack" ? "🏇 Tack & Gear" : horse.asset_category === "prop" ? "🌲 Prop" : "🎭 Diorama"}
                </span>
              </div>
            )}

            {horse.finish_type && (
              <div className="passport-detail-row">
                <span className="passport-detail-label">Finish Type</span>
                <span className="passport-detail-value">{horse.finish_type}</span>
              </div>
            )}

            {horse.condition_grade && (
              <div className="passport-detail-row">
                <span className="passport-detail-label">Condition</span>
                <span className="passport-condition-badge">
                  {horse.condition_grade}
                </span>
              </div>
            )}

            {refInfo ? (
              <>
                <div className="passport-detail-row">
                  <span className="passport-detail-label">{refInfo.type}</span>
                  <span className="passport-detail-value">{refInfo.name}</span>
                </div>

                <div className="passport-detail-row">
                  <span className="passport-detail-label">
                    {refInfo.type === "Mold" ? "Manufacturer" : "Sculptor"}
                  </span>
                  <span className="passport-detail-value">{refInfo.maker}</span>
                </div>

                <div className="passport-detail-row">
                  <span className="passport-detail-label">Scale</span>
                  <span className="passport-detail-value">{refInfo.scale}</span>
                </div>

                {refInfo.extra && (
                  <div className="passport-detail-row">
                    <span className="passport-detail-label">
                      {refInfo.type === "Mold" ? "Released" : "Medium"}
                    </span>
                    <span className="passport-detail-value">
                      {refInfo.extra}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="passport-detail-row">
                <span className="passport-detail-label">Reference</span>
                <span className="passport-detail-value" style={{ opacity: 0.6, fontStyle: "italic" }}>
                  Not linked to database — Custom Entry
                </span>
              </div>
            )}

            {releaseInfo && (
              <>
                <div className="passport-detail-row">
                  <span className="passport-detail-label">Release</span>
                  <span className="passport-detail-value">{releaseInfo.name}</span>
                </div>

                {releaseInfo.modelNumber && (
                  <div className="passport-detail-row">
                    <span className="passport-detail-label">Model #</span>
                    <span className="passport-detail-value">#{releaseInfo.modelNumber}</span>
                  </div>
                )}

                {releaseInfo.color && (
                  <div className="passport-detail-row">
                    <span className="passport-detail-label">Color</span>
                    <span className="passport-detail-value">{releaseInfo.color}</span>
                  </div>
                )}

                {releaseInfo.yearStart && (
                  <div className="passport-detail-row">
                    <span className="passport-detail-label">Release Years</span>
                    <span className="passport-detail-value">
                      {releaseInfo.yearStart}
                      {releaseInfo.yearEnd && releaseInfo.yearEnd !== releaseInfo.yearStart
                        ? `–${releaseInfo.yearEnd}`
                        : ""}
                    </span>
                  </div>
                )}
              </>
            )}

            <div className="passport-detail-row">
              <span className="passport-detail-label">Added</span>
              <span className="passport-detail-value">
                {new Date(horse.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            <div className="passport-detail-row">
              <span className="passport-detail-label">Photos</span>
              <span className="passport-detail-value">
                {images.length} uploaded
              </span>
            </div>

            {horse.sculptor && (
              <div className="passport-detail-row">
                <span className="passport-detail-label">Sculptor / Artist</span>
                <span className="passport-detail-value">{horse.sculptor}</span>
              </div>
            )}

            {horse.finishing_artist && (
              <div className="passport-detail-row">
                <span className="passport-detail-label">🎨 Finished by</span>
                <span className="passport-detail-value">{horse.finishing_artist}</span>
              </div>
            )}

            {(horse.edition_number || horse.edition_size) && (
              <div className="passport-detail-row">
                <span className="passport-detail-label">📋 Edition</span>
                <span className="passport-detail-value">
                  {horse.edition_number && horse.edition_size
                    ? `${horse.edition_number} of ${horse.edition_size}`
                    : horse.edition_size
                      ? `Limited to ${horse.edition_size}`
                      : `#${horse.edition_number}`}
                </span>
              </div>
            )}
          </div>

          {/* Market Value Badge */}
          {horse.catalog_id && <MarketValueBadge catalogId={horse.catalog_id} />}

          {/* Show Records */}
          <ShowRecordTimeline
            horseId={horseId}
            records={showRecords}
            isOwner={true}
          />

          {/* Pedigree Card */}
          <PedigreeCard
            horseId={horseId}
            pedigree={pedigree}
            isOwner={true}
          />

          {/* 🐾 Hoofprint™ Timeline */}
          <HoofprintTimeline
            horseId={horseId}
            timeline={timeline}
            ownershipChain={ownershipChain}
            lifeStage={lifeStage}
            isOwner={true}
            currentUserId={user.id}
          />

          {/* Financial Vault */}
          <VaultReveal vault={vault} />

          {/* Actions */}
          <div className="passport-actions">
            <Link
              href="/dashboard"
              className="btn btn-ghost"
              id="back-to-stable"
            >
              ← Back to Stable
            </Link>
            <Link
              href={`/stable/${horseId}/edit`}
              className="btn btn-primary"
              id="edit-horse-button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <TransferModal
              horseId={horseId}
              horseName={horse.custom_name}
            />
            <DeleteHorseModal
              horseId={horseId}
              horseName={horse.custom_name}
              imageUrls={images.map((img) => img.image_url)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
