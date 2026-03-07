import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSignedImageUrls } from "@/lib/utils/storage";
import ShareButton from "@/components/ShareButton";
import MessageSellerButton from "@/components/MessageSellerButton";
import RatingBadge from "@/components/RatingBadge";
import FollowButton from "@/components/FollowButton";
import { getUserRatingSummary } from "@/app/actions/ratings";
import { getFollowStats } from "@/app/actions/follows";

export const dynamic = "force-dynamic";

// Types
interface ProfileHorse {
  id: string;
  custom_name: string;
  finish_type: string;
  condition_grade: string;
  created_at: string;
  trade_status: string;
  listing_price: number | null;
  marketplace_notes: string | null;
  user_collections: { name: string } | null;
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ alias_name: string }>;
}) {
  const { alias_name } = await params;
  const decoded = decodeURIComponent(alias_name);
  return {
    title: `@${decoded}'s Stable — Model Horse Hub`,
    description: `Browse the public collection of @${decoded} on Model Horse Hub.`,
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ alias_name: string }>;
}) {
  const { alias_name } = await params;
  const aliasDecoded = decodeURIComponent(alias_name);
  const supabase = await createClient();

  // Auth check — needed for RLS
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Look up the user by alias_name
  const { data: profileUser } = await supabase
    .from("users")
    .select("id, alias_name, created_at")
    .eq("alias_name", aliasDecoded)
    .single<{ id: string; alias_name: string; created_at: string }>();

  if (!profileUser) {
    notFound();
  }

  const isOwnProfile = profileUser.id === user.id;

  // Fetch rating summary for this profile user
  const ratingSummary = await getUserRatingSummary(profileUser.id);

  // Count completed transactions
  const { count: completedTxCount } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .or(`buyer_id.eq.${profileUser.id},seller_id.eq.${profileUser.id}`)
    .eq("transaction_status", "completed");

  // Fetch follow stats
  const followStats = await getFollowStats(profileUser.id);

  // Fetch public collections
  const { data: publicCollections } = await supabase
    .from("user_collections")
    .select("id, name")
    .eq("user_id", profileUser.id)
    .eq("is_public", true)
    .order("name");

  // ================================================================
  // PROFILE QUERY: Only public horses for this user
  // 🔒 financial_vault is NEVER queried here.
  // ================================================================
  const { data: rawHorses } = await supabase
    .from("user_horses")
    .select(
      `
      id, custom_name, finish_type, condition_grade, created_at, trade_status, listing_price, marketplace_notes,
      user_collections(name),
      reference_molds(mold_name, manufacturer),
      artist_resins(resin_name, sculptor_alias),
      reference_releases(release_name, model_number),
      horse_images(image_url, angle_profile)
    `
    )
    .eq("owner_id", profileUser.id)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  const horses = (rawHorses as unknown as ProfileHorse[]) ?? [];

  // Generate signed URLs for thumbnails
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
  const profileCards = horses.map((horse) => {
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

    return {
      id: horse.id,
      customName: horse.custom_name,
      finishType: horse.finish_type,
      conditionGrade: horse.condition_grade,
      createdAt: horse.created_at,
      refName,
      releaseLine,
      thumbnailUrl: signedUrl || null,
      collectionName: horse.user_collections?.name || null,
      tradeStatus: horse.trade_status || "Not for Sale",
      listingPrice: horse.listing_price ?? null,
      marketplaceNotes: horse.marketplace_notes || null,
    };
  });

  const memberSince = new Date(profileUser.created_at).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" }
  );

  return (
    <div className="page-container">
      {/* Profile Header */}
      <div className="profile-hero animate-fade-in-up">
        <div className="profile-avatar">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div className="profile-hero-content">
          <h1>
            @{profileUser.alias_name}
            {isOwnProfile && (
              <span className="community-own-badge" style={{ marginLeft: "var(--space-sm)", verticalAlign: "middle" }}>
                You
              </span>
            )}
          </h1>
          <p className="profile-hero-subtitle">
            {isOwnProfile
              ? "Your public stable — this is how other collectors see your models."
              : `@${profileUser.alias_name}'s public collection`}
          </p>
          <div className="profile-hero-stats">
            <span className="profile-stat">
              🐴 {profileCards.length} public model{profileCards.length !== 1 ? "s" : ""}
            </span>
            <span className="profile-stat">
              📅 Member since {memberSince}
            </span>
            <ShareButton
              title={`@${profileUser.alias_name}'s Stable — Model Horse Hub`}
              text={`Check out @${profileUser.alias_name}'s model horse collection on Model Horse Hub!`}
              variant="icon"
            />
            {ratingSummary.count > 0 && (
              <RatingBadge average={ratingSummary.average} count={ratingSummary.count} />
            )}
            {(completedTxCount ?? 0) > 0 && (
              <span className="profile-stat" style={{ color: "#22C55E" }}>
                ✅ {completedTxCount} transaction{completedTxCount !== 1 ? "s" : ""} completed
              </span>
            )}
          </div>
          <FollowButton
            targetUserId={profileUser.id}
            initialIsFollowing={followStats.isFollowing}
            initialFollowerCount={followStats.followerCount}
            isOwnProfile={isOwnProfile}
          />
          {(followStats.followerCount > 0 || followStats.followingCount > 0) && (
            <div className="profile-follow-stats">
              <span>{followStats.followerCount} follower{followStats.followerCount !== 1 ? "s" : ""}</span>
              <span>·</span>
              <span>{followStats.followingCount} following</span>
            </div>
          )}
        </div>
      </div>

      {/* Public Collections */}
      {publicCollections && publicCollections.length > 0 && (
        <div className="profile-public-collections animate-fade-in-up">
          <h3 style={{ fontSize: "calc(0.9rem * var(--font-scale))", color: "var(--color-text-muted)", marginBottom: "var(--space-sm)" }}>
            📁 Public Collections
          </h3>
          <div className="profile-collection-pills">
            {(publicCollections as { id: string; name: string }[]).map((col) => (
              <Link
                key={col.id}
                href={`/stable/collection/${col.id}`}
                className="profile-collection-pill"
              >
                📁 {col.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <nav
        className="passport-breadcrumb animate-fade-in-up"
        aria-label="Breadcrumb"
        style={{ marginBottom: "var(--space-lg)" }}
      >
        <Link href="/community">Show Ring</Link>
        <span className="separator" aria-hidden="true">/</span>
        <span>@{profileUser.alias_name}</span>
      </nav>

      {/* Grid */}
      {profileCards.length === 0 ? (
        <div className="card shelf-empty animate-fade-in-up">
          <div className="shelf-empty-icon">🔒</div>
          <h2>
            {isOwnProfile
              ? "You haven't made any models public yet"
              : `@${profileUser.alias_name} hasn't made any models public yet`}
          </h2>
          <p>
            {isOwnProfile
              ? 'Toggle "Show in Public Community Feed" on any of your models to showcase them here.'
              : "Check back later — they may share some soon!"}
          </p>
          {isOwnProfile && (
            <Link href="/dashboard" className="btn btn-primary">
              🏠 Go to My Stable
            </Link>
          )}
        </div>
      ) : (
        <div className="community-grid animate-fade-in-up">
          {profileCards.map((horse) => (
            <Link
              key={horse.id}
              href={`/community/${horse.id}`}
              className="community-card"
              id={`profile-card-${horse.id}`}
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
                {horse.tradeStatus === "For Sale" && (
                  <span className="trade-badge trade-for-sale">
                    💲 {horse.listingPrice ? `$${horse.listingPrice.toLocaleString("en-US")}` : "For Sale"}
                  </span>
                )}
                {horse.tradeStatus === "Open to Offers" && (
                  <span className="trade-badge trade-open-offers">
                    🤝 {horse.listingPrice ? `~$${horse.listingPrice.toLocaleString("en-US")}` : "Open to Offers"}
                  </span>
                )}
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
                  <span className="community-card-ref">
                    {horse.conditionGrade}
                  </span>
                  <span className="community-card-time">
                    {formatDate(horse.createdAt)}
                  </span>
                </div>
                {horse.collectionName && (
                  <div className="horse-card-collection">
                    📁 {horse.collectionName}
                  </div>
                )}
                {(horse.tradeStatus === "For Sale" || horse.tradeStatus === "Open to Offers") && horse.marketplaceNotes && (
                  <div className="marketplace-notes-snippet" title={horse.marketplaceNotes}>
                    📝 {horse.marketplaceNotes.length > 50 ? horse.marketplaceNotes.slice(0, 50) + "…" : horse.marketplaceNotes}
                  </div>
                )}
                {!isOwnProfile && (horse.tradeStatus === "For Sale" || horse.tradeStatus === "Open to Offers") && (
                  <div style={{ marginTop: "var(--space-sm)" }}>
                    <MessageSellerButton sellerId={profileUser.id} horseId={horse.id} />
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Reviews Section */}
      {ratingSummary.count > 0 && (
        <div className="reviews-section animate-fade-in-up" id="reviews">
          <div className="reviews-section-header">
            <h2>⭐ Reviews ({ratingSummary.count})</h2>
          </div>
          {ratingSummary.ratings.map((r) => (
            <div key={r.id} className="review-item">
              <div className="review-item-header">
                <span className="review-item-author">
                  @{r.reviewerAlias} — {"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}
                </span>
                <span className="review-item-date">
                  {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              {r.reviewText && (
                <p className="review-item-text">&ldquo;{r.reviewText}&rdquo;</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
