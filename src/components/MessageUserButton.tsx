"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrFindConversation } from "@/app/actions/messaging";

interface MessageUserButtonProps {
    targetUserId: string;
    targetAlias: string;
}

/**
 * MessageUserButton — opens a general DM conversation with a user
 * without requiring a specific horse context. Used on profile pages.
 */
export default function MessageUserButton({
    targetUserId,
    targetAlias,
}: MessageUserButtonProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleClick = async () => {
        if (loading) return;
        setLoading(true);
        setError(null);

        const result = await createOrFindConversation(targetUserId, null);

        if (result.success && result.conversationId) {
            router.push(`/inbox/${result.conversationId}`);
        } else {
            setError(result.error || "Could not start conversation.");
            setLoading(false);
        }
    };

    return (
        <div className="message-user-btn-wrapper">
            <button
                className="btn btn-ghost inline-flex items-center gap-sm !text-sm !py-sm !px-lg [&_svg]:shrink-0 hover:!text-accent-primary hover:!border-accent-primary"
                onClick={handleClick}
                disabled={loading}
                id={`message-user-${targetAlias}`}
            >
                {loading ? (
                    <>
                        <span className="btn-spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />
                        Opening…
                    </>
                ) : (
                    <>
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        Message
                    </>
                )}
            </button>
            {error && (
                <p className="form-error" style={{ marginTop: "var(--space-xs)", fontSize: "0.75rem" }}>
                    {error}
                </p>
            )}
        </div>
    );
}
