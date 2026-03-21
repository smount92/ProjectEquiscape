"use client";

import { useState } from"react";
import UniversalFeed from"@/components/UniversalFeed";
import GroupRegistry from"@/components/GroupRegistry";
import GroupFiles from"@/components/GroupFiles";
import GroupAdminPanel from"@/components/GroupAdminPanel";
import type { Group, GroupChannel } from"@/app/actions/groups";

interface Props {
 group: Group;
 initialPosts: Parameters<typeof UniversalFeed>[0]["initialPosts"];
 channels: GroupChannel[];
 currentUserId: string;
}

export default function GroupDetailClient({ group, initialPosts, channels, currentUserId }: Props) {
 const [activeTab, setActiveTab] = useState<"feed" |"files" |"registry">("feed");
 const [activeChannel, setActiveChannel] = useState<string | null>(null);

 const isAdmin = group.memberRole ==="owner" || group.memberRole ==="admin";
 const isMod = isAdmin || group.memberRole ==="moderator";

 return (
 <>
 {/* Tab Bar */}
 <div className="border-edge my-6 flex gap-[2px] rounded-lg border bg-black/[0.03] p-1">
 <button
 className={`text-muted hover:text-ink flex-1 cursor-pointer rounded-md border-none bg-transparent px-4 py-2 text-sm font-semibold transition-all hover:bg-black/[0.05] ${activeTab ==="feed" ?"text-ink border border-[rgba(44,85,69,0.3)] bg-[rgba(44,85,69,0.12)]" :""}`}
 onClick={() => setActiveTab("feed")}
 >
 💬 Feed
 </button>
 <button
 className={`text-muted hover:text-ink flex-1 cursor-pointer rounded-md border-none bg-transparent px-4 py-2 text-sm font-semibold transition-all hover:bg-black/[0.05] ${activeTab ==="files" ?"text-ink border border-[rgba(44,85,69,0.3)] bg-[rgba(44,85,69,0.12)]" :""}`}
 onClick={() => setActiveTab("files")}
 >
 📁 Files
 </button>
 <button
 className={`text-muted hover:text-ink flex-1 cursor-pointer rounded-md border-none bg-transparent px-4 py-2 text-sm font-semibold transition-all hover:bg-black/[0.05] ${activeTab ==="registry" ?"text-ink border border-[rgba(44,85,69,0.3)] bg-[rgba(44,85,69,0.12)]" :""}`}
 onClick={() => setActiveTab("registry")}
 >
 📋 Registry
 </button>
 </div>

 {/* Channel Pills (only on Feed tab) */}
 {activeTab ==="feed" && channels.length > 1 && (
 <div className="scrollbar-none mb-6 flex gap-1 overflow-x-auto pb-1">
 <button
 className={`border-edge text-muted hover:text-ink cursor-pointer rounded-full border bg-black/[0.04] px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all hover:bg-black/[0.06] ${activeChannel === null ?"text-forest border-[rgba(44,85,69,0.4)] bg-[rgba(44,85,69,0.15)]" :""}`}
 onClick={() => setActiveChannel(null)}
 >
 # all
 </button>
 {channels.map((ch) => (
 <button
 key={ch.id}
 className={`border-edge text-muted hover:text-ink cursor-pointer rounded-full border bg-black/[0.04] px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all hover:bg-black/[0.06] ${activeChannel === ch.id ?"text-forest border-[rgba(44,85,69,0.4)] bg-[rgba(44,85,69,0.15)]" :""}`}
 onClick={() => setActiveChannel(ch.id)}
 >
 # {ch.name.toLowerCase()}
 </button>
 ))}
 </div>
 )}

 {/* Tab Content */}
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
