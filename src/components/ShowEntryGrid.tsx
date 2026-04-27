"use client";

import { useState } from "react";
import Link from "next/link";
import PhotoLightbox from "@/components/PhotoLightbox";
import VoteButton from "@/components/VoteButton";
import WithdrawButton from "@/components/WithdrawButton";

interface ShowEntry {
  id: string;
  horseId: string;
  horseName: string;
  ownerAlias: string;
  ownerId: string;
  thumbnailUrl: string | null;
  caption: string | null;
  votes: number;
  hasVoted: boolean;
  placing: string | null;
  finishType: string | null;
  className: string | null;
  divisionName: string | null;
}

interface ShowEntryGridProps {
  entries: ShowEntry[];
  showStatus: string;
  isExpertJudged: boolean;
  isJudging: boolean;
  currentUserId: string;
}

export default function ShowEntryGrid({
  entries,
  showStatus,
  isExpertJudged,
  isJudging,
  currentUserId,
}: ShowEntryGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Build lightbox images array from entries with thumbnails
  const lightboxImages = entries
    .filter((e) => e.thumbnailUrl)
    .map((e) => ({
      url: e.thumbnailUrl!,
      label: `${e.horseName} — by @${e.ownerAlias}${e.className ? ` · ${e.className}` : ""}`,
    }));

  // Map entry index to lightbox index (for entries that have thumbnails)
  const entryToLightboxIndex = new Map<number, number>();
  let lbIdx = 0;
  entries.forEach((e, i) => {
    if (e.thumbnailUrl) {
      entryToLightboxIndex.set(i, lbIdx);
      lbIdx++;
    }
  });

  return (
    <>
      <div className="animate-fade-in-up flex flex-col gap-0 overflow-hidden rounded-xl border border-input bg-card shadow-sm">
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            className="flex items-center gap-4 border-b border-input px-6 py-4 transition-colors last:border-b-0 hover:bg-muted"
          >
            <div className="min-w-[32px] text-center text-lg font-bold text-muted-foreground">
              {isExpertJudged && showStatus === "closed" && entry.placing
                ? entry.placing
                : `#${index + 1}`}
            </div>
            {entry.thumbnailUrl && (
              <button
                type="button"
                className="h-[64px] w-[64px] shrink-0 cursor-pointer overflow-hidden rounded-md border-0 bg-muted p-0 transition-transform hover:scale-105 hover:ring-2 hover:ring-forest"
                onClick={() => setLightboxIndex(entryToLightboxIndex.get(index) ?? null)}
                title="Click to view full photo"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={entry.thumbnailUrl}
                  alt={entry.horseName}
                  loading="lazy"
                  className="h-full w-full object-contain"
                />
              </button>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
              <Link
                href={`/community/${entry.horseId}`}
                className="text-base font-semibold text-inherit no-underline hover:text-forest"
              >
                🐴 {entry.horseName}
              </Link>
              <span className="text-forest no-underline">
                by{" "}
                {entry.ownerId === "hidden" ? (
                  <span className="text-muted">@{entry.ownerAlias}</span>
                ) : (
                  <Link href={`/profile/${encodeURIComponent(entry.ownerAlias)}`}>
                    @{entry.ownerAlias}
                  </Link>
                )}
                {" ·"}
                {entry.finishType}
                {entry.className && (
                  <span className="ml-1 text-forest">
                    · {entry.divisionName && `${entry.divisionName} / `}
                    {entry.className}
                  </span>
                )}
              </span>
              {entry.caption && (
                <p className="mt-1 text-xs italic leading-tight text-muted-foreground">
                  &ldquo;{entry.caption}&rdquo;
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {isExpertJudged ? (
                entry.placing && showStatus === "closed" ? (
                  <span className="rounded-sm bg-amber-500/15 px-2 py-1 text-sm font-semibold text-amber-500">
                    {entry.placing}
                  </span>
                ) : isJudging ? (
                  <span className="text-xs text-muted-foreground">🏅 Expert judging</span>
                ) : null
              ) : (
                <VoteButton
                  entryId={entry.id}
                  initialVotes={entry.votes}
                  initialHasVoted={entry.hasVoted}
                  disabled={showStatus !== "open"}
                />
              )}
              {entry.ownerId === currentUserId && showStatus === "open" && (
                <WithdrawButton entryId={entry.id} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
