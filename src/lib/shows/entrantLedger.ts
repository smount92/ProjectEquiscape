/**
 * Shows domain — the entrant ledger. The SINGLE owner of "what can
 * this viewer enter at this show, and why not".
 *
 * Before this module the same questions were answered in three
 * places: the server validator (entryRules), the entry dialog's
 * picker hints (horsePicker), and ad-hoc counting on the show page.
 * They drifted — the picker compared scales as raw text while the
 * server normalized them, so the page said "may not fit" for horses
 * the server happily accepted.
 *
 * Now:
 *  - `horseVerdict` decides one horse against one class. The server
 *    validator (entryRules.validateEntry) uses the same logic for
 *    its three CERTAIN rules (already in this class, one breed-halter
 *    class per horse, per-entrant cap), so a "blocked" verdict here is
 *    a refusal there, word for word.
 *  - `buildEntrantLedger` runs that verdict for every class × every
 *    horse the viewer owns and adds the per-class and per-horse counts
 *    the entry page renders.
 *
 * Scale / finish verdicts are SOFT: a hint, never a block. The server
 * still refuses them (it has the authoritative horse facts), but the
 * page must not hide a horse because of them — catalog data can be
 * stale or missing.
 *
 * Pure: no I/O, no imports from actions or components. Scratched
 * entries are history and never count (see the SCRATCH / RE-ENTRY
 * contract in entryRules.ts).
 */

import { normalizeScale } from "@/lib/catalog/taxonomy";
import type { ConsoleClass, ConsoleDivision } from "./console";
import { breedMatchesClass, classNamesBreed } from "./horsePicker";
import { BREEDS } from "@/lib/showbio/vocab";
import type { EntrantHorse, MyShowEntry } from "./public";
import type { ClassStatus, DivisionAxis } from "./types";

export type HorseVerdictCode =
    | "ok" // nothing known stands in the way
    | "in_this_class" // a live entry of this horse already exists in this class
    | "in_other_halter" // live entry in another breed-halter class (one halter class per horse)
    | "class_full_for_you" // you already have maxPerEntrant live entries in this class
    | "scale" // horse scale not in allowedScales (soft: hint, not a block)
    | "finish"; // horse finish not in allowedFinishes (soft)

export interface HorseVerdict {
    horseId: string;
    code: HorseVerdictCode;
    /** True for in_this_class / in_other_halter / class_full_for_you — the server WILL refuse. */
    blocked: boolean;
    /** Plain words for the entrant, e.g. "Already entered in this class", "In halter as 112 · Paint", "Traditional (1:9) only · this horse is Classic". */
    reason: string | null;
    /** For in_other_halter: the class it is in. */
    otherClassId?: string;
    /** Soft breed hint: the class name names this horse's breed (reuse breedMatchesClass from horsePicker). */
    breedMatch: boolean;
    /**
     * The tier the page shows the horse under (owner, 2026-10-11):
     * "fits" — nothing stands in the way and the breed lines up (or the
     * class names no breed); "maybe" — enterable but uncertain (scale,
     * finish, or the class names a breed this horse isn't listed as);
     * "blocked" — a rule the server will refuse.
     */
    tier: HorseTier;
    /** The "maybe" note when `reason` is null, e.g. "Listed as Morgan" or "Breed not set on this horse". */
    hint: string | null;
}

export type HorseTier = "fits" | "maybe" | "blocked";

export interface ClassLedger {
    classId: string;
    classNumber: string | null;
    name: string;
    sectionName: string;
    divisionName: string;
    axis: DivisionAxis;
    status: ClassStatus;
    maxPerEntrant: number | null;
    /** Live (non-scratched) entries of the viewer in this class. */
    mineLive: number;
    /** Horse ids of those entries, in entry order. */
    myHorseIds: string[];
    /** null = uncapped. */
    remaining: number | null;
    /** "open" = can add; "full" = at your cap; "closed" = class not scheduled (cancelled/combined/placed…). */
    state: "open" | "full" | "closed";
    /** Verdict for every horse the viewer owns, same order as the horses input. */
    verdicts: HorseVerdict[];
    /** Horses with code "ok" (not blocked, no soft mismatch), breed matches first, then input order. */
    applicable: string[];
    /** Everything else, blocked first (certain reasons), then soft mismatches. */
    other: string[];
    /** The class's name names a breed ("101 Arabian" yes, "Vintage (Pre-1990)" no). */
    breedNamed: boolean;
    /** The three tiers the page shows — see HorseVerdict.tier. Breed matches lead `fits`. */
    fits: string[];
    maybe: string[];
    blocked: string[];
}

