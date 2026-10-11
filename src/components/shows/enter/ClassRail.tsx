"use client";

/**
 * The class list on the entry page — every class in program order.
 * Desktop: a column grouped under division / section headings.
 * Phones: one horizontal strip of class numbers, the current one
 * expanded to its full label (no scroll-inside-scroll; the page
 * scrolls). Each mark comes straight from the ledger.
 */

import { useEffect, useRef } from "react";

import { classLabel, effectiveCap, type ClassLedger } from "@/lib/shows/entrantLedger";
import { friendlyClassStatus } from "@/lib/shows/plainWords";

interface ClassRailProps {
    classes: ClassLedger[];
    selectedClassId: string | null;
    onSelect: (classId: string) => void;
}

/** "✓", "You: 2 of 3", "Full for you", or the closed status. */
function stateMark(cls: ClassLedger): string | null {
    if (cls.state === "closed") return friendlyClassStatus(cls.status);
    if (cls.state === "full") return "Full for you";
    const cap = effectiveCap(cls.maxPerEntrant);
    if (cls.mineLive > 0) return cap !== null ? `✓ You: ${cls.mineLive} of ${cap}` : `✓ ${cls.mineLive} entered`;
    return null;
}

export default function ClassRail({ classes: allClasses, selectedClassId, onSelect }: ClassRailProps) {
    const stripRef = useRef<HTMLDivElement>(null);
    // A class the host cancelled or combined away is not on the program the
    // public page shows, so it is not a stop on this rail either (the first
    // look-see listed nine "Cancelled" rows from a trimmed template).
    const classes = allClasses.filter((c) => c.status !== "cancelled" && c.status !== "combined");

    // Keep the current chip in view on the phone strip.
    useEffect(() => {
        const chip = stripRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
        if (chip && typeof chip.scrollIntoView === "function") {
            chip.scrollIntoView({ block: "nearest", inline: "center" });
        }
    }, [selectedClassId]);

    // Group under division → section headings, keeping program order.
    const groups: { division: string; sections: { section: string; classes: ClassLedger[] }[] }[] = [];
    for (const cls of classes) {
        let div = groups[groups.length - 1];
        if (!div || div.division !== cls.divisionName) {
            div = { division: cls.divisionName, sections: [] };
            groups.push(div);
        }
        let sec = div.sections[div.sections.length - 1];
        if (!sec || sec.section !== cls.sectionName) {
            sec = { section: cls.sectionName, classes: [] };
            div.sections.push(sec);
        }
        sec.classes.push(cls);
    }

    return (
        <>
            {/* Phones: the stepper strip. */}
            <div
                ref={stripRef}
                className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden"
                aria-label="Classes"
                role="navigation"
                data-testid="class-strip"
            >
                {classes.map((cls, i) => {
                    const current = cls.classId === selectedClassId;
                    const done = cls.mineLive > 0;
                    return (
                        <button
                            key={cls.classId}
                            type="button"
                            onClick={() => onSelect(cls.classId)}
                            aria-current={current ? "true" : undefined}
                            aria-label={classLabel(cls)}
                            className={`flex min-h-11 shrink-0 cursor-pointer items-center gap-1 rounded-full border px-3 text-sm whitespace-nowrap ${
                                current
                                    ? "border-forest bg-forest/10 font-semibold text-forest"
                                    : "border-input bg-card text-foreground"
                            } ${cls.state === "closed" ? "opacity-50" : ""}`}
                        >
                            {done && <span aria-hidden="true">✓</span>}
                            {current ? classLabel(cls) : (cls.classNumber ?? String(i + 1))}
                        </button>
                    );
                })}
            </div>

            {/* Desktop: the grouped column. */}
            <nav
                aria-label="Classes"
                className="ledger-card hidden lg:sticky lg:top-[calc(var(--header-height)+1rem)] lg:block lg:max-h-[calc(100dvh-var(--header-height)-2rem)] lg:overflow-y-auto"
                data-testid="class-rail"
            >
                <span className="ledger-tab">Classes</span>
                {groups.map((g) => (
                    <div key={g.division} className="mb-3">
                        <p className="m-0 font-serif text-sm font-bold text-forest">{g.division}</p>
                        {g.sections.map((s) => (
                            <div key={s.section} className="mt-1">
                                <p className="m-0 text-xs tracking-wide text-muted-foreground uppercase">{s.section}</p>
                                <ul className="m-0 flex list-none flex-col p-0">
                                    {s.classes.map((cls) => {
                                        const current = cls.classId === selectedClassId;
                                        const mark = stateMark(cls);
                                        return (
                                            <li key={cls.classId}>
                                                <button
                                                    type="button"
                                                    onClick={() => onSelect(cls.classId)}
                                                    aria-current={current ? "true" : undefined}
                                                    className={`flex min-h-9 w-full cursor-pointer flex-col rounded-md px-2 py-1 text-left text-sm ${
                                                        current
                                                            ? "bg-forest/10 font-semibold text-forest"
                                                            : "text-foreground hover:bg-muted"
                                                    } ${cls.state === "closed" ? "opacity-50" : ""}`}
                                                >
                                                    <span className="truncate">{classLabel(cls)}</span>
                                                    {mark && <span className="text-xs text-muted-foreground">{mark}</span>}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </div>
                ))}
            </nav>
        </>
    );
}
