import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSignedImageUrls } from "@/lib/utils/storage";

// Types
interface CommunityHorse {
  id: string;
  owner_id: string;
  custom_name: string;
  finish_type: string;
  condition_grade: string;
  created_at: string;
  users: {
    alias_name: string;
  } | null;
  reference_molds: {
    mold_name: string;
    manufacturer: string;
  } | null;
  artist_resins: {
    resin_name: string;
    sculptor_alias: string;
  } | null;
  reference_releases: {
    release_name: string;
    model_number: string | null;
  } | null;
  horse_images: {
    image_url: string;
    angle_profile: string;
  }[];
}

function getFinishBadgeClass(finish: string): string {
  switch (finish) {
    case "OF":
      return "badge-of";
    case "Custom":
      return "badge-custom";
    case "Artist Resin":
      return "badge-resin";
    default:
      return "";
  }
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export const metadata = {
  title: "The Show Ring — Model Horse Hub",
  description:
    "Browse the community showcase of model horses cataloged by collectors around the world.",
};

export default async function CommunityPage() {
  const supabase = await createClient();

  // Auth check — community requires login (RLS needs authenticated user)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // ================================================================
  // COMMUNITY QUERY: Public horses across all users
  // CRITICAL: Joins user_horses → users (alias_name only),
  //           reference_molds, reference_releases, horse_images.
  // 🔒 financial_vault is NEVER queried here.
  // ================================================================
  const { data: rawHorses } = await supabase
    .from("user_horses")
    .select(
      `
      id, owner_id, custom_name, finish_type, condition_grade, created_at,
      users!inner(alias_name),
      reference_molds(mold_name, manufacturer),
      artist_resins(resin_name, sculptor_alias),
      reference_releases(release_name, model_number),
      horse_images(image_url, angle_profile)
    `
    )
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(60);

  const horses = (rawHorses as unknown as CommunityHorse[]) ?? [];

  // Collect all thumbnail image URLs and generate signed URLs
  const thumbnailUrls: string[] = [];
  horses.forEach((horse) => {
    const thumb = horse.horse_images?.find(
      (img) => img.angle_profile === "Primary_Thumbnail"
    );
    const first = horse.horse_images?.[0];
    const url = thumb?.image_url || first?.image_url;
    if (url) thumbnailUrls.push(url);
  });

  const signedUrlMap = await getSignedImageUrls(supabase, thumbnailUrls);

  // Build display data
  const communityCards = horses.map((horse) => {
    const thumb = horse.horse_images?.find(
      (img) => img.angle_profile === "Primary_Thumbnail"
    );
    const firstImage = horse.horse_images?.[0];
    const imageUrl = thumb?.image_url || firstImage?.image_url;
    const signedUrl = imageUrl ? signedUrlMap.get(imageUrl) : undefined;

    const refName = horse.reference_molds
      ? `${horse.reference_molds.manufacturer} ${horse.reference_molds.mold_name}`
      : horse.artist_resins
        ? `${horse.artist_resins.sculptor_alias} — ${horse.artist_resins.resin_name}`
        : "Unlisted Mold";

    const releaseLine = horse.reference_releases
      ? `${horse.reference_releases.release_name}${horse.reference_releases.model_number ? ` (#${horse.reference_releases.model_number})` : ""}`
      : null;

    const ownerAlias = horse.users?.alias_name ?? "Unknown";

    return {
      id: horse.id,
      customName: horse.custom_name,
      finishType: horse.finish_type,
      conditionGrade: horse.condition_grade,
      createdAt: horse.created_at,
      refName,
      releaseLine,
      ownerAlias,
      thumbnailUrl: signedUrl || null,
    };
  });

  return (
    <div className="page-container">
      {/* Hero */}
      <div className="community-hero animate-fade-in-up">
        <div className="community-hero-content">
          <h1>
            🏆 The <span className="text-gradient">Show Ring</span>
          </h1>
          <p className="community-hero-subtitle">
            Browse the latest models shared by collectors from around the world.
            Every horse has a story.
          </p>
        </div>
        <div className="community-stats">
          <div className="community-stat">
            <span className="community-stat-number">{communityCards.length}</span>
            <span className="community-stat-label">Models Showcased</span>
          </div>
        </div>
      </div>

      {/* Grid */}
      {communityCards.length === 0 ? (
        <div className="card shelf-empty animate-fade-in-up">
          <div className="shelf-empty-icon">🏟️</div>
          <h2>The Show Ring is Empty</h2>
          <p>
            No models have been shared yet. Be the first to showcase your
            collection!
          </p>
          <Link href="/add-horse" className="btn btn-primary">
            🐴 Add to Stable
          </Link>
        </div>
      ) : (
        <div className="community-grid animate-fade-in-up">
          {communityCards.map((horse) => (
            <Link
              key={horse.id}
              href={`/community/${horse.id}`}
              className="community-card"
              id={`community-card-${horse.id}`}
            >
              <div className="community-card-image">
                {horse.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={horse.thumbnailUrl}
                    alt={horse.customName}
                    loading="lazy"
                  />
                ) : (
                  <div className="horse-card-placeholder">
                    <span className="horse-card-placeholder-icon">🐴</span>
                    <span>No photo</span>
                  </div>
                )}
                <span
                  className={`horse-card-badge ${getFinishBadgeClass(horse.finishType)}`}
                >
                  {horse.finishType}
                </span>
              </div>
              <div className="community-card-info">
                <div className="community-card-name">{horse.customName}</div>
                <div className="community-card-ref">{horse.refName}</div>
                {horse.releaseLine && (
                  <div
                    className="community-card-ref"
                    style={{
                      fontSize: "calc(0.7rem * var(--font-scale))",
                      opacity: 0.7,
                      marginTop: "2px",
                    }}
                  >
                    🎨 {horse.releaseLine}
                  </div>
                )}
                <div className="community-card-footer">
                  <span className="community-card-owner">
                    <svg
                      width="12"
                      height="12"
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
                    @{horse.ownerAlias}
                  </span>
                  <span className="community-card-time">
                    {timeAgo(horse.createdAt)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
