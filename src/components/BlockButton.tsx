"use client";

import { useState, useTransition } from "react";
import { blockUser, unblockUser } from "@/app/actions/blocks";

interface BlockButtonProps {
    targetId: string;
    targetAlias: string;
    initialBlocked: boolean;
}

export default function BlockButton({ targetId, targetAlias, initialBlocked }: BlockButtonProps) {
    const [blocked, setBlocked] = useState(initialBlocked);
    const [isPending, startTransition] = useTransition();

    const handleToggle = () => {
        const action = blocked ? "unblock" : "block";
        const confirmMsg = blocked
            ? `Unblock @${targetAlias}?`
            : `Block @${targetAlias}? They won't be able to message you, and their content will be hidden from your feeds.`;

        if (!confirm(confirmMsg)) return;

        const wasBlocked = blocked;
        setBlocked(!blocked);

        startTransition(async () => {
            const result = action === "block"
                ? await blockUser(targetId)
                : await unblockUser(targetId);

            if (!result.success) {
                setBlocked(wasBlocked); // Revert
            }
        });
    };

    return (
        <button
            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
            onClick={handleToggle}
            disabled={isPending}
            style={{ fontSize: "calc(0.8rem * var(--font-scale))", color: blocked ? "var(--color-text-muted)" : "var(--color-danger)" }}
        >
            {blocked ? "✓ Blocked — Unblock" : "🚫 Block User"}
        </button>
    );
}
