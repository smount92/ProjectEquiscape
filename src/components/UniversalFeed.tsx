"use client";

import { useState, useRef, useTransition, useCallback, useEffect } from"react";
import { useRouter } from"next/navigation";
import Link from"next/link";
import { createPost, replyToPost, deletePost, updatePost, togglePostLike, getPosts } from"@/app/actions/posts";
import type { Post } from"@/app/actions/posts";
import { createClient } from"@/lib/supabase/client";
import RichText from"@/components/RichText";
import LikeToggle from"@/components/LikeToggle";
import { safeUUID } from"@/lib/utils/uuid";

// ============================================================
// UNIVERSAL FEED — renders posts for ANY context
// Replaces: ActivityFeed, FeedComposeBar, LoadMoreFeed,
// GroupFeed, CommentSection, EventCommentSection
// ============================================================

interface UniversalFeedProps {
 initialPosts: Post[];
 context: { horseId?: string; groupId?: string; eventId?: string; globalFeed?: boolean };
 currentUserId: string;
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
 <div className="bg-card border-edge mt-6 rounded-lg border p-6 shadow-md transition-all">
 <h3 className="mb-4">
 💬 {label} ({posts.length}
 {hasMore ?"+" :""})
 </h3>

 {/* ── Composer ── */}
 {showComposer && (
 <div className="border-edge mb-6 rounded-lg border bg-[var(--color-surface-1)] p-4">
 <textarea
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-4 py-2 text-sm font-semibold no-underline transition-all"
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
 <div key={i} style={{ position:"relative" }}>
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={preview} alt={`Preview ${i + 1}`} className="max-h-[150]" />
 <button
 onClick={() => removeImage(i)}
 style={{
 position:"absolute",
 top: 4,
 right: 4,
 background:"rgba(0,0,0,0.6)",
 color:"white",
 border:"none",
 borderRadius:"50%",
 width: 20,
 height: 20,
 cursor:"pointer",
 fontSize: 12,
 lineHeight:"20px",
 }}
 aria-label="Remove image"
 >
 ✕
 </button>
 </div>
 ))}
 </div>
 )}
 <div className="flex items-center justify-between">
 <div className="gap-2" style={{ display:"flex", alignItems:"center" }}>
 <button
 type="button"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => fileInputRef.current?.click()}
 disabled={imageFiles.length >= 4}
 title="Attach images (up to 4)"
 style={{ padding:"4px 8px" }}
 >
 📷 {imageFiles.length > 0 ? `(${imageFiles.length}/4)` :""}
 </button>
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 multiple
 onChange={handleImageSelect}
 style={{ display:"none" }}
 />
 <span className="text-muted text-xs">{composerText.length}/2000</span>
 </div>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handlePost}
 disabled={isPosting || (!composerText.trim() && imageFiles.length === 0)}
 >
 {isPosting ?"Posting…" :"📝 Post"}
 </button>
 </div>
 {error && (
 <p className="text-danger mt-2 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm">
 {error}
 </p>
 )}
 </div>
 )}

 {/* ── Post List ── */}
 {posts.length === 0 ? (
 <p className="text-muted">No {label.toLowerCase()} yet — be the first!</p>
 ) : (
 <div className="gap-4" style={{ display:"flex", flexDirection:"column" }}>
 {posts.map((post) => (
 <PostCard key={post.id} post={post} currentUserId={currentUserId} />
 ))}
 </div>
 )}

 {/* ── Load More Sentinel ── */}
 {hasMore && <div ref={sentinelRef} className="h-[1]" />}
 {isLoadingMore && (
 <p className="text-muted mt-4" style={{ textAlign:"center" }}>
 Loading more…
 </p>
 )}
 </div>
 );
}

// ============================================================
// POST CARD — renders a single post + replies
// ============================================================

