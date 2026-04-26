import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import WishlistRemoveButton from"@/components/WishlistRemoveButton";
import MatchmakerMatches from"@/components/MatchmakerMatches";
import WishlistSearch from"@/components/WishlistSearch";
import { getPublicImageUrls } from"@/lib/utils/storage";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";

export const metadata = {
 title:"My Wishlist — Model Horse Hub",
 description:"Models you're hunting for — your personal wishlist with Matchmaker.",
};


interface MarketplaceMatch {
 id: string;
 custom_name: string;
 trade_status: string;
 listing_price: number | null;
 marketplace_notes: string | null;
 thumbnailUrl: string | null;
 ownerAlias: string;
 ownerId: string;
}

export default async function WishlistPage() {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();

 if (!user) {
 redirect("/login");
 }

 // 1. Fetch wishlist items with catalog_items join
 const { data: rawItems } = await supabase
 .from("user_wishlists")
 .select(
 `
 id, notes, created_at, catalog_id,
 catalog_items:catalog_id(title, maker, scale, item_type)
 `,
 )
 .eq("user_id", user.id)
 .order("created_at", { ascending: false });

 const items = rawItems ?? [];

 // 2. THE MATCHMAKER ENGINE
 // For each wishlist item, find public horses that match the catalog_id AND are for sale/trade
 const matchMap = new Map<string, MarketplaceMatch[]>();

 if (items.length > 0) {
 const catalogIds = [...new Set(items.map((i) => i.catalog_id).filter(Boolean))] as string[];

 if (catalogIds.length > 0) {
 const { data: rawMatches } = await supabase
 .from("user_horses")
 .select(
  `
  id, custom_name, trade_status, listing_price, marketplace_notes,
  catalog_id, owner_id,
  users!inner(alias_name),
  horse_images(image_url, angle_profile)
  `,
 )
 .eq("is_public", true)
 .neq("owner_id", user.id)
 .in("trade_status", ["For Sale","Open to Offers"])
 .in("catalog_id", catalogIds)
 .limit(200);

 const matches = rawMatches ?? [];

 // Collect thumbnail URLs for signed URL generation
 const thumbUrls: string[] = [];
 matches.forEach((m) => {
  const thumb = m.horse_images?.find((img) => img.angle_profile ==="Primary_Thumbnail");
  const first = m.horse_images?.[0];
  const url = thumb?.image_url || first?.image_url;
  if (url) thumbUrls.push(url);
 });

 const signedUrlMap = getPublicImageUrls(thumbUrls);

 // Group matches by wishlist item
 for (const item of items) {
  const itemMatches: MarketplaceMatch[] = [];

  for (const match of matches) {
  if (item.catalog_id && match.catalog_id === item.catalog_id) {
   const thumb = match.horse_images?.find((img) => img.angle_profile ==="Primary_Thumbnail");
   const firstImg = match.horse_images?.[0];
   const imgUrl = thumb?.image_url || firstImg?.image_url;

   itemMatches.push({
   id: match.id,
   custom_name: match.custom_name,
   trade_status: match.trade_status,
   listing_price: match.listing_price,
   marketplace_notes: match.marketplace_notes,
   thumbnailUrl: imgUrl ? signedUrlMap.get(imgUrl) || null : null,
   ownerAlias: match.users?.alias_name ??"Unknown",
   ownerId: match.owner_id,
   });
  }
  }

  if (itemMatches.length > 0) {
  matchMap.set(item.id, itemMatches);
  }
 }
 }
 }

 const totalMatches = [...matchMap.values()].reduce((sum, arr) => sum + arr.length, 0);

 return (
 <ExplorerLayout
  title={<>❤️ <span className="text-forest">My Wishlist</span></>}
  description={`Models you're hunting for — ${items.length} item${items.length !== 1 ?"s" :""}${totalMatches > 0 ? ` 🔥 ${totalMatches} marketplace match${totalMatches !== 1 ?"es" :""} found!` :""}`}
  headerActions={
  <Link
   href="/community"
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-stone-50orest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
   id="browse-showring"
  >
   🏆 Browse Show Ring
  </Link>
  }
 >
  {/* Search to Add */}
  <WishlistSearch />

  {/* Wishlist Grid */}
  {items.length === 0 ? (
  <div className="bg-card border-input animate-fade-in-up rounded-lg border px-8 py-12 text-center shadow-md transition-all">
   <div className="mb-4 text-5xl">❤️</div>
   <h2>Your Wishlist is Empty</h2>
   <p>Browse the Show Ring and tap the heart icon on models you love to start your hunt!</p>
   <Link
   href="/community"
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-stone-50orest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
   >
   🏆 Browse the Show Ring
   </Link>
  </div>
  ) : (
  <div className="animate-fade-in-up grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-6 max-[600px]:grid-cols-1">
   {items.map((item) => {
   const catalogItem = item.catalog_items;
   const title = catalogItem?.title ||"Custom Entry";
   const maker = catalogItem?.maker || null;
   const scale = catalogItem?.scale || null;
   const typeIcon =
    catalogItem?.item_type ==="artist_resin"
    ?"🎨"
    : catalogItem?.item_type ==="plastic_release"
    ?"📦"
    :"🏭";
   const matches = matchMap.get(item.id) ?? [];

   return (
    <div
    key={item.id}
    className="group/bg-card border-input hover:border-emerald-700 relative flex gap-4 rounded-lg border bg-muted/80 backdrop-blur-sm p-6 shadow-md transition-all duration-250 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(44,85,69,0.15)]"
    id={`wishlist-${item.id}`}
    >
    <div className="mt-[2px] shrink-0 text-[2rem] leading-none">🐴</div>
    <div className="min-w-0 flex-1">
     <div className="text-stone-900 mb-1 text-base font-semibold">
     {typeIcon} {title}
     </div>
     {maker && <div className="text-forest mb-1 text-sm">{maker}</div>}
     {scale && <div className="text-stone-500 mb-[2px] text-sm">📏 {scale}</div>}
     {item.notes && (
     <div className="text-stone-500 mt-1 text-sm italic">📝 {item.notes}</div>
     )}
     <div className="text-stone-500 mt-2 text-xs opacity-70">
     Added{" "}
     {new Date(item.created_at).toLocaleDateString("en-US", {
      month:"short",
      day:"numeric",
      year:"numeric",
     })}
     </div>

     {/* MATCHMAKER RESULTS */}
     {matches.length > 0 && (
     <MatchmakerMatches matchCount={matches.length} matches={matches} />
     )}
    </div>
    <WishlistRemoveButton wishlistId={item.id} />
    </div>
   );
   })}
  </div>
  )}
 </ExplorerLayout>
 );
}
