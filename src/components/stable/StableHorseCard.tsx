"use client";

/**
 * THE shared horse card (Digital Stable v2). Used by the dashboard
 * gallery grid and the collection page — one implementation instead
 * of three near-duplicates. Badges use tokenized night-safe washes
 * (src/lib/stable/badges.ts), never raw light-only Tailwind palettes.
 */

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getThumbUrl } from "@/lib/utils/imageUrl";
import type { StableCard } from "@/lib/stable/types";
import {
    CATEGORY_BADGE_ICONS,
    RIBBON_BADGE_CLASS,
    TRADE_STAMP_CLASSES,
    TRADE_STAMP_LABELS,
    finishBadgeClass,
} from "@/lib/stable/badges";
import { CATEGORY_LABELS } from "@/lib/stable/filterParams";

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

export default function StableHorseCard({
    horse,
    selectMode = false,
    isSelected = false,
    onToggleSelect,
}: {
    horse: StableCard;
    selectMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: (id: string) => void;
}) {
    const stampClass = TRADE_STAMP_CLASSES[horse.tradeStatus];

    const cardContent = (
        <>
            {selectMode && (
                <div className="pointer-events-none absolute top-3 left-3 z-[5]">
                    <input type="checkbox" checked={isSelected} readOnly aria-label={`Select ${horse.customName}`} />
                </div>
            )}

            {/* Image */}
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted">
                {horse.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={getThumbUrl(horse.thumbnailUrl)}
                        onError={(e) => {
                            // Fallback to full-res if thumb doesn't exist (older uploads)
                            (e.target as HTMLImageElement).src = horse.thumbnailUrl!;
                        }}
                        alt={horse.customName}
                        loading="lazy"
                        className="h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                        <span className="text-4xl opacity-50">🐴</span>
                        <span className="text-xs font-medium">No photo</span>
                    </div>
                )}

                {/* Category overlay (non-model assets) */}
                {horse.assetCategory && horse.assetCategory !== "model" && (
                    <span className="absolute top-2 right-2 rounded-md bg-black/40 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
                        {CATEGORY_BADGE_ICONS[horse.assetCategory] ?? "🐄"}{" "}
                        {CATEGORY_LABELS[horse.assetCategory] ?? horse.assetCategory}
                    </span>
                )}

                {/* Rubber-stamp trade status on the photo (mock's "For Sale" stamp) */}
                {stampClass && (
                    <span
                        className={`absolute bottom-2 left-2 -rotate-3 rounded border-2 bg-card/85 px-2 py-0.5 font-serif text-[0.62rem] font-bold tracking-[0.14em] uppercase ${stampClass}`}
                    >
                        {TRADE_STAMP_LABELS[horse.tradeStatus] ?? horse.tradeStatus}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="mt-3 px-1">
                <h3 className="truncate font-serif text-lg font-bold text-foreground">{horse.customName}</h3>
                <p className="mt-0.5 truncate text-sm text-secondary-foreground">{horse.refName}</p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                    {horse.finishType && (
                        <Badge className={finishBadgeClass(horse.finishType)}>{horse.finishType}</Badge>
                    )}
                    {horse.conditionGrade && <Badge variant="outline">{horse.conditionGrade}</Badge>}
                    {horse.showRecordCount > 0 && (
                        <Badge className={RIBBON_BADGE_CLASS} title={`${horse.showRecordCount} show placings`}>
                            🏆 {horse.showRecordCount}
                        </Badge>
                    )}
                </div>

                <div className="mt-2 flex items-center gap-2 text-xs text-secondary-foreground">
                    <span>{formatDate(horse.createdAt)}</span>
                    {horse.sculptor && <span>· ✂️ {horse.sculptor}</span>}
                </div>
                {horse.collectionName && (
                    <div className="mt-1 truncate text-[0.7rem] text-muted-foreground">📁 {horse.collectionName}</div>
                )}
            </div>
        </>
    );

    if (selectMode) {
        return (
            <div
                onClick={() => onToggleSelect?.(horse.id)}
                className={`group relative cursor-pointer rounded-2xl border bg-card p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${
                    isSelected ? "border-[var(--primary)] ring-2 ring-forest" : "border-input"
                }`}
                id={`horse-card-${horse.id}`}
            >
                {cardContent}
            </div>
        );
    }

    return (
        <Link
            href={`/stable/${horse.id}`}
            className="group relative block rounded-2xl border border-input bg-card p-3 no-underline shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            id={`horse-card-${horse.id}`}
        >
            {cardContent}
        </Link>
    );
}
