import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSignedImageUrls } from "@/lib/utils/storage";
import ShowRingGrid from "@/components/ShowRingGrid";

// Types
interface CommunityHorse {
  id: string;
  owner_id: string;
  custom_name: string;
  finish_type: string;
  condition_grade: string;
  created_at: string;
  sculptor: string | null;
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
      id, owner_id, custom_name, finish_type, condition_grade, created_at, sculptor,
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
      sculptor: horse.sculptor || null,
      // Search fields from reference data
      moldName: horse.reference_molds?.mold_name || null,
      releaseName: horse.reference_releases?.release_name || null,
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

      {/* Grid with Search */}
      <ShowRingGrid communityCards={communityCards} />
    </div>
  );
}
