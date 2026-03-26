import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import { getFollowingFeed } from"@/app/actions/activity";
import { getPosts } from"@/app/actions/posts";
import UniversalFeed from"@/components/UniversalFeed";
import LoadMoreFeed from"@/components/LoadMoreFeed";
import Link from"next/link";

export const metadata = {
 title:"Activity Feed — Model Horse Hub",
 description:"See the latest activity from the Model Horse Hub community.",
};


export default async function FeedPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();

 if (!user) redirect("/login");

 const { tab } = await searchParams;
 const activeTab = tab ==="following" ?"following" :"global";

 // Global tab → unified posts table
 // Following tab → legacy activity_events (system events from followed users)
 let followingData: {
 items: Awaited<ReturnType<typeof getFollowingFeed>>["items"];
 nextCursor: string | null;
 } | null = null;
 let globalPosts: Awaited<ReturnType<typeof getPosts>> = [];

 if (activeTab ==="following") {
 followingData = await getFollowingFeed(30);
 } else {
 globalPosts = await getPosts({ globalFeed: true }, { includeReplies: true, limit: 30 });
 }

 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-8">
 {/* Hero */}
 <div className="animate-fade-in-up mb-8">
 <h1 className="text-2xl font-bold tracking-tight">
 📰 <span className="text-forest">Activity Feed</span>
 </h1>
 <p className="mt-2 max-w-xl text-base text-ink-light">
 Stay up to date with what's happening in the community.
 </p>
 </div>

 {/* Tab Bar */}
 <div className="animate-fade-in-up mb-8 flex w-fit gap-1 rounded-lg border border-stone-200 bg-stone-100/60 p-1">
 <Link
 href="/feed"
 className={`rounded-md px-5 py-2 text-sm whitespace-nowrap no-underline transition-all ${activeTab ==="global" ?"bg-forest font-semibold text-white shadow-sm" :"text-ink-light hover:bg-white hover:text-stone-700"}`}
 >
 🌐 Global
 </Link>
 <Link
 href="/feed?tab=following"
 className={`rounded-md px-5 py-2 text-sm whitespace-nowrap no-underline transition-all ${activeTab ==="following" ?"bg-forest font-semibold text-white shadow-sm" :"text-ink-light hover:bg-white hover:text-stone-700"}`}
 >
 👥 Following
 </Link>
 </div>

 {activeTab ==="global" ? (
 /* ── Global Tab: UniversalFeed (posts table) ── */
 <UniversalFeed
 initialPosts={globalPosts}
 context={{ globalFeed: true }}
 currentUserId={user.id}
 showComposer={true}
 composerPlaceholder="Share an update with the community… (supports @mentions)"
 label="Community Posts"
 />
 ) : (
 /* ── Following Tab: Legacy system events feed ── */
 <LoadMoreFeed
 initialItems={followingData?.items ?? []}
 initialCursor={followingData?.nextCursor ?? null}
 feedType="following"
 currentUserId={user.id}
 emptyMessage="Follow collectors on the Discover page to see their activity!"
 />
 )}
 </div>
 );
}
