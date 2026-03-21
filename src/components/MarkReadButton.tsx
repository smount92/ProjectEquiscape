"use client";

import { useState } from "react";
import { toggleMessageRead } from "@/app/actions/admin";
import { useRouter } from "next/navigation";

export default function MarkReadButton({
    messageId,
    isRead,
}: {
    messageId: string;
    isRead: boolean;
}) {
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
                <span className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-spinner w-[12] h-[12]" aria-hidden="true" />
            ) : isRead ? (
                "↩ Unread"
            ) : (
                "✓ Read"
            )}
        </button>
    );
}
