/**
 * The reference linker — the one model behind the "Try the new linker"
 * step of the add-horse form.
 *
 * The old picker hands back a flat list of titles. This module decides
 * the shapes the new one shows: a mold with an identity line, releases
 * ordered by how likely they are to be the member's horse, what a row
 * says when a fact is missing, and how a typed term is read. It is pure
 * so the server action and the component agree and the tests can pin
 * the rules. Spec: the "Reference linker spec" doc (2026-10-12).
 *
 * It runs on the Registry as it is today: no generation column, no
 * alias table, sets hung on one mold. Where the data cannot tell two
 * molds apart the model says so (`ambiguous`) instead of pretending.
 */

import { sameWords } from "@/lib/catalog/searchKey";
import { yearRangeLabel } from "@/lib/catalog/cardDisplay";
import { parseYearRange } from "@/lib/catalog/corrections";

export const LINKER_PREF_KEY = "mhh:linker";
export type LinkerPref = "new" | "old";

export interface LinkerRelease {
    id: string;
    title: string;
    /** The model number as stored, without a leading hash. */
    model: string | null;
    /** attributes.color_description — "what it looks like". */
    look: string | null;
    from: number | null;
    to: number | null;
    run: string | null;
    /** The set this piece came in, when the title says so. */
    setName: string | null;
    /** True when this row hangs on ANOTHER mold but its set title names this one. */
    isSetPiece: boolean;
    /** True when this release's own name is what the member typed. It leads its group. */
    hit?: boolean;
    /** A member's photo of a horse on this release, when one exists. */
    photo: string | null;
    scale: string | null;
}

export interface LinkerMold {
    id: string;
    title: string;
    maker: string;
    scale: string | null;
    /** "G1".."G6" when the title carries it; null otherwise. */
    generation: string | null;
    sculptor: string | null;
    year: number | null;
    /** Distinct collectors with a horse linked to the mold itself; null = unknown. */
    owners: number | null;
    releases: LinkerRelease[];
    /** True when another mold in the same result prints the same identity line. */
    ambiguous: boolean;
    href: string;
}

/** A mold shown only as a heading (other scale, other maker). */
export interface LinkerMoldSummary {
    id: string;
    title: string;
    maker: string;
    scale: string | null;
    generation: string | null;
    year: number | null;
    releaseCount: number;
    /** The release name that matched the search, when the mold was reached through one. */
    hitTitle?: string;
    href: string;
}

export interface LinkerOther {
    id: string;
    title: string;
    itemType: string;
    maker: string;
    scale: string | null;
    look: string | null;
    href: string;
}

export interface NumberHit {
    mold: LinkerMoldSummary | null;
    release: LinkerRelease;
}

export interface LinkerResult {
    term: string;
    kind: "text" | "number" | "empty";
    scale: string | null;
    /** Molds at the chosen scale (or every scale when none is chosen), with releases. */
    molds: LinkerMold[];
    /** Same name, other scales. */
    otherScales: LinkerMoldSummary[];
    /** Resins, chinas, micros and the rest. */
    others: LinkerOther[];
    numberHits: NumberHit[];
}

/** Scale names the linker offers as chips; the rest fall under "Any scale". */
export const LINKER_SCALES = [
    "Traditional (1:9)",
    "Classic (1:12)",
    "Stablemate (1:32)",
    "Paddock Pal (1:24)",
    "Mini Whinnies (1:64)",
] as const;

export function shortScale(scale: string | null): string {
    if (!scale) return "scale not recorded";
    return scale.replace(/\s*\(.*\)\s*$/, "");
}

