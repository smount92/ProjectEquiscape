"use client";

import { useState, useRef, useTransition, useCallback, useEffect } from"react";
import { useRouter } from"next/navigation";
import { createPost, replyToPost, deletePost, updatePost, togglePostLike, getPosts } from"@/app/actions/posts";
import type { Post } from"@/app/actions/posts";
import { createClient } from"@/lib/supabase/client";
import RichText from"@/components/RichText";
import { safeUUID } from"@/lib/utils/uuid";
import { PostHeader, HorseEmbedCard, ReactionBar, ReplyComposer } from"@/components/social";
import { Button } from "@/components/ui/button";

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
 /**
  * Visual variant.
  *
  * Both variants now render the SAME ledger leaves. The thread wears
  * the site's paper everywhere it appears — passport, barn, event,
  * show — because that is what the owner approved on /feed, and a
  * comment on a horse should not look like a different product from
  * a post in the Paddock.
  *
  * "leather" survives only as a layout hint: the one caller that ever
  * passed it wrapped this component in its own padded panel (the old
  * global /feed, which now uses FeedStream instead). It therefore
  * just suppresses the top margin — it no longer switches materials.
  */
 variant?: "default" | "leather";
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
 variant = "default",
}: UniversalFeedProps) {
 const isLeather = variant === "leather";
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
 const uploadedPaths: string[] = [];
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
 // The thread sits directly on the page's parchment — no card around
 // the card. Each post below is its own ledger leaf.
 <div className={isLeather ? "relative" : "relative mt-6"}>
 {/* Section rule in the site's heading vocabulary (same brass bar
 the Paddock stream and ExplorerLayout headings use). */}
 <div className="brass-heading mb-4">
 <span className="brass-heading-bar" aria-hidden="true" />
 <h3 className="text-secondary-foreground m-0 text-sm">
 {label} ({posts.length}
 {hasMore ?"+" :""})
 </h3>
 </div>

 {/* ── Composer ── */}
 {showComposer && (
 <div className="ledger-card mb-6">
 <span className="ledger-tab">Say something</span>
 <textarea
 /* A lit-paper slip laid on the ledger, not a hole in it. */
 className="border-input bg-(--paper-lit) text-(--paper-lit-ink) placeholder:text-(--paper-lit-ink-soft)/60 focus:border-forest min-h-[76px] w-full resize-y rounded-md border px-4 py-3 text-sm no-underline transition-all focus:outline-none"
 placeholder={composerPlaceholder}
 value={composerText}
 onChange={(e) => setComposerText(e.target.value)}
 maxLength={2000}
 rows={2}
 id="universal-compose-input"
 aria-label="Write a post"
 />
 {imagePreviews.length > 0 && (
 <div
 className={`mt-3 grid gap-1.5 ${imagePreviews.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
 >
 {imagePreviews.map((preview, i) => (
 <div key={i} className="relative">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={preview}
 alt={`Preview ${i + 1}`}
 className="border-input bg-muted h-[150px] w-full rounded-lg border object-cover"
 />
 <button
 onClick={() => removeImage(i)}
 className="absolute top-1 right-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-0 bg-black/60 text-xs leading-5 text-white"
 aria-label={`Remove image ${i + 1}`}
 >
 ✕
 </button>
 </div>
 ))}
 </div>
 )}
 <div className="border-forest/15 mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
 <div className="flex flex-wrap items-center gap-2">
 <button
 type="button"
 className="studio-chip disabled:opacity-50"
 onClick={() => fileInputRef.current?.click()}
 disabled={imageFiles.length >= 4}
 title="Attach images (up to 4)"
 >
 📷 Photo{imageFiles.length > 0 ? ` (${imageFiles.length}/4)` :""}
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
 <span className="text-muted-foreground text-xs font-medium tabular-nums">{composerText.length}/2000</span>
 </div>
 <button
 type="button"
 className="btn-brass disabled:cursor-not-allowed disabled:opacity-50"
 onClick={handlePost}
 disabled={isPosting || (!composerText.trim() && imageFiles.length === 0)}
 >
 {isPosting ?"Posting…" :"Post"}
 </button>
 </div>
 {error && (
 <p className="text-destructive mt-2 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm">
 {error}
 </p>
 )}
 </div>
 )}

 {/* ── Post List ── */}
 {posts.length === 0 ? (
 <p className="ledger-card text-muted-foreground m-0 text-sm italic">
 No {label.toLowerCase()} yet — be the first!
 </p>
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
 <p className="text-muted-foreground mt-4 text-center text-sm italic">Loading more…</p>
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

 // Photos read as prints on the page (the PassportGallery / Paddock
 // treatment): one big, or a tidy pair-grid. No hero bleed — a thread
 // post is a page of a ledger, not a magazine spread.
 const gridMedia = post.media.slice(0, 4);

 return (
 <article className={`ledger-card thread-post ${post.isPinned ? "thread-post-pinned" : ""}`}>
 {post.isPinned && (
 <span className="stamp mb-2 inline-block">📌 Pinned</span>
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
 className="inline-flex min-h-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-1.5 py-0.5 text-xs font-semibold text-muted-foreground no-underline transition-all hover:bg-card"
 onClick={() => {
 setIsEditing(!isEditing);
 setEditText(displayContent);
 }}
 disabled={isPending}
 aria-label="Edit post"
 >
 ✏️
 </button>
 <button
 className="inline-flex min-h-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-1.5 py-0.5 text-xs font-semibold text-muted-foreground no-underline transition-all hover:bg-card"
 onClick={handleDelete}
 disabled={isPending}
 aria-label="Delete post"
 >
 🗑️
 </button>
 </>
 ) : undefined}
 />

 {/* Content */}
 <div className="mt-1.5 pl-10">
 {isEditing ? (
 <div className="flex flex-col gap-1">
 <textarea
 className="border-input bg-(--paper-lit)/70 text-(--paper-lit-ink) placeholder:text-(--paper-lit-ink-soft)/60 focus:border-forest min-h-[36px] w-full resize-y rounded-md border px-4 py-2 text-sm no-underline transition-all focus:outline-none"
 value={editText}
 onChange={(e) => setEditText(e.target.value)}
 rows={3}
 maxLength={2000}
 aria-label="Edit post content"
 />
 <div className="flex gap-1">
 <Button
 onClick={handleEdit}
 disabled={isPending || !editText.trim()}
 >
 {isPending ?"Saving…" :"Save"}
 </Button>
 <Button variant="outline" size="wide" className="text-muted-foreground"
 onClick={() => setIsEditing(false)}
 >
 Cancel
 </Button>
 </div>
 </div>
 ) : (
 <RichText content={displayContent} />
 )}

 {/* Rich horse embed card */}
 {embedHorseId && <HorseEmbedCard horseId={embedHorseId} />}
 </div>

 {/* Media: prints on the page, not full-bleed stacks */}
 {gridMedia.length > 0 && (
 <div
 className={`mt-3 grid gap-1.5 pl-10 ${gridMedia.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
 >
 {gridMedia.map((m, i) => (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 key={m.id || i}
 src={m.imageUrl}
 alt={m.caption || `Image ${i + 1}`}
 loading="lazy"
 className="border-input bg-muted h-full max-h-[340px] w-full rounded-lg border object-cover"
 />
 ))}
 </div>
 )}

 {/* Actions: Like + Reply toggle */}
 <div className="border-forest/15 mt-2 border-t pt-1 pl-10">
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
 <div className="border-forest/25 mt-3 ml-10 border-l-2 pl-4">
 {visibleReplies.map((r) => (
 <div key={r.id} className="mb-3">
 <PostHeader
 avatarUrl={r.authorAvatarUrl}
 alias={r.authorAlias}
 createdAt={r.createdAt}
 avatarSize="xs"
 actions={r.authorId === currentUserId ? (
 <button
 className="inline-flex min-h-0 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground no-underline transition-all hover:bg-card"
 onClick={() => {
 if (!confirm("Delete this reply?")) return;
 startTransition(async () => {
 await deletePost(r.id);
 setReplies((prev) => prev.filter((reply) => reply.id !== r.id));
 router.refresh();
 });
 }}
 disabled={isPending}
 aria-label="Delete reply"
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
 </article>
 );
}
