import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getPublicImageUrls } from "@/lib/utils/storage";
import ShareButton from "@/components/ShareButton";
import MessageSellerButton from "@/components/MessageSellerButton";
import RatingBadge from "@/components/RatingBadge";
import FollowButton from "@/components/FollowButton";
import { getUserReviewSummary } from "@/app/actions/transactions";
import { getFollowStats } from "@/app/actions/follows";
import EditBioButton from "@/components/EditBioButton";
import BlockButton from "@/components/BlockButton";
import MessageUserButton from "@/components/MessageUserButton";
import RatingForm from "@/components/RatingForm";
import { isBlocked as checkIsBlocked } from "@/app/actions/blocks";
import TrophyCase from "@/components/TrophyCase";

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
  catalog_items: {
    title: string;
    maker: string;
    item_type: string;
  } | null;
  horse_images: {
    image_url: string;
    angle_profile: string;
  }[];
}

function getFinishBadgeClass(finish: string): string {
  switch (finish) {
    case "OF":
      return "of";
    case "Custom":
      return "custom";
    case "Artist Resin":
      return "resin";
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
    .select("id, alias_name, created_at, bio, avatar_url, show_badges")
    .eq("alias_name", aliasDecoded)
    .single<{ id: string; alias_name: string; created_at: string; bio: string | null; avatar_url: string | null; show_badges: boolean | null }>();

  if (!profileUser) {
    notFound();
  }

  // Resolve avatar from storage path to signed URL
  if (profileUser.avatar_url && !profileUser.avatar_url.startsWith("http")) {
    const { data: signedAvatar } = await supabase.storage
      .from("avatars")
      .createSignedUrl(profileUser.avatar_url, 3600);
    profileUser.avatar_url = signedAvatar?.signedUrl || null;
  }

  const isOwnProfile = profileUser.id === user.id;

  // Fetch rating summary for this profile user
  const ratingSummary = await getUserReviewSummary(profileUser.id);

  // Count completed transactions
  const { count: completedTxCount } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .or(`buyer_id.eq.${profileUser.id},seller_id.eq.${profileUser.id}`)
    .eq("transaction_status", "completed");

  // Check for unreviewed transactions between viewer and profile owner
  let unreviewedTxn: { id: string } | null = null;
  if (!isOwnProfile) {
    // Find a completed transaction between these two users where viewer hasn't reviewed
    const { data: txns } = await supabase
      .from("transactions")
      .select("id")
      .eq("status", "completed")
      .or(`and(party_a_id.eq.${user.id},party_b_id.eq.${profileUser.id}),and(party_a_id.eq.${profileUser.id},party_b_id.eq.${user.id})`)
      .order("completed_at", { ascending: false })
      .limit(10);

    if (txns && txns.length > 0) {
      const txnIds = (txns as { id: string }[]).map(t => t.id);
      const { data: existingReviews } = await supabase
        .from("reviews")
        .select("transaction_id")
        .eq("reviewer_id", user.id)
        .in("transaction_id", txnIds);

      const reviewedIds = new Set((existingReviews ?? []).map((r: { transaction_id: string }) => r.transaction_id));
      const unreviewed = (txns as { id: string }[]).find(t => !reviewedIds.has(t.id));
      if (unreviewed) {
        unreviewedTxn = unreviewed;
      }
    }
  }

  // Fetch follow stats
  const followStats = await getFollowStats(profileUser.id);

  // Check if user has an art studio
  const { data: studioProfile } = await supabase
    .from("artist_profiles")
    .select("studio_slug, studio_name")
    .eq("user_id", profileUser.id)
    .maybeSingle();
  const studioSlug = (studioProfile as { studio_slug: string; studio_name: string } | null)?.studio_slug || null;
  const studioName = (studioProfile as { studio_slug: string; studio_name: string } | null)?.studio_name || null;

  // Check block status (for other users)
  const blocked = isOwnProfile ? false : await checkIsBlocked(profileUser.id);

  // Fetch public collections
  const { data: publicCollections } = await supabase
    .from("user_collections")
    .select("id, name")
    .eq("user_id", profileUser.id)
    .eq("is_public", true)
    .order("name");

  // Fetch user badges for Trophy Case
  const { data: rawBadges } = await supabase
    .from("user_badges")
    .select("badge_id, earned_at, badges(id, name, description, icon, category, tier)")
    .eq("user_id", profileUser.id)
    .order("earned_at", { ascending: false });

  const userBadges = (rawBadges ?? []).map((b: Record<string, unknown>) => ({
    id: (b.badges as { id: string }).id,
    name: (b.badges as { name: string }).name,
    description: (b.badges as { description: string }).description,
    icon: (b.badges as { icon: string }).icon,
    category: (b.badges as { category: string }).category,
    tier: (b.badges as { tier: number }).tier,
    earnedAt: b.earned_at as string,
  }));

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
      catalog_items:catalog_id(title, maker, item_type),
      horse_images(image_url, angle_profile)
    `
    )
    .eq("owner_id", profileUser.id)
    .eq("visibility", "public")
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

  const signedUrlMap = getPublicImageUrls(thumbnailUrls);

  // Build display data
  const profileCards = horses.map((horse) => {
    const thumb = horse.horse_images?.find(
      (img) => img.angle_profile === "Primary_Thumbnail"
    );
    const firstImage = horse.horse_images?.[0];
    const imageUrl = thumb?.image_url || firstImage?.image_url;
    const signedUrl = imageUrl ? signedUrlMap.get(imageUrl) : undefined;

    const refName = horse.catalog_items
      ? `${horse.catalog_items.maker} ${horse.catalog_items.title}`
      : "Unlisted Mold";

    const releaseLine = null; // Now unified in catalog_items

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

  const forSaleCount = profileCards.filter(
    (h) => h.tradeStatus === "For Sale" || h.tradeStatus === "Open to Offers"
  ).length;

  return (
    <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6 max-w-[var(--max-width)]">
      {/* Profile Header */}
      <div className="profile-hero max-md:flex-col max-md:items-center max-md:text-center max-sm:flex-col max-sm:text-center max-sm:py-8 max-sm:px-4 animate-fade-in-up">
        <div className="flex items-center justify-center w-[72px] h-[72px] rounded-full bg-[rgba(44, 85, 69, 0.12)] border-[2px] border-[rgba(44, 85, 69, 0.3)] text-forest shrink-0">
          {profileUser.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profileUser.avatar_url} alt={profileUser.alias_name} className="w-full h-full rounded-full" style={{ objectFit: "cover" }} />
          ) : (
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
          )}
        </div>
        <div className="text-[calc(1.6rem*var(--font-scale))] font-extrabold tracking-[-0.02em] mb-1 text-forest">
          <h1>
            @{profileUser.alias_name}
            {isOwnProfile && (
              <span className="inline-flex py-[2px] px-2 rounded-sm bg-forest text-white text-[calc(0.65rem*var(--font-scale))] font-bold uppercase tracking-wider ml-2" style={{ verticalAlign: "middle" }}>
                You
              </span>
            )}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] leading-normal mb-2">
            {isOwnProfile
              ? "Your public stable — this is how other collectors see your models."
              : `@${profileUser.alias_name}'s public collection`}
          </p>
          {profileUser.bio && (
            <p style={{
              color: "var(--color-text-muted)",
              fontSize: "calc(var(--font-size-sm) * var(--font-scale))",
              maxWidth: "480px",
              lineHeight: 1.5,
              marginTop: "var(--space-xs)",
            }}>
              {profileUser.bio}
            </p>
          )}
          {isOwnProfile && (
            <EditBioButton currentBio={profileUser.bio} />
          )}
          {studioSlug && (
            <Link
              href={`/studio/${studioSlug}`}
              className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
              style={{ marginTop: "var(--space-xs)", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              🎨 {isOwnProfile ? "My Studio" : `Visit ${studioName || "Studio"}`}
            </Link>
          )}
          <div className="flex gap-6 flex-wrap">
            <span className="text-sm text-[var(--color-text-secondary)]">
              🐴 {profileCards.length} public model{profileCards.length !== 1 ? "s" : ""}
            </span>
            <span className="text-sm text-[var(--color-text-secondary)]">
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
              <span className="text-sm text-[var(--color-text-secondary)] text-[#22C55E]">
                ✅ {completedTxCount} transaction{completedTxCount !== 1 ? "s" : ""} completed
              </span>
            )}
            {forSaleCount > 0 && (
              <span className="text-sm text-[var(--color-text-secondary)] text-[var(--color-accent, #f59e0b)]">
                💲 {forSaleCount} for sale/trade
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
            <div className="flex items-center gap-2 text-[calc(0.85rem*var(--font-scale))] text-muted mt-1">
              <span>{followStats.followerCount} follower{followStats.followerCount !== 1 ? "s" : ""}</span>
              <span>·</span>
              <span>{followStats.followingCount} following</span>
            </div>
          )}
          {!isOwnProfile && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <MessageUserButton
                targetUserId={profileUser.id}
                targetAlias={profileUser.alias_name}
              />
              <BlockButton
                targetId={profileUser.id}
                targetAlias={profileUser.alias_name}
                initialBlocked={blocked}
              />
            </div>
          )}
        </div>
      </div>

      {/* Public Collections */}
      {publicCollections && publicCollections.length > 0 && (
        <div className="mb-6 animate-fade-in-up">
          <h3 className="text-[calc(0.9rem*var(--font-scale))] text-muted mb-2" >
            📁 Public Collections
          </h3>
          <div className="flex flex-wrap gap-2">
            {(publicCollections as { id: string; name: string }[]).map((col) => (
              <Link
                key={col.id}
                href={`/stable/collection/${col.id}`}
                className="inline-flex items-center gap-1 py-[6px] px-[14px] text-[calc(0.85rem*var(--font-scale))] bg-[rgba(129,140,248,0.06)] border border-[rgba(129,140,248,0.15)] rounded-md text-forest no-underline transition-all hover:0.12)] hover:0.3)] hover:translate-y-[-1px]"
              >
                📁 {col.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Trophy Case — only if user hasn't hidden badges (owner always sees their own) */}
      {userBadges.length > 0 && (isOwnProfile || (profileUser.show_badges ?? true)) && (
        <div className="animate-fade-in-up mb-6" id="trophies">
          <h3 className="text-[calc(0.9rem*var(--font-scale))] text-muted mb-2" >
            🏆 Trophy Case
          </h3>
          <TrophyCase badges={userBadges} />
        </div>
      )}

      {/* Unreviewed Transaction Prompt */}
      {unreviewedTxn && (
        <div className="animate-fade-in-up mb-6">
          <RatingForm
            transactionId={unreviewedTxn.id}
            targetId={profileUser.id}
            targetAlias={profileUser.alias_name}
            existingRating={null}
          />
        </div>
      )}

      {/* Breadcrumb */}
      <nav
        className="flex items-center gap-2 mb-6 text-sm text-muted animate-fade-in-up"
        aria-label="Breadcrumb"
        style={{ marginBottom: "var(--space-lg)" }}
      >
        <Link href="/community">Show Ring</Link>
        <span className="separator" aria-hidden="true">/</span>
        <span>@{profileUser.alias_name}</span>
      </nav>

      {/* Grid */}
      {profileCards.length === 0 ? (
        <div className="bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all text-center py-[var(--space-3xl)] px-8 animate-fade-in-up">
          <div className="text-center py-[var(--space-3xl)] px-8-icon">🔒</div>
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
            <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm">
              🏠 Go to My Stable
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill, minmax(300px, 1fr))] gap-6 animate-fade-in-up">
          {profileCards.map((horse) => (
            <Link
              key={horse.id}
              href={`/community/${horse.id}`}
              className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all"
              id={`profile-card-${horse.id}`}
            >
              <div className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all-image">
                {horse.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={horse.thumbnailUrl}
                    alt={horse.customName}
                    loading="lazy"
                  />
                ) : (
                  <div className="horse-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all-placeholder">
                    <span className="horse-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all-placeholder-icon">🐴</span>
                    <span>No photo</span>
                  </div>
                )}
                <span
                  className={`horse-card-badge ${getFinishBadgeClass(horse.finishType)}`}
                >
                  {horse.finishType}
                </span>
                {horse.tradeStatus === "For Sale" && (
                  <span className="trade-badge bg-[rgba(34,197,94,0.85)] text-white border border-[rgba(34,197,94,0.5)]">
                    💲 {horse.listingPrice ? `$${horse.listingPrice.toLocaleString("en-US")}` : "For Sale"}
                  </span>
                )}
                {horse.tradeStatus === "Open to Offers" && (
                  <span className="trade-badge bg-[rgba(59,130,246,0.85)] text-white border border-[rgba(59,130,246,0.5)]">
                    🤝 {horse.listingPrice ? `~$${horse.listingPrice.toLocaleString("en-US")}` : "Open to Offers"}
                  </span>
                )}
              </div>
              <div className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all-info">
                <div className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all-name">{horse.customName}</div>
                <div className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all-ref">{horse.refName}</div>
                {horse.releaseLine && (
                  <div
                    className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all-ref"
                    style={{
                      fontSize: "calc(0.7rem * var(--font-scale))",
                      opacity: 0.7,
                      marginTop: "2px",
                    }}
                  >
                    🎨 {horse.releaseLine}
                  </div>
                )}
                <div className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all-footer">
                  <span className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all-ref">
                    {horse.conditionGrade}
                  </span>
                  <span className="flex flex-col rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-edge no-underline text-ink transition-all-time">
                    {formatDate(horse.createdAt)}
                  </span>
                </div>
                {horse.collectionName && (
                  <div className="horse-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all-collection">
                    📁 {horse.collectionName}
                  </div>
                )}
                {(horse.tradeStatus === "For Sale" || horse.tradeStatus === "Open to Offers") && horse.marketplaceNotes && (
                  <div className="marketplace-notes-snippet" title={horse.marketplaceNotes}>
                    📝 {horse.marketplaceNotes.length > 50 ? horse.marketplaceNotes.slice(0, 50) + "…" : horse.marketplaceNotes}
                  </div>
                )}
                {!isOwnProfile && (horse.tradeStatus === "For Sale" || horse.tradeStatus === "Open to Offers") && (
                  <div className="mt-2" >
                    <MessageSellerButton
                      sellerId={profileUser.id}
                      horseId={horse.id}
                      horseName={horse.customName}
                      tradeStatus={horse.tradeStatus}
                      askingPrice={horse.listingPrice}
                    />
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Reviews Section */}
      {ratingSummary.count > 0 && (
        <div className="bg-[var(--color-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all-bg,rgba(0,0,0,0.05))] border border-edge rounded-lg p-6 mt-8 animate-fade-in-up" id="reviews">
          <div className="flex items-center gap-2 mb-6 [&_h2]:m-0 [&_h2]:text-[calc(1.1rem*var(--font-scale))]">
            <h2>⭐ Reviews ({ratingSummary.count})</h2>
          </div>
          {ratingSummary.ratings.map((r) => (
            <div key={r.id} className="py-4 border-b border-edge last:border-b-0">
              <div className="flex items-center justify-between mb-1 max-sm:flex-col max-sm:items-start max-sm:gap-1">
                <span className="text-[calc(0.85rem*var(--font-scale))] text-muted">
                  @{r.reviewerAlias} — {"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}
                </span>
                <span className="text-[calc(0.75rem*var(--font-scale))] text-muted opacity-70">
                  {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              {r.reviewText && (
                <p className="text-[calc(0.9rem*var(--font-scale))] text-muted italic mt-1">&ldquo;{r.reviewText}&rdquo;</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
