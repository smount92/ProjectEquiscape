"use client";

import { useState } from "react";
import { voteForEntry } from "@/app/actions/shows";

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
        <div className="gap-[2px]" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <button
                className={`vote-button ${hasVoted ? "vote-button-voted" : ""}`}
                onClick={handleVote}
                disabled={loading || disabled}
                style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                title={disabled ? "Voting is closed" : undefined}
            >
                <span className="vote-icon">{hasVoted ? "❤️" : "🤍"}</span>
                <span className="font-semibold">{votes}</span>
            </button>
            {error && (
                <span
                    style={{
                        fontSize: "calc(0.65rem * var(--font-scale))",
                        color: "var(--color-error, #ef4444)",
                        maxWidth: "100px",
                        textAlign: "center",
                        lineHeight: 1.2,
                    }}
                >
                    {error}
                </span>
            )}
        </div>
    );
}
