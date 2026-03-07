import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActivityFeed, getFollowingFeed } from "@/app/actions/activity";
import ActivityFeed from "@/components/ActivityFeed";
import Link from "next/link";

export const metadata = {
    title: "Activity Feed — Model Horse Hub",
    description: "See the latest activity from the Model Horse Hub community.",
};

export const dynamic = "force-dynamic";

export default async function FeedPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>;
}) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { tab } = await searchParams;
    const activeTab = tab === "following" ? "following" : "global";

    const feedItems =
        activeTab === "following"
            ? await getFollowingFeed(50)
            : await getActivityFeed(50);

    return (
        <div className="page-container">
            {/* Hero */}
            <div className="community-hero animate-fade-in-up">
                <div className="community-hero-content">
                    <h1>
                        📰 <span className="text-gradient">Activity Feed</span>
                    </h1>
                    <p className="community-hero-subtitle">
                        Stay up to date with what's happening in the community.
                    </p>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="feed-tabs animate-fade-in-up">
                <Link
                    href="/feed"
                    className={`feed-tab ${activeTab === "global" ? "feed-tab-active" : ""}`}
                >
                    🌐 Global
                </Link>
                <Link
                    href="/feed?tab=following"
                    className={`feed-tab ${activeTab === "following" ? "feed-tab-active" : ""}`}
                >
                    👥 Following
                </Link>
            </div>

            {/* Feed */}
            <ActivityFeed
                items={feedItems}
                emptyMessage={
                    activeTab === "following"
                        ? "Follow collectors on the Discover page to see their activity!"
                        : "No activity yet. Be the first to add a horse!"
                }
            />
        </div>
    );
}
