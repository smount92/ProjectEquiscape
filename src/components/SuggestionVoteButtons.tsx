"use client";

import { useState, useTransition } from "react";
import { voteSuggestion, removeVote } from "@/app/actions/catalog-suggestions";

interface Props {
    suggestionId: string;
    currentVote: string | null;
    upvotes: number;
    downvotes: number;
}

export default function SuggestionVoteButtons({
    suggestionId,
    currentVote: initialVote,
    upvotes: initialUp,
    downvotes: initialDown,
}: Props) {
    const [isPending, startTransition] = useTransition();
    const [currentVote, setCurrentVote] = useState(initialVote);
    const [upvotes, setUpvotes] = useState(initialUp);
    const [downvotes, setDownvotes] = useState(initialDown);

    const handleVote = (type: "up" | "down") => {
        // Optimistic update
        if (currentVote === type) {
            // Remove vote
            if (type === "up") setUpvotes((v) => v - 1);
            else setDownvotes((v) => v - 1);
            setCurrentVote(null);
            startTransition(async () => {
                await removeVote(suggestionId);
            });
        } else {
            // Switch or add vote
            if (currentVote === "up") setUpvotes((v) => v - 1);
            if (currentVote === "down") setDownvotes((v) => v - 1);
            if (type === "up") setUpvotes((v) => v + 1);
            else setDownvotes((v) => v + 1);
            setCurrentVote(type);
            startTransition(async () => {
                await voteSuggestion(suggestionId, type);
            });
        }
    };

    return (
        <div className="flex flex-col items-center gap-[4px]">
            <button
                className={`ref-vote-btn ref-vote-up ${currentVote === "up" ? "ref-vote-active" : ""}`}
                onClick={() => handleVote("up")}
                disabled={isPending}
                title="Upvote — I agree with this suggestion"
            >
                ▲
            </button>
            <span className="ref-vote-score">{upvotes - downvotes}</span>
            <button
                className={`ref-vote-btn ref-vote-down ${currentVote === "down" ? "ref-vote-active" : ""}`}
                onClick={() => handleVote("down")}
                disabled={isPending}
                title="Downvote — I disagree with this suggestion"
            >
                ▼
            </button>
        </div>
    );
}
