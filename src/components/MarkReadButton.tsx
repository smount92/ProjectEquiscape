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
                <span className="btn-spinner" style={{ width: 12, height: 12 }} aria-hidden="true" />
            ) : isRead ? (
                "↩ Unread"
            ) : (
                "✓ Read"
            )}
        </button>
    );
}
