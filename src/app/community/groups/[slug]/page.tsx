import { createClient } from"@/lib/supabase/server";
import { redirect, notFound } from"next/navigation";
import Link from"next/link";
import { getGroup, getGroupChannels } from"@/app/actions/groups";
import { getGroupBoard } from"@/app/actions/groups-forum";
import { groupsForumEnabled } from"@/lib/groups/flags";
import { GROUP_TYPE_LABELS } from"@/lib/constants/groups";
import { getPosts } from"@/app/actions/posts";
import GroupDetailClient from"@/components/GroupDetailClient";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import { Button } from "@/components/ui/button";


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

 const forumOn = groupsForumEnabled();
 const [posts, channels, boardResult] = await Promise.all([
 group.isMember ? getPosts({ groupId: group.id }, { includeReplies: true }) : Promise.resolve([]),
 group.isMember ? getGroupChannels(group.id) : Promise.resolve([]),
 forumOn && group.isMember ? getGroupBoard({ groupId: group.id }) : Promise.resolve(null),
 ]);
 // Board failure (e.g. migration 122 not applied yet) falls back to
 // the legacy feed UI instead of breaking the page.
 const board = boardResult && boardResult.success
 ? { threads: boardResult.threads, hasMore: boardResult.hasMore }
 : null;

 return (
 <ExplorerLayout title={group.name} description={<>{GROUP_TYPE_LABELS[group.groupType] || group.groupType}{group.region && <> · 📍 {group.region}</>} · 👥 {group.memberCount} member{group.memberCount !== 1 ?"s" :""}</>}>
 <div className="mx-auto max-w-6xl px-6">
 {/* Group Header */}
 <div className="border-input mb-6 border-b pb-6">
 <Button asChild variant="outline" size="wide"><Link
 href="/community/groups"
 >
 ← All Groups
 </Link></Button>
 <h1>{group.name}</h1>
 <div
 className="text-muted-foreground mt-2 flex flex-wrap gap-4 text-sm"
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
 <GroupDetailClient group={group} initialPosts={posts} channels={channels} currentUserId={user.id} board={board} />
 ) : (
 <div className="flex flex-col items-center justify-center rounded-lg border border-input bg-card p-8 text-center shadow-sm mt-8">
 <p>Join this group to see posts and participate.</p>
 </div>
 )}
 </div>
  </ExplorerLayout>
 );
}
