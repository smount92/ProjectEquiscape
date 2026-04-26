import { createClient } from"@/lib/supabase/server";
import { redirect, notFound } from"next/navigation";
import Link from"next/link";
import { getGroup, getGroupChannels } from"@/app/actions/groups";
import { GROUP_TYPE_LABELS } from"@/lib/constants/groups";
import { getPosts } from"@/app/actions/posts";
import GroupDetailClient from"@/components/GroupDetailClient";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";


export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 const group = await getGroup(slug);
 return {
 title: group ? `${group.name} — Model Horse Hub` :"Group Not Found",
 description: group?.description ||"Model Horse Hub group",
 };
}

export default async function GroupDetailPage({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) redirect("/login");

 const group = await getGroup(slug);
 if (!group) notFound();

 const [posts, channels] = await Promise.all([
 group.isMember ? getPosts({ groupId: group.id }, { includeReplies: true }) : Promise.resolve([]),
 group.isMember ? getGroupChannels(group.id) : Promise.resolve([]),
 ]);

 return (
 <ExplorerLayout title={group.name} description={<>{GROUP_TYPE_LABELS[group.groupType] || group.groupType}{group.region && <> · 📍 {group.region}</>} · 👥 {group.memberCount} member{group.memberCount !== 1 ?"s" :""}</>}>
 <div className="mx-auto max-w-6xl px-6">
 {/* Group Header */}
 <div className="border-input mb-6 border-b pb-6">
 <Link
 href="/community/groups"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 >
 ← All Groups
 </Link>
 <h1>{group.name}</h1>
 <div
 className="text-stone-500 mt-2 flex flex-wrap gap-4 text-sm"
 >
 <span>{GROUP_TYPE_LABELS[group.groupType] || group.groupType}</span>
 {group.region && <span>📍 {group.region}</span>}
 <span>
 👥 {group.memberCount} member{group.memberCount !== 1 ?"s" :""}
 </span>
 <span>Created by @{group.creatorAlias}</span>
 </div>
 {group.description && <p className="mt-4 leading-[1.6]">{group.description}</p>}
 </div>

 {/* Content */}
 {group.isMember ? (
 <GroupDetailClient group={group} initialPosts={posts} channels={channels} currentUserId={user.id} />
 ) : (
 <div className="flex flex-col items-center justify-center rounded-lg border border-input bg-card p-8 text-center shadow-sm mt-8">
 <p>Join this group to see posts and participate.</p>
 </div>
 )}
 </div>
  </ExplorerLayout>
 );
}
