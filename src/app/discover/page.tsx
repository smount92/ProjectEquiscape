import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import DiscoverGrid from"@/components/DiscoverGrid";

export const metadata = {
 title:"Discover Collectors — Model Horse Hub",
 description:"Browse active collectors in the Model Horse Hub community. Find stables to follow and admire.",
};

export const dynamic ="force-dynamic";

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
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-[0]">
 {/* Hero */}
 <div className="animate-fade-in-up mb-2 text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
 <div className="mb-2-content text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
 <h1>
 👥 <span className="text-forest">Discover Collectors</span>
 </h1>
 <p className="mb-2-subtitle text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
 Find fellow collectors, browse their stables, and connect with the community.
 </p>
 </div>
 <div className="mt-8 flex justify-center gap-8">
 <div className="flex flex-col items-center">
 <span className="items-center-number flex flex-col">{activeUsers.length}</span>
 <span className="items-center-label flex flex-col">Active Collectors</span>
 </div>
 </div>
 </div>

 {/* Client-side searchable grid with tags */}
 <DiscoverGrid users={activeUsers} currentUserId={user.id} followedIds={Array.from(followedIds)} />
 </div>
 );
}
