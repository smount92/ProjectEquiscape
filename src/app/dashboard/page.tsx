import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getSignedImageUrls } from "@/lib/utils/storage";
import DashboardToast from "@/components/DashboardToast";
import StableGrid from "@/components/StableGrid";

// Types for the dashboard query results
interface HorseWithDetails {
    id: string;
    custom_name: string;
    finish_type: string;
    condition_grade: string;
    created_at: string;
    collection_id: string | null;
    sculptor: string | null;
    trade_status: string;
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

export default async function DashboardPage() {
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
      id, custom_name, finish_type, condition_grade, created_at, collection_id, sculptor, trade_status,
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

    // Fetch financial vault totals (owner-only via RLS — strictly private)
    const { data: rawVaults } = await supabase
        .from("financial_vault")
        .select("purchase_price, estimated_current_value, horse_id")
        .in(
            "horse_id",
            horses.map((h) => h.id)
        );

    const vaults = (rawVaults as { purchase_price: number | null; estimated_current_value: number | null; horse_id: string }[]) ?? [];

    // Compute total vault value: prefer estimated_current_value, fall back to purchase_price
    let totalVaultValue = 0;
    vaults.forEach((v) => {
        totalVaultValue += v.estimated_current_value ?? v.purchase_price ?? 0;
    });

    // Count horses per collection and compute vault value per collection
    const collectionCounts = new Map<string, number>();
    const collectionValues = new Map<string, number>();
    horses.forEach((h) => {
        if (h.collection_id) {
            collectionCounts.set(h.collection_id, (collectionCounts.get(h.collection_id) || 0) + 1);
        }
    });
    // Map horse_id -> collection_id for vault value aggregation
    const horseCollectionMap = new Map<string, string>();
    horses.forEach((h) => {
        if (h.collection_id) horseCollectionMap.set(h.id, h.collection_id);
    });
    vaults.forEach((v) => {
        const colId = horseCollectionMap.get(v.horse_id);
        if (colId) {
            const val = v.estimated_current_value ?? v.purchase_price ?? 0;
            collectionValues.set(colId, (collectionValues.get(colId) || 0) + val);
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
            sculptor: horse.sculptor || null,
            tradeStatus: horse.trade_status || "Not for Sale",
            // Search fields from reference data
            moldName: horse.reference_molds?.mold_name || null,
            releaseName: horse.reference_releases?.release_name || null,
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

                {/* 🔒 Stable Overview — PRIVATE analytics (never exposed publicly) */}
                {horses.length > 0 && (
                    <div className="analytics-row">
                        <div className="analytics-card">
                            <div className="analytics-icon">🐴</div>
                            <div className="analytics-value">{horses.length}</div>
                            <div className="analytics-label">Total Models</div>
                        </div>
                        <div className="analytics-card">
                            <div className="analytics-icon">📁</div>
                            <div className="analytics-value">{collections.length}</div>
                            <div className="analytics-label">Collections</div>
                        </div>
                        <div className="analytics-card">
                            <div className="analytics-icon">💰</div>
                            <div className="analytics-value">
                                {totalVaultValue > 0
                                    ? `$${totalVaultValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                    : "—"}
                            </div>
                            <div className="analytics-label">Vault Value</div>
                        </div>
                    </div>
                )}

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
                                        {(collectionValues.get(col.id) || 0) > 0 && (
                                            <> · ${(collectionValues.get(col.id) || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</>
                                        )}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Horse Grid with Search */}
                <StableGrid horseCards={horseCards} />
            </div>
        </div>
    );
}
