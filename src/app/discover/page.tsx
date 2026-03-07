import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import RatingBadge from "@/components/RatingBadge";
import { getUserRatingSummary } from "@/app/actions/ratings";

export const metadata = {
    title: "Discover Collectors — Model Horse Hub",
    description:
        "Browse active collectors in the Model Horse Hub community. Find stables to follow and admire.",
};

interface UserRow {
    id: string;
    alias_name: string;
    created_at: string;
}

export default async function DiscoverPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    // Fetch all users
    const { data: rawUsers } = await supabase
        .from("users")
        .select("id, alias_name, created_at")
        .order("created_at", { ascending: false });

    const allUsers = (rawUsers as UserRow[]) ?? [];

    // Count public horses per user
    const { data: publicHorses } = await supabase
        .from("user_horses")
        .select("owner_id")
        .eq("is_public", true);

    const countMap = new Map<string, number>();
    (publicHorses ?? []).forEach((h: { owner_id: string }) => {
        countMap.set(h.owner_id, (countMap.get(h.owner_id) || 0) + 1);
    });

    // Filter to only active users (at least 1 public horse)
    const activeUsers = allUsers.filter((u) => (countMap.get(u.id) || 0) > 0);

    // Fetch rating summaries for active users
    const ratingMap = new Map<string, { average: number; count: number }>();
    for (const u of activeUsers) {
        const summary = await getUserRatingSummary(u.id);
        if (summary.count > 0) {
            ratingMap.set(u.id, { average: summary.average, count: summary.count });
        }
    }

    const memberSince = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
        });

    return (
        <div className="page-container">
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
                        const publicCount = countMap.get(u.id) || 0;
                        const rating = ratingMap.get(u.id);
                        const isMe = u.id === user.id;

                        return (
                            <Link
                                key={u.id}
                                href={`/profile/${encodeURIComponent(u.alias_name)}`}
                                className="discover-card"
                                id={`discover-${u.id}`}
                            >
                                <div className="discover-card-avatar">
                                    <svg
                                        width="32"
                                        height="32"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
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
                                    {rating && (
                                        <div style={{ marginTop: "var(--space-xs)" }}>
                                            <RatingBadge
                                                average={rating.average}
                                                count={rating.count}
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
