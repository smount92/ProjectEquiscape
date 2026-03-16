"use client";

import { useState, useRef, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPost, replyToPost, deletePost, updatePost, togglePostLike, getPosts } from "@/app/actions/posts";
import type { Post } from "@/app/actions/posts";
import { createClient } from "@/lib/supabase/client";
import RichText from "@/components/RichText";
import LikeToggle from "@/components/LikeToggle";
import { safeUUID } from "@/lib/utils/uuid";

// ============================================================
// UNIVERSAL FEED — renders posts for ANY context
// Replaces: ActivityFeed, FeedComposeBar, LoadMoreFeed,
//           GroupFeed, CommentSection, EventCommentSection
// ============================================================

interface UniversalFeedProps {
    initialPosts: Post[];
    context: { horseId?: string; groupId?: string; eventId?: string; globalFeed?: boolean };
    currentUserId: string;
    showComposer?: boolean;
    composerPlaceholder?: string;
    /** Label override — e.g. "Comments" vs "Posts" vs "Discussion" */
    label?: string;
}

function timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function UniversalFeed({
    initialPosts,
    context,
    currentUserId,
    showComposer = true,
    composerPlaceholder = "Share an update…",
    label = "Posts",
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
            setPosts(prev => [...prev, ...morePosts]);
            if (morePosts.length < 25) setHasMore(false);
        }
        setIsLoadingMore(false);
    }, [isLoadingMore, hasMore, posts, context]);

    useEffect(() => {
        if (!sentinelRef.current || !hasMore) return;
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) loadMore();
        }, { rootMargin: "200px" });
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
        newFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = ev => {
                newPreviews.push(ev.target?.result as string);
                if (newPreviews.length === newFiles.length) setImagePreviews(newPreviews);
            };
            reader.readAsDataURL(file);
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeImage = (index: number) => {
        setImageFiles(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
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
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) { setError("Not authenticated."); setIsPosting(false); return; }
                for (const file of imageFiles) {
                    const ext = file.name.split(".").pop() || "webp";
                    const path = `social/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                    const { error: uploadErr } = await supabase.storage.from("horse-images").upload(path, file, { contentType: file.type });
                    if (uploadErr) { setError(`Upload failed: ${uploadErr.message}`); setIsPosting(false); return; }
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
                setPosts(prev => [{
                    id: result.postId || safeUUID(),
                    authorId: currentUserId,
                    authorAlias: "You",
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
                }, ...prev]);
                setComposerText("");
                setImageFiles([]);
                setImagePreviews([]);
                router.refresh();
            } else {
                setError(result.error || "Failed to post.");
            }
        } catch { setError("Something went wrong."); }
        setIsPosting(false);
    };

    return (
        <div className="glass-card" style={{ padding: "var(--space-lg)", marginTop: "var(--space-lg)" }}>
            <h3 style={{ marginBottom: "var(--space-md)" }}>💬 {label} ({posts.length}{hasMore ? "+" : ""})</h3>

            {/* ── Composer ── */}
            {showComposer && (
                <div className="feed-compose-bar" style={{ marginBottom: "var(--space-lg)" }}>
                    <textarea
                        className="form-textarea feed-compose-input"
                        placeholder={composerPlaceholder}
                        value={composerText}
                        onChange={e => setComposerText(e.target.value)}
                        maxLength={2000}
                        rows={2}
                        id="universal-compose-input"
                    />
                    {imagePreviews.length > 0 && (
                        <div className="feed-image-collage" data-count={imagePreviews.length} style={{ marginTop: "var(--space-sm)", maxHeight: 150 }}>
                            {imagePreviews.map((preview, i) => (
                                <div key={i} style={{ position: "relative" }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={preview} alt={`Preview ${i + 1}`} style={{ maxHeight: 150 }} />
                                    <button onClick={() => removeImage(i)} style={{
                                        position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)",
                                        color: "white", border: "none", borderRadius: "50%", width: 20, height: 20,
                                        cursor: "pointer", fontSize: 12, lineHeight: "20px",
                                    }} aria-label="Remove image">✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="feed-compose-footer">
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()}
                                disabled={imageFiles.length >= 4} title="Attach images (up to 4)" style={{ padding: "4px 8px" }}>
                                📷 {imageFiles.length > 0 ? `(${imageFiles.length}/4)` : ""}
                            </button>
                            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} style={{ display: "none" }} />
                            <span className="feed-compose-count">{composerText.length}/2000</span>
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={handlePost}
                            disabled={isPosting || (!composerText.trim() && imageFiles.length === 0)}>
                            {isPosting ? "Posting…" : "📝 Post"}
                        </button>
                    </div>
                    {error && <p className="form-error" style={{ marginTop: "var(--space-xs)" }}>{error}</p>}
                </div>
            )}

            {/* ── Post List ── */}
            {posts.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)" }}>No {label.toLowerCase()} yet — be the first!</p>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                    {posts.map(post => (
                        <PostCard key={post.id} post={post} currentUserId={currentUserId} />
                    ))}
                </div>
            )}

            {/* ── Load More Sentinel ── */}
            {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
            {isLoadingMore && <p style={{ textAlign: "center", color: "var(--color-text-muted)", marginTop: "var(--space-md)" }}>Loading more…</p>}
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
                setReplies(prev => [...prev, {
                    id: safeUUID(),
                    authorId: currentUserId,
                    authorAlias: "You",
                    content: replyText.trim(),
                    parentId: post.id,
                    horseId: null, groupId: null, eventId: null, studioId: null, helpRequestId: null,
                    likesCount: 0, repliesCount: 0, isPinned: false,
                    createdAt: new Date().toISOString(), updatedAt: null, media: [], isLikedByMe: false, replies: [],
                }]);
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
        <div style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-sm)" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Link href={`/profile/${encodeURIComponent(post.authorAlias)}`} style={{ fontWeight: 600, fontSize: "calc(0.85rem * var(--font-scale))" }}>
                    @{post.authorAlias}
                </Link>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                    <span style={{ color: "var(--color-text-muted)", fontSize: "calc(0.75rem * var(--font-scale))" }}>
                        {timeAgo(post.createdAt)}
                        {wasEdited && <span title="This post was edited" style={{ opacity: 0.6 }}> (edited)</span>}
                    </span>
                    {post.authorId === currentUserId && (
                        <>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setIsEditing(!isEditing); setEditText(displayContent); }} disabled={isPending}
                                style={{ fontSize: "0.75rem", padding: "2px 6px" }}>✏️</button>
                            <button className="btn btn-ghost btn-sm" onClick={handleDelete} disabled={isPending}
                                style={{ fontSize: "0.75rem", padding: "2px 6px" }}>🗑️</button>
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            <div style={{ marginTop: 4 }}>
                {isEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                        <textarea className="form-textarea" value={editText} onChange={e => setEditText(e.target.value)}
                            rows={3} maxLength={2000} style={{ fontSize: "calc(0.85rem * var(--font-scale))" }} />
                        <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                            <button className="btn btn-primary btn-sm" onClick={handleEdit} disabled={isPending || !editText.trim()}>
                                {isPending ? "Saving…" : "Save"}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(false)}>Cancel</button>
                        </div>
                    </div>
                ) : (
                    <RichText content={displayContent} />
                )}
                {/* Rich embed for /community/ horse links */}
                {/\/community\/[0-9a-f]{8}-/.test(post.content) && (() => {
                    const match = post.content.match(/\/community\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
                    if (!match) return null;
                    const horseId = match[1];
                    return (
                        <Link
                            href={`/community/${horseId}`}
                            className="embed-card"
                            style={{ marginTop: "var(--space-sm)" }}
                        >
                            <div className="embed-card-body">
                                <div className="embed-card-title">🐴 View Horse Passport</div>
                                <div className="embed-card-desc">Click to view this model on Model Horse Hub</div>
                                <div className="embed-card-domain">modelhorsehub.com/community/{horseId.slice(0, 8)}…</div>
                            </div>
                        </Link>
                    );
                })()}
            </div>

            {/* Media Collage */}
            {post.media.length > 0 && (
                <div className="feed-image-collage" data-count={Math.min(post.media.length, 4)} style={{ marginTop: "var(--space-sm)" }}>
                    {post.media.slice(0, 4).map((m, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={m.id || i} src={m.imageUrl} alt={m.caption || `Image ${i + 1}`} loading="lazy" />
                    ))}
                </div>
            )}

            {/* Actions: Like + Reply toggle */}
            <div className="feed-action-row" style={{ marginTop: "var(--space-xs)" }}>
                <LikeToggle
                    initialLiked={post.isLikedByMe}
                    initialCount={post.likesCount}
                    onToggle={() => togglePostLike(post.id)}
                />
                <button className="btn btn-ghost btn-sm" onClick={() => setShowReplies(!showReplies)}
                    style={{ fontSize: "calc(0.8rem * var(--font-scale))" }}>
                    💬 {post.repliesCount > 0 ? post.repliesCount : ""} {showReplies ? "▲" : "▼"}
                </button>
            </div>

            {/* Replies */}
            {showReplies && (
                <div style={{ marginLeft: "var(--space-lg)", marginTop: "var(--space-sm)", borderLeft: "2px solid var(--color-border)", paddingLeft: "var(--space-md)" }}>
                    {replies.map(r => (
                        <div key={r.id} style={{ marginBottom: "var(--space-sm)" }}>
                            <Link href={`/profile/${encodeURIComponent(r.authorAlias)}`} style={{ fontWeight: 600, fontSize: "calc(0.8rem * var(--font-scale))" }}>
                                @{r.authorAlias}
                            </Link>
                            <span style={{ color: "var(--color-text-muted)", fontSize: "calc(0.7rem * var(--font-scale))", marginLeft: "var(--space-xs)" }}>
                                {timeAgo(r.createdAt)}
                            </span>
                            <div style={{ marginTop: 2 }}><RichText content={r.content} /></div>
                        </div>
                    ))}
                    {/* Reply composer */}
                    <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-sm)" }}>
                        <input
                            className="form-input"
                            placeholder="Reply…"
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            maxLength={500}
                            style={{ flex: 1, fontSize: "calc(0.8rem * var(--font-scale))" }}
                        />
                        <button className="btn btn-primary btn-sm" onClick={handleReply}
                            disabled={isPending || !replyText.trim()}
                            style={{ fontSize: "calc(0.8rem * var(--font-scale))" }}>
                            {isPending ? "…" : "Reply"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
