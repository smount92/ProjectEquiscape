"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    replyToPost,
    deletePost,
    updatePost,
    togglePostLike,
    type FeedStreamItem,
    type Post,
} from "@/app/actions/posts";
import { deleteTextPost } from "@/app/actions/activity";
import { toggleActivityLike } from "@/app/actions/likes";
import RichText from "@/components/RichText";
import { safeUUID } from "@/lib/utils/uuid";
import { PostHeader, HorseEmbedCard, ReactionBar, ReplyComposer } from "@/components/social";
import { Button } from "@/components/ui/button";

interface FeedPostCardProps {
    item: FeedStreamItem;
    currentUserId: string;
    currentUserAlias: string;
    currentUserAvatar: string | null;
    /** Aliases mentioned anywhere on this page, so spaced names link. */
    knownAliases: readonly string[];
    onRemoved: (id: string) => void;
}

/** Quiet forest pill for "where this was written" / audience chips. */
const CONTEXT_CHIP =
    "inline-flex max-w-full items-center gap-1 truncate rounded-full border border-forest/25 bg-forest/5 px-2.5 py-[3px] text-xs font-semibold text-forest no-underline";

/**
 * One row of the unified feed.
 *
 * Handles all three shapes the stream can contain:
 *   - a `posts` row (full: reply, like, edit, delete, media, context)
 *   - a `show_results` announcement (same, minus editing — a show's
 *     own words are not the host's to rewrite)
 *   - a legacy `activity_events` text post (read-only apart from
 *     liking and the author's own delete; there is no reply thread to
 *     attach to, and its likes live in the separate activity system)
 *
 * All three wear the SAME ledger leaf, deliberately: the point of the
 * merge was one stream, and three card treatments would undo it in
 * the eye even though the data is unified underneath. The only visual
 * fork is the brass fore-edge on a show announcement — that is the
 * platform speaking, not a member, and it earns a distinct edge.
 */
