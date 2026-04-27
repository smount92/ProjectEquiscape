import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import { Suspense } from"react";
import { getPublicImageUrls } from"@/lib/utils/storage";
import ShowRingGrid from"@/components/ShowRingGrid";
import FeaturedHorseCard from"@/components/FeaturedHorseCard";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";


export const metadata = {
 title:"The Show Ring — Model Horse Hub",
 description:"Browse the community showcase of model horses cataloged by collectors around the world.",
};

/** Skeleton shown while ShowRingContent loads */
function ShowRingSkeleton() {
 return (
 <div className="space-y-6">
  {/* Search bar skeleton */}
  <div className="animate-pulse rounded-xl bg-muted p-4">
   <div className="h-10 rounded-lg bg-muted" />
  </div>
  {/* Grid skeleton — 12 card placeholders */}
  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
   {Array.from({ length: 12 }).map((_, i) => (
    <div key={i} className="animate-pulse rounded-lg border border-input bg-card shadow-sm">
     <div className="aspect-square rounded-t-lg bg-muted" />
     <div className="space-y-2 p-3">
      <div className="h-4 w-3/4 rounded bg-muted" />
      <div className="h-3 w-1/2 rounded bg-muted" />
      <div className="h-3 w-1/3 rounded bg-muted" />
     </div>
    </div>
   ))}
  </div>
 </div>
 );
}

