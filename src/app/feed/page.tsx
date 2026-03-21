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

export const dynamic ="force-dynamic";

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
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-[0]">
 {/* Hero */}
 <div className="animate-fade-in-up mb-2 text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
 <div className="mb-2-content text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
 <h1>
 📰 <span className="text-forest">Activity Feed</span>
 </h1>
 <p className="mb-2-subtitle text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
 Stay up to date with what's happening in the community.
 </p>
 </div>
 </div>

 {/* Tab Bar */}
 <div className="animate-fade-in-up mb-8 flex w-fit gap-1 rounded-lg border border-black/[0.06] bg-black/[0.04] p-[3px]">
 <Link
 href="/feed"
 className={`text-muted hover:text-ink rounded-[calc(var(--radius-lg)-2px)] px-5 py-2 text-[calc(0.9rem*var(--font-scale))] whitespace-nowrap no-underline transition-all hover:bg-black/[0.06] ${activeTab ==="global" ?"!bg-forest font-semibold !text-white shadow-[0_2px_8px_rgba(129,140,248,0.25)]" :""}`}
 >
 🌐 Global
 </Link>
 <Link
 href="/feed?tab=following"
 className={`text-muted hover:text-ink rounded-[calc(var(--radius-lg)-2px)] px-5 py-2 text-[calc(0.9rem*var(--font-scale))] whitespace-nowrap no-underline transition-all hover:bg-black/[0.06] ${activeTab ==="following" ?"!bg-forest font-semibold !text-white shadow-[0_2px_8px_rgba(129,140,248,0.25)]" :""}`}
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
