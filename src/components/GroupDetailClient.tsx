"use client";

import { useState } from"react";
import UniversalFeed from"@/components/UniversalFeed";
import GroupRegistry from"@/components/GroupRegistry";
import GroupFiles from"@/components/GroupFiles";
import GroupAdminPanel from"@/components/GroupAdminPanel";
import GroupBoard from"@/components/groups/GroupBoard";
import type { Group, GroupChannel } from"@/app/actions/groups";
import type { BoardThread } from"@/lib/groups/types";

interface Props {
 group: Group;
 initialPosts: Parameters<typeof UniversalFeed>[0]["initialPosts"];
 channels: GroupChannel[];
 currentUserId: string;
 /**
  * Notice-board data — non-null only when NEXT_PUBLIC_GROUPS_FORUM
  * is on and the server fetched the board. Null renders today's UI
  * untouched, so the forum merges to prod invisibly.
  */
 board?: { threads: BoardThread[]; hasMore: boolean } | null;
}

export default function GroupDetailClient({ group, initialPosts, channels, currentUserId, board = null }: Props) {
 const forumOn = board !== null;
 const [activeTab, setActiveTab] = useState<"board" |"feed" |"files" |"registry">(forumOn ?"board" :"feed");
 const [activeChannel, setActiveChannel] = useState<string | null>(null);

 const isAdmin = group.memberRole ==="owner" || group.memberRole ==="admin";
 const isMod = isAdmin || group.memberRole ==="moderator";

 const tabClass = (tab: string) =>
 `text-muted-foreground hover:text-foreground flex-1 cursor-pointer rounded-md border-none bg-transparent px-4 py-2 text-sm font-semibold transition-all hover:bg-black/[0.05] ${activeTab === tab ?"text-foreground border border-emerald-300 bg-emerald-100/70" :""}`;

 return (
 <>
 {/* Tab Bar */}
 <div className="border-input my-6 flex gap-[2px] rounded-lg border bg-black/[0.03] p-1">
 {forumOn && (
 <button className={tabClass("board")} onClick={() => setActiveTab("board")}>
 📌 Board
 </button>
 )}
 <button className={tabClass("feed")} onClick={() => setActiveTab("feed")}>
 {forumOn ?"💬 Latest" :"💬 Feed"}
 </button>
 <button className={tabClass("files")} onClick={() => setActiveTab("files")}>
 📁 Files
 </button>
 <button className={tabClass("registry")} onClick={() => setActiveTab("registry")}>
 📋 Registry
 </button>
 </div>

 {/* Channel Pills (only on the legacy Feed tab — the Board has its own channel tabs) */}
 {!forumOn && activeTab ==="feed" && channels.length > 1 && (
 <div className="scrollbar-none mb-6 flex gap-1 overflow-x-auto pb-1">
 <button
 className={`border-input text-secondary-foreground hover:text-foreground cursor-pointer rounded-full border bg-black/[0.04] px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all hover:bg-black/[0.06] ${activeChannel === null ?"text-forest border-emerald-400 bg-emerald-100" :""}`}
 onClick={() => setActiveChannel(null)}
 >
 # all
 </button>
 {channels.map((ch) => (
 <button
 key={ch.id}
 className={`border-input text-secondary-foreground hover:text-foreground cursor-pointer rounded-full border bg-black/[0.04] px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all hover:bg-black/[0.06] ${activeChannel === ch.id ?"text-forest border-emerald-400 bg-emerald-100" :""}`}
 onClick={() => setActiveChannel(ch.id)}
 >
 # {ch.name.toLowerCase()}
 </button>
 ))}
 </div>
 )}

 {/* Tab Content */}
 {forumOn && activeTab ==="board" && board && (
 <GroupBoard
 groupId={group.id}
 slug={group.slug}
 channels={channels}
 initialThreads={board.threads}
 initialHasMore={board.hasMore}
 isAdmin={isAdmin}
 />
 )}

 {activeTab ==="feed" && (
 <UniversalFeed
 initialPosts={initialPosts}
 context={{ groupId: group.id }}
 currentUserId={currentUserId}
 showComposer={true}
 composerPlaceholder={
 activeChannel
 ? `Post to #${channels.find((c) => c.id === activeChannel)?.name ||"channel"}…`
 :"Share with the group…"
 }
 label="Group Posts"
 />
 )}

 {activeTab ==="files" && <GroupFiles groupId={group.id} canUpload={isMod} canDelete={isAdmin} />}

 {activeTab ==="registry" && <GroupRegistry groupId={group.id} isMember={group.isMember} />}

 {/* Admin Panel (always visible for admins below content) */}
 {isAdmin && (
 <GroupAdminPanel
 groupId={group.id}
 currentUserId={currentUserId}
 memberRole={group.memberRole ||"member"}
 />
 )}
 </>
 );
}