/** "5022", "#5022", " 5022 " → a model number; anything else is text. */
export function parseTerm(raw: string): { kind: "text" | "number" | "empty"; value: string } {
    const t = raw.trim();
    if (!t) return { kind: "empty", value: "" };
    const m = t.match(/^#?\s*([0-9][0-9a-z-]{2,11})$/i);
    if (m && /\d{3,}/.test(m[1])) return { kind: "number", value: m[1].toLowerCase() };
    return { kind: "text", value: t };
}

const GEN_RE = /\(\s*(g[1-6])\s*\)|^\s*(g[1-6])\s+|\s+(g[1-6])\s*$/i;

/** "Silky Sullivan (G1)", "G1 Silky Sullivan" → "G1". */
export function generationOf(title: string | null | undefined): string | null {
    if (!title) return null;
    const m = title.match(GEN_RE);
    const g = m?.[1] ?? m?.[2] ?? m?.[3];
    return g ? g.toUpperCase() : null;
}

/** The title without its generation token, so "G1 Silky Sullivan" matches "Silky Sullivan". */
export function stripGeneration(title: string): string {
    return title.replace(GEN_RE, " ").replace(/\s+/g, " ").trim();
}

/** Search-side aliases collectors type that the Registry does not store. */
export function normalizeTerm(raw: string): string {
    let t = raw.trim();
    t = t.replace(/^(sm|stablemate|classic|trad|traditional)\s+/i, "");
    t = stripGeneration(t);
    return t;
}

export function identityLine(m: Pick<LinkerMold, "maker" | "scale" | "generation" | "sculptor" | "year">): string {
    const scale = m.scale ? shortScale(m.scale) + (m.generation ? " " + m.generation : "") : (m.generation ?? null);
    return [m.maker, scale, m.sculptor, m.year ? String(m.year) : null].filter(Boolean).join(" · ");
}

/** Molds that print the same identity line cannot be told apart by it. */
export function markAmbiguous<
    T extends Pick<LinkerMold, "maker" | "scale" | "generation" | "sculptor" | "year" | "title">,
>(molds: T[]): (T & { ambiguous: boolean })[] {
    const seen = new Map<string, number>();
    for (const m of molds) {
        const k = m.title.toLowerCase() + "|" + identityLine(m).toLowerCase();
        seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    return molds.map((m) => ({
        ...m,
        ambiguous: (seen.get(m.title.toLowerCase() + "|" + identityLine(m).toLowerCase()) ?? 0) > 1,
    }));
}

const SET_WORDS = /\b(set|assortment|collection|gift set|play set|playset|family|pack)\b/i;

/** "12-Piece Stablemates Set With Arabian Mare, Citation, …" → "12-Piece Stablemates Set". */
export function setLabel(title: string): string | null {
    const cut = title.replace(/\s+with\s+.*$/i, "").trim();
    if (SET_WORDS.test(cut) || /\bwith\b/i.test(title)) return cut || null;
    return null;
}

/**
 * The pieces a set title lists after "With": "12-Piece Set With Arabian
 * Mare, American Saddlebred (2) & Swaps." → ["Arabian Mare", "American
 * Saddlebred", "Swaps"]. Split on commas, "&", "and" and a further "with";
 * a count or note in brackets and trailing punctuation are dropped. Only a
 * capitalised piece is a horse: a lowercase one is an accessory ("foal
 * blanket", "unicorn halter") or a note ("replaced by …"), MHH-068.
 */
export function rosterPieces(title: string): string[] {
    return rosterSegments(title)
        .map((s) => s.text)
        .filter(isHorsePiece);
}

/** A capitalised piece is a horse; a lowercase one is an accessory or a note. */
const isHorsePiece = (p: string) => /^[\p{Lu}\d]/u.test(p);

/** The roster cut into pieces, each with whether "and"/"&" (rather than a comma) joined it to the one before. */
function rosterSegments(title: string): { text: string; joinedByAnd: boolean }[] {
    const i = title.search(/\bwith\b/i);
    if (i < 0) return [];
    // A capturing split keeps the separators at the odd positions.
    const parts = title
        .slice(i)
        .replace(/^with\b/i, "")
        .split(/(,|&|\band\b|\bwith\b|;)/i);
    const out: { text: string; joinedByAnd: boolean }[] = [];
    for (let k = 0; k < parts.length; k += 2) {
        const sep = k > 0 ? parts[k - 1] : "";
        out.push({
            text: parts[k]
                .replace(/\([^)]*\)/g, " ")
                .replace(/^[\s"'“”‘’]+|[\s.,;:!"'“”‘’]+$/g, "")
                .replace(/\s+/g, " "),
            joinedByAnd: sep === "&" || /^and$/i.test(sep),
        });
    }
    return out;
}

/**
 * Runs of two or more roster pieces joined by "and" or "&", put back
 * together ("Set With Mare and Foal, Stallion" → ["Mare and Foal"]). The
 * split on "and" that lets "Shetland Pony and Welsh Pony" name two molds
 * also cut a mold whose own name holds "and" in two; these runs let that
 * name match whole. Never joined across a comma.
 */
export function rosterRuns(title: string): string[] {
    const segs = rosterSegments(title);
    const out: string[] = [];
    for (let a = 0; a < segs.length; a++) {
        if (!isHorsePiece(segs[a].text)) continue;
        let run = segs[a].text;
        for (let b = a + 1; b < segs.length && segs[b].joinedByAnd && segs[b].text; b++) {
            run += " and " + segs[b].text;
            out.push(run);
        }
    }
    return out;
}

/**
 * Does this release's title say it came with a piece on `moldTitle`? A
 * piece counts only when it IS the mold's name, whole (same words, any
 * order, punctuation aside): "American Saddlebred" is not the Saddlebred
 * mold. Matching the name as a word inside a piece put 37 false set lines
 * on the Stablemate Saddlebred mold (MHH-074). Pieces joined by "and" also
 * count together, for a mold named "Mare and Foal".
 */
export function mentionsMold(title: string, moldTitle: string): boolean {
    const mold = stripGeneration(moldTitle);
    return [...rosterPieces(title), ...rosterRuns(title)].some((piece) => sameWords(stripGeneration(piece), mold));
}

/**
 * Words a title must contain to be worth testing with `mentionsMold`.
 * Order-free, so "Morgan - Prancing" is fetched for Prancing Morgan.
 * One-letter words ("O" in Man O' War) are left out.
 */
export function rosterPrefilterWords(moldTitle: string): string[] {
    return stripGeneration(moldTitle)
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length >= 2);
}

/**
 * The ILIKE patterns for the database read that fetches a mold's candidate
 * set rows: each word after "with", where the roster is. That read stops at
 * 400 rows, so a word matched anywhere in the title filled it with sets
 * that only carry the word in their own name, and real ones were cut.
 * The words hold only letters and digits, so no LIKE wildcard gets in.
 */
export function rosterPrefilterPatterns(moldTitle: string): string[] {
    return rosterPrefilterWords(moldTitle).map((w) => `%with%${w}%`);
}

/** The Registry's one year label (cardDisplay.yearRangeLabel): "1995–1997", "1998" for a start alone, "–1997" for an end alone. */
export function yearsLabel(r: Pick<LinkerRelease, "from" | "to">): string | null {
    return yearRangeLabel({ release_year_start: r.from, release_year_end: r.to });
}

/**
 * The years a form box is filled in with, in the shape `parseYearRange`
 * reads: "1995-1997" or "1998". A row with only a last year fills in
 * nothing, so its end year is never filed as a first year.
 */
export function yearsInput(r: Pick<LinkerRelease, "from" | "to">): string {
    if (!r.from) return "";
    return r.to && r.to !== r.from ? `${r.from}-${r.to}` : String(r.from);
}

export type MissingFact = "colour" | "year" | "model number";

export function missingFacts(r: Pick<LinkerRelease, "look" | "from" | "to" | "model">): MissingFact[] {
    const out: MissingFact[] = [];
    if (!r.look) out.push("colour");
    if (!r.from && !r.to) out.push("year");
    if (!r.model) out.push("model number");
    return out;
}

function isRegular(run: string | null): boolean {
    return !!run && /regular/i.test(run);
}

/**
 * The order a member reads: releases sold alone before set pieces; within
 * each, the regular run first, then rows with a model number, then the
 * earliest year, then title. Rows with no colour sink to the end of their
 * band so a member meets what can be recognised first.
 */
export function orderReleases(list: LinkerRelease[]): LinkerRelease[] {
    const rank = (r: LinkerRelease) => [
        r.hit ? 0 : 1,
        r.isSetPiece || r.setName ? 1 : 0,
        r.look ? 0 : 1,
        isRegular(r.run) ? 0 : 1,
        r.model ? 0 : 1,
        r.from ?? 9999,
    ];
    return [...list].sort((a, b) => {
        const ra = rank(a);
        const rb = rank(b);
        for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
        return a.title.localeCompare(b.title);
    });
}

/**
 * A set is one Registry row per mold in it, all with the same number, so a
 * mold named in eight sets would show the same "#495600 · from the
 * Stablemates Assortment" four times. One row per set and number is enough;
 * `copies` says how many rows stand behind it.
 */
export function collapseSetPieces(list: LinkerRelease[]): (LinkerRelease & { copies?: number })[] {
    const out: (LinkerRelease & { copies?: number })[] = [];
    const seen = new Map<string, LinkerRelease & { copies?: number }>();
    for (const r of list) {
        if (!r.isSetPiece) {
            out.push(r);
            continue;
        }
        const key = `${(r.model ?? "").toLowerCase()}|${(r.setName ?? r.title).toLowerCase().replace(/s\b/g, "")}`;
        const prev = seen.get(key);
        if (prev) {
            prev.copies = (prev.copies ?? 1) + 1;
            if (!prev.look && r.look) prev.look = r.look;
            continue;
        }
        const row = { ...r };
        seen.set(key, row);
        out.push(row);
    }
    return out;
}

/** Which is "the common one": the regular run, else the earliest row that has a colour and a number. */
export function commonOne(list: LinkerRelease[]): string | null {
    // A search hit sorts first, but being searched for does not make it the common release.
    const ordered = orderReleases(list.map((r) => ({ ...r, hit: false }))).filter((r) => !r.isSetPiece && !r.setName);
    const reg = ordered.find((r) => isRegular(r.run));
    if (reg) return reg.id;
    const first = ordered.find((r) => r.look && r.model);
    return first?.id ?? null;
}

/** The chosen scale matches a row's scale; "any"/null matches everything; unscaled rows match nothing but "any". */
export function scaleMatches(rowScale: string | null, chosen: string | null): boolean {
    if (!chosen || chosen === "any") return true;
    return rowScale === chosen;
}

/**
 * A release's own name ("Montana Harvest", "T-Bone"): the title, minus a
 * leading number, when it is not the mold's name and not a set. Null when
 * the release is just "the mold in this colour".
 */
export function releaseName(
    release: Pick<LinkerRelease, "title" | "setName" | "isSetPiece">,
    moldTitle: string | null | undefined,
): string | null {
    if (release.setName || release.isSetPiece) return null;
    const name = splitNumberFromTitle(release.title).title;
    if (!name) return null;
    if ((moldTitle ?? "").trim().toLowerCase() === name.trim().toLowerCase()) return null;
    return name;
}

/** What the linked banner says. */
export function linkedLabel(
    mold: Pick<LinkerMold, "title" | "scale" | "generation"> | null,
    release: LinkerRelease | null,
): string {
    if (!mold && !release) return "";
    const moldBit = mold
        ? mold.title +
          (mold.scale ? " (" + shortScale(mold.scale) + (mold.generation ? " " + mold.generation : "") + ")" : "")
        : "";
    if (!release) return moldBit + ", mold only";
    const rel = [release.model ? "#" + release.model : null, releaseName(release, mold?.title), release.look]
        .filter(Boolean)
        .join(" · ");
    return [moldBit, rel || release.title].filter(Boolean).join(" · ");
}

/**
 * A correction on one attribute, in the shape every suggestion surface and
 * the apply path expect: `{ field: { from, to } }` with both as strings. The
 * first 13 "fill in what you know" corrections (2026-10-13) went out as bare
 * strings and read "undefined → undefined" on the admin queue.
 */
export function factCorrection(
    field: "color_description" | "release_year_start" | "release_year_end" | "model_number",
    current: unknown,
    value: string,
): Record<string, { from: string; to: string }> {
    const to = field === "model_number" ? value.trim().replace(/^#/, "") : value.trim();
    const from = current === null || current === undefined ? "" : String(current);
    return { [field]: { from, to } };
}

/**
 * "Fill in what you know" for the year (MHH-077): "1976" files the first
 * year; "1995-1997" (or 1995–97, 1995 to 1997) files the first and the last.
 */
export function yearFactChanges(
    raw: string,
    current: { release_year_start?: unknown; release_year_end?: unknown },
): { ok: true; changes: Record<string, { from: string; to: string }> } | { ok: false; error: string } {
    const range = parseYearRange(raw);
    if (!range.ok) return range;
    return {
        ok: true,
        changes: {
            ...factCorrection("release_year_start", current.release_year_start, String(range.start)),
            ...(range.end !== null
                ? factCorrection("release_year_end", current.release_year_end, String(range.end))
                : {}),
        },
    };
}

/** "Add my release": the typed years as the suggestion's `year` and `year_end`; empty is fine. */
export function releaseYearFields(
    raw: string | null | undefined,
): { ok: true; fields: { year?: number; year_end?: number } } | { ok: false; error: string } {
    if (!raw?.trim()) return { ok: true, fields: {} };
    const range = parseYearRange(raw);
    if (!range.ok) return range;
    return { ok: true, fields: { year: range.start, ...(range.end !== null ? { year_end: range.end } : {}) } };
}

/** Strip a leading "#5022 " from a typed title so the number goes in its own field. */
export function splitNumberFromTitle(title: string): { title: string; model: string | null } {
    const m = title.trim().match(/^#?\s*(\d{3,7}[a-z]?)\s+(.+)$/i);
    if (m) return { title: m[2].trim(), model: m[1] };
    return { title: title.trim(), model: null };
}
