import { createClient } from"@/lib/supabase/server";
import { redirect, notFound } from"next/navigation";
import Link from"next/link";
import { getPublicImageUrls } from"@/lib/utils/storage";
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
import ExplorerLayout from"@/components/layouts/ExplorerLayout";


function getFinishBadgeClass(finish: string): string {
 switch (finish) {
 case"OF":
 return"of";
 case"Custom":
 return"custom";
 case"Artist Resin":
 return"resin";
 default:
 return"";
 }
}

function formatDate(dateStr: string): string {
 return new Date(dateStr).toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 year:"numeric",
 });
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

 if (!user) {
 redirect("/login");
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
 const { data: rawHorses } = await supabase
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
 .order("created_at", { ascending: false });

  const horses = rawHorses ?? [];

 // Generate signed URLs for thumbnails
 const thumbnailUrls: string[] = [];
 horses.forEach((horse) => {
 const thumb = horse.horse_images?.find((img) => img.angle_profile ==="Primary_Thumbnail");
 const first = horse.horse_images?.[0];
 const url = thumb?.image_url || first?.image_url;
 if (url) thumbnailUrls.push(url);
 });

 const signedUrlMap = getPublicImageUrls(thumbnailUrls);

 // Build display data
 const profileCards = horses.map((horse) => {
 const thumb = horse.horse_images?.find((img) => img.angle_profile ==="Primary_Thumbnail");
 const firstImage = horse.horse_images?.[0];
 const imageUrl = thumb?.image_url || firstImage?.image_url;
 const signedUrl = imageUrl ? signedUrlMap.get(imageUrl) : undefined;

 const refName = horse.catalog_items
 ? `${horse.catalog_items.maker} ${horse.catalog_items.title}`
 :"Unlisted Mold";

 const releaseLine = null; // Now unified in catalog_items

 return {
 id: horse.id,
 customName: horse.custom_name,
  finishType: horse.finish_type ?? "OF",
  conditionGrade: horse.condition_grade ?? "",
 createdAt: horse.created_at,
 refName,
 releaseLine,
 thumbnailUrl: signedUrl || null,
 collectionName: horse.user_collections?.name || null,
 tradeStatus: horse.trade_status ||"Not for Sale",
 listingPrice: horse.listing_price ?? null,
 marketplaceNotes: horse.marketplace_notes || null,
 };
 });

 const memberSince = new Date(profileUser.created_at).toLocaleDateString("en-US", {
 month:"long",
 year:"numeric",
 });

 const forSaleCount = profileCards.filter(
 (h) => h.tradeStatus ==="For Sale" || h.tradeStatus ==="Open to Offers",
 ).length;

 return (
 <ExplorerLayout
  title={<>@{profileUser.alias_name}{isOwnProfile && <span className="bg-forest ml-2 inline-flex align-middle rounded-sm px-2 py-[2px] text-xs font-bold tracking-wider text-white uppercase">You</span>}</>}
  description={isOwnProfile ?"Your public stable — this is how other collectors see your models." :`@${profileUser.alias_name}'s public collection`}
 >
 {/* Profile Header */}
 <div className="profile-hero animate-fade-in-up max-md:flex-col max-md:items-center max-md:text-center max-sm:flex-col max-sm:px-4 max-sm:py-8 max-sm:text-center">
 <div className="bg-emerald-50 border-emerald-200 text-forest flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border-[2px]">
 {profileUser.avatar_url ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={profileUser.avatar_url}
 alt={profileUser.alias_name}
 className="h-full w-full rounded-full object-cover"
 />
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
 <div className="text-forest mb-1 text-2xl font-bold tracking-tight">
 <h1>
 @{profileUser.alias_name}
 {isOwnProfile && (
 <span
 className="bg-forest ml-2 inline-flex align-middle rounded-sm px-2 py-[2px] text-xs font-bold tracking-wider text-white uppercase"
 >
 You
 </span>
 )}
 </h1>
 <p className="mb-2 text-sm leading-normal text-stone-500">
 {isOwnProfile
 ?"Your public stable — this is how other collectors see your models."
 : `@${profileUser.alias_name}'s public collection`}
 </p>
 {profileUser.bio && (
 <p className="mt-2 max-w-[480px] text-sm leading-relaxed text-stone-600">
 {profileUser.bio}
 </p>
 )}
 {isOwnProfile && <EditBioButton currentBio={profileUser.bio} />}
 {studioSlug && (
 <Link
 href={`/studio/${studioSlug}`}
 className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-transparent px-4 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 >
 🎨 {isOwnProfile ?"My Studio" : `Visit ${studioName ||"Studio"}`}
 </Link>
 )}
 <div className="flex flex-wrap gap-6">
 <span className="text-sm text-stone-500">
 🐴 {profileCards.length} public model{profileCards.length !== 1 ?"s" :""}
 </span>
 <span className="text-sm text-stone-500">
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
 <span className="text-sm text-[#22C55E] text-stone-500">
 ✅ {completedTxCount} transaction{completedTxCount !== 1 ?"s" :""} completed
 </span>
 )}
 {forSaleCount > 0 && (
 <span className="text-amber-500 text-sm text-stone-500">
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
 <div className="mt-1 flex items-center gap-2 text-sm text-stone-600">
 <span>
 {followStats.followerCount} follower{followStats.followerCount !== 1 ?"s" :""}
 </span>
 <span>·</span>
 <span>{followStats.followingCount} following</span>
 </div>
 )}
 {!isOwnProfile && (
 <div className="mt-2 flex flex-wrap items-center gap-2">
 <MessageUserButton targetUserId={profileUser.id} targetAlias={profileUser.alias_name} />
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
 <div className="animate-fade-in-up mb-6">
 <h3 className="mb-2 text-sm text-stone-600">📁 Public Collections</h3>
 <div className="flex flex-wrap gap-2">
  {publicCollections.map((col) => (
 <Link
 key={col.id}
 href={`/stable/collection/${col.id}`}
 className="text-forest inline-flex items-center gap-1 rounded-md border border-indigo-200/20 bg-indigo-100/10 px-3.5 py-1.5 text-sm no-underline transition-all hover:translate-y-[-1px]"
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
 <h3 className="mb-2 text-sm text-stone-600">🏆 Trophy Case</h3>
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
 className="text-stone-500 animate-fade-in-up mb-8 flex items-center gap-2 text-sm"
 aria-label="Breadcrumb"
 >
 <Link href="/community">Show Ring</Link>
 <span className="separator" aria-hidden="true">
 /
 </span>
 <span>@{profileUser.alias_name}</span>
 </nav>

 {/* Grid */}
 {profileCards.length === 0 ? (
 <div className="bg-white border-stone-200 animate-fade-in-up rounded-lg border px-8 py-12 text-center shadow-md transition-all">
 <div className="mb-4 text-5xl">🔒</div>
 <h2>
 {isOwnProfile
 ?"You haven't made any models public yet"
 : `@${profileUser.alias_name} hasn't made any models public yet`}
 </h2>
 <p>
 {isOwnProfile
 ? 'Toggle"Show in Public Community Feed" on any of your models to showcase them here.'
 :"Check back later — they may share some soon!"}
 </p>
 {isOwnProfile && (
 <Link
 href="/dashboard"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 >
 🏠 Go to My Stable
 </Link>
 )}
 </div>
 ) : (
 <div className="grid-cols-[repeat(auto-fill,minmax(300px,1fr))] animate-fade-in-up grid gap-6">
 {profileCards.map((horse) => (
 <Link
 key={horse.id}
 href={`/community/${horse.id}`}
 className="border-stone-200 text-stone-900 flex flex-col overflow-hidden rounded-lg border bg-stone-50 no-underline transition-all"
 id={`profile-card-${horse.id}`}
 >
 <div className="relative">
 {horse.thumbnailUrl ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img src={horse.thumbnailUrl} alt={horse.customName} loading="lazy" className="w-full object-cover" />
 ) : (
 <div className="flex flex-col items-center justify-center bg-stone-100 px-4 py-8">
 <span className="text-4xl">🐴</span>
 <span className="mt-1 text-sm text-stone-500">No photo</span>
 </div>
 )}
 <span className={`horse-card-badge ${getFinishBadgeClass(horse.finishType)}`}>
 {horse.finishType}
 </span>
 {horse.tradeStatus ==="For Sale" && (
 <span className="trade-badge border border-green-500/50 bg-green-500/85 text-white">
 💲{""}
 {horse.listingPrice
 ? `$${horse.listingPrice.toLocaleString("en-US")}`
 :"For Sale"}
 </span>
 )}
 {horse.tradeStatus ==="Open to Offers" && (
 <span className="trade-badge border border-blue-500/50 bg-blue-500/85 text-white">
 🤝{""}
 {horse.listingPrice
 ? `~$${horse.listingPrice.toLocaleString("en-US")}`
 :"Open to Offers"}
 </span>
 )}
 </div>
 <div className="p-4">
 <div className="text-sm font-semibold text-stone-900">
 {horse.customName}
 </div>
 <div className="mt-0.5 text-xs text-stone-600">
 {horse.refName}
 </div>
 {horse.releaseLine && (
 <div className="mt-0.5 text-xs text-stone-500">
 🎨 {horse.releaseLine}
 </div>
 )}
 <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
 <span>{horse.conditionGrade}</span>
 <span>{formatDate(horse.createdAt)}</span>
 </div>
 {horse.collectionName && (
 <div className="mt-2 text-xs text-stone-600">
 📁 {horse.collectionName}
 </div>
 )}
 {(horse.tradeStatus ==="For Sale" || horse.tradeStatus ==="Open to Offers") &&
 horse.marketplaceNotes && (
 <div className="mt-1 truncate text-xs text-stone-500" title={horse.marketplaceNotes}>
 📝{""}
 {horse.marketplaceNotes.length > 50
 ? horse.marketplaceNotes.slice(0, 50) +"…"
 : horse.marketplaceNotes}
 </div>
 )}
 {!isOwnProfile &&
 (horse.tradeStatus ==="For Sale" || horse.tradeStatus ==="Open to Offers") && (
 <div className="mt-2">
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
 <div
 className="bg-white border border-stone-200 animate-fade-in-up mt-8 rounded-lg border p-6 shadow-md"
 id="reviews"
 >
 <div className="mb-6 flex items-center gap-2">
 <h2 className="m-0 text-lg">⭐ Reviews ({ratingSummary.count})</h2>
 </div>
 {ratingSummary.ratings.map((r) => (
 <div key={r.id} className="border-stone-200 border-b py-4 last:border-b-0">
 <div className="mb-1 flex items-center justify-between max-sm:flex-col max-sm:items-start max-sm:gap-1">
 <span className="text-sm text-stone-600">
 @{r.reviewerAlias} — {"★".repeat(r.stars)}
 {"☆".repeat(5 - r.stars)}
 </span>
 <span className="text-xs text-stone-500">
 {new Date(r.createdAt).toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 year:"numeric",
 })}
 </span>
 </div>
 {r.reviewText && (
 <p className="mt-1 text-sm italic text-stone-600">
 &ldquo;{r.reviewText}&rdquo;
 </p>
 )}
 </div>
 ))}
 </div>
 )}
 </ExplorerLayout>
 );
}
