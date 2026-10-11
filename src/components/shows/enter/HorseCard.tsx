"use client";

/**
 * One of your horses on the entry page. The card IS a toggle button
 * (aria-pressed); online shows add a "Change photo" control under it
 * for the judged photo. A blocked horse (the ledger's certain refusal
 * — the server WILL refuse it) renders disabled with the reason; a
 * soft mismatch stays selectable with the reason as a warning.
 */

import type { EntrantHorse } from "@/lib/shows/public";

interface HorseCardProps {
    horse: EntrantHorse;
    selected: boolean;
    /** Certain refusal — not selectable. */
    blocked?: boolean;
    /** The ledger's plain-words reason (blocked or soft). */
    reason?: string | null;
    breedMatch?: boolean;
    /** Online shows: the judged photo's URL (falls back to the thumbnail). */
    photoUrl?: string | null;
    showPhotoControl: boolean;
    pickerOpen?: boolean;
    onToggle: () => void;
    onChangePhoto?: () => void;
}

export default function HorseCard({
    horse,
    selected,
    blocked = false,
    reason = null,
    breedMatch = false,
    photoUrl,
    showPhotoControl,
    pickerOpen = false,
    onToggle,
    onChangePhoto,
}: HorseCardProps) {
    const image = photoUrl ?? horse.thumbnailUrl;
    const facts = [horse.breed, horse.scale, horse.finish].filter(Boolean).join(" · ");
    return (
        <div
            className={`flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card transition-shadow ${
                selected ? "border-forest ring-2 ring-forest" : "border-input"
            } ${blocked ? "opacity-60" : ""}`}
            data-testid={`horse-card-${horse.id}`}
        >
            <button
                type="button"
                className="flex min-h-11 w-full cursor-pointer flex-col gap-1 p-2 text-left disabled:cursor-not-allowed"
                aria-pressed={selected}
                disabled={blocked}
                onClick={onToggle}
            >
                <span className="relative block">
                    {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" className="aspect-square w-full rounded-md object-cover" loading="lazy" />
                    ) : (
                        <span
                            className="flex aspect-square w-full items-center justify-center rounded-md bg-muted text-3xl"
                            aria-hidden="true"
                        >
                            🐴
                        </span>
                    )}
                    {selected && (
                        <span
                            className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-forest text-xs font-bold text-primary-foreground"
                            aria-hidden="true"
                        >
                            ✓
                        </span>
                    )}
                </span>
                <span className="truncate text-sm font-semibold text-foreground">{horse.name}</span>
                {facts && <span className="truncate text-xs text-muted-foreground">{facts}</span>}
                {breedMatch && !blocked && (
                    <span className="self-start rounded-full border border-forest/40 px-2 text-[0.7rem] font-semibold text-forest">
                        Breed match
                    </span>
                )}
                {reason && (
                    <span className={`text-xs ${blocked ? "text-muted-foreground" : "font-semibold text-destructive"}`}>
                        {blocked ? reason : `⚠ ${reason}`}
                    </span>
                )}
            </button>
            {showPhotoControl && !blocked && (
                <button
                    type="button"
                    className="min-h-9 cursor-pointer border-t border-input px-2 py-1 text-xs font-semibold text-forest hover:bg-muted"
                    aria-expanded={pickerOpen}
                    onClick={onChangePhoto}
                >
                    {pickerOpen ? "Close photos" : "Change photo"}
                </button>
            )}
        </div>
    );
}
