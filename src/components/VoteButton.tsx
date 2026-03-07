"use client";

import { useState } from "react";
import { voteForEntry } from "@/app/actions/shows";

interface VoteButtonProps {
    entryId: string;
    initialVotes: number;
    initialHasVoted: boolean;
}

export default function VoteButton({
    entryId,
    initialVotes,
    initialHasVoted,
}: VoteButtonProps) {
    const [votes, setVotes] = useState(initialVotes);
    const [hasVoted, setHasVoted] = useState(initialHasVoted);
    const [loading, setLoading] = useState(false);

    const handleVote = async () => {
        setLoading(true);
        const result = await voteForEntry(entryId);
        if (result.success && result.newVotes !== undefined) {
            setVotes(result.newVotes);
            setHasVoted(!hasVoted);
        }
        setLoading(false);
    };

    return (
        <button
            className={`vote-button ${hasVoted ? "vote-button-voted" : ""}`}
            onClick={handleVote}
            disabled={loading}
        >
            <span className="vote-icon">{hasVoted ? "❤️" : "🤍"}</span>
            <span className="vote-count">{votes}</span>
        </button>
    );
}
