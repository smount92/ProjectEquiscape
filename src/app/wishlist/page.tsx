import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import WishlistRemoveButton from "@/components/WishlistRemoveButton";

export const metadata = {
    title: "My Wishlist — Model Horse Hub",
    description: "Models you're hunting for — your personal wishlist.",
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

export default async function WishlistPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

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
