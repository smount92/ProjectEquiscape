"use client";

import { useState, useRef, useTransition, useCallback, useEffect } from"react";
import { useRouter } from"next/navigation";
import { createPost, replyToPost, deletePost, updatePost, togglePostLike, getPosts } from"@/app/actions/posts";
import type { Post } from"@/app/actions/posts";
import { createClient } from"@/lib/supabase/client";
import RichText from"@/components/RichText";
import { safeUUID } from"@/lib/utils/uuid";
import { PostHeader, HorseEmbedCard, ReactionBar, ReplyComposer } from"@/components/social";

// ============================================================
// UNIVERSAL FEED — renders posts for ANY context
// Replaces: ActivityFeed, FeedComposeBar, LoadMoreFeed,
// GroupFeed, CommentSection, EventCommentSection
// ============================================================

interface UniversalFeedProps {
 initialPosts: Post[];
 context: { horseId?: string; groupId?: string; eventId?: string; globalFeed?: boolean };
 currentUserId: string;
 currentUserAlias?: string;
 currentUserAvatar?: string | null;
 showComposer?: boolean;
 composerPlaceholder?: string;
 /** Label override — e.g."Comments" vs"Posts" vs"Discussion" */
 label?: string;
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
 return new Date(dateStr).toLocaleDateString("en-US", { month:"short", day:"numeric" });
}