/** Async server component that fetches all community data and renders the grid */
async function ShowRingContent({
 userId,
 searchParams,
}: {
 userId: string;
 searchParams: { q?: string; finishType?: string; tradeStatus?: string; sortBy?: string };
}) {
 const supabase = await createClient();

 // ================================================================
 // COMMUNITY QUERY: Public horses across all users (server-side filtered)
 // ================================================================
 let query = supabase
 .from("user_horses")
 .select(
 `
 id, owner_id, custom_name, finish_type, condition_grade, asset_category, created_at, sculptor, trade_status, listing_price, marketplace_notes, catalog_id,
 users!inner(alias_name),
 catalog_items:catalog_id(title, maker, scale, item_type),
 horse_images(image_url, angle_profile)
 `,
 { count: "exact" }
 )
 .eq("visibility","public");

 // Apply server-side filters
 if (searchParams.q) {
 query = query.or(`custom_name.ilike.%${searchParams.q}%,sculptor.ilike.%${searchParams.q}%`);
 }
 if (searchParams.finishType && searchParams.finishType !=="all") {
 query = query.eq("finish_type", searchParams.finishType as "OF" | "Custom" | "Artist Resin");
 }
 if (searchParams.tradeStatus && searchParams.tradeStatus !=="all") {
 query = query.eq("trade_status", searchParams.tradeStatus as any);
 }

 // Sorting
 if (searchParams.sortBy ==="oldest") {
 query = query.order("created_at", { ascending: true });
 } else {
 query = query.order("created_at", { ascending: false });
 }

 const PAGE_SIZE = 24;
 const { data: rawHorses, count: totalCount } = await query.range(0, PAGE_SIZE - 1);

 // Filter out blocked users
 const { data: myBlocks } = await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", userId);
 const blockedOwnerIds = new Set((myBlocks ?? []).map((b) => b.blocked_id));

 const horses = (rawHorses ?? []).filter((h) => !blockedOwnerIds.has(h.owner_id));

 // Collect all thumbnail image URLs and generate signed URLs
 const thumbnailUrls: string[] = [];
 horses.forEach((horse) => {
 const thumb = horse.horse_images?.find((img) => img.angle_profile ==="Primary_Thumbnail");
 const first = horse.horse_images?.[0];
 const url = thumb?.image_url || first?.image_url;
 if (url) thumbnailUrls.push(url);
 });

 const signedUrlMap = getPublicImageUrls(thumbnailUrls);

 // ================================================================
 // SOCIAL: Fetch favorite counts + user's own favorites
 // ================================================================
 const horseIds = horses.map((h) => h.id);

 // Get all favorites for displayed horses (to count)
 const { data: allFavs } = await supabase.from("horse_favorites").select("horse_id").in("horse_id", horseIds);

 const favCountMap = new Map<string, number>();
 (allFavs ?? []).forEach((f) => {
 favCountMap.set(f.horse_id, (favCountMap.get(f.horse_id) || 0) + 1);
 });

 // Get current user's favorites
 const { data: userFavs } = await supabase
 .from("horse_favorites")
 .select("horse_id")
 .eq("user_id", userId)
 .in("horse_id", horseIds);

 const userFavSet = new Set((userFavs ?? []).map((f) => f.horse_id));

 // Hoofprint counts (for badge)
 const { data: hoofprintData } = await supabase
 .from("v_horse_hoofprint")
 .select("horse_id")
 .in("horse_id", horseIds)
 .eq("is_public", true); // v_horse_hoofprint uses is_public from source tables

 const hoofprintCountMap = new Map<string, number>();
 (hoofprintData ?? []).forEach((e) => {
 if (e.horse_id) hoofprintCountMap.set(e.horse_id, (hoofprintCountMap.get(e.horse_id) || 0) + 1);
 });

 // Build display data
 const communityCards = horses.map((horse) => {
 const thumb = horse.horse_images?.find((img) => img.angle_profile ==="Primary_Thumbnail");
 const firstImage = horse.horse_images?.[0];
 const imageUrl = thumb?.image_url || firstImage?.image_url;
 const signedUrl = imageUrl ? signedUrlMap.get(imageUrl) : undefined;

 const refName = horse.catalog_items
 ? `${horse.catalog_items.maker} ${horse.catalog_items.title}`
 :"Unlisted Mold";

 const releaseLine = null; // Now unified in catalog_items

 const ownerAlias = horse.users?.alias_name ??"Unknown";

 return {
 id: horse.id,
 ownerId: horse.owner_id,
 customName: horse.custom_name,
 finishType: horse.finish_type ?? "OF",
 conditionGrade: horse.condition_grade ?? "",
 createdAt: horse.created_at,
 refName,
 releaseLine,
 ownerAlias,
 thumbnailUrl: signedUrl || null,
 sculptor: horse.sculptor || null,
 tradeStatus: horse.trade_status ||"Not for Sale",
 listingPrice: horse.listing_price ?? null,
 marketplaceNotes: horse.marketplace_notes || null,
 moldName: horse.catalog_items?.title || null,
 releaseName: horse.catalog_items?.title || null,
 refMoldId: horse.catalog_id || null,
 catalogId: horse.catalog_id || null,
 favoriteCount: favCountMap.get(horse.id) || 0,
 isFavorited: userFavSet.has(horse.id),
 scale: horse.catalog_items?.scale || null,
 hoofprintCount: hoofprintCountMap.get(horse.id) || 0,
 assetCategory: horse.asset_category ||"model",
 };
 });

 // ================================================================
 // FEATURED HORSE: Query most recent non-expired featured horse
 // ================================================================
 let featuredHorse: {
 horseId: string;
 horseName: string;
 title: string;
 description: string | null;
 ownerAlias: string;
 thumbnailUrl: string | null;
 finishType: string;
 } | null = null;

 const { data: rawFeatured } = await supabase
 .from("featured_horses")
 .select("id, horse_id, title, description, featured_at")
 .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
 .order("featured_at", { ascending: false })
 .limit(1)
 .maybeSingle();

 if (rawFeatured) {
 const feat = rawFeatured as { horse_id: string; title: string; description: string | null };
 const { data: fHorse } = await supabase
 .from("user_horses")
 .select(
 `
 id, custom_name, finish_type, owner_id,
 users!inner(alias_name),
 horse_images(image_url, angle_profile)
 `,
 )
 .eq("id", feat.horse_id)
 .single();

 if (fHorse) {
 const h = fHorse;
 const thumb = h.horse_images?.find((i) => i.angle_profile ==="Primary_Thumbnail");
 const imgUrl = thumb?.image_url || h.horse_images?.[0]?.image_url;
 let signedFeatUrl: string | null = null;
 if (imgUrl) {
 const fMap = getPublicImageUrls([imgUrl]);
 signedFeatUrl = fMap.get(imgUrl) || null;
 }
 featuredHorse = {
 horseId: h.id,
 horseName: h.custom_name,
 title: feat.title,
 description: feat.description,
 ownerAlias: h.users.alias_name,
 thumbnailUrl: signedFeatUrl,
 finishType: h.finish_type ?? "OF",
 };
 }
 }

 return (
 <>
  {/* Stats + Help ID link */}
  <div className="mt-6 flex items-center gap-6">
  <div className="flex items-baseline gap-2">
  <span className="text-2xl font-bold text-forest">{totalCount ?? communityCards.length}</span>
  <span className="text-sm font-medium text-ink-light">Models Showcased</span>
  </div>
  <Link
  href="/community/help-id"
  className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-stone-300 bg-card px-5 py-2 text-sm font-semibold text-foreground no-underline shadow-sm transition-all hover:border-stone-400 hover:bg-muted"
  id="help-id-link"
  >
  🔍 Help Me ID
  </Link>
  </div>

  {/* Featured Horse */}
  {featuredHorse && <FeaturedHorseCard {...featuredHorse} />}

  {/* Grid with Search */}
  <ShowRingGrid
   communityCards={communityCards}
   totalCount={totalCount ?? communityCards.length}
   initialHasMore={(totalCount ?? 0) > PAGE_SIZE}
   currentFilters={searchParams}
  />
 </>
 );
}

export default async function CommunityPage({
 searchParams,
}: {
 searchParams: Promise<{ q?: string; finishType?: string; tradeStatus?: string; sortBy?: string }>;
}) {
 const params = await searchParams;
 const supabase = await createClient();

 // Auth check — community requires login (RLS needs authenticated user)
 const {
 data: { user },
 } = await supabase.auth.getUser();

 if (!user) {
 redirect("/login");
 }

 return (
 <ExplorerLayout
  title={<>🏆 The <span className="text-forest">Show Ring</span></>}
  description="Browse the latest models shared by collectors from around the world. Every horse has a story."
 >
  <Suspense fallback={<ShowRingSkeleton />}>
  <ShowRingContent userId={user.id} searchParams={params} />
  </Suspense>
 </ExplorerLayout>
 );
}
