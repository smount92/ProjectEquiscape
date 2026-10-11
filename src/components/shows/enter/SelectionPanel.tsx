"use client";

/**
 * The horses selected for the current class, and the "Enter class"
 * press. Desktop: a sticky right column. Phones: a sheet docked to
 * the bottom of the screen carrying the count and the Enter button,
 * expandable to the list (safe-area padded; the page itself scrolls).
 */

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface SelectionPanelProps {
    classLabel: string;
    count: number;
    /** null = uncapped. */
    remaining: number | null;
    /** Why Enter is disabled, in plain words (null = it isn't). */
    blockedReason: string | null;
    submitting: boolean;
    error: string | null;
    onSubmit: () => void;
    onSkip: () => void;
    canSkip: boolean;
    /** Your live entries already in this class — the answer to "who did I put where". */
    entered: { horseId: string; name: string; photoUrl: string | null }[];
    /** The SelectionRow list items. */
    children: ReactNode;
}

export default function SelectionPanel({
    classLabel,
    count,
    remaining,
    blockedReason,
    submitting,
    error,
    onSubmit,
    onSkip,
    canSkip,
    entered,
    children,
}: SelectionPanelProps) {
    const [expanded, setExpanded] = useState(false);
    const canSubmit = count > 0 && blockedReason === null && !submitting;
    const enteredList = entered.length > 0 && (
        <div className="min-w-0" data-testid="entered-in-class">
            <p className="m-0 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                Already in this class ({entered.length})
            </p>
            <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
                {entered.map((e) => (
                    <li key={e.horseId} className="flex items-center gap-2 text-sm">
                        {e.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={e.photoUrl} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover" loading="lazy" />
                        ) : (
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-sm" aria-hidden="true">
                                🐴
                            </span>
                        )}
                        <span className="truncate font-semibold text-forest">✓ {e.name}</span>
                    </li>
                ))}
            </ul>
        </div>
    );

    return (
        <aside
            aria-label="Selected horses"
            className="fixed inset-x-0 bottom-0 z-40 flex max-h-[75dvh] flex-col gap-2 border-t border-input bg-card px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lg lg:sticky lg:inset-x-auto lg:top-[calc(var(--header-height)+1rem)] lg:bottom-auto lg:z-auto lg:max-h-[calc(100dvh-var(--header-height)-2rem)] lg:rounded-lg lg:border lg:p-4 lg:shadow-none"
            data-testid="selection-panel"
        >
            <div className="flex items-center gap-2">
                <h2 className="m-0 min-w-0 flex-1 font-serif text-base font-bold text-forest">
                    Selected for {classLabel}:{" "}
                    <span data-testid="selection-count">
                        {count} of {remaining ?? "∞"}
                    </span>
                </h2>
                {count > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="lg:hidden"
                        aria-expanded={expanded}
                        onClick={() => setExpanded((e) => !e)}
                    >
                        {expanded ? "Hide ▾" : "Show ▴"}
                    </Button>
                )}
            </div>

            {/* On the phone sheet the entered list rides with the expanded view; on desktop it sits above the selection. */}
            <div className={`${expanded ? "block" : "hidden lg:block"}`}>{enteredList}</div>

            {count === 0 ? (
                <p className="m-0 hidden text-sm text-muted-foreground lg:block">
                    Tap your horses to pick them for this class.
                </p>
            ) : (
                <ul
                    className={`m-0 min-h-0 list-none overflow-y-auto p-0 ${expanded ? "block" : "hidden lg:block"}`}
                >
                    {children}
                </ul>
            )}

            {blockedReason && count > 0 && <p className="m-0 text-xs font-semibold text-destructive">{blockedReason}</p>}
            {error && (
                <p role="alert" className="m-0 text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}

            <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onSkip} disabled={!canSkip || submitting}>
                    Skip to next class
                </Button>
                <button
                    type="button"
                    className="btn-brass disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canSubmit}
                    onClick={onSubmit}
                    data-testid="enter-class-button"
                >
                    {submitting ? "Entering…" : "Enter class"}
                </button>
            </div>
        </aside>
    );
}
