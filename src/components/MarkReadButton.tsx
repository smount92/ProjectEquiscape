"use client";

import { useState } from "react";
import { toggleMessageRead } from "@/app/actions/admin";
import { useRouter } from "next/navigation";

export default function MarkReadButton({ messageId, isRead }: { messageId: string; isRead: boolean }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleClick = async () => {
        setLoading(true);
        const result = await toggleMessageRead(messageId, !isRead);
        if (result.success) {
            router.refresh();
        }
        setLoading(false);
    };

    return (
        <button
            className={`admin-mark-btn ${isRead ? "admin-mark-unread" : "admin-mark-read"}`}
            onClick={handleClick}
            disabled={loading}
            title={isRead ? "Mark as unread" : "Mark as read"}
        >
            {loading ? (
                <span
                    className="hover:no-underline-min-h)] leading-none-spinner inline-flex h-[12] min-h-[var(--opacity-[0.5] w-[12] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] px-8 py-2 font-sans text-base font-semibold no-underline transition-all duration-150"
                    aria-hidden="true"
                />
            ) : isRead ? (
                "↩ Unread"
            ) : (
                "✓ Read"
            )}
        </button>
    );
}
