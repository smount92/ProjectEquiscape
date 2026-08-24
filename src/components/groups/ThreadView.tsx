"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import RichText from "@/components/RichText";
import MentionTextarea from "@/components/feed/MentionTextarea";
import { PostHeader, ReactionBar, UserAvatar } from "@/components/social";
import { PinPostButton } from "@/components/groups/PinPostButton";
import { togglePostLike, updatePost } from "@/app/actions/posts";
import { getThread, replyToThread } from "@/app/actions/groups-forum";
import type { ThreadPost, ThreadViewData } from "@/lib/groups/types";
import { Button } from "@/components/ui/button";

// ============================================================
// THREAD VIEW — inside one barn notice-board thread. Forest header
// with breadcrumbs (this is the page's ONE header — the route runs
// ExplorerLayout with `noHeader`), subtly-highlighted OP, replies
// via the social primitives, auto-growing 2000-char composer.
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

function ThreadPostBlock({
    post,
    isOp,
    knownAliases,
    canEdit,
    onEdited,
}: {
    post: ThreadPost;
    isOp: boolean;
    /** Real aliases in this thread, so "@MODEL HORSES INTERNATIONAL"
     *  links as one name instead of "@MODEL". */
    knownAliases: readonly string[];
    /** The viewer wrote this post. */
    canEdit: boolean;
    onEdited: (postId: string, content: string) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(post.content);
    const [saving, setSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    const handleSave = async () => {
        const content = draft.trim();
        if (!content) { setEditError("A post can't be empty."); return; }
        setSaving(true);
        setEditError(null);
        const result = await updatePost(post.id, content);
        setSaving(false);
        if (result.success) {
            onEdited(post.id, content);
            setEditing(false);
        } else {
            setEditError(result.error ?? "Could not save the edit.");
        }
    };

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
            {editing ? (
                <div className="mt-1.5 flex flex-col gap-2">
                    <textarea
                        className="border-input bg-card w-full rounded-md border px-3 py-2 text-sm"
                        value={draft}
                        rows={4}
                        maxLength={10000}
                        onChange={(e) => setDraft(e.target.value)}
                        aria-label="Edit your post"
                    />
                    {editError && <p className="text-destructive text-xs">{editError}</p>}
                    <div className="flex gap-2">
                        <Button size="sm" onClick={handleSave} disabled={saving}>
                            {saving ? "Saving…" : "Save"}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() => { setDraft(post.content); setEditing(false); setEditError(null); }}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="mt-1.5">
                    <RichText content={post.content} knownAliases={knownAliases} />
                </div>
            )}
            <div className="flex items-center justify-between">
                <ReactionBar
                    isLiked={post.isLikedByMe}
                    likeCount={post.likesCount}
                    onToggle={() => togglePostLike(post.id)}
                    variant="compact"
                />
                {canEdit && !editing && (
                    <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground text-xs underline"
                        onClick={() => setEditing(true)}
                    >
                        ✏️ Edit
                    </button>
                )}
            </div>
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
    // OP content is state so an in-place edit shows without a reload.
    const [opContent, setOpContent] = useState(thread.op.content);

    const handleEdited = (postId: string, content: string) => {
        if (postId === thread.op.id) setOpContent(content);
        else setReplies((prev) => prev.map((r) => (r.id === postId ? { ...r, content } : r)));
    };
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [text, setText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const loadMoreReplies = async () => {
        setIsLoadingMore(true);
        const result = await getThread({ postId: thread.id, repliesOffset: replies.length });
        if (result.success) {
            setReplies((prev) => [...prev, ...result.thread.replies]);
            setHasMore(result.thread.hasMoreReplies);
        }
        setIsLoadingMore(false);
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
                    ← Back to the notice board
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
                <ThreadPostBlock
                    post={{ ...thread.op, content: opContent }}
                    isOp
                    knownAliases={thread.knownAliases}
                    canEdit={thread.op.authorId === currentUserId}
                    onEdited={handleEdited}
                />

                {/* Replies */}
                {replies.map((r) => (
                    <ThreadPostBlock
                        key={r.id}
                        post={r}
                        isOp={false}
                        knownAliases={thread.knownAliases}
                        canEdit={r.authorId === currentUserId}
                        onEdited={handleEdited}
                    />
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
                        {/* MentionTextarea completes @names as you type —
                            the fix for "@MODEL HORSE INTERNATIONAL" silently
                            missing because one letter differed from the real
                            alias. Same component the feed composer uses. */}
                        <MentionTextarea
                            className="border-input bg-card text-foreground min-h-[64px] w-full resize-none rounded-md border px-3 py-2 text-sm"
                            placeholder="Write a reply…"
                            value={text}
                            maxLength={2000}
                            rows={3}
                            onChange={setText}
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
