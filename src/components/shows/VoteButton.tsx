"use client";

/**
 * Wave 4a — the community-vote heart, extracted from
 * ShowEntryGallery and taught to SAY what it does: "Vote · 3" /
 * "Voted · 4" instead of a bare heart. The gallery still owns the
 * cast/remove action; this stays presentational.
 *
 * - min-h-11 on coarse pointers (thumbs get the full target).
 * - The count pulses when it changes — transition-based, so
 *   motion-reduce switches it off.
 * - Your own entry says so in visible text, not a tooltip.
 */

import { useEffect, useRef } from "react";
import { Heart } from "lucide-react";

import type { GalleryEntry } from "@/lib/shows/gallery";

interface VoteButtonProps {
    entry: GalleryEntry;
    votingOpen: boolean;
    authed: boolean;
    pending: boolean;
    onToggle: (entry: GalleryEntry) => void;
}

export default function VoteButton({
    entry,
    votingOpen,
    authed,
    pending,
    onToggle,
}: VoteButtonProps) {
    const disabled = !votingOpen || !authed || entry.isOwn || pending;
    const voted = entry.viewerHasVoted;

    // Scale-pulse the count when it changes (a landing vote should
    // feel like something happened). Web Animations API — no state,
    // no keyframes in CSS — and prefers-reduced-motion opts out.
    const countRef = useRef<HTMLSpanElement>(null);
    const prevCount = useRef(entry.voteCount);
    useEffect(() => {
        if (prevCount.current === entry.voteCount) return;
        prevCount.current = entry.voteCount;
        if (
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
            return;
        }
        countRef.current?.animate?.(
            [
                { transform: "scale(1)" },
                { transform: "scale(1.3)" },
                { transform: "scale(1)" },
            ],
            { duration: 220, easing: "ease-out" },
        );
    }, [entry.voteCount]);

    const actionHint = !authed
        ? "Sign in to vote"
        : entry.isOwn
          ? "You can't vote for your own entry"
          : !votingOpen
            ? "Voting is closed"
            : voted
              ? "Remove your vote"
              : "Vote for this entry";

    return (
        <button
            type="button"
            className={`flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border border-input bg-card px-2.5 py-0.5 text-xs font-semibold transition-all pointer-coarse:min-h-11 disabled:cursor-default disabled:opacity-60 ${
                voted ? "text-destructive" : "text-muted-foreground"
            }`}
            disabled={disabled}
            aria-pressed={voted}
            aria-label={`${actionHint} — ${entry.voteCount} vote${entry.voteCount === 1 ? "" : "s"}`}
            data-testid="vote-button"
            onClick={() => onToggle(entry)}
        >
            <Heart
                size={14}
                strokeWidth={2}
                aria-hidden="true"
                fill={voted ? "currentColor" : "none"}
            />
            <span>{voted ? "Voted" : "Vote"}</span>
            <span aria-hidden="true">·</span>
            <span ref={countRef} data-testid="vote-count" className="inline-block">
                {entry.voteCount}
            </span>
            {entry.isOwn && (
                <span className="font-normal text-muted-foreground italic">(your entry)</span>
            )}
        </button>
    );
}
