"use client";

import Link from"next/link";
import { useRouter } from"next/navigation";
import { deleteTextPost } from"@/app/actions/activity";
import { toggleActivityLike } from"@/app/actions/likes";
import RichText from"@/components/RichText";
import LikeToggle from"@/components/LikeToggle";

export interface FeedItemData {
 id: string;
 actorAlias: string;
 actorId: string;
 eventType: string;
 horseId: string | null;
 horseName: string | null;
 thumbnailUrl: string | null;
 metadata: Record<string, unknown> | null;
 createdAt: string;
 likesCount: number;
 isLiked: boolean;
 imageUrls: string[];
}

function getEventIcon(type: string): string {
 switch (type) {
 case"new_horse":
 return"🐴";
 case"favorite":
 return"❤️";
 case"comment":
 return"💬";
 case"rating":
 return"⭐";
 case"follow":
 return"👤";
 case"show_record":
 return"🏆";
 case"transaction_complete":
 return"✅";
 case"text_post":
 return"📝";
 default:
 return"📌";
 }
}

function getEventText(item: FeedItemData): string {
 const who = `@${item.actorAlias}`;
 switch (item.eventType) {
 case"new_horse":
 return `${who} added ${item.horseName ||"a new horse"} to their stable`;
 case"favorite":
 return `${who} ❤️ ${item.horseName ||"a horse"}`;
 case"comment":
 return `${who} commented on ${item.horseName ||"a horse"}`;
 case"rating":
 return `${who} left a rating`;
 case"follow":
 return `${who} followed a collector`;
 case"show_record":
 return `${who} added a show record for ${item.horseName ||"a horse"}`;
 case"transaction_complete":
 return `${who} completed a transaction`;
 case"text_post": {
 const postText = (item.metadata as { text?: string })?.text ||"";
 return `${who}: ${postText.length > 80 ? postText.slice(0, 80) +"…" : postText}`;
 }
 default:
 return `${who} did something`;
 }
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

interface ActivityFeedProps {
 items: FeedItemData[];
 emptyMessage?: string;
 currentUserId?: string;
}

export default function ActivityFeed({ items, emptyMessage, currentUserId }: ActivityFeedProps) {
 const router = useRouter();
 if (items.length === 0) {
 return (
 <div className="bg-card border-edge animate-fade-in-up rounded-lg border px-8 py-12 text-center shadow-md transition-all">
 <div className="mb-4 text-5xl">📰</div>
 <h2>No Activity Yet</h2>
 <p>{emptyMessage ||"Follow some collectors to see their activity here!"}</p>
 </div>
 );
 }

 return (
 <div className="border-edge animate-fade-in-up flex flex-col overflow-hidden rounded-lg border">
 {items.map((item) => {
 const link = item.horseId
 ? `/community/${item.horseId}`
 : item.eventType ==="text_post"
 ? `/feed/${item.id}`
 : `/profile/${encodeURIComponent(item.actorAlias)}`;

 return (
 <div key={item.id} className="activity-feed-item-wrapper">
 <Link
 href={link}
 className="border-edge flex items-center gap-4 border-b px-6 py-4 text-inherit no-underline transition-colors last:border-b-0 hover:bg-black/[0.03]"
 >
 {item.thumbnailUrl ? (
 <div className="h-[48px] w-[48px] shrink-0 overflow-hidden rounded-md">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={item.thumbnailUrl} alt="" loading="lazy" />
 </div>
 ) : (
 <span className="shrink-0 text-[calc(1.2rem*var(--font-scale))]">
 {getEventIcon(item.eventType)}
 </span>
 )}
 <div className="flex min-w-0 flex-1 flex-col gap-0.5">
 {item.eventType ==="text_post" ? (
 <>
 <span className="text-[calc(0.9rem*var(--font-scale))] font-semibold">
 @{item.actorAlias}
 </span>
 <div className="text-ink py-1 text-base leading-relaxed whitespace-pre-wrap [&_p]:m-0">
 <RichText content={(item.metadata as { text?: string })?.text ||""} />
 </div>
 {/* Image collage for casual image posts */}
 {item.imageUrls && item.imageUrls.length > 0 && (
 <div
 className="mt-2 grid gap-[4px] overflow-hidden rounded-md"
 data-count={Math.min(item.imageUrls.length, 4)}
 >
 {item.imageUrls.slice(0, 4).map((url, i) => (
 // eslint-disable-next-line @next/next/no-img-element
 <img key={i} src={url} alt={`Post image ${i + 1}`} loading="lazy" />
 ))}
 </div>
 )}
 <span className="text-muted text-[calc(0.75rem*var(--font-scale))]">
 {timeAgo(item.createdAt)}
 </span>
 </>
 ) : (
 <>
 <span className="text-[calc(0.9rem*var(--font-scale))]">
 {getEventText(item)}
 </span>
 <span className="text-muted text-[calc(0.75rem*var(--font-scale))]">
 {timeAgo(item.createdAt)}
 </span>
 </>
 )}
 </div>
 </Link>
 {/* Action row: Like + Delete (outside the Link to avoid navigation) */}
 <div className="mt-1 flex items-center gap-2">
 {currentUserId && (
 <LikeToggle
 initialLiked={item.isLiked}
 initialCount={item.likesCount}
 onToggle={() => toggleActivityLike(item.id)}
 />
 )}
 {currentUserId && currentUserId === item.actorId && item.eventType ==="text_post" && (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 style={{ padding:"2px 6px", fontSize:"0.8rem" }}
 onClick={() => {
 if (confirm("Delete post?")) {
 deleteTextPost(item.id).then(() => router.refresh());
 }
 }}
 >
 🗑️
 </button>
 )}
 </div>
 </div>
 );
 })}
 </div>
 );
}
