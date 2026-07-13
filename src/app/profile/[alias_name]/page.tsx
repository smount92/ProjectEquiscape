import { createClient } from"@/lib/supabase/server";
import { notFound } from"next/navigation";
import Link from"next/link";
import { getPublicImageUrls } from"@/lib/utils/storage";
import { getAdminClient } from"@/lib/supabase/admin";
import ShareButton from"@/components/ShareButton";
import MessageSellerButton from"@/components/MessageSellerButton";
import RatingBadge from"@/components/RatingBadge";
import FollowButton from"@/components/FollowButton";
import { getUserReviewSummary } from"@/app/actions/transactions";
import { getFollowStats } from"@/app/actions/follows";
import EditBioButton from"@/components/EditBioButton";
import BlockButton from"@/components/BlockButton";
import MessageUserButton from"@/components/MessageUserButton";
import RatingForm from"@/components/RatingForm";
import { isBlocked as checkIsBlocked } from"@/app/actions/blocks";
import TrophyCase from"@/components/TrophyCase";
import ProfileLoadMore from"@/components/ProfileLoadMore";
import { Button } from "@/components/ui/button";
import AnonProfile from"@/components/profile/AnonProfile";


function formatDate(dateStr: string): string {
 return new Date(dateStr).toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 year:"numeric",
 });
}

/** Green stamp for wins/qualifications, red stamp for everything else. */
function isWinningPlacing(placing: string): boolean {
 return /(^1st|champ|grand|nan|top ten)/i.test(placing.trim());
}

export async function generateMetadata({ params }: { params: Promise<{ alias_name: string }> }) {
 const { alias_name } = await params;
 const decoded = decodeURIComponent(alias_name);
 return {
 title: `@${decoded}'s Stable — Model Horse Hub`,
 description: `Browse the public collection of @${decoded} on Model Horse Hub.`,
 };
}

