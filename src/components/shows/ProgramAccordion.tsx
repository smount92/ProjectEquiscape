"use client";

/**
 * Wave 4b — THE PROGRAM ACCORDION: the classlist tree with
 * divisions collapsed to one summary line (name, axis, live entry
 * count) that opens into sections → class rows. The rows are the
 * SAME PublicClassRow the legacy flat classlist renders — one
 * implementation, two shapes.
 *
 * Used twice on the album page: under #program in the entries
 * section, and inside the sticky CTA's "Pick your class" dialog.
 * Native <details> — works before hydration, keyboard-friendly for
 * free, and Simple Mode's root scaling applies untouched.
 */

import type { ConsoleClass, ConsoleDivision } from "@/lib/shows/console";
import { showsV4Enabled } from "@/lib/shows/flags";
import { AXIS_GLOSS } from "@/lib/shows/plainWords";
import { PublicClassRow } from "@/components/shows/ShowEntrySectionParts";
import { Badge } from "@/components/ui/badge";

interface ProgramAccordionProps {
    divisions: ConsoleDivision[];
    /** Caller pre-multiplies authed + entries_open + horses>0. */
    canEnter: boolean;
    onEnter: (cls: ConsoleClass) => void;
    /** Index of the division to render open initially (the CTA
     *  dialog opens the first; #program starts all collapsed). */
    defaultOpenIndex?: number | null;
    /** v4 class rooms: when set (and the flag is on), each class row
     *  grows a "class room" link to /shows/[showId]/class/[classId]. */
    showId?: string;
}

function divisionEntryCount(division: ConsoleDivision): number {
    return division.sections.reduce(
        (sum, section) => sum + section.classes.reduce((s, cls) => s + cls.entryCount, 0),
        0,
    );
}

function divisionClassCount(division: ConsoleDivision): number {
    return division.sections.reduce((sum, section) => sum + section.classes.length, 0);
}

export default function ProgramAccordion({
    divisions,
    canEnter,
    onEnter,
    defaultOpenIndex = null,
    showId,
}: ProgramAccordionProps) {
    const classRooms = !!showId && showsV4Enabled();
    if (divisions.length === 0) {
        return (
            <p className="py-4 text-center text-sm text-muted-foreground">
                The host hasn&rsquo;t published the classlist yet.
            </p>
        );
    }
    return (
        <ul className="flex list-none flex-col gap-2 p-0">
            {divisions.map((division, index) => {
                const entryCount = divisionEntryCount(division);
                const classCount = divisionClassCount(division);
                return (
                    <li key={division.id}>
                        <details
                            className="group rounded-md border border-input bg-card/60"
                            // v4 class rooms: the program IS the navigation,
                            // so every division starts open.
                            open={classRooms || defaultOpenIndex === index}
                            data-testid="program-division"
                        >
                            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                                <span
                                    aria-hidden="true"
                                    className="text-xs text-forest transition-transform group-open:rotate-90"
                                >
                                    ▶
                                </span>
                                <span className="font-serif text-sm font-bold tracking-wide text-forest uppercase">
                                    {division.name}
                                </span>
                                <Badge variant="secondary" className="capitalize">
                                    {division.axis}
                                </Badge>
                                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                                    {classCount} class{classCount === 1 ? "" : "es"} ·{" "}
                                    {entryCount} entr{entryCount === 1 ? "y" : "ies"}
                                </span>
                            </summary>
                            <div className="border-t border-input px-3 pt-2 pb-3">
                                {/* What the axis word MEANS — visible, never a tooltip. */}
                                <p className="mt-0 mb-0 text-xs text-muted-foreground">
                                    {AXIS_GLOSS[division.axis]}
                                </p>
                                <ul className="mt-3 flex list-none flex-col gap-4 p-0">
                                    {division.sections.map((section) => (
                                        <li key={section.id}>
                                            <section
                                                aria-label={section.name}
                                                className="border-l-2 border-forest/30 pl-4"
                                            >
                                                <h4 className="font-serif text-sm font-bold tracking-wide text-forest uppercase">
                                                    {section.name}
                                                </h4>
                                                <ul className="mt-1 flex list-none flex-col p-0">
                                                    {section.classes.map((cls) => (
                                                        <PublicClassRow
                                                            key={cls.id}
                                                            cls={cls}
                                                            canEnter={canEnter}
                                                            onEnter={onEnter}
                                                            classRoomHref={
                                                                classRooms
                                                                    ? `/shows/${showId}/class/${cls.id}`
                                                                    : undefined
                                                            }
                                                        />
                                                    ))}
                                                    {section.classes.length === 0 && (
                                                        <li className="py-1.5 text-sm text-muted-foreground italic">
                                                            No classes yet.
                                                        </li>
                                                    )}
                                                </ul>
                                            </section>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </details>
                    </li>
                );
            })}
        </ul>
    );
}
