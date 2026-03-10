import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import RatingBadge from "@/components/RatingBadge";
import UserAvatar from "@/components/UserAvatar";

export const metadata = {
    title: "Discover Collectors — Model Horse Hub",
    description:
        "Browse active collectors in the Model Horse Hub community. Find stables to follow and admire.",
};

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    // Fetch aggregated data from the highly efficient PostgreSQL View
    const { data: activeUsersView } = await supabase
        .from("discover_users_view")
        .select("*")
        .order("created_at", { ascending: false });

    const activeUsers = (activeUsersView || []) as {
        id: string;
        alias_name: string;
        created_at: string;
        avatar_url: string | null;
        public_horse_count: number;
        avg_rating: number;
        rating_count: number;
    }[];

    // Resolve avatar storage paths to signed URLs
    for (const u of activeUsers) {
        if (u.avatar_url && !u.avatar_url.startsWith("http")) {
            const { data: signedAvatar } = await supabase.storage
                .from("avatars")
                .createSignedUrl(u.avatar_url, 3600);
            u.avatar_url = signedAvatar?.signedUrl || null;
        }
    }

    const memberSince = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
        });

    return (
        <div className="page-container page-container-wide">
            {/* Hero */}
            <div className="community-hero animate-fade-in-up">
                <div className="community-hero-content">
                    <h1>
                        👥 <span className="text-gradient">Discover Collectors</span>
                    </h1>
                    <p className="community-hero-subtitle">
                        Find fellow collectors, browse their stables, and connect with the
                        community.
                    </p>
                </div>
                <div className="community-stats">
                    <div className="community-stat">
                        <span className="community-stat-number">{activeUsers.length}</span>
                        <span className="community-stat-label">Active Collectors</span>
                    </div>
                </div>
            </div>

            {/* Grid */}
            {activeUsers.length === 0 ? (
                <div className="card shelf-empty animate-fade-in-up">
                    <div className="shelf-empty-icon">👥</div>
                    <h2>No Active Collectors Yet</h2>
                    <p>Be the first to make your models public!</p>
                </div>
            ) : (
                <div className="discover-grid animate-fade-in-up">
                    {activeUsers.map((u) => {
                        const publicCount = u.public_horse_count;
                        const isMe = u.id === user.id;

                        return (
                            <Link
                                key={u.id}
                                href={`/profile/${encodeURIComponent(u.alias_name)}`}
                                className="discover-card"
                                id={`discover-${u.id}`}
                            >
                                <div className="discover-card-avatar">
                                    <UserAvatar avatarUrl={u.avatar_url} aliasName={u.alias_name} size={40} />
                                </div>
                                <div className="discover-card-info">
                                    <div className="discover-card-alias">
                                        @{u.alias_name}
                                        {isMe && (
                                            <span
                                                className="community-own-badge"
                                                style={{ marginLeft: "6px" }}
                                            >
                                                You
                                            </span>
                                        )}
                                    </div>
                                    <div className="discover-card-stats">
                                        <span>
                                            🐴 {publicCount} model{publicCount !== 1 ? "s" : ""}
                                        </span>
                                        <span>📅 {memberSince(u.created_at)}</span>
                                    </div>
                                    {u.rating_count > 0 && (
                                        <div style={{ marginTop: "var(--space-xs)" }}>
                                            <RatingBadge
                                                average={Number(Number(u.avg_rating).toFixed(1))}
                                                count={u.rating_count}
                                            />
                                        </div>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

