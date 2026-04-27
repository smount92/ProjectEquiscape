"use client";

import { useState, useTransition } from "react";
import { addSuggestionComment, deleteSuggestionComment } from "@/app/actions/catalog-suggestions";
import { useRouter } from "next/navigation";
import { PostHeader, ReplyComposer } from "@/components/social";

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
    currentUserAlias?: string;
}

export default function SuggestionCommentThread({ suggestionId, comments: initialComments, currentUserId, currentUserAlias = "You" }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleSubmit = async (content: string) => {
        if (!currentUserId) return;
        startTransition(async () => {
            const result = await addSuggestionComment(suggestionId, content);
            if (result.success) {
                router.refresh();
            }
        });
    };

    const handleDelete = (commentId: string) => {
        startTransition(async () => {
            await deleteSuggestionComment(commentId);
            router.refresh();
        });
    };

    return (
        <div className="mt-4">
            {/* Comment List */}
            {initialComments.length === 0 && (
                <p className="mt-4 text-sm text-muted-foreground">No comments yet. Be the first to discuss this suggestion.</p>
            )}
            {initialComments.map((comment) => (
                <div key={comment.id} className="border-b border-edge py-3">
                    <PostHeader
                        avatarUrl={null}
                        alias={comment.user_alias}
                        createdAt={comment.created_at}
                        avatarSize="xs"
                        actions={currentUserId === comment.user_id ? (
                            <button
                                className="inline-flex min-h-0 cursor-pointer items-center justify-center rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-xs text-muted-foreground no-underline transition-all hover:bg-parchment"
                                onClick={() => handleDelete(comment.id)}
                                disabled={isPending}
                                title="Delete comment"
                            >
                                🗑
                            </button>
                        ) : undefined}
                    />
                    <p className="mt-1 pl-8 text-sm leading-relaxed text-ink-light">{comment.body}</p>
                </div>
            ))}

            {/* Add Comment */}
            {currentUserId ? (
                <ReplyComposer
                    currentUserAvatar={null}
                    currentUserAlias={currentUserAlias}
                    onSubmit={handleSubmit}
                    placeholder="Share evidence, discuss this change…"
                    maxLength={2000}
                    isPending={isPending}
                />
            ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                    <a href="/login" className="text-forest font-semibold hover:underline">Log in</a> to join the discussion.
                </p>
            )}
        </div>
    );
}
