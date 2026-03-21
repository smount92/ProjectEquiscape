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
        <div className="message-user-inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-wrapper">
            <button
                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge inline-flex items-center gap-2 !text-sm !py-2 !px-6 [&_svg]:shrink-0 hover:!text-forest hover:!border-forest"
                onClick={handleClick}
                disabled={loading}
                id={`message-user-${targetAlias}`}
            >
                {loading ? (
                    <>
                        <span className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-spinner w-[14] h-[14]" aria-hidden="true" />
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
                <p className="flex items-center gap-2 mt-2 py-2 px-4 bg-[rgba(240,108,126,0.1)] border border-[rgba(240,108,126,0.3)] rounded-md text-danger text-sm mt-1 text-xs">
                    {error}
                </p>
            )}
        </div>
    );
}
