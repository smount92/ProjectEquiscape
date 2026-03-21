import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import WishlistRemoveButton from "@/components/WishlistRemoveButton";
import MatchmakerMatches from "@/components/MatchmakerMatches";
import WishlistSearch from "@/components/WishlistSearch";
import { getPublicImageUrls } from "@/lib/utils/storage";

export const metadata = {
    title: "My Wishlist — Model Horse Hub",
    description: "Models you're hunting for — your personal wishlist with Matchmaker.",
};

export const dynamic = "force-dynamic";

interface WishlistItem {
    id: string;
    notes: string | null;
    created_at: string;
    catalog_id: string | null;
    catalog_items: {
        title: string;
        maker: string;
        scale: string | null;
        item_type: string;
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
        .select(`
            id, notes, created_at, catalog_id,
            catalog_items:catalog_id(title, maker, scale, item_type)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    const items = (rawItems as unknown as WishlistItem[]) ?? [];

    // 2. THE MATCHMAKER ENGINE
    // For each wishlist item, find public horses that match the catalog_id AND are for sale/trade
    const matchMap = new Map<string, MarketplaceMatch[]>();

    if (items.length > 0) {
        const catalogIds = [...new Set(items.map((i) => i.catalog_id).filter(Boolean))] as string[];

        if (catalogIds.length > 0) {
            const { data: rawMatches } = await supabase
                .from("user_horses")
                .select(`
                    id, custom_name, trade_status, listing_price, marketplace_notes,
                    catalog_id, owner_id,
                    users!inner(alias_name),
                    horse_images(image_url, angle_profile)
                `)
                .eq("is_public", true)
                .neq("owner_id", user.id)
                .in("trade_status", ["For Sale", "Open to Offers"])
                .in("catalog_id", catalogIds)
                .limit(200);

            interface RawMatch {
                id: string;
                custom_name: string;
                trade_status: string;
                listing_price: number | null;
                marketplace_notes: string | null;
                catalog_id: string | null;
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

            const signedUrlMap = getPublicImageUrls(thumbUrls);

            // Group matches by wishlist item
            for (const item of items) {
                const itemMatches: MarketplaceMatch[] = [];

                for (const match of matches) {
                    if (item.catalog_id && match.catalog_id === item.catalog_id) {
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
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6 py-12 px-[0]">
            <div className="animate-fade-in-up">
                {/* Header */}
                <div className="shelf-sticky top-0 z-[100] h-[var(--header-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">
                    <div>
                        <h1>
                            <span className="text-forest">❤️ My Wishlist</span>
                        </h1>
                        <p style={{ color: "var(--color-text-muted)", marginTop: "var(--space-xs)" }}>
                            Models you&apos;re hunting for — {items.length} item{items.length !== 1 ? "s" : ""}
                            {totalMatches > 0 && (
                                <span className="matchmaker-sticky top-0 z-[100] h-[var(--header-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all-badge">
                                    🔥 {totalMatches} marketplace match{totalMatches !== 1 ? "es" : ""} found!
                                </span>
                            )}
                        </p>
                    </div>
                    <Link href="/community" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm" id="browse-showring">
                        🏆 Browse Show Ring
                    </Link>
                </div>

                {/* Search to Add */}
                <WishlistSearch />

                {/* Wishlist Grid */}
                {items.length === 0 ? (
                    <div className="bg-card border border-edge rounded-lg p-12 shadow-md transition-all text-center py-[var(--space-3xl)] px-8 animate-fade-in-up">
                        <div className="text-center py-[var(--space-3xl)] px-8-icon">❤️</div>
                        <h2>Your Wishlist is Empty</h2>
                        <p>
                            Browse the Show Ring and tap the heart icon on models you love to start your hunt!
                        </p>
                        <Link href="/community" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm">
                            🏆 Browse the Show Ring
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-6 max-[600px]:grid-cols-1 animate-fade-in-up">
                        {items.map((item) => {
                            const catalogItem = item.catalog_items;
                            const title = catalogItem?.title || "Custom Entry";
                            const maker = catalogItem?.maker || null;
                            const scale = catalogItem?.scale || null;
                            const typeIcon = catalogItem?.item_type === "artist_resin" ? "🎨" :
                                catalogItem?.item_type === "plastic_release" ? "📦" : "🏭";
                            const matches = matchMap.get(item.id) ?? [];

                            return (
                                <div key={item.id} className="group/bg-card border border-edge rounded-lg p-12 shadow-md transition-all flex gap-4 p-6 bg-[var(--color-surface-glass)] border border-edge rounded-lg transition-all duration-250 relative hover:border-forest hover:shadow-[0_4px_20px_rgba(44,85,69,0.15)] hover:-translate-y-0.5" id={`wishlist-${item.id}`}>
                                    <div className="text-[2rem] shrink-0 leading-none mt-[2px]">🐴</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-ink text-base mb-1">{typeIcon} {title}</div>
                                        {maker && (
                                            <div className="text-sm text-forest mb-1">
                                                {maker}
                                            </div>
                                        )}
                                        {scale && (
                                            <div className="text-sm text-muted mb-[2px]">📏 {scale}</div>
                                        )}
                                        {item.notes && (
                                            <div className="text-sm text-muted italic mt-1">📝 {item.notes}</div>
                                        )}
                                        <div className="text-xs text-muted opacity-70 mt-2">
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
