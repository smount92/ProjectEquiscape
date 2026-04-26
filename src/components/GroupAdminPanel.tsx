"use client";

import { useState, useEffect, useTransition } from"react";
import { getGroupMembers, updateMemberRole, removeMember, togglePinPost, type GroupMember } from"@/app/actions/groups";

interface Props {
 groupId: string;
 currentUserId: string;
 memberRole: string;
}

const roleBadge = (role: string) => {
 switch (role) {
 case"owner":
 return"👑 Owner";
 case"admin":
 return"⭐ Admin";
 case"moderator":
 return"🛡️ Mod";
 case"judge":
 return"⚖️ Judge";
 default:
 return"👤 Member";
 }
};

export default function GroupAdminPanel({ groupId, currentUserId, memberRole }: Props) {
 const [members, setMembers] = useState<GroupMember[]>([]);
 const [loading, setLoading] = useState(true);
 const [expanded, setExpanded] = useState(false);
 const [isPending, startTransition] = useTransition();

 const isOwner = memberRole ==="owner";
 const isAdmin = memberRole ==="admin" || isOwner;

 useEffect(() => {
 if (!expanded) return;
 setLoading(true);
 getGroupMembers(groupId).then((data) => {
 setMembers(data);
 setLoading(false);
 });
 }, [expanded, groupId]);

 if (!isAdmin) return null;

 const handleRoleChange = (userId: string, newRole:"admin" |"moderator" |"member") => {
 startTransition(async () => {
 const result = await updateMemberRole(groupId, userId, newRole);
 if (result.success) {
 setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m)));
 } else {
 alert(result.error);
 }
 });
 };

 const handleRemove = (userId: string, alias: string) => {
 if (!confirm(`Remove @${alias} from this group?`)) return;
 startTransition(async () => {
 const result = await removeMember(groupId, userId);
 if (result.success) {
 setMembers((prev) => prev.filter((m) => m.userId !== userId));
 } else {
 alert(result.error);
 }
 });
 };

 return (
 <div className="bg-card border-input mt-6 rounded-lg border p-6 shadow-md transition-all">
 <div
 className="flex cursor-pointer items-center justify-between"
 onClick={() => setExpanded(!expanded)}
 >
 <h3 className="text-stone-600 m-0 text-xs font-bold tracking-[0.08em] uppercase">⚙️ Admin Panel</h3>
 <span className="text-stone-500 text-sm">{expanded ?"▲" :"▼"}</span>
 </div>

 {expanded && (
 <div className="mt-4">
 {loading ? (
 <p className="text-stone-500">Loading members…</p>
 ) : (
 <>
 <div className="text-stone-600 mb-2 text-xs">
 👥 {members.length} member{members.length !== 1 ?"s" :""}
 </div>
 <div className="flex flex-col gap-[2px]">
 {members.map((m) => (
 <div
 key={m.userId}
 className="flex items-center justify-between rounded-sm px-1 py-2 transition-colors hover:bg-black/[0.03]"
 >
 <div className="flex items-center gap-2">
 <span className="text-stone-900 text-sm font-semibold">@{m.alias}</span>
 <span className="text-stone-600 text-xs">{roleBadge(m.role)}</span>
 </div>
 {m.userId !== currentUserId && m.role !=="owner" && (
 <div className="flex items-center gap-1">
 {isOwner && (
 <select
 className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-xs min-h-0 py-1 pl-2 pr-7"
 value={m.role}
 onChange={(e) =>
 handleRoleChange(
 m.userId,
 e.target.value as"admin" |"moderator" |"member",
 )
 }
 disabled={isPending}
 title={`Role for ${m.alias}`}
 >
 <option value="member">Member</option>
 <option value="moderator">Moderator</option>
 <option value="admin">Admin</option>
 </select>
 )}
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-red-700 no-underline transition-all"
 onClick={() => handleRemove(m.userId, m.alias)}
 disabled={isPending}
 title="Remove member"
 >
 ✕
 </button>
 </div>
 )}
 </div>
 ))}
 </div>
 </>
 )}
 </div>
 )}
 </div>
 );
}

/** Pin/Unpin button for individual posts */
export function PinPostButton({ postId, isPinned }: { postId: string; isPinned: boolean }) {
 const [pinned, setPinned] = useState(isPinned);
 const [isPending, startTransition] = useTransition();

 const handleToggle = () => {
 startTransition(async () => {
 const result = await togglePinPost(postId);
 if (result.success) setPinned(!pinned);
 });
 };

 return (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-xs font-semibold text-stone-600 no-underline transition-all"
 onClick={handleToggle}
 disabled={isPending}
 title={pinned ?"Unpin post" :"Pin post"}
 >
 📌 {pinned ?"Unpin" :"Pin"}
 </button>
 );
}
