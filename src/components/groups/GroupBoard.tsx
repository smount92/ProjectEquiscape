"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createGroupChannel, type GroupChannel } from "@/app/actions/groups";
import { createThread, getGroupBoard, markGroupRead } from "@/app/actions/groups-forum";
import type { BoardThread } from "@/lib/groups/types";

// ============================================================
// GROUP BOARD — the club notice board (NEXT_PUBLIC_GROUPS_FORUM).
// Channel tabs + green-ruled ledger thread list: brass unread dot,
// 📌 stickies with a warm tint, reply counts in forest numerals,
// bump-ordered rows. Clicking a row navigates into the thread.
// ============================================================

interface GroupBoardProps {
    groupId: string;
    slug: string;
    channels: GroupChannel[];
    initialThreads: BoardThread[];
    initialHasMore: boolean;
    /** owner/admin — may add channels */
    isAdmin: boolean;
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

/** Brass unread marker (radial brass dot per the notice-board design). */
function UnreadDot() {
    return (
        <span
            data-testid="unread-dot"
            aria-label="Unread"
            className="mt-1.5 h-2.5 w-2.5 justify-self-center rounded-full"
            style={{
                background: "radial-gradient(circle at 35% 30%, var(--brass-hi, #E8C878), var(--brass-dark, #7A5C22))",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.35)",
            }}
        />
    );
}

