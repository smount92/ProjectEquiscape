import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import DiscoverGrid from"@/components/DiscoverGrid";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import PageMasthead from"@/components/layouts/PageMasthead";
import { resolveAvatarUrls } from"@/lib/utils/avatars.server";

export const metadata = {
 title:"Discover Collectors",
 description:"Browse active collectors in the Model Horse Hub community. Find stables to follow and admire.",
};

// Mirrors /catalog's page-param pagination (src/lib/catalog/filterParams.ts).
const PAGE_SIZE = 48;

function parsePage(params: Record<string, string | string[] | undefined>): number {
 const raw = Array.isArray(params.page) ? params.page[0] : params.page;
 const n = Number.parseInt(raw ?? "", 10);
 if (!Number.isFinite(n) || n < 1) return 1;
 return Math.min(n, 10_000);
}

function pageHref(page: number): string {
 return page > 1 ? `/discover?page=${page}` : "/discover";
}

export default async function DiscoverPage({
 searchParams,
}: {
 searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();

 if (!user) redirect("/login");

 const page = parsePage(await searchParams);
 const from = (page - 1) * PAGE_SIZE;
 const to = from + PAGE_SIZE - 1;

 // Fetch aggregated data from the PostgreSQL View (now includes bio + has_studio).
 // Explicit columns (not "*") + estimated count + range(): bounds the query to
 // one page instead of an unbounded select capped silently at 1000 rows.
 const { data: activeUsersView, count } = await supabase
 .from("discover_users_view")
 .select(
 "id, alias_name, created_at, avatar_url, bio, public_horse_count, total_horse_count, avg_rating, rating_count, has_studio",
 { count: "estimated" },
 )
 .order("created_at", { ascending: false })
 .range(from, to);

 const activeUsers = (activeUsersView || []) as {
 id: string;
 alias_name: string;
 created_at: string;
 avatar_url: string | null;
 bio: string | null;
 public_horse_count: number;
 total_horse_count: number;
 avg_rating: number;
 rating_count: number;
 has_studio: boolean;
 }[];

 const total = count ?? activeUsers.length;
 const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

 // Resolve avatar storage paths to signed URLs (batch) — only for this page's rows.
 const avatarUrlMap = await resolveAvatarUrls(activeUsers.map(u => u.avatar_url));
 for (const u of activeUsers) {
 if (u.avatar_url) {
 u.avatar_url = avatarUrlMap.get(u.avatar_url) || u.avatar_url;
 }
 }

 // Batch-fetch which users the current user follows
 const userIds = activeUsers.map((u) => u.id).filter((id) => id !== user.id);
 const { data: followRows } =
 userIds.length > 0
 ? await supabase
 .from("user_follows")
 .select("following_id")
 .eq("follower_id", user.id)
 .in("following_id", userIds)
 : { data: [] };
 const followedIds = new Set((followRows ?? []).map((r: { following_id: string }) => r.following_id));

 return (
 <ExplorerLayout noHeader>
  <PageMasthead
   icon="👥"
   title="Discover Collectors"
   subtitle="Find fellow collectors and browse their stables"
  />
  <div className="mb-6 flex items-baseline gap-2">
  <span className="text-2xl font-bold text-forest">{total}</span>
  <span className="text-sm font-medium text-secondary-foreground">Active Collectors</span>
  </div>
  <DiscoverGrid users={activeUsers} currentUserId={user.id} followedIds={Array.from(followedIds)} />

  {/* Pagination — plain anchor links (SEO-crawlable, no client JS), mirrors /catalog */}
  {totalPages > 1 && (
  <nav className="mt-6 flex items-center justify-center gap-4" aria-label="Discover pagination">
   {page > 1 ? (
   <Link href={pageHref(page - 1)} className="btn-ghostleather !px-4 !py-2 !text-xs" rel="prev">
    ← Previous
   </Link>
   ) : (
   <span className="px-4 py-2 text-xs text-muted-foreground opacity-40">← Previous</span>
   )}
   <span className="text-sm text-muted-foreground">
   Page {page} of {totalPages.toLocaleString()}
   </span>
   {page < totalPages ? (
   <Link href={pageHref(page + 1)} className="btn-ghostleather !px-4 !py-2 !text-xs" rel="next">
    Next →
   </Link>
   ) : (
   <span className="px-4 py-2 text-xs text-muted-foreground opacity-40">Next →</span>
   )}
  </nav>
  )}
 </ExplorerLayout>
 );
}
