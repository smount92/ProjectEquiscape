import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import DiscoverGrid from"@/components/DiscoverGrid";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";

export const metadata = {
 title:"Discover Collectors — Model Horse Hub",
 description:"Browse active collectors in the Model Horse Hub community. Find stables to follow and admire.",
};


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
 const { data: signedAvatar } = await supabase.storage.from("avatars").createSignedUrl(u.avatar_url, 3600);
 u.avatar_url = signedAvatar?.signedUrl || null;
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
 <ExplorerLayout
  title={<>👥 <span className="text-forest">Discover Collectors</span></>}
  description="Find fellow collectors, browse their stables, and connect with the community."
 >
  <div className="mb-6 flex items-baseline gap-2">
  <span className="text-2xl font-bold text-forest">{activeUsers.length}</span>
  <span className="text-sm font-medium text-ink-light">Active Collectors</span>
  </div>
  <DiscoverGrid users={activeUsers} currentUserId={user.id} followedIds={Array.from(followedIds)} />
 </ExplorerLayout>
 );
}
