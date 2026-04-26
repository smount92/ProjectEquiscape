"use client";

import { useState } from"react";
import { useRouter } from"next/navigation";
import { createOrFindConversation } from"@/app/actions/messaging";

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
 setError(result.error ||"Could not start conversation.");
 setLoading(false);
 }
 };

 return (
 <div className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={handleClick}
 disabled={loading}
 id={`message-user-${targetAlias}`}
 >
 {loading ? (
 <>
 <span
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
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
 <p className="text-red-700 mt-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-xs">
 {error}
 </p>
 )}
 </div>
 );
}
