"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrFindConversation } from "@/app/actions/messaging";

interface MessageSellerButtonProps {
    sellerId: string;
    horseId: string;
    compact?: boolean;
}

export default function MessageSellerButton({
    sellerId,
    horseId,
    compact = false,
}: MessageSellerButtonProps) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (loading) return;

        setLoading(true);
        const result = await createOrFindConversation(sellerId, horseId);

        if (result.success && result.conversationId) {
            router.push(`/inbox/${result.conversationId}`);
        } else {
            setLoading(false);
        }
    };

    if (compact) {
        return (
            <button
                className="message-seller-btn-compact"
                onClick={handleClick}
                disabled={loading}
                title="Message Seller"
                aria-label="Message Seller"
            >
                {loading ? (
                    <span className="btn-spinner" style={{ width: 12, height: 12 }} aria-hidden="true" />
                ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                )}
            </button>
        );
    }

    return (
        <button
            className="message-seller-btn"
            onClick={handleClick}
            disabled={loading}
        >
            {loading ? (
                <>
                    <span className="btn-spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />
                    Opening…
                </>
            ) : (
                <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Message Seller
                </>
            )}
        </button>
    );
}
