import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import WishlistRemoveButton from "@/components/WishlistRemoveButton";
import MatchmakerMatches from "@/components/MatchmakerMatches";
import { getSignedImageUrls } from "@/lib/utils/storage";

export const metadata = {
    title: "My Wishlist — Model Horse Hub",
    description: "Models you're hunting for — your personal wishlist with Matchmaker.",
};

interface WishlistItem {
    id: string;
    notes: string | null;
    created_at: string;
    mold_id: string | null;
    release_id: string | null;
    reference_molds: {
        mold_name: string;
        manufacturer: string;
        scale: string;
    } | null;
    reference_releases: {
        release_name: string;
        model_number: string | null;
        color_description: string | null;
    } | null;
}

interface MarketplaceMatch {
    id: string;
    custom_name: string;
    trade_status: string;
    listing_price: number | null;
    marketplace_notes: string | null;
    thumbnailUrl: string | null;
    ownerAlias: string;
}

export default async function WishlistPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // 1. Fetch wishlist items
    const { data: rawItems } = await supabase
        .from("user_wishlists")
        .select(
            `
      id, notes, created_at, mold_id, release_id,
      reference_molds(mold_name, manufacturer, scale),
      reference_releases(release_name, model_number, color_description)
    `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    const items = (rawItems as unknown as WishlistItem[]) ?? [];

    // 2. THE MATCHMAKER ENGINE
    // For each wishlist item, find public horses that match the mold/release AND are for sale/trade
    const matchMap = new Map<string, MarketplaceMatch[]>();

    if (items.length > 0) {
        // Collect unique mold_ids and release_ids from wishlist
        const moldIds = [...new Set(items.map((i) => i.mold_id).filter(Boolean))] as string[];
        const releaseIds = [...new Set(items.map((i) => i.release_id).filter(Boolean))] as string[];

        // Query ALL public horses that are for sale/trade and match any wishlist mold or release
        // We do a single efficient query rather than N+1
        if (moldIds.length > 0 || releaseIds.length > 0) {
            let query = supabase
                .from("user_horses")
                .select(
                    `
          id, custom_name, trade_status, listing_price, marketplace_notes,
          reference_mold_id, release_id, owner_id,
          users!inner(alias_name),
          horse_images(image_url, angle_profile)
        `
                )
                .eq("is_public", true)
                .neq("owner_id", user.id) // Don't match your own horses
                .in("trade_status", ["For Sale", "Open to Offers"]);

            // Filter by matching mold_ids OR release_ids
            if (moldIds.length > 0 && releaseIds.length > 0) {
                query = query.or(
                    `reference_mold_id.in.(${moldIds.join(",")}),release_id.in.(${releaseIds.join(",")})`
                );
            } else if (moldIds.length > 0) {
                query = query.in("reference_mold_id", moldIds);
            } else {
                query = query.in("release_id", releaseIds);
            }

            const { data: rawMatches } = await query.limit(200);

            interface RawMatch {
                id: string;
                custom_name: string;
                trade_status: string;
                listing_price: number | null;
                marketplace_notes: string | null;
                reference_mold_id: string | null;
                release_id: string | null;
                owner_id: string;
                users: { alias_name: string } | null;
                horse_images: { image_url: string; angle_profile: string }[];
            }

            const matches = (rawMatches as unknown as RawMatch[]) ?? [];

            // Collect thumbnail URLs for signed URL generation
            const thumbUrls: string[] = [];
            matches.forEach((m) => {
                const thumb = m.horse_images?.find((img) => img.angle_profile === "Primary_Thumbnail");
                const first = m.horse_images?.[0];
                const url = thumb?.image_url || first?.image_url;
                if (url) thumbUrls.push(url);
            });

            const signedUrlMap = await getSignedImageUrls(supabase, thumbUrls);

            // Group matches by wishlist item
            for (const item of items) {
                const itemMatches: MarketplaceMatch[] = [];

                for (const match of matches) {
                    // Match logic: exact mold_id AND (release_id match OR wishlist has no release_id)
                    const moldMatch = item.mold_id && match.reference_mold_id === item.mold_id;
                    const releaseMatch = item.release_id ? match.release_id === item.release_id : true;

                    if (moldMatch && releaseMatch) {
                        const thumb = match.horse_images?.find(
                            (img) => img.angle_profile === "Primary_Thumbnail"
                        );
                        const firstImg = match.horse_images?.[0];
                        const imgUrl = thumb?.image_url || firstImg?.image_url;

                        itemMatches.push({
                            id: match.id,
                            custom_name: match.custom_name,
                            trade_status: match.trade_status,
                            listing_price: match.listing_price,
                            marketplace_notes: match.marketplace_notes,
                            thumbnailUrl: imgUrl ? signedUrlMap.get(imgUrl) || null : null,
                            ownerAlias: match.users?.alias_name ?? "Unknown",
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
        <div className="page-container form-page">
            <div className="animate-fade-in-up">
                {/* Header */}
                <div className="shelf-header">
                    <div>
                        <h1>
                            <span className="text-gradient">❤️ My Wishlist</span>
                        </h1>
                        <p style={{ color: "var(--color-text-muted)", marginTop: "var(--space-xs)" }}>
                            Models you&apos;re hunting for — {items.length} item{items.length !== 1 ? "s" : ""}
                            {totalMatches > 0 && (
                                <span className="matchmaker-header-badge">
                                    🔥 {totalMatches} marketplace match{totalMatches !== 1 ? "es" : ""} found!
                                </span>
                            )}
                        </p>
                    </div>
                    <Link href="/community" className="btn btn-primary" id="browse-showring">
                        🏆 Browse Show Ring
                    </Link>
                </div>

                {/* Wishlist Grid */}
                {items.length === 0 ? (
                    <div className="card shelf-empty animate-fade-in-up">
                        <div className="shelf-empty-icon">❤️</div>
                        <h2>Your Wishlist is Empty</h2>
                        <p>
                            Browse the Show Ring and tap the heart icon on models you love to start your hunt!
                        </p>
                        <Link href="/community" className="btn btn-primary">
                            🏆 Browse the Show Ring
                        </Link>
                    </div>
                ) : (
                    <div className="wishlist-grid animate-fade-in-up">
                        {items.map((item) => {
                            const moldName = item.reference_molds
                                ? `${item.reference_molds.manufacturer} ${item.reference_molds.mold_name}`
                                : "Unknown Mold";
                            const scale = item.reference_molds?.scale || null;
                            const releaseName = item.reference_releases?.release_name || null;
                            const modelNumber = item.reference_releases?.model_number || null;
                            const color = item.reference_releases?.color_description || null;
                            const matches = matchMap.get(item.id) ?? [];

                            return (
                                <div key={item.id} className="wishlist-card" id={`wishlist-${item.id}`}>
                                    <div className="wishlist-card-icon">🐴</div>
                                    <div className="wishlist-card-info">
                                        <div className="wishlist-card-mold">{moldName}</div>
                                        {releaseName && (
                                            <div className="wishlist-card-release">
                                                🎨 {releaseName}
                                                {modelNumber ? ` (#${modelNumber})` : ""}
                                            </div>
                                        )}
                                        {color && (
                                            <div className="wishlist-card-detail">{color}</div>
                                        )}
                                        {scale && (
                                            <div className="wishlist-card-detail">📏 {scale}</div>
                                        )}
                                        {item.notes && (
                                            <div className="wishlist-card-notes">📝 {item.notes}</div>
                                        )}
                                        <div className="wishlist-card-date">
                                            Added {new Date(item.created_at).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })}
                                        </div>

                                        {/* MATCHMAKER RESULTS */}
                                        {matches.length > 0 && (
                                            <MatchmakerMatches
                                                matchCount={matches.length}
                                                matches={matches}
                                            />
                                        )}
                                    </div>
                                    <WishlistRemoveButton wishlistId={item.id} />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
