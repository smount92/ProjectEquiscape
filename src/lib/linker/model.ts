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

/** Does this release's title say it came with a piece on `moldTitle`? */
export function mentionsMold(title: string, moldTitle: string): boolean {
    const i = title.search(/\bwith\b/i);
    if (i < 0) return false;
    const tail = title.slice(i);
    const esc = moldTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // eslint-disable-next-line security/detect-non-literal-regexp -- the title is escaped above
    const re = new RegExp("(^|[\\s,])(" + esc + ")(?=$|[\\s,.;])", "gi");
    // A roster names a mold the way a title does, capitalised ("With Rojo");
    // a lowercase word is an accessory, not a mold ("foal blanket" is not
    // the Foal mold, "unicorn halter" not the Unicorn), MHH-068.
    for (const m of tail.matchAll(re)) {
        if (/^[\p{Lu}\d]/u.test(m[2])) return true;
    }
    return false;
}

export function yearsLabel(r: Pick<LinkerRelease, "from" | "to">): string | null {
    if (r.from && r.to) return r.from === r.to ? String(r.from) : `${r.from}–${r.to}`;
    if (r.from) return `${r.from}–`;
    if (r.to) return `–${r.to}`;
    return null;
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
    field: "color_description" | "release_year_start" | "model_number",
    current: unknown,
    value: string,
): Record<string, { from: string; to: string }> {
    const to = field === "model_number" ? value.trim().replace(/^#/, "") : value.trim();
    const from = current === null || current === undefined ? "" : String(current);
    return { [field]: { from, to } };
}

/** Strip a leading "#5022 " from a typed title so the number goes in its own field. */
export function splitNumberFromTitle(title: string): { title: string; model: string | null } {
    const m = title.trim().match(/^#?\s*(\d{3,7}[a-z]?)\s+(.+)$/i);
    if (m) return { title: m[2].trim(), model: m[1] };
    return { title: title.trim(), model: null };
}
