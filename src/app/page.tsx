import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getSignedImageUrls } from "@/lib/utils/storage";
import DashboardToast from "@/components/DashboardToast";

// Types for the dashboard query results
interface HorseWithDetails {
  id: string;
  custom_name: string;
  finish_type: string;
  condition_grade: string;
  created_at: string;
  collection_id: string | null;
  reference_molds: { mold_name: string; manufacturer: string } | null;
  artist_resins: { resin_name: string; sculptor_alias: string } | null;
  reference_releases: { release_name: string; model_number: string | null } | null;
  horse_images: { image_url: string; angle_profile: string }[];
}

interface UserCollection {
  id: string;
  name: string;
  description: string | null;
}

function getFinishBadgeClass(finishType: string): string {
  switch (finishType) {
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

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("users")
    .select("alias_name")
    .eq("id", user.id)
    .single<{ alias_name: string }>();

  // Fetch horses with reference data and thumbnail images
  const { data: rawHorses } = await supabase
    .from("user_horses")
    .select(
      `
      id, custom_name, finish_type, condition_grade, created_at, collection_id,
      reference_molds(mold_name, manufacturer),
      artist_resins(resin_name, sculptor_alias),
      reference_releases(release_name, model_number),
      horse_images(image_url, angle_profile)
    `
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const horses = (rawHorses as unknown as HorseWithDetails[]) ?? [];

  // Fetch user's collections
  const { data: rawCollections } = await supabase
    .from("user_collections")
    .select("id, name, description")
    .eq("user_id", user.id)
    .order("name");

  const collections = (rawCollections as unknown as UserCollection[]) ?? [];

  // Count horses per collection
  const collectionCounts = new Map<string, number>();
  horses.forEach((h) => {
    if (h.collection_id) {
      collectionCounts.set(h.collection_id, (collectionCounts.get(h.collection_id) || 0) + 1);
    }
  });

  // Build collection name map for badge display
  const collectionNameMap = new Map<string, string>();
  collections.forEach((c) => collectionNameMap.set(c.id, c.name));

  // Collect all thumbnail image URLs and generate signed URLs
  const thumbnailUrls: string[] = [];
  horses.forEach((horse) => {
    const thumb = horse.horse_images?.find(
      (img) => img.angle_profile === "Primary_Thumbnail"
    );
    if (thumb) thumbnailUrls.push(thumb.image_url);
  });

  const signedUrlMap = await getSignedImageUrls(supabase, thumbnailUrls);

  // Build display data
  const horseCards = horses.map((horse) => {
    const thumb = horse.horse_images?.find(
      (img) => img.angle_profile === "Primary_Thumbnail"
    );
    const firstImage = horse.horse_images?.[0];
    const imageUrl = thumb?.image_url || firstImage?.image_url;
    const signedUrl = imageUrl ? signedUrlMap.get(imageUrl) : undefined;

    // If we didn't get a signed URL for the first image (non-thumbnail), get one
    // This is a fallback - ideally we'd batch these too, but keeping it simple
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
      collectionName: horse.collection_id ? collectionNameMap.get(horse.collection_id) || null : null,
    };
  });

  return (
    <div className="page-container form-page">
      <div className="animate-fade-in-up">
        {/* Shelf Header */}
        <div className="shelf-header">
          <div>
            <h1>
              <span className="text-gradient">Digital Stable</span>
              {profile?.alias_name && (
                <span
                  style={{
                    fontSize: "calc(var(--font-size-lg) * var(--font-scale))",
                    color: "var(--color-text-muted)",
                    fontWeight: 400,
                    marginLeft: "var(--space-md)",
                  }}
                >
                  {profile.alias_name}&apos;s Herd
                </span>
              )}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
            {horses.length > 0 && (
              <span className="shelf-stats">
                {horses.length} model{horses.length === 1 ? "" : "s"}
              </span>
            )}
            <Link href="/add-horse" className="btn btn-primary" id="add-horse-button">
              🐴 Add to Stable
            </Link>
          </div>
        </div>

        {/* Success toast (reads URL ?toast= param) */}
        <Suspense fallback={null}>
          <DashboardToast />
        </Suspense>

        {/* Collection Folders Row */}
        {collections.length > 0 && (
          <div className="collections-row">
            <h2 className="collections-row-title">📁 Collections</h2>
            <div className="collections-scroll">
              {collections.map((col) => (
                <Link
                  key={col.id}
                  href={`/stable/collection/${col.id}`}
                  className="collection-folder"
                  id={`collection-${col.id}`}
                >
                  <span className="collection-folder-icon">📁</span>
                  <span className="collection-folder-name">{col.name}</span>
                  <span className="collection-folder-count">
                    {collectionCounts.get(col.id) || 0} model{(collectionCounts.get(col.id) || 0) !== 1 ? "s" : ""}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Horse Grid or Empty State */}
        {horseCards.length === 0 ? (
          <div className="card shelf-empty">
            <div className="shelf-empty-icon">🏠</div>
            <h2>Your Stable is Empty</h2>
            <p>
              You haven&apos;t added any models yet. Click the button above to
              catalog your first horse!
            </p>
            <Link
              href="/add-horse"
              className="btn btn-primary"
              id="add-first-horse"
            >
              🐴 Add Your First Horse
            </Link>
          </div>
        ) : (
          <div className="shelf-grid">
            {horseCards.map((horse) => (
              <Link
                key={horse.id}
                href={`/stable/${horse.id}`}
                className="horse-card"
                id={`horse-card-${horse.id}`}
              >
                <div className="horse-card-image">
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
                <div className="horse-card-info">
                  <div className="horse-card-name">{horse.customName}</div>
                  <div className="horse-card-ref">{horse.refName}</div>
                  {horse.releaseLine && (
                    <div className="horse-card-ref" style={{ fontSize: "calc(0.7rem * var(--font-scale))", opacity: 0.7, marginTop: "2px" }}>
                      🎨 {horse.releaseLine}
                    </div>
                  )}
                  <div className="horse-card-meta">
                    <span>{horse.conditionGrade}</span>
                    <span>{formatDate(horse.createdAt)}</span>
                  </div>
                  {horse.collectionName && (
                    <div className="horse-card-collection">
                      📁 {horse.collectionName}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
