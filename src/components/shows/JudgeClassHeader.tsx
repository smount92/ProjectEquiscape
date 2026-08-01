"use client";

/**
 * Wave 4a — the judge queue's sticky class header. Navigation IS the
 * header: big prev/next chevrons either side of the class name, the
 * position line under it, and an "All classes" dialog of 44px rows
 * (number + NAME + done tick / entry count) to jump anywhere.
 *
 * Replaces the old 36px number-only tab strip; tablist semantics go
 * with it — a jump menu in a dialog is plain buttons, honestly
 * labelled, with aria-current marking the open class.
 *
 * Leather ground on purpose: the header and the ribbon tray frame
 * the parchment work surface like the top and bottom rails of a tack
 * trunk. All colors ride the constant leather/brass ramps, so
 * Lamplight is safe; Simple Mode flattens .leather-panel to a plain
 * saddle block in globals.css.
 */

import { useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export interface JudgeClassNavItem {
    classId: string;
    className: string;
    classNumber: string | null;
    entryCount: number;
    placed: boolean;
}

function navLabel(item: JudgeClassNavItem, index: number): string {
    const number = item.classNumber ?? String(index + 1);
    return `${number} · ${item.className}`;
}

export default function JudgeClassHeader({
    items,
    activeIndex,
    placedCount,
    onNavigate,
}: {
    items: JudgeClassNavItem[];
    activeIndex: number;
    /** Classes marked done across the show (the progress number). */
    placedCount: number;
    onNavigate: (index: number) => void;
}) {
    const [listOpen, setListOpen] = useState(false);
    const active = items[activeIndex];
    if (!active) return null;

    const chevronClass =
        "flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/20 bg-black/15 text-2xl leading-none text-(--leather-text) transition-all hover:bg-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brass-hi) disabled:cursor-default disabled:opacity-35";

    return (
        <div className="sticky top-[var(--header-height)] z-40">
            <div className="leather-panel flex flex-col gap-0.5 rounded-xl px-2 py-2">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className={chevronClass}
                        aria-label="Previous class"
                        data-testid="prev-class"
                        disabled={activeIndex === 0}
                        onClick={() => onNavigate(activeIndex - 1)}
                    >
                        <span aria-hidden="true">‹</span>
                    </button>
                    <h2 className="min-w-0 flex-1 truncate text-center font-serif text-base font-bold text-engraved-light sm:text-lg">
                        {navLabel(active, activeIndex)}
                    </h2>
                    <button
                        type="button"
                        className={chevronClass}
                        aria-label="Next class"
                        data-testid="next-class"
                        disabled={activeIndex === items.length - 1}
                        onClick={() => onNavigate(activeIndex + 1)}
                    >
                        <span aria-hidden="true">›</span>
                    </button>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-3 text-xs text-(--leather-text-soft)">
                    <span data-testid="judge-progress">
                        Class {activeIndex + 1} of {items.length} · {active.entryCount}{" "}
                        {active.entryCount === 1 ? "entry" : "entries"} · {placedCount} placed ✓
                    </span>
                    <Dialog open={listOpen} onOpenChange={setListOpen}>
                        <DialogTrigger asChild>
                            <button
                                type="button"
                                data-testid="all-classes"
                                className="min-h-11 cursor-pointer px-2 font-semibold text-(--leather-text) underline decoration-(--brass) underline-offset-4 transition-all hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brass-hi)"
                            >
                                All classes ▾
                            </button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[80dvh]">
                            <DialogHeader>
                                <DialogTitle>All classes</DialogTitle>
                                <DialogDescription className="sr-only">
                                    Jump to any class in the judging queue.
                                </DialogDescription>
                            </DialogHeader>
                            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                                {items.map((item, index) => (
                                    <li key={item.classId}>
                                        <button
                                            type="button"
                                            data-testid="class-jump"
                                            aria-current={index === activeIndex ? "true" : undefined}
                                            className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left transition-all hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring ${
                                                index === activeIndex ? "bg-muted" : ""
                                            }`}
                                            onClick={() => {
                                                onNavigate(index);
                                                setListOpen(false);
                                            }}
                                        >
                                            <span className="w-8 shrink-0 text-right font-mono text-xs font-semibold text-muted-foreground">
                                                {item.classNumber ?? index + 1}
                                            </span>
                                            <span
                                                className={`min-w-0 flex-1 truncate text-sm ${
                                                    index === activeIndex
                                                        ? "font-semibold text-foreground"
                                                        : "text-foreground"
                                                }`}
                                            >
                                                {item.className}
                                            </span>
                                            <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
                                                {item.placed ? (
                                                    <span className="font-semibold text-forest">✓ placed</span>
                                                ) : (
                                                    `${item.entryCount} ${item.entryCount === 1 ? "entry" : "entries"}`
                                                )}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </div>
    );
}
