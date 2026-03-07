import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSignedImageUrls } from "@/lib/utils/storage";
import PassportGallery from "@/components/PassportGallery";
import ShareButton from "@/components/ShareButton";

// Types — mirrors the private passport but WITHOUT VaultData
interface PublicHorseDetail {
  id: string;
  owner_id: string;
  custom_name: string;
  finish_type: string;
  condition_grade: string;
  is_public: boolean;
  created_at: string;
  users: {
    alias_name: string;
  } | null;
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

const ANGLE_LABELS: Record<string, string> = {
  Primary_Thumbnail: "Near-Side",
  Left_Side: "Left Side",
  Right_Side: "Off-Side",
  Front_Chest: "Front / Chest",
  Back_Hind: "Hindquarters",
  Belly_Makers_Mark: "Belly / Mark",
  Detail_Face_Eyes: "Face & Eyes",
  Detail_Ears: "Ears",
  Detail_Hooves: "Hooves",
  Flaw_Rub_Damage: "Flaws",
  extra_detail: "Detail",
  Other: "Other",
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_horses")
    .select("custom_name")
    .eq("id", id)
    .eq("is_public", true)
    .single();

  return {
    title: data
      ? `${data.custom_name} — The Show Ring`
      : "Horse Not Found — The Show Ring",
    description: data
      ? `View ${data.custom_name} in the community showcase.`
      : "This horse could not be found.",
  };
}

export default async function PublicPassportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
  // PUBLIC QUERY: Fetch horse ONLY if is_public = TRUE
  // 🔒 financial_vault is NEVER queried here.
  // 🔒 Only alias_name from users — never email or full_name.
  // ================================================================
  const { data: rawHorse } = await supabase
    .from("user_horses")
    .select(
      `
      id, owner_id, custom_name, finish_type, condition_grade,
      is_public, created_at,
      users!inner(alias_name),
      reference_molds(mold_name, manufacturer, scale, release_year_start),
      artist_resins(resin_name, sculptor_alias, scale, cast_medium),
      reference_releases(release_name, model_number, color_description, release_year_start, release_year_end)
    `
    )
    .eq("id", horseId)
    .eq("is_public", true)
    .single();

  if (!rawHorse) {
    notFound();
  }

  const horse = rawHorse as unknown as PublicHorseDetail;

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

  // Generate signed URLs
  const imageUrls = images.map((img) => img.image_url);
  const signedUrlMap = await getSignedImageUrls(supabase, imageUrls);

  const galleryImages = images.map((img) => ({
    signedUrl: signedUrlMap.get(img.image_url) || img.image_url,
    angle_profile: img.angle_profile,
    label: ANGLE_LABELS[img.angle_profile] || img.angle_profile,
  }));

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

  const ownerAlias = horse.users?.alias_name ?? "Unknown";
  const isOwnHorse = horse.owner_id === user.id;

  return (
    <div className="page-container form-page">
      {/* Breadcrumb */}
      <nav
        className="passport-breadcrumb animate-fade-in-up"
        aria-label="Breadcrumb"
      >
        <Link href="/community">Show Ring</Link>
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
              <p
                className="passport-subtitle"
                style={{ opacity: 0.6, fontStyle: "italic" }}
              >
                Unlisted / Custom Entry
              </p>
            )}
          </div>

          {/* Owner badge */}
          <Link
            href={`/profile/${encodeURIComponent(ownerAlias)}`}
            className="community-owner-badge"
            style={{ textDecoration: "none" }}
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
              aria-hidden="true"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>
              Owned by <strong>@{ownerAlias}</strong>
            </span>
            {isOwnHorse && (
              <span className="community-own-badge">You</span>
            )}
          </Link>

          {/* Model Details Card */}
          <div className="passport-detail-card">
            <h3>
              <span aria-hidden="true">📋</span> Model Details
            </h3>

            <div className="passport-detail-row">
              <span className="passport-detail-label">Finish Type</span>
              <span className="passport-detail-value">
                {horse.finish_type}
              </span>
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
                <span
                  className="passport-detail-value"
                  style={{ opacity: 0.6, fontStyle: "italic" }}
                >
                  Not linked to database — Custom Entry
                </span>
              </div>
            )}

            {releaseInfo && (
              <>
                <div className="passport-detail-row">
                  <span className="passport-detail-label">Release</span>
                  <span className="passport-detail-value">
                    {releaseInfo.name}
                  </span>
                </div>

                {releaseInfo.modelNumber && (
                  <div className="passport-detail-row">
                    <span className="passport-detail-label">Model #</span>
                    <span className="passport-detail-value">
                      #{releaseInfo.modelNumber}
                    </span>
                  </div>
                )}

                {releaseInfo.color && (
                  <div className="passport-detail-row">
                    <span className="passport-detail-label">Color</span>
                    <span className="passport-detail-value">
                      {releaseInfo.color}
                    </span>
                  </div>
                )}

                {releaseInfo.yearStart && (
                  <div className="passport-detail-row">
                    <span className="passport-detail-label">Release Years</span>
                    <span className="passport-detail-value">
                      {releaseInfo.yearStart}
                      {releaseInfo.yearEnd &&
                        releaseInfo.yearEnd !== releaseInfo.yearStart
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
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>

          {/* 🔒 NO Financial Vault section — this is a PUBLIC view */}

          {/* Actions */}
          <div className="passport-actions" style={{ marginTop: "var(--space-lg)" }}>
            <Link href="/community" className="btn btn-ghost">
              ← Back to Show Ring
            </Link>
            <div style={{ display: "flex", gap: "var(--space-sm)" }}>
              <ShareButton
                title={`${horse.custom_name} — Model Horse Hub`}
                text={`Check out ${horse.custom_name} on Model Horse Hub!`}
                label="Share"
                variant="full"
              />
              {isOwnHorse && (
                <Link
                  href={`/stable/${horse.id}`}
                  className="btn btn-primary"
                >
                  View My Passport
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
