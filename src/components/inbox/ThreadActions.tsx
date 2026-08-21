"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { setThreadArchived, setThreadMuted } from "@/app/actions/deals";

/**
 * Mute and archive — two things the inbox has never had, because there
 * was nowhere to store them. `conversation_participants` gives every
 * person their own row per thread, so both are one column each.
 *
 * Mute silences the EMAIL as well as the bell. Turning off "messages"
 * in settings only ever silenced the bell; every message still sent its
 * own email, with no batching and no unsubscribe.
 */
export default function ThreadActions({
    conversationId,
    muted,
    archived,
    enabled,
}: {
    conversationId: string;
    muted: boolean;
    archived: boolean;
    enabled: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const router = useRouter();

    if (!enabled) return null;

    const run = async (fn: () => Promise<{ success: boolean }>) => {
        setBusy(true);
        await fn();
        setBusy(false);
        setOpen(false);
        router.refresh();
    };

    return (
        <div className="relative">
            <button
                className="border-input bg-card text-muted-foreground hover:text-foreground flex h-[32px] w-[32px] items-center justify-center rounded-full border transition-all"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-label="Thread options"
                title="Thread options"
                disabled={busy}
            >
                ⋯
            </button>
            {open && (
                <div className="border-input bg-card absolute right-0 z-20 mt-1 w-52 rounded-lg border p-1 shadow-md">
                    <MenuItem
                        onClick={() => run(() => setThreadMuted(conversationId, !muted))}
                        disabled={busy}
                    >
                        {muted ? "🔔 Unmute this thread" : "🔕 Mute this thread"}
                    </MenuItem>
                    <MenuItem
                        onClick={() => run(() => setThreadArchived(conversationId, !archived))}
                        disabled={busy}
                    >
                        {archived ? "📥 Move back to inbox" : "🗄️ Archive"}
                    </MenuItem>
                </div>
            )}
        </div>
    );
}

function MenuItem({
    children,
    onClick,
    disabled,
}: {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            className="hover:bg-muted text-foreground block w-full rounded-md px-3 py-2 text-left text-sm transition-colors disabled:opacity-50"
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </button>
    );
}
