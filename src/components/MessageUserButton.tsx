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
export default function MessageUserButton({ targetUserId, targetAlias }: MessageUserButtonProps) {
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
        <div className="message-user-inline-flex hover:no-underline-min-h)] leading-none-wrapper min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] px-8 py-2 font-sans text-base font-semibold no-underline transition-all duration-150">
            <button
                className="hover:no-underline-min-h)] text-ink-light border-edge hover:!text-forest hover:!border-forest inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent !px-6 px-8 !py-2 py-2 font-sans !text-sm text-base leading-none font-semibold no-underline transition-all duration-150 [&_svg]:shrink-0"
                onClick={handleClick}
                disabled={loading}
                id={`message-user-${targetAlias}`}
            >
                {loading ? (
                    <>
                        <span
                            className="hover:no-underline-min-h)] leading-none-spinner inline-flex h-[14] min-h-[var(--opacity-[0.5] w-[14] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] px-8 py-2 font-sans text-base font-semibold no-underline transition-all duration-150"
                            aria-hidden="true"
                        />
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
                <p className="text-danger mt-1 mt-2 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm text-xs">
                    {error}
                </p>
            )}
        </div>
    );
}
