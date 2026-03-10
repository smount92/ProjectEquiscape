"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addComment, deleteComment } from "@/app/actions/social";
import { toggleCommentLike } from "@/app/actions/likes";
import LikeToggle from "@/components/LikeToggle";
import RichText from "@/components/RichText";

interface CommentData {
    id: string;
    content: string;
    createdAt: string;
    userAlias: string;
    userId: string;
    parentId: string | null;
    likesCount: number;
    isLiked: boolean;
}

interface CommentSectionProps {
    horseId: string;
    currentUserId: string;
    horseOwnerId: string;
    initialComments: CommentData[];
}

function timeAgo(dateStr: string): string {
    const seconds = Math.floor(
        (Date.now() - new Date(dateStr).getTime()) / 1000
    );
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
}

export default function CommentSection({
    horseId,
    currentUserId,
    horseOwnerId,
    initialComments,
}: CommentSectionProps) {
    const router = useRouter();
    const [comments, setComments] = useState<CommentData[]>(initialComments);
    const [newComment, setNewComment] = useState("");
    const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [replyingToId, setReplyingToId] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState("");

    // Sync comments state when server re-fetches after revalidation
    useEffect(() => {
        setComments(initialComments);
    }, [initialComments]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || status === "saving") return;

        setStatus("saving");
        setErrorMsg("");

        const result = await addComment(horseId, newComment);

        if (result.success) {
            // Optimistic: prepend the new comment
            const optimisticComment: CommentData = {
                id: `temp-${Date.now()}`,
                content: newComment.trim(),
                createdAt: new Date().toISOString(),
                userAlias: "You",
                userId: currentUserId,
                parentId: null,
                likesCount: 0,
                isLiked: false,
            };
            setComments((prev) => [optimisticComment, ...prev]);
            setNewComment("");
            setStatus("idle");
            router.refresh();
        } else {
            setErrorMsg(result.error || "Failed to post comment.");
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
        }
    };

    const handleReply = async (parentId: string) => {
        if (!replyContent.trim()) return;

        setStatus("saving");
        const result = await addComment(horseId, replyContent, parentId);

        if (result.success) {
            const optimisticReply: CommentData = {
                id: `temp-reply-${Date.now()}`,
                content: replyContent.trim(),
                createdAt: new Date().toISOString(),
                userAlias: "You",
                userId: currentUserId,
                parentId,
                likesCount: 0,
                isLiked: false,
            };
            setComments((prev) => [...prev, optimisticReply]);
            setReplyContent("");
            setReplyingToId(null);
            setStatus("idle");
            router.refresh();
        } else {
            setStatus("idle");
        }
    };

    const handleDelete = async (commentId: string) => {
        if (deletingId) return;
        setDeletingId(commentId);

        const result = await deleteComment(commentId);

        if (result.success) {
            setComments((prev) => prev.filter((c) => c.id !== commentId && c.parentId !== commentId));
            router.refresh();
        }

        setDeletingId(null);
    };

    const canDelete = (comment: CommentData): boolean => {
        return comment.userId === currentUserId || currentUserId === horseOwnerId;
    };

    const charCount = newComment.length;
    const isOverLimit = charCount > 500;

    // Separate top-level comments and replies
    const topLevel = comments.filter((c) => !c.parentId);
    const repliesByParent = new Map<string, CommentData[]>();
    for (const c of comments) {
        if (c.parentId) {
            if (!repliesByParent.has(c.parentId)) repliesByParent.set(c.parentId, []);
            repliesByParent.get(c.parentId)!.push(c);
        }
    }

    return (
        <div className="comment-section" id="comment-section">
            <h3 className="comment-section-header">
                <span aria-hidden="true">💬</span> Comments
                {comments.length > 0 && (
                    <span className="comment-section-count">({comments.length})</span>
                )}
            </h3>

            {/* Comment Input */}
            <form className="comment-input-row" onSubmit={handleSubmit}>
                <div style={{ position: "relative", flex: 1 }}>
                    <textarea
                        className="comment-input"
                        placeholder="Leave a comment…(supports @mentions)"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        maxLength={520}
                        rows={2}
                        id="comment-input"
                    />
                    <span
                        className={`comment-char-count ${isOverLimit ? "over-limit" : ""}`}
                    >
                        {charCount}/500
                    </span>
                </div>
                <button
                    type="submit"
                    className="btn btn-primary comment-submit-btn"
                    disabled={
                        !newComment.trim() || status === "saving" || isOverLimit
                    }
                    id="comment-submit"
                >
                    {status === "saving" ? (
                        <span
                            className="btn-spinner"
                            style={{ width: 16, height: 16 }}
                            aria-hidden="true"
                        />
                    ) : (
                        "Post"
                    )}
                </button>
            </form>

            {/* Error message */}
            {status === "error" && errorMsg && (
                <div className="comment-error">{errorMsg}</div>
            )}

            {/* Comments List */}
            {topLevel.length === 0 ? (
                <div className="comments-empty">
                    <p>No comments yet. Be the first to share your thoughts!</p>
                </div>
            ) : (
                <div className="comment-list">
                    {topLevel.map((comment) => (
                        <div key={comment.id}>
                            {/* Top-level comment */}
                            <div className="comment-item" id={`comment-${comment.id}`}>
                                <div className="comment-item-header">
                                    <Link
                                        href={`/profile/${encodeURIComponent(comment.userAlias)}`}
                                        className="comment-author"
                                    >
                                        @{comment.userAlias}
                                    </Link>
                                    <span className="comment-time">
                                        {timeAgo(comment.createdAt)}
                                    </span>
                                    {canDelete(comment) && (
                                        <button
                                            className="comment-delete-btn"
                                            onClick={() => handleDelete(comment.id)}
                                            disabled={deletingId === comment.id}
                                            title="Delete comment"
                                            aria-label="Delete comment"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                                <RichText content={comment.content} />
                                <div className="feed-action-row">
                                    <LikeToggle
                                        initialLiked={comment.isLiked}
                                        initialCount={comment.likesCount}
                                        onToggle={() => toggleCommentLike(comment.id)}
                                    />
                                    <button
                                        className="btn btn-ghost"
                                        style={{ padding: '2px 6px', fontSize: '0.8rem' }}
                                        onClick={() => setReplyingToId(replyingToId === comment.id ? null : comment.id)}
                                    >
                                        {replyingToId === comment.id ? "Cancel" : "Reply"}
                                    </button>
                                </div>

                                {/* Reply compose bar */}
                                {replyingToId === comment.id && (
                                    <div className="comment-reply-bar">
                                        <textarea
                                            className="comment-input"
                                            placeholder={`Reply to @${comment.userAlias}…`}
                                            value={replyContent}
                                            onChange={(e) => setReplyContent(e.target.value)}
                                            maxLength={500}
                                            rows={2}
                                        />
                                        <button
                                            className="btn btn-primary"
                                            style={{ marginTop: 4, fontSize: '0.85rem', padding: '4px 12px' }}
                                            disabled={!replyContent.trim()}
                                            onClick={() => handleReply(comment.id)}
                                        >
                                            Reply
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Threaded replies */}
                            {repliesByParent.get(comment.id)?.map((reply) => (
                                <div key={reply.id} className="comment-reply-indent">
                                    <div className="comment-item" id={`comment-${reply.id}`}>
                                        <div className="comment-item-header">
                                            <Link
                                                href={`/profile/${encodeURIComponent(reply.userAlias)}`}
                                                className="comment-author"
                                            >
                                                @{reply.userAlias}
                                            </Link>
                                            <span className="comment-time">
                                                {timeAgo(reply.createdAt)}
                                            </span>
                                            {canDelete(reply) && (
                                                <button
                                                    className="comment-delete-btn"
                                                    onClick={() => handleDelete(reply.id)}
                                                    disabled={deletingId === reply.id}
                                                    title="Delete reply"
                                                    aria-label="Delete reply"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                        <RichText content={reply.content} />
                                        <div className="feed-action-row">
                                            <LikeToggle
                                                initialLiked={reply.isLiked}
                                                initialCount={reply.likesCount}
                                                onToggle={() => toggleCommentLike(reply.id)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