export default function UniversalFeed({
 initialPosts,
 context,
 currentUserId,
 currentUserAlias = "You",
 currentUserAvatar = null,
 showComposer = true,
 composerPlaceholder ="Share an update…",
 label ="Posts",
}: UniversalFeedProps) {
 const router = useRouter();
 const [posts, setPosts] = useState(initialPosts);
 const [composerText, setComposerText] = useState("");
 const [imageFiles, setImageFiles] = useState<File[]>([]);
 const [imagePreviews, setImagePreviews] = useState<string[]>([]);
 const [isPosting, setIsPosting] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [hasMore, setHasMore] = useState(initialPosts.length >= 25);
 const [isLoadingMore, setIsLoadingMore] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const sentinelRef = useRef<HTMLDivElement>(null);

 // ── Infinite Scroll ──
 const loadMore = useCallback(async () => {
 if (isLoadingMore || !hasMore || posts.length === 0) return;
 setIsLoadingMore(true);
 const lastCreatedAt = posts[posts.length - 1].createdAt;
 const morePosts = await getPosts(context, { cursor: lastCreatedAt, includeReplies: true });
 if (morePosts.length === 0) {
 setHasMore(false);
 } else {
 setPosts((prev) => [...prev, ...morePosts]);
 if (morePosts.length < 25) setHasMore(false);
 }
 setIsLoadingMore(false);
 }, [isLoadingMore, hasMore, posts, context]);

 useEffect(() => {
 if (!sentinelRef.current || !hasMore) return;
 const observer = new IntersectionObserver(
 (entries) => {
 if (entries[0].isIntersecting) loadMore();
 },
 { rootMargin:"200px" },
 );
 observer.observe(sentinelRef.current);
 return () => observer.disconnect();
 }, [loadMore, hasMore]);

 // ── Image Select ──
 const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = Array.from(e.target.files || []).slice(0, 4 - imageFiles.length);
 if (files.length === 0) return;
 const newFiles = [...imageFiles, ...files].slice(0, 4);
 setImageFiles(newFiles);
 const newPreviews: string[] = [];
 newFiles.forEach((file) => {
 const reader = new FileReader();
 reader.onload = (ev) => {
 newPreviews.push(ev.target?.result as string);
 if (newPreviews.length === newFiles.length) setImagePreviews(newPreviews);
 };
 reader.readAsDataURL(file);
 });
 if (fileInputRef.current) fileInputRef.current.value ="";
 };

 const removeImage = (index: number) => {
 setImageFiles((prev) => prev.filter((_, i) => i !== index));
 setImagePreviews((prev) => prev.filter((_, i) => i !== index));
 };

 // ── Post ──
 const handlePost = async () => {
 if (!composerText.trim() && imageFiles.length === 0) return;
 setIsPosting(true);
 setError(null);
 try {
 // Upload images first
 let uploadedPaths: string[] = [];
 if (imageFiles.length > 0) {
 const supabase = createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) {
 setError("Not authenticated.");
 setIsPosting(false);
 return;
 }
 for (const file of imageFiles) {
 const ext = file.name.split(".").pop() ||"webp";
 const path = `social/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
 const { error: uploadErr } = await supabase.storage
 .from("horse-images")
 .upload(path, file, { contentType: file.type });
 if (uploadErr) {
 setError(`Upload failed: ${uploadErr.message}`);
 setIsPosting(false);
 return;
 }
 uploadedPaths.push(path);
 }
 }

 const result = await createPost({
 content: composerText.trim(),
 ...context,
 imagePaths: uploadedPaths.length > 0 ? uploadedPaths : undefined,
 });

 if (result.success) {
 // Optimistic add
 setPosts((prev) => [
 {
 id: result.postId || safeUUID(),
 authorId: currentUserId,
 authorAlias:"You",
 authorAvatarUrl: null,
 content: composerText.trim(),
 parentId: null,
 horseId: context.horseId || null,
 groupId: context.groupId || null,
 eventId: context.eventId || null,
 studioId: null,
 helpRequestId: null,
 likesCount: 0,
 repliesCount: 0,
 isPinned: false,
 createdAt: new Date().toISOString(),
 updatedAt: null,
 media: imagePreviews.map((url, i) => ({ id: `temp-${i}`, imageUrl: url, caption: null })),
 isLikedByMe: false,
 replies: [],
 },
 ...prev,
 ]);
 setComposerText("");
 setImageFiles([]);
 setImagePreviews([]);
 router.refresh();
 } else {
 setError(result.error ||"Failed to post.");
 }
 } catch {
 setError("Something went wrong.");
 }
 setIsPosting(false);
 };

 return (
 <div className="mt-6 rounded-lg border border-edge bg-card p-6 shadow-md transition-all">
 <h3 className="mb-4">
 💬 {label} ({posts.length}
 {hasMore ?"+" :""})
 </h3>

 {/* ── Composer ── */}
 {showComposer && (
 <div className="mb-6 rounded-lg border border-edge bg-parchment p-4">
 <textarea
 className="w-full min-h-[100px] resize-y rounded-md border border-edge bg-transparent px-4 py-3 text-sm no-underline transition-all focus:border-forest focus:outline-none"
 placeholder={composerPlaceholder}
 value={composerText}
 onChange={(e) => setComposerText(e.target.value)}
 maxLength={2000}
 rows={2}
 id="universal-compose-input"
 />
 {imagePreviews.length > 0 && (
 <div
 className="mt-2 grid max-h-[150] gap-[4px] overflow-hidden rounded-md"
 data-count={imagePreviews.length}
 >
 {imagePreviews.map((preview, i) => (
 <div key={i} className="relative">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={preview} alt={`Preview ${i + 1}`} className="max-h-[150]" />
 <button
 onClick={() => removeImage(i)}
 className="absolute top-1 right-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-0 bg-black/60 text-xs leading-5 text-white"
 aria-label="Remove image"
 >
 ✕
 </button>
 </div>
 ))}
 </div>
 )}
 <div className="flex flex-wrap items-center justify-between gap-2">
 <div className="flex items-center gap-2">
 <button
 type="button"
 className="inline-flex min-h-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-2 py-1 text-sm font-semibold text-muted-foreground no-underline transition-all"
 onClick={() => fileInputRef.current?.click()}
 disabled={imageFiles.length >= 4}
 title="Attach images (up to 4)"
 >
 📷 {imageFiles.length > 0 ? `(${imageFiles.length}/4)` :""}
 </button>
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 multiple
 onChange={handleImageSelect}
 className="hidden"
 aria-label="Upload images"
 />
 <span className="text-muted-foreground font-medium text-xs">{composerText.length}/2000</span>
 </div>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 onClick={handlePost}
 disabled={isPosting || (!composerText.trim() && imageFiles.length === 0)}
 >
 {isPosting ?"Posting…" :"📝 Post"}
 </button>
 </div>
 {error && (
 <p className="text-red-700 mt-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm">
 {error}
 </p>
 )}
 </div>
 )}

 {/* ── Post List ── */}
 {posts.length === 0 ? (
 <p className="text-muted-foreground font-medium my-4">No {label.toLowerCase()} yet — be the first!</p>
 ) : (
 <div className="flex flex-col gap-5">
 {posts.map((post) => (
 <PostCard key={post.id} post={post} currentUserId={currentUserId} currentUserAlias={currentUserAlias} currentUserAvatar={currentUserAvatar} />
 ))}
 </div>
 )}

 {/* ── Load More Sentinel ── */}
 {hasMore && <div ref={sentinelRef} className="h-[1]" />}
 {isLoadingMore && (
 <p className="text-muted-foreground mt-4 text-center">
 Loading more…
 </p>
 )}
 </div>
 );
}

// ============================================================
// POST CARD — renders a single post + replies
// ============================================================

function PostCard({ post, currentUserId, currentUserAlias, currentUserAvatar }: { post: Post; currentUserId: string; currentUserAlias: string; currentUserAvatar: string | null }) {
 const router = useRouter();
 const [showReplies, setShowReplies] = useState(false);
 const [showAllReplies, setShowAllReplies] = useState(false);
 const [replies, setReplies] = useState(post.replies);
 const [isPending, startTransition] = useTransition();
 const [isEditing, setIsEditing] = useState(false);
 const [editText, setEditText] = useState(post.content);
 const [displayContent, setDisplayContent] = useState(post.content);
 const [wasEdited, setWasEdited] = useState(!!post.updatedAt && post.updatedAt !== post.createdAt);

 const handleReply = async (content: string) => {
 startTransition(async () => {
 const result = await replyToPost(post.id, content);
 if (result.success) {
 setReplies((prev) => [
 ...prev,
 {
 id: safeUUID(),
 authorId: currentUserId,
 authorAlias: currentUserAlias,
 authorAvatarUrl: currentUserAvatar,
 content,
 parentId: post.id,
 horseId: null,
 groupId: null,
 eventId: null,
 studioId: null,
 helpRequestId: null,
 likesCount: 0,
 repliesCount: 0,
 isPinned: false,
 createdAt: new Date().toISOString(),
 updatedAt: null,
 media: [],
 isLikedByMe: false,
 replies: [],
 },
 ]);
 router.refresh();
 }
 });
 };

 const handleDelete = () => {
 if (!confirm("Delete this post?")) return;
 startTransition(async () => {
 await deletePost(post.id);
 router.refresh();
 });
 };

 const handleEdit = () => {
 startTransition(async () => {
 const result = await updatePost(post.id, editText.trim());
 if (result.success) {
 setDisplayContent(editText.trim());
 setIsEditing(false);
 setWasEdited(true);
 router.refresh();
 }
 });
 };

 // Extract horse UUID from post content for rich embed card
 const horseMatch = post.content.match(/\/community\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
 const embedHorseId = horseMatch ? horseMatch[1] : null;

 // Reply collapse: show first 2 if >3 replies
 const visibleReplies = replies.length > 3 && !showAllReplies ? replies.slice(0, 2) : replies;
 const hiddenCount = replies.length - 2;

 return (
 <div className={`border-b border-edge pb-3 ${post.isPinned ? "border-l-4 border-l-amber-400 bg-amber-50/30 pl-4" : ""}`}>
 {post.isPinned && (
 <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-amber-600">📌 Pinned</span>
 )}
 {/* Header with avatar */}
 <PostHeader
 avatarUrl={post.authorAvatarUrl}
 alias={post.authorAlias}
 avatarSize="md"
 createdAt={post.createdAt}
 isEdited={wasEdited}
 permalink={`/feed/${post.id}`}
 actions={post.authorId === currentUserId ? (
 <>
 <button
 className="inline-flex min-h-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-xs font-semibold text-muted-foreground no-underline transition-all hover:bg-parchment"
 onClick={() => {
 setIsEditing(!isEditing);
 setEditText(displayContent);
 }}
 disabled={isPending}
 >
 ✏️
 </button>
 <button
 className="inline-flex min-h-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-xs font-semibold text-muted-foreground no-underline transition-all hover:bg-parchment"
 onClick={handleDelete}
 disabled={isPending}
 >
 🗑️
 </button>
 </>
 ) : undefined}
 />

 {/* Content */}
 <div className="mt-1 pl-10">
 {isEditing ? (
 <div className="flex flex-col gap-1">
 <textarea
 className="min-h-[36px] w-full resize-y rounded-md border border-edge bg-transparent px-4 py-2 text-sm no-underline transition-all"
 value={editText}
 onChange={(e) => setEditText(e.target.value)}
 rows={3}
 maxLength={2000}
 aria-label="Edit post content"
 />
 <div className="flex gap-1">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 onClick={handleEdit}
 disabled={isPending || !editText.trim()}
 >
 {isPending ?"Saving…" :"Save"}
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-muted-foreground no-underline transition-all"
 onClick={() => setIsEditing(false)}
 >
 Cancel
 </button>
 </div>
 </div>
 ) : (
 <RichText content={displayContent} />
 )}

 {/* Rich horse embed card */}
 {embedHorseId && <HorseEmbedCard horseId={embedHorseId} />}
 </div>

 {/* Media Collage */}
 {post.media.length > 0 && (
 <div
 className="mt-2 grid gap-[4px] overflow-hidden rounded-md pl-10"
 data-count={Math.min(post.media.length, 4)}
 >
 {post.media.slice(0, 4).map((m, i) => (
 // eslint-disable-next-line @next/next/no-img-element
 <img key={m.id || i} src={m.imageUrl} alt={m.caption || `Image ${i + 1}`} loading="lazy" />
 ))}
 </div>
 )}

 {/* Actions: Like + Reply toggle */}
 <div className="pl-10">
 <ReactionBar
 isLiked={post.isLikedByMe}
 likeCount={post.likesCount}
 onToggle={() => togglePostLike(post.id)}
 replyCount={post.repliesCount}
 onReplyToggle={() => setShowReplies(!showReplies)}
 isReplyOpen={showReplies}
 />
 </div>

 {/* Replies */}
 {showReplies && (
 <div className="mt-3 ml-10 border-l-2 border-[#E0D5C1]/60 pl-4">
 {visibleReplies.map((r) => (
 <div key={r.id} className="mb-3">
 <PostHeader
 avatarUrl={r.authorAvatarUrl}
 alias={r.authorAlias}
 createdAt={r.createdAt}
 avatarSize="xs"
 actions={r.authorId === currentUserId ? (
 <button
 className="inline-flex min-h-0 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground no-underline transition-all hover:bg-parchment"
 onClick={() => {
 if (!confirm("Delete this reply?")) return;
 startTransition(async () => {
 await deletePost(r.id);
 setReplies((prev) => prev.filter((reply) => reply.id !== r.id));
 router.refresh();
 });
 }}
 disabled={isPending}
 >
 🗑️
 </button>
 ) : undefined}
 />
 <div className="mt-0.5 pl-8">
 <RichText content={r.content} />
 </div>
 </div>
 ))}
 {replies.length > 3 && !showAllReplies && (
 <button
 className="mb-2 cursor-pointer text-sm font-medium text-forest hover:underline"
 onClick={() => setShowAllReplies(true)}
 >
 Show {hiddenCount} more {hiddenCount === 1 ? "reply" : "replies"}
 </button>
 )}
 {/* Reply composer */}
 <ReplyComposer
 currentUserAvatar={currentUserAvatar}
 currentUserAlias={currentUserAlias}
 onSubmit={handleReply}
 isPending={isPending}
 />
 </div>
 )}
 </div>
 );
}