export interface HorseLedger {
    horseId: string;
    /** Live entries by class id. */
    classIds: string[];
    /** The halter class this horse is in, if any. */
    halterClassId: string | null;
}

export interface EntrantLedger {
    classes: ClassLedger[]; // flattened in program order (division → section → class sortOrder)
    byClass: Record<string, ClassLedger>;
    horses: HorseLedger[];
    byHorse: Record<string, HorseLedger>;
    /** Live entries total. */
    liveEntries: number;
    /** Classes where state === "open" and at least one horse is not blocked. */
    classesWithRoom: number;
}

// ── One horse × one class ──

interface VerdictHorse {
    id: string;
    scale: string | null;
    finish: string | null;
    breed?: string | null;
}

interface VerdictClass {
    id: string;
    name: string;
    axis: DivisionAxis;
    maxPerEntrant: number | null;
    allowedScales: string[] | null;
    allowedFinishes: string[] | null;
}

interface VerdictLiveEntry {
    classId: string;
    horseId: string;
    axis: DivisionAxis;
}

export interface HorseVerdictArgs {
    horse: VerdictHorse;
    cls: VerdictClass;
    /** Live entries of THIS viewer only, each with its class axis. */
    myLive: VerdictLiveEntry[];
    classNameById?: Record<string, string>; // for the in_other_halter reason text
}

/** One certain refusal, as found by `horseBlocks`. */
export interface HorseBlock {
    code: "in_this_class" | "in_other_halter" | "class_full_for_you";
    /** For in_other_halter: the class it is in. */
    otherClassId?: string;
}

/** The per-entrant cap in force, or null when uncapped (null or ≤ 0 —
 *  the server has always treated 0 as "no cap"). */
export function effectiveCap(maxPerEntrant: number | null): number | null {
    return maxPerEntrant !== null && maxPerEntrant > 0 ? maxPerEntrant : null;
}

/**
 * EVERY certain refusal that applies, in precedence order
 * (in_this_class > in_other_halter > class_full_for_you). The server
 * validator reports all of them in one pass; `horseVerdict` takes the
 * first. Scratched entries must already be excluded from `myLive`.
 */
export function horseBlocks(args: Pick<HorseVerdictArgs, "horse" | "cls" | "myLive">): HorseBlock[] {
    const { horse, cls, myLive } = args;
    const blocks: HorseBlock[] = [];

    // No double entry in the same class.
    if (myLive.some((e) => e.classId === cls.id && e.horseId === horse.id)) {
        blocks.push({ code: "in_this_class" });
    }

    // ONE breed-halter class per horse per show.
    if (cls.axis === "halter") {
        const other = myLive.find((e) => e.horseId === horse.id && e.axis === "halter" && e.classId !== cls.id);
        if (other) blocks.push({ code: "in_other_halter", otherClassId: other.classId });
    }

    // Per-class entrant cap.
    const cap = effectiveCap(cls.maxPerEntrant);
    if (cap !== null) {
        const mine = myLive.filter((e) => e.classId === cls.id).length;
        if (mine >= cap) blocks.push({ code: "class_full_for_you" });
    }

    return blocks;
}

/** Does the horse's scale pass the class's list? Both sides go through
 *  the Taxonomy-v2 normalizer, exactly as the server compares them. */
export function scaleFits(scale: string | null | undefined, allowed: string[] | null | undefined): boolean {
    if (!allowed || allowed.length === 0) return true;
    const norm = normalizeScale(scale);
    if (norm === null) return false;
    return allowed.some((s) => normalizeScale(s) === norm);
}

