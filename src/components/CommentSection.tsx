"use client";

import { useState } from "react";
import Link from "next/link";
import { addComment, deleteComment } from "@/app/actions/social";

interface CommentData {
    id: string;
    content: string;
    createdAt: string;
    userAlias: string;
    userId: string;
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
    const [comments, setComments] = useState<CommentData[]>(initialComments);
    const [newComment, setNewComment] = useState("");
    const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);

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
            };
            setComments((prev) => [optimisticComment, ...prev]);
            setNewComment("");
            setStatus("idle");
        } else {
            setErrorMsg(result.error || "Failed to post comment.");
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
        }
    };

    const handleDelete = async (commentId: string) => {
        if (deletingId) return;
        setDeletingId(commentId);

        const result = await deleteComment(commentId);

        if (result.success) {
            setComments((prev) => prev.filter((c) => c.id !== commentId));
        }

        setDeletingId(null);
    };

    const canDelete = (comment: CommentData): boolean => {
        return comment.userId === currentUserId || currentUserId === horseOwnerId;
    };

    const charCount = newComment.length;
    const isOverLimit = charCount > 500;

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
                        placeholder="Leave a comment…"
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
            {comments.length === 0 ? (
                <div className="comments-empty">
                    <p>No comments yet. Be the first to share your thoughts!</p>
                </div>
            ) : (
                <div className="comment-list">
                    {comments.map((comment) => (
                        <div key={comment.id} className="comment-item" id={`comment-${comment.id}`}>
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
                            <p className="comment-content">{comment.content}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
