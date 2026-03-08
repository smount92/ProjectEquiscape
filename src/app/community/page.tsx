import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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
  created_at: string;
  sculptor: string | null;
  trade_status: string;
  listing_price: number | null;
  marketplace_notes: string | null;
  reference_mold_id: string | null;
  release_id: string | null;
  users: {
    alias_name: string;
  } | null;
  reference_molds: {
    mold_name: string;
    manufacturer: string;
    scale: string | null;
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

export const metadata = {
  title: "The Show Ring — Model Horse Hub",
  description:
    "Browse the community showcase of model horses cataloged by collectors around the world.",
};

export const dynamic = "force-dynamic";

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
      id, owner_id, custom_name, finish_type, condition_grade, created_at, sculptor, trade_status, listing_price, marketplace_notes, reference_mold_id, release_id,
      users!inner(alias_name),
      reference_molds(mold_name, manufacturer, scale),
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
    .from("horse_timeline")
    .select("horse_id")
    .in("horse_id", horseIds)
    .eq("is_public", true);

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
      moldName: horse.reference_molds?.mold_name || null,
      releaseName: horse.reference_releases?.release_name || null,
      refMoldId: horse.reference_mold_id || null,
      refReleaseId: horse.release_id || null,
      favoriteCount: favCountMap.get(horse.id) || 0,
      isFavorited: userFavSet.has(horse.id),
      scale: horse.reference_molds?.scale || null,
      hoofprintCount: hoofprintCountMap.get(horse.id) || 0,
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

      {/* Featured Horse */}
      {featuredHorse && (
        <FeaturedHorseCard {...featuredHorse} />
      )}

      {/* Grid with Search */}
      <ShowRingGrid communityCards={communityCards} />
    </div>
  );
}