export default async function ProfilePage({ params }: { params: Promise<{ alias_name: string }> }) {
 const { alias_name } = await params;
 const aliasDecoded = decodeURIComponent(alias_name);
 const supabase = await createClient();

 // Auth check — needed for RLS
 const {
 data: { user },
 } = await supabase.auth.getUser();

 // Logged-out visitors get a read-only public profile (service-role reads,
 // scoped to public data); the full interactive profile below is unchanged
 // for logged-in members.
 if (!user) {
 return <AnonProfile alias={aliasDecoded} />;
 }

 // Look up the user by alias_name
 const { data: profileUser } = await supabase
 .from("users")
 .select("id, alias_name, created_at, bio, avatar_url, show_badges")
 .eq("alias_name", aliasDecoded)
 .single<{
 id: string;
 alias_name: string;
 created_at: string;
 bio: string | null;
 avatar_url: string | null;
 show_badges: boolean | null;
 }>();

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
 .select("id", { count:"exact", head: true })
 .or(`buyer_id.eq.${profileUser.id},seller_id.eq.${profileUser.id}`)
 .eq("transaction_status","completed");

 // Check for unreviewed transactions between viewer and profile owner
 let unreviewedTxn: { id: string } | null = null;
 if (!isOwnProfile) {
 // Find a completed transaction between these two users where viewer hasn't reviewed
 const { data: txns } = await supabase
 .from("transactions")
 .select("id")
 .eq("status","completed")
 .or(
 `and(party_a_id.eq.${user.id},party_b_id.eq.${profileUser.id}),and(party_a_id.eq.${profileUser.id},party_b_id.eq.${user.id})`,
 )
 .order("completed_at", { ascending: false })
 .limit(10);

 if (txns && txns.length > 0) {
  const txnIds = txns.map((t) => t.id);
 const { data: existingReviews } = await supabase
 .from("reviews")
 .select("transaction_id")
 .eq("reviewer_id", user.id)
 .in("transaction_id", txnIds);

  const reviewedIds = new Set(
  (existingReviews ?? []).map((r) => r.transaction_id),
  );
  const unreviewed = txns.find((t) => !reviewedIds.has(t.id));
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
  const studioSlug = studioProfile?.studio_slug || null;
  const studioName = studioProfile?.studio_name || null;

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

  const userBadges = (rawBadges ?? []).map((b) => {
  const badge = b.badges as { id: string; name: string; description: string; icon: string; category: string; tier: number };
  return {
  id: badge.id,
  name: badge.name,
  description: badge.description,
  icon: badge.icon,
  category: badge.category,
  tier: badge.tier,
  earnedAt: b.earned_at ?? "",
  };
  });

 // ================================================================
 // PROFILE QUERY: Only public horses for this user
 // 🔒 financial_vault is NEVER queried here.
 // ================================================================
 const PROFILE_PAGE_SIZE = 24;

 const { data: rawHorses, count: publicHorseCount } = await supabase
 .from("user_horses")
 .select(
 `
 id, custom_name, finish_type, condition_grade, created_at, trade_status, listing_price, marketplace_notes,
 user_collections(name),
 catalog_items:catalog_id(title, maker, item_type),
 horse_images(image_url, angle_profile)
 `, { count: "exact" },
 )
 .eq("owner_id", profileUser.id)
 .eq("visibility","public")
 .order("created_at", { ascending: false })
 .range(0, PROFILE_PAGE_SIZE - 1);

  const horses = rawHorses ?? [];

 // Total horse count (all non-deleted, regardless of visibility)
 // Must bypass RLS — the regular client can only see own + public horses
 const adminClient = getAdminClient();
 const { count: totalHorseCount } = await adminClient
 .from("user_horses")
 .select("id", { count: "exact", head: true })
 .eq("owner_id", profileUser.id)
 .is("deleted_at", null);

 // ================================================================
 // STRAP STATS + SHOW LEDGER — read-only aggregates over EXISTING
 // tables; every query is scoped to public horses so the showcase
 // never leaks private stable data. 🔒 No financial/vault reads.
 // ================================================================

 // NAN cards: show_records flagged is_nan_qualifying on public horses
 const { count: nanCardCount } = await supabase
 .from("show_records")
 .select("id, user_horses!inner(visibility)", { count:"exact", head: true })
 .eq("user_id", profileUser.id)
 .eq("is_nan_qualifying", true)
 .eq("user_horses.visibility","public");

 // Shows hosted: events created by this user that are shows
 const { count: showsHostedCount } = await supabase
 .from("events")
 .select("id", { count:"exact", head: true })
 .eq("created_by", profileUser.id)
 .in("event_type", ["live_show","photo_show"]);

 // Show records on public horses — one dataset drives both the
 // "Stars of the Stable" auto-pick and the recent show ledger.
 // Capped at 400 recent records; plenty for a count-based pick.
 const { data: rawRecords } = await supabase
 .from("show_records")
 .select(
 "id, horse_id, show_name, class_name, division, placing, show_date, is_nan_qualifying, nan_card_type, created_at, user_horses!inner(custom_name, visibility)",
 )
 .eq("user_id", profileUser.id)
 .eq("user_horses.visibility","public")
 .order("show_date", { ascending: false, nullsFirst: false })
 .limit(400);

  const showRecords = (rawRecords ?? []).map((r) => ({
  id: r.id,
  horseId: r.horse_id,
  horseName: (r.user_horses as unknown as { custom_name: string } | null)?.custom_name ?? "—",
  showName: r.show_name,
  className: r.class_name || r.division || null,
  placing: r.placing,
  showDate: r.show_date,
  isNanQualifying: r.is_nan_qualifying ?? false,
  nanCardType: r.nan_card_type,
  }));

 // ================================================================
 // STARS OF THE STABLE — auto-pick: the 3 public horses with the
 // most show records, falling back to the most recently added
 // public horses. An owner-curated "feature these 3" picker is
 // deferred to the production build (needs a storage column).
 // ================================================================
 const recordCountByHorse = new Map<string, number>();
 for (const rec of showRecords) {
 recordCountByHorse.set(rec.horseId, (recordCountByHorse.get(rec.horseId) ?? 0) + 1);
 }
 const starIds: string[] = [...recordCountByHorse.entries()]
 .sort((a, b) => b[1] - a[1])
 .slice(0, 3)
 .map(([id]) => id);
 // Fallback fill: most recently added public horses
 for (const horse of horses) {
 if (starIds.length >= 3) break;
 if (!starIds.includes(horse.id)) starIds.push(horse.id);
 }

 // Star horses outside the first page need their own fetch
 const missingStarIds = starIds.filter((id) => !horses.some((h) => h.id === id));
 let extraStarHorses: typeof horses = [];
 if (missingStarIds.length > 0) {
 const { data: extra } = await supabase
 .from("user_horses")
 .select(
 `
 id, custom_name, finish_type, condition_grade, created_at, trade_status, listing_price, marketplace_notes,
 user_collections(name),
 catalog_items:catalog_id(title, maker, item_type),
 horse_images(image_url, angle_profile)
 `,
 )
 .eq("owner_id", profileUser.id)
 .eq("visibility","public")
 .in("id", missingStarIds);
  extraStarHorses = (extra ?? []) as typeof horses;
 }

 // Generate signed URLs for thumbnails (stable grid + star polaroids)
 const thumbnailUrls: string[] = [];
 [...horses, ...extraStarHorses].forEach((horse) => {
 const thumb = horse.horse_images?.find((img) => img.angle_profile ==="Primary_Thumbnail");
 const first = horse.horse_images?.[0];
 const url = thumb?.image_url || first?.image_url;
 if (url) thumbnailUrls.push(url);
 });

 const signedUrlMap = getPublicImageUrls(thumbnailUrls);

 // Build display data
 const buildCard = (horse: (typeof horses)[number]) => {
 const thumb = horse.horse_images?.find((img) => img.angle_profile ==="Primary_Thumbnail");
 const firstImage = horse.horse_images?.[0];
 const imageUrl = thumb?.image_url || firstImage?.image_url;
 const signedUrl = imageUrl ? signedUrlMap.get(imageUrl) : undefined;

 const refName = horse.catalog_items
 ? `${horse.catalog_items.maker} ${horse.catalog_items.title}`
 :"Unlisted Mold";

 return {
 id: horse.id,
 customName: horse.custom_name,
  finishType: horse.finish_type ?? "",
  conditionGrade: horse.condition_grade ?? "",
 createdAt: horse.created_at,
 refName,
 thumbnailUrl: signedUrl || null,
 collectionName: horse.user_collections?.name || null,
 tradeStatus: horse.trade_status ||"Not for Sale",
 listingPrice: horse.listing_price ?? null,
 marketplaceNotes: horse.marketplace_notes || null,
 };
 };

 const profileCards = horses.map(buildCard);
 const extraStarCards = extraStarHorses.map(buildCard);

 // Star polaroids: card + a star line from the horse's best record
 const starCards = starIds
 .map((id) => profileCards.find((c) => c.id === id) ?? extraStarCards.find((c) => c.id === id))
 .filter((c): c is NonNullable<typeof c> => Boolean(c))
 .map((card) => {
 const horseRecords = showRecords.filter((r) => r.horseId === card.id);
 const nanRec = horseRecords.find((r) => r.isNanQualifying);
 const placedRec = horseRecords.find((r) => r.placing);
 let starLine: string | null = null;
 if (nanRec) {
 starLine = `★ NAN Qualified${nanRec.nanCardType ? ` — ${nanRec.nanCardType} card` :""}`;
 } else if (placedRec) {
 starLine = `★ ${placedRec.placing} — ${placedRec.showName}`;
 } else if (horseRecords.length > 0) {
 starLine = `★ ${horseRecords.length} show record${horseRecords.length !== 1 ?"s" :""}`;
 }
 return { ...card, starLine };
 });

 const recentRecords = showRecords.slice(0, 8);

 const memberSince = new Date(profileUser.created_at).toLocaleDateString("en-US", {
 month:"long",
 year:"numeric",
 });

 const forSaleCount = profileCards.filter(
 (h) => h.tradeStatus ==="For Sale" || h.tradeStatus ==="Open to Offers",
 ).length;

 const hasMoreHorses = (publicHorseCount ?? 0) > PROFILE_PAGE_SIZE;

 const strapStats: { num: string; label: string }[] = [
 { num: String(totalHorseCount ?? 0), label:"Horses" },
 { num: String(publicHorseCount ?? 0), label:"Public" },
 ];
 if ((nanCardCount ?? 0) > 0) {
 strapStats.push({ num: String(nanCardCount), label:"NAN Cards" });
 }
 strapStats.push({
 num: String(followStats.followerCount),
 label: followStats.followerCount === 1 ?"Follower" :"Followers",
 });
 if ((showsHostedCount ?? 0) > 0) {
 strapStats.push({ num: String(showsHostedCount), label:"Shows Hosted" });
 }

 const renderPolaroid = (horse: (typeof profileCards)[number]) => (
 <Link
 key={horse.id}
 href={`/community/${horse.id}`}
 className="polaroid w-[220px]"
 id={`profile-card-${horse.id}`}
 >
 <div className="polaroid-photo">
 {horse.thumbnailUrl ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img src={horse.thumbnailUrl} alt={horse.customName} loading="lazy" />
 ) : (
 <span>No Photo</span>
 )}
 </div>
 <div className="polaroid-name">{horse.customName}</div>
 <div className="polaroid-breed">
 {horse.refName}
 {horse.finishType ? ` · ${horse.finishType}` :""}
 </div>
 <div className="mt-1 flex items-center justify-between px-1 text-[0.68rem] text-muted-foreground">
 <span>{horse.conditionGrade}</span>
 <span>{formatDate(horse.createdAt)}</span>
 </div>
 {horse.collectionName && (
 <div className="px-1 text-center text-[0.68rem] text-secondary-foreground">
 📁 {horse.collectionName}
 </div>
 )}
 {horse.tradeStatus ==="For Sale" && (
 <div className="mt-1 text-center">
 <span className="stamp stamp-red">
 For Sale{horse.listingPrice ? ` $${horse.listingPrice.toLocaleString("en-US")}` :""}
 </span>
 </div>
 )}
 {horse.tradeStatus ==="Open to Offers" && (
 <div className="mt-1 text-center">
 <span className="stamp">
 Open to Offers{horse.listingPrice ? ` ~$${horse.listingPrice.toLocaleString("en-US")}` :""}
 </span>
 </div>
 )}
 {(horse.tradeStatus ==="For Sale" || horse.tradeStatus ==="Open to Offers") &&
 horse.marketplaceNotes && (
 <div className="mt-1 truncate px-1 text-center text-[0.65rem] text-muted-foreground" title={horse.marketplaceNotes}>
 📝{""}
 {horse.marketplaceNotes.length > 50
 ? horse.marketplaceNotes.slice(0, 50) +"…"
 : horse.marketplaceNotes}
 </div>
 )}
 {!isOwnProfile &&
 (horse.tradeStatus ==="For Sale" || horse.tradeStatus ==="Open to Offers") && (
 <div className="mt-2 px-1">
 <MessageSellerButton
 sellerId={profileUser.id}
 horseId={horse.id}
 horseName={horse.customName}
 tradeStatus={horse.tradeStatus}
 askingPrice={horse.listingPrice}
 />
 </div>
 )}
 </Link>
 );

 return (
 <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-10 lg:px-8">
 {/* ── LEATHER MASTHEAD — the stable's nameplate ── */}
 <header className="leather-panel stitched animate-fade-in-up relative rounded-[14px] px-6 pt-8 pb-9 text-center">
 <div className="brass-medallion mx-auto mb-3">
 {profileUser.avatar_url ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={profileUser.avatar_url}
 alt={profileUser.alias_name}
 className="h-full w-full object-cover"
 />
 ) : (
 <span aria-hidden="true">{profileUser.alias_name.charAt(0).toUpperCase()}</span>
 )}
 </div>
 <h1 className="text-engraved-light mb-1 font-serif text-[clamp(1.5rem,4vw,2.3rem)] font-bold tracking-[0.13em] uppercase text-balance">
 {profileUser.alias_name}
 {isOwnProfile && (
 <span className="bg-forest ml-3 inline-flex align-middle rounded-sm px-2 py-[2px] text-xs font-bold tracking-wider text-white uppercase">
 You
 </span>
 )}
 </h1>
 <div className="font-serif text-[0.78rem] tracking-[0.2em] uppercase text-(--leather-text-soft)">
 @{profileUser.alias_name} · Member since {memberSince}
 </div>
 {profileUser.bio && (
 <p className="mx-auto mt-3 mb-0 max-w-[52ch] text-[0.92rem] italic text-(--leather-text)">
 {profileUser.bio}
 </p>
 )}
 <div className="masthead-cta mt-5 flex flex-wrap items-center justify-center gap-3">
 <FollowButton
 targetUserId={profileUser.id}
 initialIsFollowing={followStats.isFollowing}
 initialFollowerCount={followStats.followerCount}
 isOwnProfile={isOwnProfile}
 />
 {!isOwnProfile && (
 <span className="msg-slot">
 <MessageUserButton targetUserId={profileUser.id} targetAlias={profileUser.alias_name} />
 </span>
 )}
 <a href="#stable" className="btn-ghostleather">
 Browse Stable →
 </a>
 </div>
 </header>

 {/* ── GREEN STRAP STATS ── */}
 <div className="stats-strap relative -mt-4 mx-6 sm:mx-10" role="group" aria-label="Stable statistics">
 {strapStats.map((stat) => (
 <div key={stat.label}>
 <div className="stat-num">{stat.num}</div>
 <div className="stat-label">{stat.label}</div>
 </div>
 ))}
 </div>

 {/* ── Quiet meta row: share / studio / reviews / moderation ── */}
 <div className="animate-fade-in-up mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
 {isOwnProfile && (
 <span className="text-sm text-muted-foreground">
 Your public stable — this is how other collectors see your models.
 </span>
 )}
 <ShareButton
 title={`@${profileUser.alias_name}'s Stable — Model Horse Hub`}
 text={`Check out @${profileUser.alias_name}'s model horse collection on Model Horse Hub!`}
 variant="icon"
 />
 {ratingSummary.count > 0 && (
 <RatingBadge average={ratingSummary.average} count={ratingSummary.count} />
 )}
 {(completedTxCount ?? 0) > 0 && (
 <span className="text-sm text-muted-foreground">
 ✅ {completedTxCount} transaction{completedTxCount !== 1 ?"s" :""} completed
 </span>
 )}
 {forSaleCount > 0 && (
 <span className="text-sm text-muted-foreground">
 💲 {forSaleCount} for sale/trade
 </span>
 )}
 {followStats.followingCount > 0 && (
 <span className="text-sm text-muted-foreground">
 {followStats.followingCount} following
 </span>
 )}
 {studioSlug && (
 <Link
 href={`/studio/${studioSlug}`}
 className="inline-flex items-center gap-1.5 rounded-md border border-input bg-transparent px-4 py-1.5 text-sm font-semibold text-secondary-foreground no-underline transition-all"
 >
 🎨 {isOwnProfile ?"My Studio" : `Visit ${studioName ||"Studio"}`}
 </Link>
 )}
 {isOwnProfile && <EditBioButton currentBio={profileUser.bio} />}
 {!isOwnProfile && (
 <BlockButton
 targetId={profileUser.id}
 targetAlias={profileUser.alias_name}
 initialBlocked={blocked}
 />
 )}
 </div>

 {/* Public Collections */}
 {publicCollections && publicCollections.length > 0 && (
 <div className="animate-fade-in-up mt-6">
 <div className="flex flex-wrap items-center justify-center gap-2">
  {publicCollections.map((col) => (
 <Link
 key={col.id}
 href={`/stable/collection/${col.id}`}
 className="ledger-tab !mb-0 no-underline transition-all hover:translate-y-[-1px]"
 >
 📁 {col.name}
 </Link>
 ))}
 </div>
 </div>
 )}

 {/* Unreviewed Transaction Prompt */}
 {unreviewedTxn && (
 <div className="animate-fade-in-up mt-6">
 <RatingForm
 transactionId={unreviewedTxn.id}
 targetId={profileUser.id}
 targetAlias={profileUser.alias_name}
 existingRating={null}
 />
 </div>
 )}

 {/* ── STARS OF THE STABLE — wood shelf, three tilted polaroids.
      Auto-picked (most show records → most recent); the
      owner-curated picker is deferred to the production build. ── */}
 {starCards.length > 0 && (
 <section className="animate-fade-in-up mt-10" id="stars">
 <div className="brass-heading mb-3">
 <span className="brass-heading-bar" aria-hidden="true" />
 <h2 className="font-serif text-base font-bold text-foreground">Stars of the Stable</h2>
 <span className="ml-auto text-xs italic text-muted-foreground">
 auto-picked from show records
 </span>
 </div>
 <div className="shelfwrap">
 <div className="shelfrow">
 {starCards.map((star) => (
 <Link
 key={star.id}
 href={`/community/${star.id}`}
 className="polaroid"
 id={`star-card-${star.id}`}
 >
 <div className="polaroid-photo">
 {star.thumbnailUrl ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img src={star.thumbnailUrl} alt={star.customName} loading="lazy" />
 ) : (
 <span>No Photo</span>
 )}
 </div>
 <div className="polaroid-name">{star.customName}</div>
 <div className="polaroid-breed">
 {star.refName}
 {star.finishType ? ` · ${star.finishType}` :""}
 </div>
 {star.starLine && <div className="polaroid-star">{star.starLine}</div>}
 </Link>
 ))}
 </div>
 </div>
 </section>
 )}

 {/* Trophy Case — only if user hasn't hidden badges (owner always sees their own) */}
 {userBadges.length > 0 && (isOwnProfile || (profileUser.show_badges ?? true)) && (
 <section className="animate-fade-in-up mt-10" id="trophies">
 <div className="brass-heading mb-3">
 <span className="brass-heading-bar" aria-hidden="true" />
 <h2 className="font-serif text-base font-bold text-foreground">🏆 Trophy Case</h2>
 </div>
 <TrophyCase badges={userBadges} />
 </section>
 )}

 {/* Breadcrumb */}
 <nav
 className="text-muted-foreground animate-fade-in-up mt-8 flex items-center gap-2 text-sm"
 aria-label="Breadcrumb"
 >
 <Link href="/community">Show Ring</Link>
 <span className="separator" aria-hidden="true">
 /
 </span>
 <span>@{profileUser.alias_name}</span>
 </nav>

 {/* ── THE STABLE — full public herd on a scrollable wood shelf ── */}
 <section className="animate-fade-in-up mt-4 scroll-mt-24" id="stable">
 <div className="brass-heading mb-3">
 <span className="brass-heading-bar" aria-hidden="true" />
 <h2 className="font-serif text-base font-bold text-foreground">The Stable</h2>
 <span className="ml-auto text-xs italic text-muted-foreground">
 {publicHorseCount ?? 0} public model{(publicHorseCount ?? 0) !== 1 ?"s" :""} — scroll the shelf
 </span>
 </div>
 {profileCards.length === 0 ? (
 <div className="ledger-paper px-8 py-12 text-center">
 <div className="mb-4 text-5xl">🔒</div>
 <h3 className="mb-2 text-lg font-bold text-foreground">
 {isOwnProfile
 ?"You haven't made any models public yet"
 : `@${profileUser.alias_name} hasn't made any models public yet`}
 </h3>
 <p className="text-secondary-foreground">
 {isOwnProfile
 ? 'Toggle"Show in Public Community Feed" on any of your models to showcase them here.'
 :"Check back later — they may share some soon!"}
 </p>
 {isOwnProfile && (
 <Button asChild className="mt-4"><Link
 href="/dashboard"
 >
 🏠 Go to My Stable
 </Link></Button>
 )}
 </div>
 ) : (
 <div className="shelfwrap">
 <div className="shelf-strip" tabIndex={0} role="region" aria-label="Public horses shelf">
 {profileCards.map(renderPolaroid)}
 </div>
 {hasMoreHorses && (
 <ProfileLoadMore
 userId={profileUser.id}
 initialOffset={PROFILE_PAGE_SIZE}
 totalCount={publicHorseCount ?? 0}
 />
 )}
 </div>
 )}
 </section>

 {/* ── RECENT SHOW RECORD — the green-ruled ledger ── */}
 {recentRecords.length > 0 && (
 <section className="animate-fade-in-up mt-10" id="show-ledger">
 <div className="brass-heading mb-3">
 <span className="brass-heading-bar" aria-hidden="true" />
 <h2 className="font-serif text-base font-bold text-foreground">Recent Show Record</h2>
 </div>
 <div className="ledger-card">
 <span className="ledger-tab">Show Ledger — @{profileUser.alias_name}</span>
 <div className="overflow-x-auto">
 <table className="w-full min-w-[480px] border-collapse text-sm">
 <thead>
 <tr>
 <th className="px-2.5 py-1.5">Horse</th>
 <th className="px-2.5 py-1.5">Class</th>
 <th className="px-2.5 py-1.5">Show</th>
 <th className="px-2.5 py-1.5">Date</th>
 <th className="px-2.5 py-1.5">Result</th>
 </tr>
 </thead>
 <tbody>
 {recentRecords.map((rec) => (
 <tr key={rec.id}>
 <td className="px-2.5 py-2 font-bold text-foreground">
 <Link href={`/community/${rec.horseId}`} className="text-foreground no-underline hover:underline">
 {rec.horseName}
 </Link>
 </td>
 <td className="px-2.5 py-2 text-secondary-foreground">{rec.className ??"—"}</td>
 <td className="px-2.5 py-2 text-secondary-foreground">{rec.showName}</td>
 <td className="px-2.5 py-2 text-secondary-foreground">
 {rec.showDate ? formatDate(rec.showDate) :"—"}
 </td>
 <td className="px-2.5 py-2">
 {rec.placing ? (
 <span className={isWinningPlacing(rec.placing) ?"stamp" :"stamp stamp-red"}>
 {rec.placing}
 </span>
 ) : rec.isNanQualifying ? (
 <span className="stamp">NAN</span>
 ) : (
 <span className="text-muted-foreground">—</span>
 )}
 {rec.placing && rec.isNanQualifying && (
 <span className="stamp ml-2">NAN</span>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </section>
 )}

 {/* Reviews Section */}
 {ratingSummary.count > 0 && (
 <section className="ledger-paper animate-fade-in-up mt-10" id="reviews">
 <div className="mb-6 flex items-center gap-2">
 <h2 className="m-0 text-lg">⭐ Reviews ({ratingSummary.count})</h2>
 </div>
 {ratingSummary.ratings.map((r) => (
 <div key={r.id} className="border-input border-b py-4 last:border-b-0">
 <div className="mb-1 flex items-center justify-between max-sm:flex-col max-sm:items-start max-sm:gap-1">
 <span className="text-sm text-secondary-foreground">
 <Link
 href={`/profile/${encodeURIComponent(r.reviewerAlias)}`}
 className="no-underline hover:text-forest hover:underline"
 >
 @{r.reviewerAlias}
 </Link>{" "}
 — {"★".repeat(r.stars)}
 {"☆".repeat(5 - r.stars)}
 </span>
 <span className="text-xs text-muted-foreground">
 {new Date(r.createdAt).toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 year:"numeric",
 })}
 </span>
 </div>
 {r.reviewText && (
 <p className="mt-1 text-sm italic text-secondary-foreground">
 &ldquo;{r.reviewText}&rdquo;
 </p>
 )}
 </div>
 ))}
 </section>
 )}
 </div>
 );
}