export default function GroupBoard({
    groupId,
    slug,
    channels: initialChannels,
    initialThreads,
    initialHasMore,
    isAdmin,
}: GroupBoardProps) {
    const router = useRouter();
    const [channels, setChannels] = useState(initialChannels);
    const [activeChannel, setActiveChannel] = useState<string | null>(null);
    const [threads, setThreads] = useState(initialThreads);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // New-thread form
    const [composerOpen, setComposerOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [formChannel, setFormChannel] = useState<string>("");
    const [isPosting, startPosting] = useTransition();
    const contentRef = useRef<HTMLTextAreaElement>(null);

    // Add-channel affordance (owner/admin)
    const [channelFormOpen, setChannelFormOpen] = useState(false);
    const [newChannelName, setNewChannelName] = useState("");
    const [isSavingChannel, startSavingChannel] = useTransition();

    // Board visit clears unread state — AFTER the dots above were
    // computed server-side. Dots reflect state at load; the next
    // visit sees them cleared. Simple and honest.
    const markedRef = useRef(false);
    useEffect(() => {
        if (markedRef.current) return;
        markedRef.current = true;
        void markGroupRead({ groupId });
    }, [groupId]);

    const loadBoard = async (channelId: string | null, offset: number, append: boolean) => {
        setIsLoading(true);
        setError(null);
        const result = await getGroupBoard({ groupId, channelId: channelId ?? undefined, offset });
        if (result.success) {
            setThreads((prev) => (append ? [...prev, ...result.threads] : result.threads));
            setHasMore(result.hasMore);
        } else {
            setError(result.error);
        }
        setIsLoading(false);
    };

    const switchChannel = (channelId: string | null) => {
        setActiveChannel(channelId);
        void loadBoard(channelId, 0, false);
    };

    const handleCreateThread = () => {
        startPosting(async () => {
            const result = await createThread({
                groupId,
                channelId: (formChannel || activeChannel) || undefined,
                title,
                content,
            });
            if (result.success) {
                router.push(`/community/groups/${slug}/thread/${result.threadId}`);
            } else {
                setError(result.error);
            }
        });
    };

    const handleAddChannel = () => {
        startSavingChannel(async () => {
            const result = await createGroupChannel(groupId, newChannelName);
            if (result.success && result.channelId) {
                setChannels((prev) => [...prev, {
                    id: result.channelId!,
                    name: newChannelName.trim(),
                    slug: newChannelName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                    description: null,
                    sortOrder: prev.length,
                }]);
                setNewChannelName("");
                setChannelFormOpen(false);
            } else if (!result.success) {
                setError(result.error || "Could not add channel.");
            }
        });
    };

    const autoGrow = () => {
        const el = contentRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
    };

    return (
        <div>
            {/* Channel tabs + New Thread */}
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Channels">
                    <button
                        role="tab"
                        aria-selected={activeChannel === null}
                        className={`min-h-[44px] cursor-pointer border-none bg-transparent px-3 py-1.5 text-xs font-semibold tracking-[0.14em] uppercase sm:min-h-0 ${activeChannel === null ? "ledger-tab !mb-0" : "text-muted-foreground hover:text-foreground"}`}
                        onClick={() => switchChannel(null)}
                    >
                        All
                    </button>
                    {channels.map((ch) => (
                        <button
                            key={ch.id}
                            role="tab"
                            aria-selected={activeChannel === ch.id}
                            className={`min-h-[44px] cursor-pointer border-none bg-transparent px-3 py-1.5 text-xs font-semibold tracking-[0.14em] uppercase sm:min-h-0 ${activeChannel === ch.id ? "ledger-tab !mb-0" : "text-muted-foreground hover:text-foreground"}`}
                            onClick={() => switchChannel(ch.id)}
                        >
                            {ch.name}
                        </button>
                    ))}
                    {isAdmin && !channelFormOpen && (
                        <button
                            className="text-muted-foreground hover:text-foreground min-h-[44px] cursor-pointer border-none bg-transparent px-2 py-1.5 text-xs sm:min-h-0"
                            onClick={() => setChannelFormOpen(true)}
                            title="Add a channel"
                        >
                            + Channel
                        </button>
                    )}
                    {isAdmin && channelFormOpen && (
                        <span className="inline-flex items-center gap-1">
                            <Input
                                className="h-8 w-36 text-xs"
                                placeholder="Channel name"
                                value={newChannelName}
                                maxLength={40}
                                onChange={(e) => setNewChannelName(e.target.value)}
                            />
                            <Button size="sm" className="text-xs" disabled={isSavingChannel || !newChannelName.trim()} onClick={handleAddChannel}>
                                Add
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => setChannelFormOpen(false)}>
                                ✕
                            </Button>
                        </span>
                    )}
                </div>
                {!composerOpen && (
                    <button className="btn-brass" onClick={() => { setComposerOpen(true); setFormChannel(activeChannel ?? ""); }}>
                        + New Thread
                    </button>
                )}
            </div>

            {/* New thread form */}
            {composerOpen && (
                <div className="ledger-card mb-4">
                    <span className="ledger-tab">New Thread</span>
                    <div className="flex flex-col gap-2">
                        <Input
                            placeholder="Thread title (3–120 characters)"
                            value={title}
                            maxLength={120}
                            onChange={(e) => setTitle(e.target.value)}
                            aria-label="Thread title"
                        />
                        {channels.length > 0 && (
                            <select
                                className="border-input bg-card text-foreground min-h-[44px] rounded-md border px-3 py-2 text-sm sm:min-h-0"
                                value={formChannel}
                                onChange={(e) => setFormChannel(e.target.value)}
                                aria-label="Channel"
                            >
                                <option value="">No channel</option>
                                {channels.map((ch) => (
                                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                                ))}
                            </select>
                        )}
                        <textarea
                            ref={contentRef}
                            className="border-input bg-card text-foreground min-h-[96px] w-full resize-none rounded-md border px-3 py-2 text-sm"
                            placeholder="What's on your mind? (2000 characters, room to breathe)"
                            value={content}
                            maxLength={2000}
                            onChange={(e) => { setContent(e.target.value); autoGrow(); }}
                            aria-label="Thread content"
                        />
                        {content.length > 1600 && (
                            <span className="text-muted-foreground text-right text-xs">{content.length}/2000</span>
                        )}
                        <div className="flex items-center justify-end gap-2">
                            <Button variant="outline" onClick={() => setComposerOpen(false)} disabled={isPosting}>
                                Cancel
                            </Button>
                            <button
                                className="btn-brass disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={handleCreateThread}
                                disabled={isPosting || title.trim().length < 3 || !content.trim()}
                            >
                                {isPosting ? "Posting…" : "Post Thread"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {error && <p className="text-destructive mb-3 text-sm">{error}</p>}

            {/* The ledger thread list */}
            <div className="ledger-card !p-0" aria-busy={isLoading}>
                {threads.length === 0 && !isLoading && (
                    <p className="text-muted-foreground px-8 py-10 text-center text-sm italic">
                        Nothing on the board yet. Pin up the first notice!
                    </p>
                )}
                {threads.map((t) => (
                    <div
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        className={`grid w-full cursor-pointer grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-0 border-b border-solid border-[color-mix(in_srgb,var(--color-forest,#2C5545)_16%,transparent)] bg-transparent px-4 py-3 pl-8 text-left last:border-b-0 hover:bg-[color-mix(in_srgb,var(--color-forest,#2C5545)_4%,transparent)] ${t.isPinned ? "bg-[color-mix(in_srgb,var(--brass,#B08D3E)_8%,transparent)] hover:bg-[color-mix(in_srgb,var(--brass,#B08D3E)_13%,transparent)]" : ""}`}
                        onClick={() => router.push(`/community/groups/${slug}/thread/${t.id}`)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                router.push(`/community/groups/${slug}/thread/${t.id}`);
                            }
                        }}
                    >
                        {t.isPinned ? (
                            <span className="justify-self-center text-sm" title="Pinned" aria-label="Pinned">📌</span>
                        ) : t.unread ? (
                            <UnreadDot />
                        ) : (
                            <span aria-hidden="true" />
                        )}
                        <span className={`truncate text-[0.95rem] ${t.unread || t.isPinned ? "text-foreground font-bold" : "text-secondary-foreground font-normal"}`}>
                            {t.displayTitle}
                        </span>
                        <span className="row-span-2 text-right">
                            <span className="text-forest block text-base font-bold tabular-nums">{t.repliesCount}</span>
                            <span className="text-muted-foreground block text-[0.6rem] tracking-[0.16em] uppercase">
                                {t.repliesCount === 1 ? "reply" : "replies"}
                            </span>
                            <span className="text-muted-foreground block text-[0.68rem] italic">{timeAgo(t.lastActivity)}</span>
                        </span>
                        <span className="text-muted-foreground col-start-2 truncate text-xs">
                            started by{" "}
                            <Link
                                href={`/profile/${encodeURIComponent(t.authorAlias)}`}
                                className="text-saddle font-bold hover:underline"
                                onClick={(e) => e.stopPropagation()}
                            >
                                @{t.authorAlias}
                            </Link>
                            {t.isPinned && " · pinned"}
                            {t.lastReplyAlias && (
                                <>
                                    {" "}· last reply{" "}
                                    <Link
                                        href={`/profile/${encodeURIComponent(t.lastReplyAlias)}`}
                                        className="text-saddle font-bold hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        @{t.lastReplyAlias}
                                    </Link>
                                    , {timeAgo(t.lastActivity)}
                                </>
                            )}
                        </span>
                    </div>
                ))}
            </div>

            {hasMore && (
                <div className="mt-3 flex justify-center">
                    <Button variant="outline" size="wide" disabled={isLoading} onClick={() => loadBoard(activeChannel, threads.length, true)}>
                        {isLoading ? "Loading…" : "Load more threads"}
                    </Button>
                </div>
            )}
        </div>
    );
}