export default function FeedPostCard({
    item,
    currentUserId,
    currentUserAlias,
    currentUserAvatar,
    knownAliases,
    onRemoved,
}: FeedPostCardProps) {
    const router = useRouter();
    const isLegacy = item.source === "activity";
    const isSystem = item.kind === "show_results";

    const [showReplies, setShowReplies] = useState(false);
    const [showAllReplies, setShowAllReplies] = useState(false);
    const [replies, setReplies] = useState<Post[]>(item.replies);
    const [isPending, startTransition] = useTransition();
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(item.content);
    const [displayContent, setDisplayContent] = useState(item.content);
    const [wasEdited, setWasEdited] = useState(!!item.updatedAt && item.updatedAt !== item.createdAt);

    const handleReply = async (content: string) => {
        startTransition(async () => {
            const result = await replyToPost(item.id, content);
            if (!result.success) return;
            setReplies((prev) => [
                ...prev,
                {
                    id: safeUUID(),
                    authorId: currentUserId,
                    authorAlias: currentUserAlias,
                    authorAvatarUrl: currentUserAvatar,
                    content,
                    parentId: item.id,
                    horseId: null, groupId: null, eventId: null, studioId: null, helpRequestId: null,
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
        });
    };

    const handleDelete = () => {
        if (!confirm("Delete this post?")) return;
        startTransition(async () => {
            const result = isLegacy ? await deleteTextPost(item.id) : await deletePost(item.id);
            if (result.success) onRemoved(item.id);
            router.refresh();
        });
    };

    const handleEdit = () => {
        startTransition(async () => {
            const result = await updatePost(item.id, editText.trim());
            if (!result.success) return;
            setDisplayContent(editText.trim());
            setIsEditing(false);
            setWasEdited(true);
            router.refresh();
        });
    };

    // A horse permalink in the body becomes a rich card.
    const horseMatch = displayContent.match(
        /\/community\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    );
    const embedHorseId = horseMatch ? horseMatch[1] : null;

    const visibleReplies = replies.length > 3 && !showAllReplies ? replies.slice(0, 2) : replies;
    const hiddenCount = replies.length - 2;

    const gridMedia = item.media.slice(0, 4);

    return (
        <article
            className={`ledger-card paddock-post ${isSystem ? "paddock-post-system" : ""}`}
        >
            <PostHeader
                avatarUrl={item.authorAvatarUrl}
                alias={item.authorAlias}
                avatarSize="md"
                createdAt={item.createdAt}
                isEdited={wasEdited}
                permalink={`/feed/${item.id}`}
                actions={
                    item.canEdit || item.canDelete ? (
                        <>
                            {item.canEdit && (
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
                            )}
                            {item.canDelete && (
                                <button
                                    className="inline-flex min-h-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-1.5 py-0.5 text-xs font-semibold text-muted-foreground no-underline transition-all hover:bg-card"
                                    onClick={handleDelete}
                                    disabled={isPending}
                                    aria-label="Delete post"
                                >
                                    🗑️
                                </button>
                            )}
                        </>
                    ) : undefined
                }
            />

            {/* Where this was written, when it wasn't written here — and
                who it was written for, when that isn't everyone. */}
            {(item.context || isSystem || item.visibility === "followers") && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-10">
                    {isSystem && <span className="stamp">🏆 Show Results</span>}
                    {item.context && (
                        <Link href={item.context.href} className={`${CONTEXT_CHIP} hover:underline`}>
                            {item.context.label}
                        </Link>
                    )}
                    {item.visibility === "followers" && (
                        <span
                            className="border-input bg-muted text-secondary-foreground inline-flex items-center rounded-full border px-2.5 py-[3px] text-xs font-semibold"
                            title="Only your followers can see this post"
                        >
                            👥 Followers
                        </span>
                    )}
                </div>
            )}

            <div className="mt-1.5 pl-10">
                {isEditing ? (
                    <div className="flex flex-col gap-1">
                        <textarea
                            className="min-h-[36px] w-full resize-y rounded-md border border-input bg-(--paper-lit)/70 px-4 py-2 text-sm no-underline transition-all focus:border-forest focus:outline-none"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={3}
                            maxLength={2000}
                            aria-label="Edit post content"
                        />
                        <div className="flex gap-1">
                            <Button onClick={handleEdit} disabled={isPending || !editText.trim()}>
                                {isPending ? "Saving…" : "Save"}
                            </Button>
                            <Button
                                variant="outline"
                                size="wide"
                                className="text-muted-foreground"
                                onClick={() => setIsEditing(false)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <RichText content={displayContent} knownAliases={knownAliases} />
                )}

                {embedHorseId && <HorseEmbedCard horseId={embedHorseId} />}
            </div>

            {/* Photos read as prints on the page: bordered, rounded, one
                big or a tidy pair-grid — the PassportGallery treatment,
                not four full-bleed images stacked down the card. */}
            {gridMedia.length > 0 && (
                <div
                    className={`mt-3 grid gap-1.5 pl-10 ${
                        gridMedia.length === 1 ? "grid-cols-1" : "grid-cols-2"
                    }`}
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

            <div className="border-forest/15 mt-2 border-t pt-1 pl-10">
                <ReactionBar
                    isLiked={item.isLikedByMe}
                    likeCount={item.likesCount}
                    onToggle={() => (isLegacy ? toggleActivityLike(item.id) : togglePostLike(item.id))}
                    // Legacy rows have no reply thread — `posts` replies can't
                    // hang off an activity_events id, so no reply affordance
                    // rather than one that silently fails.
                    replyCount={isLegacy ? undefined : item.repliesCount}
                    onReplyToggle={isLegacy ? undefined : () => setShowReplies(!showReplies)}
                    isReplyOpen={showReplies}
                />
            </div>

            {showReplies && !isLegacy && (
                <div className="border-forest/25 mt-3 ml-10 border-l-2 pl-4">
                    {visibleReplies.map((r) => (
                        <div key={r.id} className="mb-3">
                            <PostHeader
                                avatarUrl={r.authorAvatarUrl}
                                alias={r.authorAlias}
                                createdAt={r.createdAt}
                                avatarSize="xs"
                                actions={
                                    r.authorId === currentUserId ? (
                                        <button
                                            className="inline-flex min-h-0 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground no-underline transition-all hover:bg-card"
                                            onClick={() => {
                                                if (!confirm("Delete this reply?")) return;
                                                startTransition(async () => {
                                                    await deletePost(r.id);
                                                    setReplies((prev) => prev.filter((x) => x.id !== r.id));
                                                    router.refresh();
                                                });
                                            }}
                                            disabled={isPending}
                                            aria-label="Delete reply"
                                        >
                                            🗑️
                                        </button>
                                    ) : undefined
                                }
                            />
                            <div className="mt-0.5 pl-8">
                                <RichText content={r.content} knownAliases={knownAliases} />
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
