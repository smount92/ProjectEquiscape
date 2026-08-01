/**
 * Shows domain — horse-picker ordering for the entry dialog.
 *
 * Pure helpers behind EnterClassDialog's picker so a 50–500-horse
 * stable stays scannable: filter by name as the user types, then
 * float the horses that LOOK compatible with the class's
 * allowed_scales / allowed_finishes to the top.
 *
 * SOFT ordering only. The comparison deliberately mirrors
 * entryRules.validateEntry (exact string match against the allowed
 * lists; a null scale/finish cannot match a restricted list) so the
 * hint agrees with the server as often as possible — but the server
 * remains the sole authority. Nothing here may hide, disable, or
 * pre-reject a horse; a "mismatch" is a hint, never a gate.
 *
 * Secondary order is the server-provided order untouched (a stable
 * partition): listMyEntrantHorses / the show page's server render
 * already sort the stable, and the picker inherits whatever they
 * decide (alphabetical today) rather than re-sorting client-side.
 */

import type { EntrantHorse } from "./public";

/** The slice of a class the picker orders against — structurally
 *  satisfied by ConsoleClass and by EnterClassDialog's
 *  EnterableClass; every field is optional so callers without
 *  restriction data degrade to "everything fits". */
export interface PickerClassRestrictions {
    allowedScales?: string[] | null;
    allowedFinishes?: string[] | null;
}

export interface PickerHorse {
    horse: EntrantHorse;
    /** True when nothing suggests the horse conflicts with the
     *  class's restrictions. Never authoritative — server decides. */
    fitsClass: boolean;
    /** Human hint parts for a mismatch row, e.g. ["Traditional/Classic scale only"].
     *  Empty when fitsClass. */
    mismatches: string[];
}

/** Does `value` pass a restriction list, the way the server does?
 *  No list (null/empty) accepts everything; a restricted list
 *  requires an exact match, so an unknown (null) value fails. */
function passes(value: string | null, allowed: string[] | null | undefined): boolean {
    if (!allowed || allowed.length === 0) return true;
    return value !== null && allowed.includes(value);
}

/** Case-insensitive substring match on the horse's name. */
export function matchesQuery(horse: EntrantHorse, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (q === "") return true;
    return horse.name.toLowerCase().includes(q);
}

/** Annotate one horse against the class's soft restrictions. */
export function annotateHorse(
    horse: EntrantHorse,
    cls: PickerClassRestrictions,
): PickerHorse {
    const mismatches: string[] = [];
    if (!passes(horse.scale, cls.allowedScales)) {
        mismatches.push(`${cls.allowedScales!.join("/")} scale only`);
    }
    if (!passes(horse.finish, cls.allowedFinishes)) {
        mismatches.push(`${cls.allowedFinishes!.join("/")} finish only`);
    }
    return { horse, fitsClass: mismatches.length === 0, mismatches };
}

/**
 * The picker's list: name-filtered, likely-fits first, otherwise in
 * the caller's (server's) order. Stable in both partitions.
 */
export function filterAndRankHorses(
    horses: EntrantHorse[],
    cls: PickerClassRestrictions,
    query: string,
): PickerHorse[] {
    const kept = horses.filter((h) => matchesQuery(h, query)).map((h) => annotateHorse(h, cls));
    return [...kept.filter((p) => p.fitsClass), ...kept.filter((p) => !p.fitsClass)];
}
