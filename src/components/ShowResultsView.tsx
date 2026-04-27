"use client";

import { useState } from "react";
import Link from "next/link";
import VoteButton from "@/components/VoteButton";
import WithdrawButton from "@/components/WithdrawButton";
import PhotoLightbox from "@/components/PhotoLightbox";

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
  classId: string | null;
}

interface ClassOption {
  id: string;
  name: string;
  divisionName: string;
}

interface ShowResultsViewProps {
  entries: ShowEntry[];
  classes: ClassOption[];
  showStatus: string;
  isExpertJudged: boolean;
  isJudging: boolean;
  currentUserId: string;
}

const MEDAL_MAP: Record<string, string> = {
  "1st": "🥇", "2nd": "🥈", "3rd": "🥉",
  HM: "🎗️",
  Champion: "🏆", "Reserve Champion": "🥈",
  "Grand Champion": "🏆", "Reserve Grand Champion": "🥈",
};

const RIBBON_BORDER_MAP: Record<string, string> = {
  "1st": "border-blue-500",
  "2nd": "border-red-500",
  "3rd": "border-yellow-500",
  "4th": "border-input",
  "5th": "border-pink-500",
  "6th": "border-green-500",
  HM: "border-green-500",
  Champion: "border-blue-600",
  "Reserve Champion": "border-red-600",
};

const PLACE_ORDER: Record<string, number> = {
  "Grand Champion": 0,
  "Reserve Grand Champion": 1,
  Champion: 2,
  "Reserve Champion": 3,
  "1st": 4, "2nd": 5, "3rd": 6,
  "4th": 7, "5th": 8, "6th": 9,
  HM: 10,
};