function PostCard({ post, currentUserId }: { post: Post; currentUserId: string }) {
 const router = useRouter();
 const [showReplies, setShowReplies] = useState(false);
 const [replies, setReplies] = useState(post.replies);
 const [replyText, setReplyText] = useState("");
 const [isPending, startTransition] = useTransition();
 const [isEditing, setIsEditing] = useState(false);
 const [editText, setEditText] = useState(post.content);
 const [displayContent, setDisplayContent] = useState(post.content);
 const [wasEdited, setWasEdited] = useState(!!post.updatedAt && post.updatedAt !== post.createdAt);

 const handleReply = () => {
 if (!replyText.trim()) return;
 startTransition(async () => {
 const result = await replyToPost(post.id, replyText.trim());
 if (result.success) {
 setReplies((prev) => [
 ...prev,
 {
 id: safeUUID(),
 authorId: currentUserId,
 authorAlias:"You",
 content: replyText.trim(),
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
 setReplyText("");
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

 return (
 <div className="pb-2" style={{ borderBottom:"1px solid var(--color-border)" }}>
 {/* Header */}
 <div className="justify-between" style={{ display:"flex", alignItems:"center" }}>
 <Link
 href={`/profile/${encodeURIComponent(post.authorAlias)}`}
 className="text-[calc(0.85rem*var(--font-scale))] font-semibold"
 >
 @{post.authorAlias}
 </Link>
 <div className="gap-2" style={{ display:"flex", alignItems:"center" }}>
 <span className="text-muted text-[calc(0.75rem*var(--font-scale))]">
 {timeAgo(post.createdAt)}
 {wasEdited && (
 <span title="This post was edited" className="opacity-[0.6]">
 {""}
 (edited)
 </span>
 )}
 </span>
 {post.authorId === currentUserId && (
 <>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => {
 setIsEditing(!isEditing);
 setEditText(displayContent);
 }}
 disabled={isPending}
 style={{ fontSize:"0.75rem", padding:"2px 6px" }}
 >
 ✏️
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={handleDelete}
 disabled={isPending}
 style={{ fontSize:"0.75rem", padding:"2px 6px" }}
 >
 🗑️
 </button>
 </>
 )}
 </div>
 </div>

 {/* Content */}
 <div className="mt-[4]">
 {isEditing ? (
 <div className="gap-1" style={{ display:"flex", flexDirection:"column" }}>
 <textarea
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-4 py-2 text-sm font-semibold no-underline transition-all"
 value={editText}
 onChange={(e) => setEditText(e.target.value)}
 rows={3}
 maxLength={2000}
 style={{ fontSize:"calc(0.85rem * var(--font-scale))" }}
 />
 <div className="gap-1" style={{ display:"flex" }}>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleEdit}
 disabled={isPending || !editText.trim()}
 >
 {isPending ?"Saving…" :"Save"}
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => setIsEditing(false)}
 >
 Cancel
 </button>
 </div>
 </div>
 ) : (
 <RichText content={displayContent} />
 )}
 {/* Rich embed for /community/ horse links */}
 {/\/community\/[0-9a-f]{8}-/.test(post.content) &&
 (() => {
 const match = post.content.match(
 /\/community\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
 );
 if (!match) return null;
 const horseId = match[1];
 return (
 <Link
 href={`/community/${horseId}`}
 className="embed-bg-card border-edge rounded-lg border shadow-md transition-all"
 style={{ marginTop:"var(--space-sm)" }}
 >
 <div className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all">
 <div className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all">
 🐴 View Horse Passport
 </div>
 <div className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all">
 Click to view this model on Model Horse Hub
 </div>
 <div className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all">
 modelhorsehub.com/community/{horseId.slice(0, 8)}…
 </div>
 </div>
 </Link>
 );
 })()}
 </div>

 {/* Media Collage */}
 {post.media.length > 0 && (
 <div
 className="mt-2 grid gap-[4px] overflow-hidden rounded-md"
 data-count={Math.min(post.media.length, 4)}
 >
 {post.media.slice(0, 4).map((m, i) => (
 // eslint-disable-next-line @next/next/no-img-element
 <img key={m.id || i} src={m.imageUrl} alt={m.caption || `Image ${i + 1}`} loading="lazy" />
 ))}
 </div>
 )}

 {/* Actions: Like + Reply toggle */}
 <div className="flex items-center gap-3 mt-1">
 <LikeToggle
 initialLiked={post.isLikedByMe}
 initialCount={post.likesCount}
 onToggle={() => togglePostLike(post.id)}
 />
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => setShowReplies(!showReplies)}
 style={{ fontSize:"calc(0.8rem * var(--font-scale))" }}
 >
 💬 {post.repliesCount > 0 ? post.repliesCount :""} {showReplies ?"▲" :"▼"}
 </button>
 </div>

 {/* Replies */}
 {showReplies && (
 <div className="mt-2 ml-6 pl-4" style={{ borderLeft:"2px solid var(--color-border)" }}>
 {replies.map((r) => (
 <div key={r.id} className="mb-2 items-start justify-between" style={{ display:"flex" }}>
 <div className="flex-1">
 <Link
 href={`/profile/${encodeURIComponent(r.authorAlias)}`}
 className="text-[calc(0.8rem*var(--font-scale))] font-semibold"
 >
 @{r.authorAlias}
 </Link>
 <span className="text-muted ml-1 text-[calc(0.7rem*var(--font-scale))]">
 {timeAgo(r.createdAt)}
 </span>
 <div className="mt-[2]">
 <RichText content={r.content} />
 </div>
 </div>
 {r.authorId === currentUserId && (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 style={{ fontSize:"0.7rem", padding:"2px 6px", flexShrink: 0 }}
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
 )}
 </div>
 ))}
 {/* Reply composer */}
 <div className="mt-2 gap-2" style={{ display:"flex" }}>
 <input
 className="form-input"
 placeholder="Reply…"
 value={replyText}
 onChange={(e) => setReplyText(e.target.value)}
 maxLength={500}
 style={{ flex: 1, fontSize:"calc(0.8rem * var(--font-scale))" }}
 />
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleReply}
 disabled={isPending || !replyText.trim()}
 style={{ fontSize:"calc(0.8rem * var(--font-scale))" }}
 >
 {isPending ?"…" :"Reply"}
 </button>
 </div>
 </div>
 )}
 </div>
 );
}
