"use client";

import { useState } from"react";
import { voteForEntry } from"@/app/actions/shows";

interface VoteButtonProps {
 entryId: string;
 initialVotes: number;
 initialHasVoted: boolean;
 disabled?: boolean;
}

export default function VoteButton({ entryId, initialVotes, initialHasVoted, disabled = false }: VoteButtonProps) {
 const [votes, setVotes] = useState(initialVotes);
 const [hasVoted, setHasVoted] = useState(initialHasVoted);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const handleVote = async () => {
 if (disabled) return;
 setLoading(true);
 setError(null);
 const result = await voteForEntry(entryId);
 if (result.success && result.newVotes !== undefined) {
 setVotes(result.newVotes);
 setHasVoted(!hasVoted);
 } else if (result.error) {
 setError(result.error);
 setTimeout(() => setError(null), 3000);
 }
 setLoading(false);
 };

 return (
 <div className="flex flex-col items-center gap-[2px]">
 <button
 className={`vote-button min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 ${hasVoted ?"vote-button-voted" :""} ${disabled ?"cursor-not-allowed opacity-50" :""}`}
 onClick={handleVote}
 disabled={loading || disabled}
 title={disabled ?"Voting is closed" : undefined}
 >
 <span className="vote-icon">{hasVoted ?"❤️" :"🤍"}</span>
 <span className="font-semibold">{votes}</span>
 </button>
 {error && (
 <span className="max-w-[100px] text-center text-[0.625rem] leading-tight text-[var(--color-error,#ef4444)]">
 {error}
 </span>
 )}
 </div>
 );
}
