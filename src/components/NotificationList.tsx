"use client";

import { useState } from"react";
import Link from"next/link";
import { markNotificationRead, markAllNotificationsRead, clearNotifications } from"@/app/actions/notifications";

interface NotifItem {
 id: string;
 type: string;
 content: string | null;
 actorAlias: string | null;
 horseId: string | null;
 conversationId: string | null;
 linkUrl: string | null;
 isRead: boolean;
 createdAt: string;
}

function getNotifIcon(type: string): string {
 switch (type) {
 case"favorite":
 return"❤️";
 case"comment":
 return"💬";
 case"rating":
 return"⭐";
 case"follow":
 return"👤";
 case"message":
 return"✉️";
 case"feature":
 return"🌟";
 case"wishlist_match":
 return"❤️‍🔥";
 case"show_vote":
 return"📸";
 case"show_result":
 return"🏆";
 case"judge_assigned":
 return"🏅";
 case"achievement":
 return"🏆";
 default:
 return"🔔";
 }
}

function getNotifLink(n: NotifItem): string {
 // 1. Explicit deep-link URL — highest priority
 if (n.linkUrl) return n.linkUrl;
 // 2. Horse-related → horse passport
 if (n.horseId) return `/community/${n.horseId}`;
 // 3. Conversation → inbox thread
 if (n.conversationId) return `/inbox/${n.conversationId}`;
 // 4. Follow → actor's profile (correct destination for follows)
 if (n.type ==="follow" && n.actorAlias) return `/profile/${encodeURIComponent(n.actorAlias)}`;
 // 5. Show-related types → shows listing page as fallback
 if (["show_result","show_vote","judge_assigned"].includes(n.type)) return"/shows";
 // 6. Actor profile as last resort
 if (n.actorAlias) return `/profile/${encodeURIComponent(n.actorAlias)}`;
 return"/notifications";
}

function timeAgo(dateStr: string): string {
 const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
 if (seconds < 60) return"Just now";
 const minutes = Math.floor(seconds / 60);
 if (minutes < 60) return `${minutes}m ago`;
 const hours = Math.floor(minutes / 60);
 if (hours < 24) return `${hours}h ago`;
 const days = Math.floor(hours / 24);
 if (days < 30) return `${days}d ago`;
 return new Date(dateStr).toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 });
}

interface NotificationListProps {
 initialNotifications: NotifItem[];
}

export default function NotificationList({ initialNotifications }: NotificationListProps) {
 const [notifs, setNotifs] = useState(initialNotifications);
 const [clearing, setClearing] = useState(false);

 const handleMarkAllRead = async () => {
 await markAllNotificationsRead();
 setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
 };

 const handleClear = async () => {
 setClearing(true);
 await clearNotifications();
 setNotifs([]);
 setClearing(false);
 };

 const handleClick = async (id: string) => {
 await markNotificationRead(id);
 setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
 };

 const unreadCount = notifs.filter((n) => !n.isRead).length;

 return (
 <div>
 {/* Actions Bar */}
 {notifs.length > 0 && (
 <div className="border-input mb-6 flex gap-2 border-b pb-2">
 {unreadCount > 0 && (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-secondary-foreground no-underline transition-all"
 onClick={handleMarkAllRead}
 >
 ✓ Mark All Read
 </button>
 )}
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-muted-foreground no-underline transition-all"
 onClick={handleClear}
 disabled={clearing}
 >
 {clearing ?"Clearing…" :"🗑️ Clear All"}
 </button>
 </div>
 )}

 {/* List */}
 {notifs.length === 0 ? (
 <div className="bg-card border-input animate-fade-in-up rounded-lg border px-8 py-12 text-center shadow-md transition-all">
 <div className="mb-4 text-5xl">🔔</div>
 <h2>All Caught Up!</h2>
 <p>No notifications yet. Activity from the community will appear here.</p>
 </div>
 ) : (
 <div className="flex flex-col">
 {notifs.map((n) => (
 <Link
 key={n.id}
 href={getNotifLink(n)}
 className={`border-input flex items-center gap-4 border-b px-6 py-4 text-inherit no-underline transition-colors hover:bg-black/[0.03] ${n.isRead ?"" :"bg-indigo-50/40"}`}
 onClick={() => handleClick(n.id)}
 >
 <span className="shrink-0 text-xl">
 {getNotifIcon(n.type)}
 </span>
 <div className="flex min-w-0 flex-1 flex-col gap-0.5">
 <span className="text-sm">
 {n.content ||"New notification"}
 </span>
 <span className="text-muted-foreground text-xs">
 {timeAgo(n.createdAt)}
 </span>
 </div>
 {!n.isRead && <span className="bg-forest h-2 w-2 shrink-0 rounded-full" />}
 </Link>
 ))}
 </div>
 )}
 </div>
 );
}