/** Does the horse's finish pass the class's list? Exact match. */
export function finishFits(finish: string | null | undefined, allowed: string[] | null | undefined): boolean {
    if (!allowed || allowed.length === 0) return true;
    return !!finish && allowed.includes(finish);
}

function uniq(values: string[]): string[] {
    return [...new Set(values)];
}

function blockReason(block: HorseBlock, cls: VerdictClass, classNameById?: Record<string, string>): string {
    switch (block.code) {
        case "in_this_class":
            return "Already entered in this class";
        case "in_other_halter": {
            const label = block.otherClassId ? classNameById?.[block.otherClassId] : undefined;
            return label ? `In halter as ${label}` : "Already in another halter class";
        }
        case "class_full_for_you": {
            const cap = effectiveCap(cls.maxPerEntrant) ?? 0;
            return `At your limit · ${cap} ${cap === 1 ? "entry" : "entries"} per entrant`;
        }
    }
}

/** The verdict one horse would get for one class — same logic the ledger uses, exported for the server validator. */
export function horseVerdict(args: HorseVerdictArgs): HorseVerdict {
    const { horse, cls, classNameById } = args;
    const breedMatch = breedMatchesClass(horse.breed ?? null, cls.name);

    const [block] = horseBlocks(args);
    if (block) {
        return {
            horseId: horse.id,
            code: block.code,
            blocked: true,
            reason: blockReason(block, cls, classNameById),
            ...(block.otherClassId ? { otherClassId: block.otherClassId } : {}),
            breedMatch,
            tier: "blocked",
            hint: null,
        };
    }

    if (!scaleFits(horse.scale, cls.allowedScales)) {
        const allowed = uniq(cls.allowedScales!.map((s) => normalizeScale(s) ?? s.trim()));
        return {
            horseId: horse.id,
            code: "scale",
            blocked: false,
            reason: `${allowed.join(" / ")} only · ${horse.scale ? `this horse is ${horse.scale}` : "this horse's scale is unknown"}`,
            breedMatch,
            tier: "maybe",
            hint: null,
        };
    }

    if (!finishFits(horse.finish, cls.allowedFinishes)) {
        return {
            horseId: horse.id,
            code: "finish",
            blocked: false,
            reason: `${cls.allowedFinishes!.join(" / ")} only · ${horse.finish ? `this horse is ${horse.finish}` : "this horse's finish is unknown"}`,
            breedMatch,
            tier: "maybe",
            hint: null,
        };
    }

    // Nothing stands in the way. Whether that is a clean fit or a
    // "maybe" depends on whether the class names a breed at all: an
    // "Arabian" class with a horse listed as Morgan (or not listed) is
    // a maybe; "Fall & Creative Scenes" names no breed, so every horse fits.
    const breedNamed = classNamesBreed(cls.name, BREEDS);
    const uncertain = breedNamed && !breedMatch;
    return {
        horseId: horse.id,
        code: "ok",
        blocked: false,
        reason: null,
        breedMatch,
        tier: uncertain ? "maybe" : "fits",
        hint: uncertain ? (horse.breed ? `Listed as ${horse.breed}` : "Breed not set on this horse") : null,
    };
}

// ── The whole show, for one viewer ──

/** "112 · Paint", or just the name when the class has no number. */
export function classLabel(cls: { classNumber: string | null; name: string }): string {
    return cls.classNumber ? `${cls.classNumber} · ${cls.name}` : cls.name;
}

const bySortOrder = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;

