import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSignedImageUrls } from "@/lib/utils/storage";

interface CollectionHorse {
  id: string;
  custom_name: string;
  finish_type: string;
  condition_grade: string;
  created_at: string;
  reference_molds: { mold_name: string; manufacturer: string } | null;
  artist_resins: { resin_name: string; sculptor_alias: string } | null;
  reference_releases: { release_name: string; model_number: string | null } | null;
  horse_images: { image_url: string; angle_profile: string }[];
}

function getFinishBadgeClass(finishType: string): string {
  switch (finishType) {
    case "OF": return "of";
    case "Custom": return "custom";
    case "Artist Resin": return "resin";
    default: return "";
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_collections")
    .select("name")
    .eq("id", id)
    .single<{ name: string }>();

  return {
    title: data ? `${data.name} — Digital Stable` : "Collection Not Found",
    description: data ? `View models in the "${data.name}" collection.` : "Collection not found.",
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: collectionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch collection details (RLS ensures owner-only)
  const { data: collection } = await supabase
    .from("user_collections")
    .select("id, name, description, created_at")
    .eq("id", collectionId)
    .single<{ id: string; name: string; description: string | null; created_at: string }>();

  if (!collection) {
    notFound();
  }

  // Fetch horses in this collection
  const { data: rawHorses } = await supabase
    .from("user_horses")
    .select(
      `
      id, custom_name, finish_type, condition_grade, created_at,
      reference_molds(mold_name, manufacturer),
      artist_resins(resin_name, sculptor_alias),
      reference_releases(release_name, model_number),
      horse_images(image_url, angle_profile)
    `
    )
    .eq("owner_id", user.id)
    .eq("collection_id", collectionId)
    .order("created_at", { ascending: false });

  const horses = (rawHorses as unknown as CollectionHorse[]) ?? [];

  // Generate signed URLs
  const thumbnailUrls: string[] = [];
  horses.forEach((horse) => {
    const thumb = horse.horse_images?.find((img) => img.angle_profile === "Primary_Thumbnail");
    const first = horse.horse_images?.[0];
    const url = thumb?.image_url || first?.image_url;
    if (url) thumbnailUrls.push(url);
  });

  const signedUrlMap = await getSignedImageUrls(supabase, thumbnailUrls);

  const horseCards = horses.map((horse) => {
    const thumb = horse.horse_images?.find((img) => img.angle_profile === "Primary_Thumbnail");
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
    };
  });

  return (
    <div className="page-container form-page">
      {/* Breadcrumb */}
      <nav className="passport-breadcrumb animate-fade-in-up" aria-label="Breadcrumb">
        <Link href="/">Digital Stable</Link>
        <span className="separator" aria-hidden="true">/</span>
        <span>📁 {collection.name}</span>
      </nav>

      {/* Collection Header */}
      <div className="collection-hero animate-fade-in-up">
        <div className="collection-hero-icon">📁</div>
        <div className="collection-hero-content">
          <h1>{collection.name}</h1>
          {collection.description && (
            <p className="collection-hero-desc">{collection.description}</p>
          )}
          <span className="collection-hero-count">
            {horseCards.length} model{horseCards.length !== 1 ? "s" : ""} in this collection
          </span>
        </div>
      </div>

      {/* Grid */}
      {horseCards.length === 0 ? (
        <div className="card shelf-empty animate-fade-in-up">
          <div className="shelf-empty-icon">📂</div>
          <h2>This collection is empty</h2>
          <p>
            Add models to this collection from the &quot;Add to Stable&quot; form or by editing an existing model.
          </p>
          <Link href="/add-horse" className="btn btn-primary">
            🐴 Add to Stable
          </Link>
        </div>
      ) : (
        <div className="shelf-grid animate-fade-in-up">
          {horseCards.map((horse) => (
            <Link
              key={horse.id}
              href={`/stable/${horse.id}`}
              className="horse-card"
              id={`collection-horse-${horse.id}`}
            >
              <div className="horse-card-image">
                {horse.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={horse.thumbnailUrl} alt={horse.customName} loading="lazy" />
                ) : (
                  <div className="horse-card-placeholder">
                    <span className="horse-card-placeholder-icon">🐴</span>
                    <span>No photo</span>
                  </div>
                )}
                <span className={`horse-card-badge ${getFinishBadgeClass(horse.finishType)}`}>
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
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
