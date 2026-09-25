/**
 * A show's focus, read off its own class list.
 *
 * A user asked for tags like "OF", "CM", "Halter", "Performance" beside
 * "MHH Sanctioned" so the point of each show is clear at a glance. We
 * never ask the host for them: every class already records the finishes
 * and scales it allows, and every division has an axis, so the tags are
 * derived and can never disagree with the program.
 */

import type { ConsoleDivision } from "./console";

export interface FocusInput {
    axis: string;
    classes: { allowedFinishes: string[] | null; allowedScales: string[] | null; status?: string }[];
}

export interface ShowFocus {
    /** Finishes any class restricts to, in hobby order; empty = every class open to all. */
    finishes: string[];
    /** Division axes present, in the order shows run them. */
    axes: string[];
    /** Scales any class restricts to; empty = no scale limits. */
    scales: string[];
    /** Enterable classes counted, so "All finishes" is only claimed for a real program. */
    classCount: number;
}

const FINISH_ORDER = ["OF", "CM", "AR", "CM/AR"];
const AXIS_ORDER = ["halter", "performance", "workmanship", "collectibility"];
const AXIS_LABEL: Record<string, string> = {
    halter: "Halter",
    performance: "Performance",
    workmanship: "Workmanship",
    collectibility: "Collectibility",
};

function ordered(values: Iterable<string>, order: readonly string[]): string[] {
    return [...new Set(values)].sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });
}

export function deriveShowFocus(divisions: readonly FocusInput[]): ShowFocus {
    const finishes = new Set<string>();
    const scales = new Set<string>();
    const axes = new Set<string>();
    let classCount = 0;
    for (const d of divisions) {
        const live = d.classes.filter((c) => c.status !== "cancelled" && c.status !== "combined");
        if (live.length === 0) continue;
        classCount += live.length;
        if (d.axis && d.axis !== "other") axes.add(d.axis);
        for (const c of live) {
            for (const f of c.allowedFinishes ?? []) if (f.trim()) finishes.add(f.trim());
            for (const s of c.allowedScales ?? []) if (s.trim()) scales.add(s.trim());
        }
    }
    return {
        finishes: ordered(finishes, FINISH_ORDER),
        axes: ordered(axes, AXIS_ORDER),
        scales: [...scales].sort(),
        classCount,
    };
}

/** The console tree, flattened to what deriveShowFocus reads. */
export function focusFromConsole(divisions: readonly ConsoleDivision[]): ShowFocus {
    return deriveShowFocus(
        divisions.map((d) => ({
            axis: d.axis,
            classes: d.sections.flatMap((s) =>
                s.classes.map((c) => ({
                    allowedFinishes: c.allowedFinishes,
                    allowedScales: c.allowedScales,
                    status: c.status,
                })),
            ),
        })),
    );
}

const MAX_SCALE_CHIPS = 3;

/** Short scale labels: "Traditional (1:9)" → "Traditional". */
function scaleShort(scale: string): string {
    return scale.replace(/\s*\(.*\)\s*$/, "").trim() || scale;
}

/**
 * The chips a card or masthead shows: finishes first, then axes, then
 * scales. An empty program yields nothing rather than "All finishes".
 */
export function focusChips(focus: ShowFocus | null | undefined): string[] {
    // A list cached before this field existed (unstable_cache keeps its
    // entries across a deploy) carries no focus: show nothing, not a crash.
    if (!focus || focus.classCount === 0) return [];
    // Finishes only when a class restricts them. Hosts often write "OF
    // only" in the rules and leave every class open, so an "All
    // finishes" chip would contradict the host on their own page.
    const chips: string[] = [...focus.finishes];
    chips.push(...focus.axes.map((a) => AXIS_LABEL[a] ?? a));
    if (focus.scales.length > 0) {
        const shorts = [...new Set(focus.scales.map(scaleShort))];
        chips.push(...shorts.slice(0, MAX_SCALE_CHIPS));
        if (shorts.length > MAX_SCALE_CHIPS) chips.push(`+${shorts.length - MAX_SCALE_CHIPS} scales`);
    }
    return chips;
}

export const EMPTY_FOCUS: ShowFocus = { finishes: [], axes: [], scales: [], classCount: 0 };
