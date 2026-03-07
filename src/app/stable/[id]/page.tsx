import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSignedImageUrls } from "@/lib/utils/storage";
import PassportGallery from "@/components/PassportGallery";
import VaultReveal from "@/components/VaultReveal";
import DeleteHorseModal from "@/components/DeleteHorseModal";

// Types
interface HorseDetail {
  id: string;
  owner_id: string;
  custom_name: string;
  finish_type: string;
  condition_grade: string;
  is_for_sale: boolean;
  is_public: boolean;
  created_at: string;
  sculptor: string | null;
  reference_molds: {
    mold_name: string;
    manufacturer: string;
    scale: string;
    release_year_start: number | null;
  } | null;
  artist_resins: {
    resin_name: string;
    sculptor_alias: string;
    scale: string;
    cast_medium: string | null;
  } | null;
  reference_releases: {
    release_name: string;
    model_number: string | null;
    color_description: string | null;
    release_year_start: number | null;
    release_year_end: number | null;
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
      id, owner_id, custom_name, finish_type, condition_grade,
      is_for_sale, is_public, created_at, sculptor,
      reference_molds(mold_name, manufacturer, scale, release_year_start),
      artist_resins(resin_name, sculptor_alias, scale, cast_medium),
      reference_releases(release_name, model_number, color_description, release_year_start, release_year_end)
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

  // Reference display info
  const refInfo = horse.reference_molds
    ? {
      type: "Mold",
      name: horse.reference_molds.mold_name,
      maker: horse.reference_molds.manufacturer,
      scale: horse.reference_molds.scale,
      extra: horse.reference_molds.release_year_start
        ? `First released ${horse.reference_molds.release_year_start}`
        : null,
    }
    : horse.artist_resins
      ? {
        type: "Artist Resin",
        name: horse.artist_resins.resin_name,
        maker: horse.artist_resins.sculptor_alias,
        scale: horse.artist_resins.scale,
        extra: horse.artist_resins.cast_medium,
      }
      : null;

  const releaseInfo = horse.reference_releases
    ? {
      name: horse.reference_releases.release_name,
      modelNumber: horse.reference_releases.model_number,
      color: horse.reference_releases.color_description,
      yearStart: horse.reference_releases.release_year_start,
      yearEnd: horse.reference_releases.release_year_end,
    }
    : null;

  return (
    <div className="page-container form-page">
      {/* Breadcrumb */}
      <nav className="passport-breadcrumb animate-fade-in-up" aria-label="Breadcrumb">
        <Link href="/">Digital Stable</Link>
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
              <span aria-hidden="true">📋</span> Model Details
            </h3>

            <div className="passport-detail-row">
              <span className="passport-detail-label">Finish Type</span>
              <span className="passport-detail-value">{horse.finish_type}</span>
            </div>

            <div className="passport-detail-row">
              <span className="passport-detail-label">Condition</span>
              <span className="passport-condition-badge">
                {horse.condition_grade}
              </span>
            </div>

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
          </div>

          {/* Financial Vault */}
          <VaultReveal vault={vault} />

          {/* Actions */}
          <div className="passport-actions">
            <Link
              href="/"
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
