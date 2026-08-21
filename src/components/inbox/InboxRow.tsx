"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { UserAvatar } from "@/components/social";
import { setThreadArchived, setThreadMuted } from "@/app/actions/deals";
import { stageLabel } from "@/lib/deals/vocabulary";
import type { InboxThread } from "@/app/inbox/reads";

/**
 * One line in the inbox.
 *
 * The thing this fixes beyond performance: a $400 sale mid-payment and
 * someone asking which mold a horse is used to look identical — same
 * avatar, same grey preview, same everything. A deal now carries its
 * stage as a stamp and its role as a chip, and a plain conversation
 * carries neither, so the two are told apart before you read a word.
 */
export default function InboxRow({
    thread,
    muteEnabled,
}: {
    thread: InboxThread;
    muteEnabled: boolean;
}) {
    const [busy, setBusy] = useState(false);
    const router = useRouter();

    const isDeal = thread.dealKind !== null || thread.stage !== null;
    const unread = thread.unreadCount > 0;

    const toggle = async (
        e: React.MouseEvent,
        fn: () => Promise<{ success: boolean }>,
    ) => {
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        await fn();
        setBusy(false);
        router.refresh();
    };

    return (
        <div
            className={`border-input relative border-b last:border-b-0 ${
                unread ? "bg-success/10" : ""
            }`}
        >
            <Link
                href={`/inbox/${thread.id}`}
                className="text-foreground flex items-center gap-4 px-6 py-4 no-underline transition-all hover:bg-black/[0.03] max-md:gap-2 max-md:px-4 max-md:py-3"
                id={`inbox-item-${thread.id}`}
            >
                {thread.subjectThumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={thread.subjectThumbUrl}
                        alt={thread.subjectTitle ?? ""}
                        className="h-11 w-11 shrink-0 rounded-md object-cover max-md:h-9 max-md:w-9"
                    />
                ) : (
                    <UserAvatar
                        src={thread.otherAvatarUrl}
                        alias={thread.otherAlias}
                        size="sm"
                    />
                )}

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className={`text-sm font-semibold ${unread ? "text-forest" : "text-foreground"}`}
                        >
                            @{thread.otherAlias}
                        </span>
                        {thread.roleLabel && (
                            <span className="border-input bg-muted text-muted-foreground inline-block rounded-full border px-2 py-[1px] text-[0.65rem] font-semibold">
                                {thread.roleLabel}
                            </span>
                        )}
                        {thread.disputed ? (
                            <span className="border-warning/40 bg-warning/10 text-warning inline-block rounded-full border px-2 py-[1px] text-[0.65rem] font-semibold">
                                Disputed
                            </span>
                        ) : (
                            thread.stage && (
                                <span className="border-forest/25 bg-forest/5 text-forest inline-block rounded-full border px-2 py-[1px] text-[0.65rem] font-semibold">
                                    {stageLabel(thread.stage)}
                                </span>
                            )
                        )}
                        {thread.muted && (
                            <span className="text-muted-foreground text-[0.65rem]" title="Muted">
                                🔕
                            </span>
                        )}
                        <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                            {timeAgo(thread.lastAt)}
                        </span>
                    </div>

                    <div className="text-muted-foreground mt-[2px] flex items-center gap-1 text-xs">
                        {thread.subjectTitle ? (
                            <>
                                {isDeal ? "🤝" : "🐴"} {thread.subjectTitle}
                            </>
                        ) : (
                            <>💬 Direct message</>
                        )}
                    </div>

                    <div className="text-secondary-foreground mt-1 overflow-hidden text-xs text-ellipsis whitespace-nowrap">
                        {thread.preview ? (
                            <>
                                {thread.previewIsMine && (
                                    <span className="text-foreground font-semibold">You: </span>
                                )}
                                {thread.preview}
                            </>
                        ) : (
                            <span className="text-muted-foreground">No messages yet</span>
                        )}
                    </div>
                </div>

                {unread && (
                    <div className="bg-forest flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-full px-1.5 text-[0.7rem] font-bold text-white">
                        {thread.unreadCount}
                    </div>
                )}
            </Link>

            {muteEnabled && (
                <div className="absolute right-2 bottom-2 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 hover:opacity-100 max-md:hidden">
                    <RowButton
                        title={thread.muted ? "Unmute" : "Mute"}
                        disabled={busy}
                        onClick={(e) => toggle(e, () => setThreadMuted(thread.id, !thread.muted))}
                    >
                        {thread.muted ? "🔔" : "🔕"}
                    </RowButton>
                    <RowButton
                        title={thread.archived ? "Move back to inbox" : "Archive"}
                        disabled={busy}
                        onClick={(e) =>
                            toggle(e, () => setThreadArchived(thread.id, !thread.archived))
                        }
                    >
                        {thread.archived ? "📥" : "🗄️"}
                    </RowButton>
                </div>
            )}
        </div>
    );
}

function RowButton({
    children,
    title,
    onClick,
    disabled,
}: {
    children: React.ReactNode;
    title: string;
    onClick: (e: React.MouseEvent) => void;
    disabled?: boolean;
}) {
    return (
        <button
            className="border-input bg-card hover:bg-muted flex h-7 w-7 items-center justify-center rounded-full border text-xs transition-colors disabled:opacity-40"
            title={title}
            aria-label={title}
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </button>
    );
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
