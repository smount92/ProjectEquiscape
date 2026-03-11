import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSignedImageUrls } from "@/lib/utils/storage";
import PassportGallery from "@/components/PassportGallery";
import ShareButton from "@/components/ShareButton";
import FavoriteButton from "@/components/FavoriteButton";
import { getPosts } from "@/app/actions/posts";
import UniversalFeed from "@/components/UniversalFeed";
import ShowRecordTimeline from "@/components/ShowRecordTimeline";
import PedigreeCard from "@/components/PedigreeCard";
import HoofprintTimeline from "@/components/HoofprintTimeline";
import { getHoofprint } from "@/app/actions/hoofprint";

// Force fresh data on every request — prevents stale comments/favorites
export const dynamic = "force-dynamic";

// Types — mirrors the private passport but WITHOUT VaultData
interface PublicHorseDetail {
  id: string;
  owner_id: string;
  custom_name: string;
  finish_type: string;
  condition_grade: string;
  is_public: boolean;
  created_at: string;
  finishing_artist: string | null;
  edition_number: number | null;
  edition_size: number | null;
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
      is_public, created_at, finishing_artist, edition_number, edition_size,
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

  // ================================================================
  // SOCIAL: Favorites + Comments
  // ================================================================

  // Favorite count
  const { count: favoriteCount } = await supabase
    .from("horse_favorites")
    .select("id", { count: "exact", head: true })
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

          {/* See More from Seller — only for other users' horses */}
          {!isOwnHorse && (
            <Link
              href={`/profile/${encodeURIComponent(ownerAlias)}`}
              className="btn btn-ghost"
              style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", marginTop: "var(--space-sm)" }}
              id="see-more-seller"
            >
              👤 See all models from @{ownerAlias} →
            </Link>
          )}

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
              {isOwnHorse && (
                <Link
                  href={`/stable/${horse.id}`}
                  className="btn btn-primary"
                >
                  View My Passport
                </Link>
              )}
              <Link href={`/community/${horseId}/hoofprint`} className="btn btn-ghost">
                🐾 View Full Hoofprint
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Provenance — Read Only */}
      {(showRecords.length > 0 || pedigree) && (
        <div className="animate-fade-in-up" style={{ marginTop: "var(--space-xl)" }}>
          {showRecords.length > 0 && (
            <ShowRecordTimeline
              horseId={horseId}
              records={showRecords}
              isOwner={false}
            />
          )}
          {pedigree && (
            <div style={{ marginTop: "var(--space-lg)" }}>
              <PedigreeCard
                horseId={horseId}
                pedigree={pedigree}
                isOwner={false}
              />
            </div>
          )}
        </div>
      )}

      {/* 🐾 Hoofprint™ — Public Read-Only */}
      {await (async () => {
        const { timeline: hfTimeline, ownershipChain: hfChain, lifeStage: hfStage } = await getHoofprint(horseId);
        if (hfTimeline.length === 0 && hfChain.length === 0) return null;
        return (
          <div className="animate-fade-in-up" style={{ marginTop: "var(--space-xl)" }}>
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
      <div className="animate-fade-in-up" style={{ marginTop: "var(--space-xl)" }}>
        <UniversalFeed
          initialPosts={comments}
          context={{ horseId }}
          currentUserId={user.id}
          showComposer={true}
          composerPlaceholder="Leave a comment on this model…"
          label="Comments"
        />
      </div>
    </div>
  );
}
