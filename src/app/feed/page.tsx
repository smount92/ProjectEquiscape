import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import { getFollowingFeed } from"@/app/actions/activity";
import { getPosts } from"@/app/actions/posts";
import UniversalFeed from"@/components/UniversalFeed";
import LoadMoreFeed from"@/components/LoadMoreFeed";
import Link from"next/link";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";

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
 <ExplorerLayout
  title={<>📰 <span className="text-forest">Activity Feed</span></>}
  description="Stay up to date with what's happening in the community."
  /* Global tab brings its own leather panel — skip the archetype's
     ledger surface so leather sits directly on the page background
     (fixes the double-framing artifact). */
  frameless={activeTab ==="global"}
  controls={
  <div className="flex w-fit gap-1 rounded-lg border border-input bg-muted/60 p-1">
   <Link
   href="/feed"
   className={`rounded-md px-5 py-2 text-sm whitespace-nowrap no-underline transition-all ${activeTab ==="global" ?"bg-forest font-semibold text-white shadow-sm" :"text-secondary-foreground hover:bg-card hover:text-foreground"}`}
   >
   🌐 Global
   </Link>
   <Link
   href="/feed?tab=following"
   className={`rounded-md px-5 py-2 text-sm whitespace-nowrap no-underline transition-all ${activeTab ==="following" ?"bg-forest font-semibold text-white shadow-sm" :"text-secondary-foreground hover:bg-card hover:text-foreground"}`}
   >
   👥 Following
   </Link>
  </div>
  }
 >
  {activeTab ==="global" ? (
  /* ── Global Tab: UniversalFeed (posts table) ──
     Wrapped in the leather stable-feed panel (approved prototype:
     /design/feed). .feed-leather scopes the spine/dot/hero treatment
     to this page only — other UniversalFeed contexts stay plain. */
  <div className="feed-leather leather-panel stitched mt-6">
   <h2 className="feed-leather-title">Stable Activity Feed</h2>
   <UniversalFeed
    initialPosts={globalPosts}
    context={{ globalFeed: true }}
    currentUserId={user.id}
    showComposer={true}
    composerPlaceholder="Share an update with the community… (supports @mentions)"
    label="Community Posts"
    variant="leather"
   />
  </div>
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
 </ExplorerLayout>
 );
}
