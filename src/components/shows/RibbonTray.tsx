"use client";

/**
 * Wave 4a — THE RIBBON TRAY. A sticky bottom bar on leather ground:
 * six slots labelled 1st–6th in the hobby's ribbon colors (blue, red,
 * yellow, white, pink, green — placings.ts ribbonHex, never themed).
 *
 * Empty slot: dashed outline + color dot + label. Filled slot: solid
 * border in the ribbon color + the horse's photo thumbnail + label.
 * Tapping a FILLED slot takes exactly that ribbon back — every other
 * horse keeps its ribbon (the sparse-map model in judgeTray.ts).
 * Empty slots stay in the focus order (aria-disabled, announced as
 * "…— empty") so a screen-reader judge hears the whole tray.
 *
 * The tray also carries the save whisper (role="status"), the
 * role="alert" error line with its Retry link, the gentle 6-cap
 * refusal, and the brass "Class done →" button.
 *
 * Ribbon colors are constants (like the brass ramp) so Lamplight is
 * safe; Simple Mode flattens .leather-panel / .brass-plaque via
 * globals.css and everything here rides those recipes.
 */

import { PLACES, placeLabel, ribbonHex } from "@/lib/shows/placings";
import { slotAriaLabel, type TraySlots } from "@/lib/shows/judgeTray";
import type { Place } from "@/lib/shows/types";

export interface TrayEntry {
    id: string;
    horseName: string;
    photoUrl: string | null;
}

export default function RibbonTray({
    entries,
    slots,
    onClearSlot,
    onDone,
    doneSaving,
    whisper,
    error,
    onRetry,
    refusal,
    hasEntries,
}: {
    entries: readonly TrayEntry[];
    slots: TraySlots;
    onClearSlot: (place: Place) => void;
    /** Final recordPlacings(markDone: true). */
    onDone: () => void;
    doneSaving: boolean;
    /** "Saving…" / "Saved just now ✓" / "Saved ✓" / null. */
    whisper: string | null;
    /** Server refusal, verbatim — tray state is preserved above it. */
    error: string | null;
    onRetry: () => void;
    /** The gentle 6-cap message (null when all is well). */
    refusal: string | null;
    /** False for an empty class — slots hide, done stays. */
    hasEntries: boolean;
}) {
    const byId = new Map(entries.map((entry) => [entry.id, entry]));

    return (
        <div className="sticky bottom-0 z-40" data-testid="ribbon-tray">
            {error && (
                <p
                    role="alert"
                    className="mb-2 rounded-md border-2 border-destructive bg-(--paper-lit) px-3 py-2 text-sm font-semibold text-destructive"
                >
                    {error}{" "}
                    <button
                        type="button"
                        data-testid="retry-save"
                        className="cursor-pointer font-semibold underline underline-offset-2"
                        onClick={onRetry}
                    >
                        Retry save
                    </button>
                </p>
            )}
            {/* Safe-area padding lives inside the opaque leather surface
                so nothing peeks through under the home indicator. */}
            <div className="leather-panel rounded-xl px-2.5 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] sm:px-3">
                {/* Persistent live region — must exist before the refusal
                    text lands or screen readers stay silent about it. */}
                <p
                    role="status"
                    aria-live="polite"
                    data-testid="tray-refusal"
                    className={`text-center text-xs text-(--leather-text) ${
                        refusal ? "mb-1.5" : "sr-only"
                    }`}
                >
                    {refusal}
                </p>
                {hasEntries ? (
                    <div className="grid grid-cols-6 gap-1 sm:gap-2">
                        {PLACES.map((place) => {
                            const entryId = slots[place];
                            const entry = entryId !== undefined ? byId.get(entryId) : undefined;
                            const hex = ribbonHex(place) as string;
                            const filled = entry !== undefined;
                            return (
                                <button
                                    key={place}
                                    type="button"
                                    data-testid={`tray-slot-${place}`}
                                    aria-disabled={!filled}
                                    aria-label={slotAriaLabel(place, entry?.horseName ?? null)}
                                    className={`flex min-h-11 flex-col items-center gap-0.5 rounded-md p-0.5 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brass-hi) ${
                                        filled ? "cursor-pointer" : "cursor-default"
                                    }`}
                                    onClick={() => {
                                        if (filled) onClearSlot(place);
                                    }}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border-2 bg-black/25 ${
                                            filled ? "border-solid" : "border-dashed"
                                        }`}
                                        style={{ borderColor: hex }}
                                    >
                                        {filled ? (
                                            entry.photoUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={entry.photoUrl}
                                                    alt=""
                                                    className="h-full w-full object-cover"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <span className="text-base">🐴</span>
                                            )
                                        ) : (
                                            <span
                                                className="inline-block h-2.5 w-2.5 rounded-full border border-black/40"
                                                style={{ backgroundColor: hex }}
                                            />
                                        )}
                                    </span>
                                    <span
                                        aria-hidden="true"
                                        className={`font-serif text-[10px] leading-none tracking-wide ${
                                            filled
                                                ? "font-bold text-(--leather-text)"
                                                : "text-(--leather-text-muted)"
                                        }`}
                                    >
                                        {placeLabel(place)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <p className="py-1 text-center text-sm text-(--leather-text)">
                        No live entries in this class — mark it done and move on.
                    </p>
                )}
                <div className="mt-1.5 flex items-center justify-between gap-3">
                    <span
                        role="status"
                        aria-live="polite"
                        data-testid="save-whisper"
                        className="min-h-4 flex-1 truncate text-xs text-(--leather-text-soft)"
                    >
                        {whisper}
                    </span>
                    <button
                        type="button"
                        data-testid="class-done"
                        disabled={doneSaving}
                        onClick={onDone}
                        className="brass-plaque min-h-11 shrink-0 cursor-pointer px-4 font-serif text-sm font-bold tracking-wide text-engraved-brass transition-all hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brass-hi) active:translate-y-px disabled:cursor-default disabled:opacity-60"
                    >
                        {doneSaving ? "Saving…" : "Class done →"}
                    </button>
                </div>
            </div>
        </div>
    );
}
