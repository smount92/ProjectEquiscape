"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import RichText from "@/components/RichText";
import { PostHeader, ReactionBar, UserAvatar } from "@/components/social";
import { PinPostButton } from "@/components/GroupAdminPanel";
import { togglePostLike } from "@/app/actions/posts";
import { getThread, replyToThread } from "@/app/actions/groups-forum";
import type { ThreadPost, ThreadViewData } from "@/lib/groups/types";
import { Button } from "@/components/ui/button";

// ============================================================
// THREAD VIEW — inside one notice-board thread. Forest header
// with breadcrumbs, subtly-highlighted OP, replies via the
// social primitives, auto-growing 2000-char composer.
// ============================================================

interface ThreadViewProps {
    thread: ThreadViewData;
    groupName: string;
    groupSlug: string;
    currentUserId: string;
    currentUserAlias: string;
    currentUserAvatar: string | null;
    /** owner/admin/moderator — may pin/unpin */
    canPin: boolean;
}

function ThreadPostBlock({ post, isOp }: { post: ThreadPost; isOp: boolean }) {
    return (
        <div
            className={`border-input border-b px-4 py-3.5 sm:px-5 ${isOp ? "bg-[color-mix(in_srgb,var(--brass,#B08D3E)_6%,transparent)]" : "sm:pl-12"}`}
            data-testid={isOp ? "thread-op" : "thread-reply"}
        >
            <PostHeader
                avatarUrl={post.authorAvatarUrl}
                alias={post.authorAlias}
                createdAt={post.createdAt}
                avatarSize={isOp ? "sm" : "xs"}
            />
            <div className="mt-1.5">
                <RichText content={post.content} />
            </div>
            <ReactionBar
                isLiked={post.isLikedByMe}
                likeCount={post.likesCount}
                onToggle={() => togglePostLike(post.id)}
                variant="compact"
            />
        </div>
    );
}

export default function ThreadView({
    thread,
    groupName,
    groupSlug,
    currentUserId,
    currentUserAlias,
    currentUserAvatar,
    canPin,
}: ThreadViewProps) {
    const [replies, setReplies] = useState<ThreadPost[]>(thread.replies);
    const [hasMore, setHasMore] = useState(thread.hasMoreReplies);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [text, setText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const loadMoreReplies = async () => {
        setIsLoadingMore(true);
        const result = await getThread({ postId: thread.id, repliesOffset: replies.length });
        if (result.success) {
            setReplies((prev) => [...prev, ...result.thread.replies]);
            setHasMore(result.thread.hasMoreReplies);
        }
        setIsLoadingMore(false);
    };

    const autoGrow = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
    };

    const handleReply = () => {
        const content = text.trim();
        if (!content) return;
        setError(null);
        startTransition(async () => {
            const result = await replyToThread({ postId: thread.id, content });
            if (result.success) {
                setReplies((prev) => [
                    ...prev,
                    {
                        id: result.replyId,
                        authorId: currentUserId,
                        authorAlias: currentUserAlias,
                        authorAvatarUrl: currentUserAvatar,
                        content,
                        likesCount: 0,
                        isLikedByMe: false,
                        createdAt: new Date().toISOString(),
                    },
                ]);
                setText("");
                if (textareaRef.current) textareaRef.current.style.height = "auto";
            } else {
                setError(result.error);
            }
        });
    };

    return (
        <div>
            <div className="mb-3 flex items-center justify-between gap-2">
                <Link
                    href={`/community/groups/${groupSlug}`}
                    className="text-muted-foreground hover:text-foreground text-sm no-underline"
                >
                    ← Back to board
                </Link>
                {canPin && <PinPostButton postId={thread.id} isPinned={thread.isPinned} />}
            </div>

            <div className="border-input bg-card overflow-hidden rounded-lg border shadow-sm">
                {/* Forest header: breadcrumbs + title */}
                <div className="bg-[linear-gradient(180deg,#37664F,var(--color-forest-dark,#1E3D31))] px-4 py-3.5 sm:px-5">
                    <div
                        className="text-[0.64rem] font-semibold tracking-[0.18em] uppercase"
                        style={{ color: "var(--leather-text-soft, #D8BE92)" }}
                    >
                        {groupName}
                        {thread.channelName && <> · {thread.channelName}</>}
                    </div>
                    <h1 className="m-0 text-lg leading-snug" style={{ color: "var(--leather-text, #EFDDBB)" }}>
                        {thread.isPinned && <span title="Pinned">📌 </span>}
                        {thread.displayTitle}
                    </h1>
                </div>

                {/* OP, subtly highlighted */}
                <ThreadPostBlock post={thread.op} isOp />

                {/* Replies */}
                {replies.map((r) => (
                    <ThreadPostBlock key={r.id} post={r} isOp={false} />
                ))}
                {hasMore && (
                    <div className="border-input flex justify-center border-b px-4 py-3">
                        <Button variant="outline" size="wide" disabled={isLoadingMore} onClick={loadMoreReplies}>
                            {isLoadingMore ? "Loading…" : "Load more replies"}
                        </Button>
                    </div>
                )}

                {/* Growing composer — 2000 chars, no more 500-character squeeze */}
                <div className="bg-secondary/40 flex gap-2.5 px-4 py-3 sm:px-5">
                    <UserAvatar src={currentUserAvatar} alias={currentUserAlias} size="xs" />
                    <div className="min-w-0 flex-1">
                        <textarea
                            ref={textareaRef}
                            className="border-input bg-card text-foreground min-h-[64px] w-full resize-none rounded-md border px-3 py-2 text-sm"
                            placeholder="Write a reply…"
                            value={text}
                            maxLength={2000}
                            onChange={(e) => { setText(e.target.value); autoGrow(); }}
                            aria-label="Write a reply"
                        />
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                            <span className="text-muted-foreground text-xs">
                                {text.length > 1600 ? `${text.length}/2000` : ""}
                            </span>
                            <button
                                className="btn-brass disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={handleReply}
                                disabled={isPending || !text.trim()}
                            >
                                {isPending ? "Posting…" : "Reply"}
                            </button>
                        </div>
                        {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