export default function ShowResultsView({
  entries,
  classes,
  showStatus,
  isExpertJudged,
  isJudging,
  currentUserId,
}: ShowResultsViewProps) {
  const hasClasses = classes.length > 0;

  // Default to first class if classes exist, otherwise show all
  const [selectedClassId, setSelectedClassId] = useState<string>(
    hasClasses ? classes[0].id : "all"
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  // Filter entries by class
  const filteredEntries = selectedClassId === "all"
    ? entries
    : entries.filter((e) => e.classId === selectedClassId);

  // Group classes by division
  const divisionGroups: Map<string, ClassOption[]> = new Map();
  if (hasClasses) {
    for (const c of classes) {
      const group = divisionGroups.get(c.divisionName) || [];
      group.push(c);
      divisionGroups.set(c.divisionName, group);
    }
  }

  // Compute results for filtered entries
  const isClosed = showStatus === "closed";
  const champions = filteredEntries.filter(
    (e) =>
      e.placing &&
      ["Champion", "Reserve Champion", "Grand Champion", "Reserve Grand Champion"].includes(e.placing)
  );
  const topPlaced = isExpertJudged
    ? filteredEntries
        .filter(
          (e) =>
            e.placing &&
            !["Champion", "Reserve Champion", "Grand Champion", "Reserve Grand Champion"].includes(e.placing)
        )
        .sort((a, b) => (PLACE_ORDER[a.placing!] ?? 99) - (PLACE_ORDER[b.placing!] ?? 99))
        .slice(0, 6)
    : filteredEntries
        .sort((a, b) => b.votes - a.votes)
        .slice(0, 3);
  const podiumEntries = topPlaced.slice(0, 3);

  // Sorted entries for the grid
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (isExpertJudged && isClosed) {
      const aOrder = a.placing ? (PLACE_ORDER[a.placing] ?? 99) : 99;
      const bOrder = b.placing ? (PLACE_ORDER[b.placing] ?? 99) : 99;
      return aOrder - bOrder;
    }
    return b.votes - a.votes;
  });

  // Lightbox images
  const lightboxImages = sortedEntries
    .filter((e) => e.thumbnailUrl)
    .map((e) => ({
      url: e.thumbnailUrl!,
      label: `${e.horseName} — by @${e.ownerAlias}`,
    }));

  const entryToLightboxIndex = new Map<number, number>();
  let lbIdx = 0;
  sortedEntries.forEach((e, i) => {
    if (e.thumbnailUrl) {
      entryToLightboxIndex.set(i, lbIdx);
      lbIdx++;
    }
  });

  return (
    <>
      {/* Class Selector */}
      {hasClasses && (
        <div className="animate-fade-in-up mb-6 rounded-xl border border-input bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
            {isClosed ? "📋 View Results by Class" : "📋 Browse by Class"}
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                selectedClassId === "all"
                  ? "border-forest bg-forest/10 text-forest ring-1 ring-forest"
                  : "border-input text-secondary-foreground hover:border-input hover:shadow-sm"
              }`}
              onClick={() => setSelectedClassId("all")}
            >
              All ({entries.length})
            </button>
            {Array.from(divisionGroups.entries()).map(([divName, items]) => (
              <div key={divName} className="flex items-center gap-1">
                <span className="ml-2 text-xs font-bold text-muted-foreground">{divName}:</span>
                {items.map((c) => {
                  const count = entries.filter((e) => e.classId === c.id).length;
                  const isActive = selectedClassId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                        isActive
                          ? "border-forest bg-forest/10 text-forest ring-1 ring-forest"
                          : "border-input text-secondary-foreground hover:border-input hover:shadow-sm"
                      }`}
                      onClick={() => setSelectedClassId(c.id)}
                    >
                      {c.name} ({count})
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {selectedClass && (
            <div className="mt-2 text-sm text-muted-foreground">
              Viewing: <strong>{selectedClass.divisionName}</strong> › <strong>{selectedClass.name}</strong>
              {" · "}{filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"}
            </div>
          )}
        </div>
      )}

      {/* Results Podium — only for closed shows with placed entries */}
      {isClosed && filteredEntries.length > 0 && (topPlaced.length > 0 || champions.length > 0) && (
        <div className="animate-fade-in-up mb-6 rounded-xl border border-input bg-card p-8 shadow-sm">
          <h2 className="mb-2 text-center text-xl">
            🏆 <span className="text-forest">
              {selectedClass ? `${selectedClass.name} — Results` : "Results"}
            </span>
          </h2>

          {/* Champion Banners */}
          {champions.map((entry) => (
            <div key={entry.id} className="animate-fade-in-up mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
              <div className="mb-2 text-xl font-extrabold">
                {MEDAL_MAP[entry.placing!] || "🏆"} {entry.placing}
              </div>
              <div className="flex items-center justify-center gap-4">
                {entry.thumbnailUrl && (
                  <div className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={entry.thumbnailUrl} alt={entry.horseName} className="h-full w-full object-contain" />
                  </div>
                )}
                <div>
                  <Link href={`/community/${entry.horseId}`} className="text-base font-bold">
                    🐴 {entry.horseName}
                  </Link>
                  <div className="text-sm text-muted-foreground">
                    by{" "}
                    {entry.ownerId === "hidden" ? (
                      <span className="text-muted text-sm">@{entry.ownerAlias}</span>
                    ) : (
                      <Link href={`/profile/${encodeURIComponent(entry.ownerAlias)}`}>@{entry.ownerAlias}</Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Podium */}
          <div className="flex flex-wrap items-end justify-center gap-8 px-0 py-8">
            {podiumEntries.map((entry, i) => {
              const placing = isExpertJudged ? entry.placing! : ["1st", "2nd", "3rd"][i];
              const medal = MEDAL_MAP[placing] || "🏅";
              return (
                <div
                  key={entry.id}
                  className={`max-w-[220px] min-w-[160px] overflow-hidden rounded-lg text-center shadow-lg transition-transform ${i === 0 ? "scale-105" : ""}`}
                >
                  <div className="h-1 w-full bg-amber-400" />
                  {entry.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.thumbnailUrl} alt={entry.horseName} className="aspect-[4/3] w-full object-contain bg-muted" />
                  )}
                  <div className="max-w-[220px] min-w-[160px] overflow-hidden rounded-lg bg-card p-4 text-center shadow-lg">
                    <div className="mb-1 text-[2rem]">{medal}</div>
                    <Link href={`/community/${entry.horseId}`} className="block text-sm font-bold text-inherit no-underline hover:underline">
                      {entry.horseName}
                    </Link>
                    <div className="mt-[2px] text-xs text-muted-foreground">
                      by{" "}
                      {entry.ownerId === "hidden" ? (
                        <span className="text-muted text-xs">@{entry.ownerAlias}</span>
                      ) : (
                        <Link href={`/profile/${encodeURIComponent(entry.ownerAlias)}`}>@{entry.ownerAlias}</Link>
                      )}
                      {!isExpertJudged && ` · ${entry.votes} vote${entry.votes !== 1 ? "s" : ""}`}
                    </div>
                    <div className="mt-1 text-sm font-extrabold text-[var(--color-accent,#f59e0b)]">
                      {placing}
                    </div>
                    {entry.caption && (
                      <div className="mt-1 text-xs italic leading-snug text-muted-foreground">
                        &ldquo;{entry.caption}&rdquo;
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Also Placed */}
          {topPlaced.length > 3 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm text-muted-foreground">Also Placed</h3>
              {topPlaced.slice(3).map((entry) => {
                const placing = entry.placing!;
                return (
                  <div
                    key={entry.id}
                    className={`mb-1 flex items-center gap-4 border-l-[3px] px-4 py-2 ${RIBBON_BORDER_MAP[placing] || "border-green-500"}`}
                  >
                    {entry.thumbnailUrl && (
                      <div className="h-[36px] w-[36px] shrink-0 overflow-hidden rounded-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={entry.thumbnailUrl} alt={entry.horseName} className="h-full w-full object-contain" />
                      </div>
                    )}
                    <div className="flex-1">
                      <Link href={`/community/${entry.horseId}`} className="font-semibold">
                        {entry.horseName}
                      </Link>
                      <span className="ml-1 text-xs text-muted-foreground">by @{entry.ownerAlias}</span>
                    </div>
                    <span className="text-sm font-bold text-[var(--color-accent,#f59e0b)]">
                      {MEDAL_MAP[placing] || "🏅"} {placing}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Entries Grid */}
      {filteredEntries.length === 0 ? (
        <div className="animate-fade-in-up rounded-xl border border-input bg-card px-8 py-12 text-center shadow-sm">
          <div className="mb-4 text-5xl">📸</div>
          <h2>{hasClasses && selectedClassId !== "all" ? "No Entries in This Class" : "No Entries Yet"}</h2>
          <p>{hasClasses && selectedClassId !== "all" ? "Try selecting a different class." : "Be the first to enter this show!"}</p>
        </div>
      ) : (
        <div className="animate-fade-in-up flex flex-col gap-0 overflow-hidden rounded-xl border border-input bg-card shadow-sm">
          {sortedEntries.map((entry, index) => (
            <div
              key={entry.id}
              className="flex items-center gap-4 border-b border-input px-6 py-4 transition-colors last:border-b-0 hover:bg-muted"
            >
              <div className="min-w-[32px] text-center text-lg font-bold text-muted-foreground">
                {isExpertJudged && isClosed && entry.placing
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
                  {entry.className && !hasClasses && (
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
                  entry.placing && isClosed ? (
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
      )}

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
