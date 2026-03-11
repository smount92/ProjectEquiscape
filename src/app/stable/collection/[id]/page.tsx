import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSignedImageUrls } from "@/lib/utils/storage";
import CollectionManager from "@/components/CollectionManager";

export const dynamic = "force-dynamic";

interface CollectionHorse {
  id: string;
  custom_name: string;
  finish_type: string;
  condition_grade: string;
  created_at: string;
  trade_status: string;
  catalog_items: { title: string; maker: string; item_type: string } | null;
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
      id, custom_name, finish_type, condition_grade, created_at, trade_status,
      catalog_items:catalog_id(title, maker, item_type),
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

  // Fetch financial vault totals for horses in this collection (owner-only via RLS)
  const horseIds = horses.map((h) => h.id);
  const { data: rawVaults } = horseIds.length > 0
    ? await supabase
      .from("financial_vault")
      .select("purchase_price, estimated_current_value")
      .in("horse_id", horseIds)
    : { data: [] };

  const vaults = (rawVaults as { purchase_price: number | null; estimated_current_value: number | null }[]) ?? [];

  let collectionVaultValue = 0;
  vaults.forEach((v) => {
    collectionVaultValue += v.estimated_current_value ?? v.purchase_price ?? 0;
  });

  const avgValue = horses.length > 0 && collectionVaultValue > 0
    ? collectionVaultValue / horses.length
    : 0;

  const horseCards = horses.map((horse) => {
    const thumb = horse.horse_images?.find((img) => img.angle_profile === "Primary_Thumbnail");
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
      tradeStatus: horse.trade_status || "Not for Sale",
    };
  });

  return (
    <div className="page-container form-page">
      {/* Breadcrumb */}
      <nav className="passport-breadcrumb animate-fade-in-up" aria-label="Breadcrumb">
        <Link href="/dashboard">Digital Stable</Link>
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
          <div style={{ marginTop: "var(--space-sm)" }}>
            <CollectionManager collection={collection} />
          </div>
        </div>
      </div>

      {/* 🔒 Collection Stats — PRIVATE analytics */}
      {horseCards.length > 0 && (
        <div className="analytics-row animate-fade-in-up">
          <div className="analytics-card">
            <div className="analytics-icon">🐴</div>
            <div className="analytics-value">{horseCards.length}</div>
            <div className="analytics-label">Models</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon">💰</div>
            <div className="analytics-value">
              {collectionVaultValue > 0
                ? `$${collectionVaultValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : "—"}
            </div>
            <div className="analytics-label">Collection Value</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon">📊</div>
            <div className="analytics-value">
              {avgValue > 0
                ? `$${avgValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : "—"}
            </div>
            <div className="analytics-label">Avg. Value</div>
          </div>
        </div>
      )}

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
                {horse.tradeStatus === "For Sale" && (
                  <span className="trade-badge trade-for-sale">💲 For Sale</span>
                )}
                {horse.tradeStatus === "Open to Offers" && (
                  <span className="trade-badge trade-open-offers">🤝 Open to Offers</span>
                )}
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
