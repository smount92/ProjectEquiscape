"use client";

import { useState } from "react";
import UniversalFeed from "@/components/UniversalFeed";
import GroupRegistry from "@/components/GroupRegistry";
import GroupFiles from "@/components/GroupFiles";
import GroupBoard from "@/components/groups/GroupBoard";
import type { Group, GroupChannel } from "@/app/actions/groups";
import type { BoardThread } from "@/lib/groups/types";

// ============================================================
// BARN INTERIOR — what a member sees once they're through the
// door. The Notice Board is the room; Latest / Files / Registry
// are the tack room shelves beside it.
//
// The barn's ONE header is the leather masthead rendered by the
// page above this component (ExplorerLayout runs with `noHeader`).
// Do not add another heading here.
// ============================================================

interface Props {
    group: Group;
    initialPosts: Parameters<typeof UniversalFeed>[0]["initialPosts"];
    channels: GroupChannel[];
    currentUserId: string;
    /**
     * Notice-board data. Null means the board fetch FAILED (e.g.
     * migration 122 not applied) — the barn then falls back to the
     * flat feed so the room is still usable.
     */
    board?: { threads: BoardThread[]; hasMore: boolean } | null;
}

export default function GroupDetailClient({ group, initialPosts, channels, currentUserId, board = null }: Props) {
    const boardOk = board !== null;
    const [activeTab, setActiveTab] = useState<"board" | "feed" | "files" | "registry">(
        boardOk ? "board" : "feed",
    );

    const isAdmin = group.memberRole === "owner" || group.memberRole === "admin";
    const isMod = isAdmin || group.memberRole === "moderator";

    const tabClass = (tab: string) =>
        `min-h-[44px] cursor-pointer border-none bg-transparent px-3 py-1.5 text-xs font-semibold tracking-[0.14em] uppercase sm:min-h-0 ${
            activeTab === tab ? "ledger-tab !mb-0" : "text-muted-foreground hover:text-foreground"
        }`;

    return (
        <>
            {/* Room tabs */}
            <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Barn sections">
                {boardOk && (
                    <button role="tab" aria-selected={activeTab === "board"} className={tabClass("board")} onClick={() => setActiveTab("board")}>
                        📌 Notice Board
                    </button>
                )}
                <button role="tab" aria-selected={activeTab === "feed"} className={tabClass("feed")} onClick={() => setActiveTab("feed")}>
                    {boardOk ? "💬 Latest" : "💬 Feed"}
                </button>
                <button role="tab" aria-selected={activeTab === "files"} className={tabClass("files")} onClick={() => setActiveTab("files")}>
                    📁 Files
                </button>
                <button role="tab" aria-selected={activeTab === "registry"} className={tabClass("registry")} onClick={() => setActiveTab("registry")}>
                    📋 Registry
                </button>
            </div>

            {/* Board-fetch failure is not silent — members should know why
                the notice board is missing rather than assume it's empty. */}
            {!boardOk && (
                <p className="text-muted-foreground mb-4 text-xs italic">
                    The notice board is unavailable right now — showing the barn&apos;s latest posts instead.
                </p>
            )}

            {boardOk && activeTab === "board" && board && (
                <GroupBoard
                    groupId={group.id}
                    slug={group.slug}
                    channels={channels}
                    initialThreads={board.threads}
                    initialHasMore={board.hasMore}
                    isAdmin={isAdmin}
                />
            )}

            {activeTab === "feed" && (
                <UniversalFeed
                    initialPosts={initialPosts}
                    context={{ groupId: group.id }}
                    currentUserId={currentUserId}
                    showComposer={true}
                    composerPlaceholder="Share with the barn…"
                    label="Barn Posts"
                />
            )}

            {activeTab === "files" && <GroupFiles groupId={group.id} canUpload={isMod} canDelete={isAdmin} />}

            {activeTab === "registry" && <GroupRegistry groupId={group.id} isMember={group.isMember} />}
        </>
    );
}
