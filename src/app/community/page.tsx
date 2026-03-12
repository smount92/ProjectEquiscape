import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSignedImageUrls } from "@/lib/utils/storage";
import ShowRingGrid from "@/components/ShowRingGrid";
import FeaturedHorseCard from "@/components/FeaturedHorseCard";

// Types
interface CommunityHorse {
  id: string;
  owner_id: string;
  custom_name: string;
  finish_type: string;
  condition_grade: string;
  asset_category: string;
  created_at: string;
  sculptor: string | null;
  trade_status: string;
  listing_price: number | null;
  marketplace_notes: string | null;
  catalog_id: string | null;
  users: {
    alias_name: string;
  } | null;
  catalog_items: {
    title: string;
    maker: string;
    scale: string | null;
    item_type: string;
  } | null;
  horse_images: {
    image_url: string;
    angle_profile: string;
  }[];
}

export const metadata = {
  title: "The Show Ring — Model Horse Hub",
  description:
    "Browse the community showcase of model horses cataloged by collectors around the world.",
};

export const dynamic = "force-dynamic";

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
    `
    )
    .eq("visibility", "public");

  // Apply server-side filters
  if (params.q) {
    query = query.or(`custom_name.ilike.%${params.q}%,sculptor.ilike.%${params.q}%`);
  }
  if (params.finishType && params.finishType !== "all") {
    query = query.eq("finish_type", params.finishType);
  }
  if (params.tradeStatus && params.tradeStatus !== "all") {
    query = query.eq("trade_status", params.tradeStatus);
  }

  // Sorting
  if (params.sortBy === "oldest") {
    query = query.order("created_at", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data: rawHorses } = await query.limit(60);

  // Filter out blocked users
  const { data: myBlocks } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", user.id);
  const blockedOwnerIds = new Set((myBlocks ?? []).map((b: { blocked_id: string }) => b.blocked_id));

  const horses = ((rawHorses as unknown as CommunityHorse[]) ?? [])
    .filter((h) => !blockedOwnerIds.has(h.owner_id));

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

  // ================================================================
  // SOCIAL: Fetch favorite counts + user's own favorites
  // ================================================================
  const horseIds = horses.map((h: CommunityHorse) => h.id);

  // Get all favorites for displayed horses (to count)
  const { data: allFavs } = await supabase
    .from("horse_favorites")
    .select("horse_id")
    .in("horse_id", horseIds);

  const favCountMap = new Map<string, number>();
  (allFavs ?? []).forEach((f: { horse_id: string }) => {
    favCountMap.set(f.horse_id, (favCountMap.get(f.horse_id) || 0) + 1);
  });

  // Get current user's favorites
  const { data: userFavs } = await supabase
    .from("horse_favorites")
    .select("horse_id")
    .eq("user_id", user.id)
    .in("horse_id", horseIds);

  const userFavSet = new Set(
    (userFavs ?? []).map((f: { horse_id: string }) => f.horse_id)
  );

  // Hoofprint counts (for badge)
  const { data: hoofprintData } = await supabase
    .from("v_horse_hoofprint")
    .select("horse_id")
    .in("horse_id", horseIds)
    .eq("is_public", true);  // v_horse_hoofprint uses is_public from source tables

  const hoofprintCountMap = new Map<string, number>();
  (hoofprintData ?? []).forEach((e: { horse_id: string }) => {
    hoofprintCountMap.set(e.horse_id, (hoofprintCountMap.get(e.horse_id) || 0) + 1);
  });

  // Build display data
  const communityCards = horses.map((horse) => {
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

    const ownerAlias = horse.users?.alias_name ?? "Unknown";

    return {
      id: horse.id,
      ownerId: horse.owner_id,
      customName: horse.custom_name,
      finishType: horse.finish_type,
      conditionGrade: horse.condition_grade,
      createdAt: horse.created_at,
      refName,
      releaseLine,
      ownerAlias,
      thumbnailUrl: signedUrl || null,
      sculptor: horse.sculptor || null,
      tradeStatus: horse.trade_status || "Not for Sale",
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
      assetCategory: horse.asset_category || "model",
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
      .select(`
        id, custom_name, finish_type, owner_id,
        users!inner(alias_name),
        horse_images(image_url, angle_profile)
      `)
      .eq("id", feat.horse_id)
      .single();

    if (fHorse) {
      const h = fHorse as unknown as {
        id: string;
        custom_name: string;
        finish_type: string;
        users: { alias_name: string };
        horse_images: { image_url: string; angle_profile: string }[];
      };
      const thumb = h.horse_images?.find((i) => i.angle_profile === "Primary_Thumbnail");
      const imgUrl = thumb?.image_url || h.horse_images?.[0]?.image_url;
      let signedFeatUrl: string | null = null;
      if (imgUrl) {
        const fMap = await getSignedImageUrls(supabase, [imgUrl]);
        signedFeatUrl = fMap.get(imgUrl) || null;
      }
      featuredHorse = {
        horseId: h.id,
        horseName: h.custom_name,
        title: feat.title,
        description: feat.description,
        ownerAlias: h.users.alias_name,
        thumbnailUrl: signedFeatUrl,
        finishType: h.finish_type,
      };
    }
  }

  return (
    <div className="page-container page-container-wide">
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
          <Link href="/community/help-id" className="btn btn-ghost" id="help-id-link" style={{ marginLeft: "var(--space-md)" }}>
            🔍 Help Me ID
          </Link>
        </div>
      </div>

      {/* Featured Horse */}
      {featuredHorse && (
        <FeaturedHorseCard {...featuredHorse} />
      )}

      {/* Grid with Search */}
      <ShowRingGrid communityCards={communityCards} />
    </div>
  );
}
