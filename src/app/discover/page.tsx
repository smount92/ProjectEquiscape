import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DiscoverGrid from "@/components/DiscoverGrid";

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

    // Fetch aggregated data from the PostgreSQL View (now includes bio + has_studio)
    const { data: activeUsersView } = await supabase
        .from("discover_users_view")
        .select("*")
        .order("created_at", { ascending: false });

    const activeUsers = (activeUsersView || []) as {
        id: string;
        alias_name: string;
        created_at: string;
        avatar_url: string | null;
        bio: string | null;
        public_horse_count: number;
        avg_rating: number;
        rating_count: number;
        has_studio: boolean;
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

            {/* Client-side searchable grid with tags */}
            <DiscoverGrid users={activeUsers} currentUserId={user.id} />
        </div>
    );
}