export function buildEntrantLedger(input: {
    divisions: ConsoleDivision[];
    myEntries: MyShowEntry[]; // from src/lib/shows/public — scratched rows must be ignored for all counts
    horses: EntrantHorse[];
}): EntrantLedger {
    // Program order: division → section → class, each by sortOrder
    // (Array.prototype.sort is stable, so ties keep input order).
    const flat: { cls: ConsoleClass; sectionName: string; divisionName: string; axis: DivisionAxis }[] = [];
    for (const div of [...input.divisions].sort(bySortOrder)) {
        for (const sec of [...div.sections].sort(bySortOrder)) {
            for (const cls of [...sec.classes].sort(bySortOrder)) {
                flat.push({ cls, sectionName: sec.name, divisionName: div.name, axis: div.axis });
            }
        }
    }

    const axisByClass = new Map<string, DivisionAxis>();
    const classNameById: Record<string, string> = {};
    for (const f of flat) {
        axisByClass.set(f.cls.id, f.axis);
        classNameById[f.cls.id] = classLabel(f.cls);
    }

    const live = input.myEntries.filter((e) => e.status !== "scratched");
    // An entry in a class the program no longer lists cannot be a
    // halter entry we know of; "other" keeps it countable, never halter.
    const myLive: VerdictLiveEntry[] = live.map((e) => ({
        classId: e.classId,
        horseId: e.horseId,
        axis: axisByClass.get(e.classId) ?? "other",
    }));

    // ── Per horse ──
    const byHorse: Record<string, HorseLedger> = {};
    const horses: HorseLedger[] = [];
    const ensureHorse = (horseId: string): HorseLedger => {
        let h = byHorse[horseId];
        if (!h) {
            h = { horseId, classIds: [], halterClassId: null };
            byHorse[horseId] = h;
            horses.push(h);
        }
        return h;
    };
    for (const h of input.horses) ensureHorse(h.id);
    for (const e of myLive) {
        const h = ensureHorse(e.horseId);
        if (!h.classIds.includes(e.classId)) h.classIds.push(e.classId);
        if (e.axis === "halter" && h.halterClassId === null) h.halterClassId = e.classId;
    }

    // ── Per class ──
    const classes: ClassLedger[] = [];
    const byClass: Record<string, ClassLedger> = {};
    let classesWithRoom = 0;

    for (const { cls, sectionName, divisionName, axis } of flat) {
        const mineHere = myLive.filter((e) => e.classId === cls.id);
        const mineLive = mineHere.length;
        const cap = effectiveCap(cls.maxPerEntrant);
        const remaining = cap === null ? null : Math.max(0, cap - mineLive);
        const state: ClassLedger["state"] = cls.status !== "scheduled" ? "closed" : remaining === 0 ? "full" : "open";

        const verdictClass: VerdictClass = {
            id: cls.id,
            name: cls.name,
            axis,
            maxPerEntrant: cls.maxPerEntrant,
            allowedScales: cls.allowedScales,
            allowedFinishes: cls.allowedFinishes,
        };
        const verdicts = input.horses.map((horse) => horseVerdict({ horse, cls: verdictClass, myLive, classNameById }));

        const ok = verdicts.filter((v) => v.code === "ok");
        const applicable = [...ok.filter((v) => v.breedMatch), ...ok.filter((v) => !v.breedMatch)].map(
            (v) => v.horseId,
        );
        const other = [
            ...verdicts.filter((v) => v.blocked),
            ...verdicts.filter((v) => !v.blocked && v.code !== "ok"),
        ].map((v) => v.horseId);

        const ledger: ClassLedger = {
            classId: cls.id,
            classNumber: cls.classNumber,
            name: cls.name,
            sectionName,
            divisionName,
            axis,
            status: cls.status,
            maxPerEntrant: cls.maxPerEntrant,
            mineLive,
            myHorseIds: mineHere.map((e) => e.horseId),
            remaining,
            state,
            verdicts,
            applicable,
            other,
            breedNamed: classNamesBreed(cls.name, BREEDS),
            // The three tiers the page shows (owner, 2026-10-11): knowns apart
            // from warnings. Breed matches lead the first tier.
            fits: [
                ...verdicts.filter((v) => v.tier === "fits" && v.breedMatch),
                ...verdicts.filter((v) => v.tier === "fits" && !v.breedMatch),
            ].map((v) => v.horseId),
            maybe: verdicts.filter((v) => v.tier === "maybe").map((v) => v.horseId),
            blocked: verdicts.filter((v) => v.tier === "blocked").map((v) => v.horseId),
        };
        classes.push(ledger);
        byClass[cls.id] = ledger;
        if (state === "open" && verdicts.some((v) => !v.blocked)) classesWithRoom += 1;
    }

    return {
        classes,
        byClass,
        horses,
        byHorse,
        liveEntries: live.length,
        classesWithRoom,
    };
}
