"use client";

import { useState, useTransition } from "react";
import {
    addSuggestionComment,
    deleteSuggestionComment,
} from "@/app/actions/catalog-suggestions";
import { useRouter } from "next/navigation";

interface Comment {
    id: string;
    user_id: string;
    user_alias: string;
    body: string;
    created_at: string;
}

interface Props {
    suggestionId: string;
    comments: Comment[];
    currentUserId: string | null;
}

export default function SuggestionCommentThread({
    suggestionId,
    comments: initialComments,
    currentUserId,
}: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [newComment, setNewComment] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = () => {
        if (!newComment.trim()) return;
        if (!currentUserId) return;

        setError("");
        startTransition(async () => {
            const result = await addSuggestionComment(
                suggestionId,
                newComment.trim()
            );
            if (result.success) {
                setNewComment("");
                router.refresh();
            } else {
                setError(result.error ?? "Failed to post comment.");
            }
        });
    };

    const handleDelete = (commentId: string) => {
        startTransition(async () => {
            await deleteSuggestionComment(commentId);
            router.refresh();
        });
    };

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    return (
        <div className="mt-4">
            {/* Comment List */}
            {initialComments.length === 0 && (
                <p className="mt-4-empty">
                    No comments yet. Be the first to discuss this suggestion.
                </p>
            )}
            {initialComments.map((comment) => (
                <div key={comment.id} className="py-2 px-[0] border-b border-edge">
                    <div className="py-2 px-[0] border-b border-edge-sticky top-0 z-[100] h-[var(--header-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">
                        <span className="py-2 px-[0] border-b border-edge-author">
                            @{comment.user_alias}
                        </span>
                        <span className="py-2 px-[0] border-b border-edge-time">
                            {timeAgo(comment.created_at)}
                        </span>
                        {currentUserId === comment.user_id && (
                            <button
                                className="py-2 px-[0] border-b border-edge-delete"
                                onClick={() => handleDelete(comment.id)}
                                disabled={isPending}
                                title="Delete comment"
                            >
                                🗑
                            </button>
                        )}
                    </div>
                    <p className="py-2 px-[0] border-b border-edge-body">{comment.body}</p>
                </div>
            ))}

            {/* Add Comment */}
            {currentUserId ? (
                <div className="py-2 px-[0] border-b border-edge-form">
                    <textarea
                        className="input py-2 px-[0] border-b border-edge-textarea"
                        placeholder="Share evidence, discuss this change…"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        rows={2}
                        maxLength={2000}
                    />
                    {error && <p className="flex items-center gap-2 mt-2 py-2 px-4 bg-[rgba(240,108,126,0.1)] border border-[rgba(240,108,126,0.3)] rounded-md text-danger text-sm">{error}</p>}
                    <div className="py-2 px-[0] border-b border-edge-form-actions">
                        <span className="py-2 px-[0] border-b border-edge-charcount">
                            {newComment.length}/2000
                        </span>
                        <button
                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm btn-small"
                            onClick={handleSubmit}
                            disabled={isPending || !newComment.trim()}
                        >
                            {isPending ? "Posting…" : "Post Comment"}
                        </button>
                    </div>
                </div>
            ) : (
                <p className="mt-4-login">
                    <a href="/login">Log in</a> to join the discussion.
                </p>
            )}
        </div>
    );
}
