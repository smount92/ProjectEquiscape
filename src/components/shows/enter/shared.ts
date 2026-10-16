/**
 * Small shared pieces of the entry page (/shows/[id]/enter). Every
 * eligibility decision comes from lib/shows/entrantLedger — these
 * helpers only walk the ledger it builds or spell a class's limits in
 * plain words. Nothing here judges a horse.
 */

import { normalizeScale } from "@/lib/catalog/taxonomy";
import type { ConsoleClass, ConsoleDivision } from "@/lib/shows/console";
import type { DocKind } from "@/lib/shows/documents";
import { effectiveCap, type ClassLedger, type EntrantLedger } from "@/lib/shows/entrantLedger";

/** One of a horse's stable photos, offered as the judged photo. */
export interface EntryPhoto {
    id: string;
    publicUrl: string;
    angleProfile: string;
}

/** The documentation a selected horse carries into the batch. */
export type DocChoice =
    | { mode: "none" }
    | { mode: "existing"; documentId: string }
    | { mode: "new"; kind: DocKind; body: string };

/** One horse picked for the current class. */
export interface SelectedHorse {
    /** Online shows: the judged photo. null = not chosen / none yet. */
    photoId: string | null;
    /** Proxy handler — someone else shows this horse. */
    handler: { id: string; alias: string } | null;
    doc: DocChoice;
}

export const EMPTY_SELECTION: SelectedHorse = {
    photoId: null,
    handler: null,
    doc: { mode: "none" },
};

/** The primary photo, else the first — what the old dialog defaulted to. */
export function defaultPhotoId(photos: EntryPhoto[]): string | null {
    return (photos.find((p) => p.angleProfile === "Primary_Thumbnail") ?? photos[0])?.id ?? null;
}

/** Class id → the console class (the limits live there, not on the ledger). */
export function indexClasses(divisions: ConsoleDivision[]): Map<string, ConsoleClass> {
    const map = new Map<string, ConsoleClass>();
    for (const division of divisions) {
        for (const section of division.sections) {
            for (const cls of section.classes) map.set(cls.id, cls);
        }
    }
    return map;
}

/** "Up to 3 of your horses · Traditional (1:9) only · OF only". */
export function classLimitsText(
    cls: Pick<ConsoleClass, "maxPerEntrant" | "allowedScales" | "allowedFinishes">,
): string {
    const parts: string[] = [];
    const cap = effectiveCap(cls.maxPerEntrant);
    parts.push(
        cap === null ? "Any number of your horses" : cap === 1 ? "One of your horses" : `Up to ${cap} of your horses`,
    );
    if (cls.allowedScales && cls.allowedScales.length > 0) {
        const scales = [...new Set(cls.allowedScales.map((s) => normalizeScale(s) ?? s.trim()))];
        parts.push(`${scales.join(" / ")} only`);
    }
    if (cls.allowedFinishes && cls.allowedFinishes.length > 0) {
        parts.push(`${cls.allowedFinishes.join(" / ")} only`);
    }
    return parts.join(" · ");
}

/** Same definition as the ledger's classesWithRoom: open, and at least
 *  one of your horses is not blocked. */
export function hasRoom(cls: ClassLedger): boolean {
    return cls.state === "open" && cls.verdicts.some((v) => !v.blocked);
}

/** The next class with room AFTER `currentId` in program order,
 *  wrapping to earlier ones; null when none is left. */
export function nextClassWithRoom(ledger: EntrantLedger, currentId: string | null): string | null {
    const list = ledger.classes;
    const start = currentId ? list.findIndex((c) => c.classId === currentId) : -1;
    for (let step = 1; step <= list.length; step++) {
        const cls = list[(start + step + list.length) % list.length];
        if (cls.classId !== currentId && hasRoom(cls)) return cls.classId;
    }
    return null;
}
