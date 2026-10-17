/**
 * The Registry Desk's checks: what is wrong (or worth a look) on one
 * release or mold, and the to-do lists built from the whole Registry.
 *
 * Pure, no I/O, so the Mold view's flag chips (Package B), the to-do lists
 * and the tests all read one definition. Where a check is also a line of
 * `scripts/catalog-delta/registry_health.mjs` it uses the same rule, so a
 * to-do list's count equals the health scan's on the same day (the tests
 * hold the two together):
 *
 *   no_mold              "releases with no parent"
 *   wrong_scale          "releases whose scale differs from their mold"
 *   empty_mold           "molds with zero releases"
 *   duplicate_release    "identical releases on the same mold (title + colour + number)"
 *   mold_name_disagrees  "releases whose typed mold name disagrees with the mold ..."
 *   title_punctuation    "titles ending in punctuation"
 *   title_lowercase      "titles starting lowercase"
 *   year_as_text         "years stored as text instead of numbers"
 *   near_name            "maker/artist names one or two letters apart"
 *
 * `number_in_title` deliberately differs from the scan's regex: it uses
 * the MHH-079 rule (`leadingModelNumber`), where a bare year leading a
 * name ("2019 Holiday Horse") is a year, not a number.
 *
 * Owner answer 1 (2026-10-16): "Whole set in the title" is a neutral note,
 * not a problem, until a moderator style rule replaces the DECISIONS line
 * "Sets: one row per piece ... full roster in the title".
 */
import { hasTrailingPunctuation } from "@/lib/catalog/corrections";
import { leadingModelNumber } from "@/lib/catalog/titleNumber";
import { sameWords } from "@/lib/catalog/searchKey";
import { generationOf, rosterPieces, setLabel, stripGeneration } from "@/lib/linker/model";

// ── Rows ────────────────────────────────────────────────────────

/** The columns the checks read: a catalog_items row. */
export interface CheckRow {
    id: string;
    title: string;
    item_type: string;
    maker: string | null;
    scale: string | null;
    parent_id: string | null;
    artist?: string | null;
    attributes: Record<string, unknown> | null;
}

/** A row sharing a model number, with the title of the mold it is filed under (for set pieces). */
export type NumberMate = CheckRow & { mold_title?: string | null };

export interface ReleaseContext {
    /** The mold the release is filed under (its parent), if any. */
    mold?: CheckRow | null;
    /** The other releases filed under the same mold (the row itself is ignored). */
    siblings?: CheckRow[];
    /** Releases of the same maker with the same model number (the row itself is ignored). */
    sameNumber?: NumberMate[];
}

// ── Flags ───────────────────────────────────────────────────────

export type FlagKey =
    | "shop_or_sale_title"
    | "no_colour"
    | "roster_in_title"
    | "description_in_title"
    | "colour_in_title"
    | "number_in_title"
    | "number_clash"
    | "wrong_scale"
    | "no_mold"
    | "mold_no_generation"
    | "set_missing_pieces"
    | "title_lowercase"
    | "title_punctuation"
    | "year_as_text"
    | "mold_name_disagrees"
    | "duplicate_release"
    | "empty_mold"
    | "near_name";

/** The words on a flag chip (the approved mock's words). */
export const FLAG_LABELS: Record<FlagKey, string> = {
    shop_or_sale_title: "Shop or sale as the title",
    no_colour: "No colour",
    roster_in_title: "Whole set in the title",
    description_in_title: "Description in the title",
    colour_in_title: "Colour in the title",
    number_in_title: "Model number in the title",
    number_clash: "Shares its model number with another release",
    wrong_scale: "Filed under the wrong scale",
    no_mold: "No mold",
    mold_no_generation: "No generation tag",
    set_missing_pieces: "Set pieces with no release yet",
    title_lowercase: "Title starts lowercase",
    title_punctuation: "Title ends in punctuation",
    year_as_text: "Years stored as text",
    mold_name_disagrees: "Typed mold name disagrees with its mold",
    duplicate_release: "Possible duplicate",
    empty_mold: "No releases",
    near_name: "Name spelled two ways",
};

/**
 * How a chip looks: `problem` is wrong data, `style` is the house format,
 * `note` is neutral information (answer 1: the roster in a set title).
 */
export type FlagTone = "problem" | "style" | "note";

export const FLAG_TONES: Record<FlagKey, FlagTone> = {
    shop_or_sale_title: "style",
    no_colour: "problem",
    roster_in_title: "note",
    description_in_title: "style",
    colour_in_title: "note",
    number_in_title: "style",
    number_clash: "problem",
    wrong_scale: "problem",
    no_mold: "problem",
    mold_no_generation: "style",
    set_missing_pieces: "problem",
    title_lowercase: "style",
    title_punctuation: "style",
    year_as_text: "style",
    mold_name_disagrees: "problem",
    duplicate_release: "problem",
    empty_mold: "problem",
    near_name: "problem",
};

// ── Shared helpers (the health scan's own normalisers) ──────────

const STABLEMATE = "Stablemate (1:32)";
/** registry_health.mjs `norm`: letters and digits only, lowercase. */
export const normName = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** registry_health.mjs `ttl`: words only, lowercase. */
export const normTitle = (s: string | null | undefined) =>
    (s ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

const attr = (row: CheckRow, key: string): unknown => row.attributes?.[key];
const text = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());
const isRelease = (row: CheckRow) => row.item_type === "plastic_release";
const isMold = (row: CheckRow) => row.item_type === "plastic_mold";

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Title checks ────────────────────────────────────────────────

/** A shop, catalog or sale named as the title, instead of the horse. */
const SHOP_OR_SALE =
    /\b(?:live auction|silent auction|auction|raffle|door prize|holiday catalogue?|wish book|catalogue?|sears|j\.?\s?c\.?\s?penney|penney'?s|montgomery wards?|toys\s?r\s?us|fao schwarz|qvc|wal-?mart|tractor supply|k-?mart|spiegel)\b/i;

export function isShopOrSaleTitle(title: string): boolean {
    return SHOP_OR_SALE.test(title);
}

/** A bracket that is a label, not a description: a generation, a year, a count, a short name. */
function isLabelBracket(content: string): boolean {
    const c = content.trim();
    if (!c) return true;
    if (/^g[1-6]$/i.test(c)) return true;
    // eslint-disable-next-line security/detect-unsafe-regex -- anchored, no nested repetition; runs on one bracket's text
    if (/^(?:19|20)\d\d(?:\s*[-–]\s*(?:(?:19|20)?\d\d))?$/.test(c)) return true;
    // eslint-disable-next-line security/detect-unsafe-regex -- anchored, at most four characters can match
    if (/^(?:x\s*)?\d{1,2}$/i.test(c)) return true;
    const words = c.split(/\s+/);
    return words.length <= 3 && /^[\p{Lu}]/u.test(c) && !/\d/.test(c) && !/[,;:>]/.test(c);
}

const ABBREVIATION_BEFORE = /\b(?:Inc|Ltd|Bros|Corp|Mrs|vs|Co|Jr|Sr|St|Mt|Dr|No)$/;
const PREPOSITION_NOTE = /\s(?:On|In|From|Sold|Made|Comes|Packaged|Includes)\s+(?=[a-z])/;

/** Where a description starts inside a title: a long bracket, a second sentence, or "On gold-tone ...". */
export function descriptionInTitle(title: string): { start: number; end: number } | null {
    for (const m of title.matchAll(/\(([^)]*)\)/g)) {
        if (!isLabelBracket(m[1])) return { start: m.index!, end: m.index! + m[0].length };
    }
    for (const m of title.matchAll(/\.\s+(?=[\p{Lu}])/gu)) {
        const before = title.slice(0, m.index!);
        if (!/[\p{Ll}]{2,}$/u.test(before) || ABBREVIATION_BEFORE.test(before)) continue;
        const rest = title.slice(m.index! + m[0].length);
        if (/^with\b/i.test(rest)) continue; // "... . With Appaloosa, ..." is the roster
        return { start: m.index!, end: title.length };
    }
    const p = title.match(PREPOSITION_NOTE);
    if (p && p.index !== undefined) {
        const after = title.slice(p.index);
        const stop = after.search(/\.\s|\s[Ww]ith\s/);
        return { start: p.index, end: stop < 0 ? title.length : p.index + stop + (after[stop] === "." ? 1 : 0) };
    }
    return null;
}

/** Coat colours and pattern words: a title that leads with them before its mold's name carries its colour. */
const COLOUR_WORDS = [
    "bay",
    "chestnut",
    "sorrel",
    "black",
    "brown",
    "grey",
    "gray",
    "white",
    "palomino",
    "buckskin",
    "dun",
    "grulla",
    "grullo",
    "roan",
    "pinto",
    "appaloosa",
    "dapple",
    "dappled",
    "alabaster",
    "liver",
    "flaxen",
    "cremello",
    "perlino",
    "champagne",
    "piebald",
    "skewbald",
    "tobiano",
    "overo",
    "sabino",
    "tovero",
    "leopard",
    "blanket",
];
// eslint-disable-next-line security/detect-non-literal-regexp -- built once from the constant word list above
const COLOUR_RE = new RegExp(`\\b(?:${COLOUR_WORDS.join("|")})\\b`, "i");
/** Words that may sit in a colour phrase besides colours. */
// eslint-disable-next-line security/detect-non-literal-regexp -- built once from the constant word list above
const COLOUR_PHRASE_RE = new RegExp(
    `^(?:\\s|-|&|,|\\band\\b|\\blight\\b|\\bdark\\b|\\bmedium\\b|\\bred\\b|\\bgolden\\b|\\bblood\\b|\\bsplash\\b|\\bflea-?bitten\\b|\\bsilver\\b|\\b(?:${COLOUR_WORDS.join("|")})\\b)+$`,
    "i",
);

/** The colour phrase before the mold's name ("Black and White Pinto" in "Black and White Pinto Saddlebred"). */
export function colourBeforeMoldName(
    title: string,
    moldTitle: string | null | undefined,
): { prefix: string; at: number } | null {
    if (!moldTitle) return null;
    const name = stripGeneration(moldTitle);
    if (!name || COLOUR_RE.test(name)) return null;
    // eslint-disable-next-line security/detect-non-literal-regexp -- the mold's name, escaped
    const m = title.match(new RegExp(`\\b${escapeRe(name)}\\b`, "i"));
    if (!m || m.index === undefined || m.index === 0) return null;
    const prefix = title.slice(0, m.index).trim();
    return COLOUR_RE.test(prefix) ? { prefix, at: m.index } : null;
}

/** Is the prefix only colour words (so it can come off the title whole)? */
export function isPureColourPhrase(prefix: string): boolean {
    return COLOUR_PHRASE_RE.test(prefix.trim());
}

/** A colour description that says nothing: empty, "?", "unknown". */
export function hasNoColour(row: CheckRow): boolean {
    const c = text(attr(row, "color_description"));
    return !c || /^(?:\?+|unknown|n\/a|none|-+)$/i.test(c);
}

/** The full roster of a set in the title: two or more named pieces after "With". */
export function hasRosterInTitle(title: string): boolean {
    return rosterPieces(title).length >= 2;
}

/** registry_health.mjs: release_year_start or _end stored as a string. */
export function hasYearAsText(row: CheckRow): boolean {
    return typeof attr(row, "release_year_start") === "string" || typeof attr(row, "release_year_end") === "string";
}

/** registry_health.mjs: the typed mold name (less a leading "G1 ") is not the mold's title. */
export function moldNameDisagrees(row: CheckRow, mold: CheckRow | null | undefined): boolean {
    const typed = attr(row, "mold_name");
    if (!row.parent_id || !typed) return false;
    return normTitle(String(typed).replace(/^g[1-6]\s+/i, "")) !== normTitle(mold?.title);
}

/** Two rows are one set's pieces: the same set name, or the same title in different colours. */
function sameSet(a: CheckRow, b: CheckRow): boolean {
    const la = setLabel(a.title);
    const lb = setLabel(b.title);
    if (la && lb && normTitle(la) === normTitle(lb)) return true;
    return normTitle(a.title) === normTitle(b.title);
}

/** registry_health.mjs `relKey`: what makes two releases identical. */
export function duplicateKey(row: CheckRow): string {
    return `${row.parent_id}|${normTitle(row.title)}|${normTitle(text(attr(row, "color_description")) || null)}|${attr(row, "model_number") ?? ""}`;
}

function modelNumberOf(row: CheckRow): string {
    return text(attr(row, "model_number")).replace(/^#\s*/, "").toLowerCase();
}

/** The pieces a set row names that no row of the same set is filed under. */
export function missingSetPieces(row: CheckRow, mates: NumberMate[], ownMoldTitle?: string | null): string[] {
    const pieces = rosterPieces(row.title);
    if (pieces.length < 2) return [];
    const label = setLabel(row.title);
    const filed = [
        ownMoldTitle ?? null,
        ...mates
            .filter(
                (m) =>
                    m.id !== row.id && label && setLabel(m.title) && normTitle(setLabel(m.title)) === normTitle(label),
            )
            .map((m) => m.mold_title ?? null),
    ].filter((t): t is string => !!t);
    return pieces.filter((p) => !filed.some((t) => sameWords(stripGeneration(t), stripGeneration(p))));
}

/** Checks every row type shares (the health scan runs these over all items). */
function commonFlags(row: CheckRow): FlagKey[] {
    const out: FlagKey[] = [];
    const title = row.title ?? "";
    if (/^[a-z]/.test(title)) out.push("title_lowercase");
    if (hasTrailingPunctuation(title)) out.push("title_punctuation");
    if (hasYearAsText(row)) out.push("year_as_text");
    return out;
}

/**
 * Everything worth flagging on one release. `ctx` carries what a row can't
 * know alone: its mold, the releases beside it, and rows sharing its number.
 */
export function releaseFlags(row: CheckRow, ctx: ReleaseContext = {}): FlagKey[] {
    const out = new Set<FlagKey>();
    const title = row.title ?? "";
    const mold = ctx.mold ?? null;

    if (isShopOrSaleTitle(title)) out.add("shop_or_sale_title");
    if (hasNoColour(row)) out.add("no_colour");
    if (hasRosterInTitle(title)) out.add("roster_in_title");
    if (descriptionInTitle(title)) out.add("description_in_title");
    if (mold && colourBeforeMoldName(title, mold.title)) out.add("colour_in_title");
    if (leadingModelNumber(title)) out.add("number_in_title");

    if (!row.parent_id) out.add("no_mold");
    else if (mold && mold.scale && row.scale && mold.scale !== row.scale) out.add("wrong_scale");
    if (moldNameDisagrees(row, mold)) out.add("mold_name_disagrees");

    const key = duplicateKey(row);
    if ((ctx.siblings ?? []).some((s) => s.id !== row.id && duplicateKey(s) === key)) out.add("duplicate_release");

    // Number checks need the rows sharing the number; without them, say nothing.
    const number = modelNumberOf(row);
    if (number && ctx.sameNumber) {
        const mates = ctx.sameNumber.filter(
            (m) => m.id !== row.id && modelNumberOf(m) === number && normName(m.maker) === normName(row.maker),
        );
        if (mates.some((m) => !sameSet(row, m))) out.add("number_clash");
        if (missingSetPieces(row, mates, mold?.title).length > 0) out.add("set_missing_pieces");
    }

    for (const f of commonFlags(row)) out.add(f);
    return [...out];
}

/** Breyer Stablemate molds carry their generation in the title: "Saddlebred (G1)". */
export function needsGenerationTag(mold: CheckRow): boolean {
    return isMold(mold) && normName(mold.maker) === "breyer" && mold.scale === STABLEMATE && !generationOf(mold.title);
}

/** Everything worth flagging on one mold, given the releases filed under it. */
export function moldFlags(mold: CheckRow, releases: CheckRow[]): FlagKey[] {
    const out: FlagKey[] = [];
    if (!releases.some((r) => isRelease(r) && r.parent_id === mold.id)) out.push("empty_mold");
    if (needsGenerationTag(mold)) out.push("mold_no_generation");
    out.push(...commonFlags(mold));
    return out;
}

// ── Names spelled two ways (registry_health.mjs `near`) ─────────

function levenshtein(a: string, b: string): number {
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let x = 1; x <= a.length; x++) {
        let diag = prev[0];
        prev[0] = x;
        for (let y = 1; y <= b.length; y++) {
            const keep = prev[y];
            prev[y] = Math.min(prev[y] + 1, prev[y - 1] + 1, diag + (a[x - 1] === b[y - 1] ? 0 : 1));
            diag = keep;
        }
    }
    return prev[b.length];
}

/** Maker or artist names one or two letters apart, with how many rows use each. */
export function nearNamePairs(rows: CheckRow[]): { a: string; b: string; countA: number; countB: number }[] {
    const people = new Map<string, number>();
    for (const r of rows) for (const n of [r.maker, r.artist]) if (n) people.set(n, (people.get(n) ?? 0) + 1);
    const names = [...people.keys()].map((name) => ({ name, n: normName(name) })).filter((x) => x.n.length > 6);
    names.sort((p, q) => p.n.length - q.n.length);
    const out: { a: string; b: string; countA: number; countB: number }[] = [];
    for (let i = 0; i < names.length; i++)
        for (let j = i + 1; j < names.length && names[j].n.length - names[i].n.length <= 2; j++) {
            if (levenshtein(names[i].n, names[j].n) <= 2)
                out.push({
                    a: names[i].name,
                    b: names[j].name,
                    countA: people.get(names[i].name)!,
                    countB: people.get(names[j].name)!,
                });
        }
    return out;
}

// ── To-do lists ─────────────────────────────────────────────────

export type TodoListKey =
    | "number_in_title"
    | "no_colour"
    | "shop_or_sale_title"
    | "description_in_title"
    | "mold_no_generation"
    | "wrong_scale"
    | "duplicates"
    | "set_missing_pieces"
    | "no_mold"
    | "empty_mold"
    | "mold_name_disagrees"
    | "near_name"
    | "title_punctuation"
    | "title_lowercase"
    | "year_as_text"
    | "colour_in_title"
    | "roster_in_title";

export interface TodoItem {
    /** Unique within its list; the claim key. A row id, or a group key. */
    key: string;
    /** Which check found it (a list can hold two, e.g. duplicates and number clashes). */
    kind: FlagKey;
    /** The row to open, when there is one. */
    id: string | null;
    title: string;
    /** One line of detail in plain words. */
    detail: string | null;
    maker: string | null;
    scale: string | null;
    moldId: string | null;
    moldTitle: string | null;
}

export interface TodoListDef {
    key: TodoListKey;
    title: string;
    what: string;
    tone: FlagTone;
}

/** The lists, in the order the Desk shows them: Stablemate work from the 16 October survey first. */
export const TODO_LISTS: TodoListDef[] = [
    {
        key: "number_in_title",
        title: "Model number in the title",
        what: "Titles like “#5038 Morgan Mare”. The number belongs in its own box.",
        tone: "style",
    },
    {
        key: "no_colour",
        title: "No colour",
        what: "Releases with no colour, or only a “?”. Fill in what you know.",
        tone: "problem",
    },
    {
        key: "shop_or_sale_title",
        title: "Shop or sale as the title",
        what: "Titles like “BreyerFest 1990 — Live Auction 01” or “Sears Holiday Catalog”.",
        tone: "style",
    },
    {
        key: "description_in_title",
        title: "Description in the title",
        what: "Notes pasted into the name, like “(Replaced in 2006 by …)”. They belong in the notes.",
        tone: "style",
    },
    {
        key: "mold_no_generation",
        title: "Molds with no generation tag",
        what: "Breyer Stablemate molds without “(G1)”, “(G2)” … in the title, so molds of the same breed get mixed up.",
        tone: "style",
    },
    {
        key: "wrong_scale",
        title: "Filed under the wrong scale",
        what: "Releases sitting under a mold of another scale. Moving them keeps every horse linked.",
        tone: "problem",
    },
    {
        key: "duplicates",
        title: "Possible duplicates or number clashes",
        what: "Identical releases on one mold, and releases sharing a model number. Usually a wrong number, sometimes a true duplicate.",
        tone: "problem",
    },
    {
        key: "set_missing_pieces",
        title: "Gift sets with missing pieces",
        what: "Pieces named in a set's title that have no release of their own yet.",
        tone: "problem",
    },
    {
        key: "no_mold",
        title: "Releases with no mold",
        what: "Releases not filed under any mold. Find the mold and file them there.",
        tone: "problem",
    },
    {
        key: "empty_mold",
        title: "Molds with no releases",
        what: "Molds nothing is filed under. Usually a duplicate of another mold, or the releases are filed somewhere else.",
        tone: "problem",
    },
    {
        key: "mold_name_disagrees",
        title: "Typed mold name disagrees",
        what: "The release says one mold in its Mold box but is filed under another.",
        tone: "problem",
    },
    {
        key: "near_name",
        title: "Names spelled two ways",
        what: "Maker or artist names one or two letters apart. A typo, or two different people? Check before merging.",
        tone: "problem",
    },
    {
        key: "title_punctuation",
        title: "Titles ending in punctuation",
        what: "A stray full stop or comma at the end, usually from a description pasted in.",
        tone: "style",
    },
    {
        key: "title_lowercase",
        title: "Titles starting lowercase",
        what: "Names start with a capital letter.",
        tone: "style",
    },
    {
        key: "year_as_text",
        title: "Years stored as text",
        what: "Years that came in as text from the March import. Saving the year again stores it as a number.",
        tone: "style",
    },
    {
        key: "colour_in_title",
        title: "Colour in the title",
        what: "Titles like “Black Pinto Saddlebred”. Worth a look: some horses really are named for their colour.",
        tone: "note",
    },
    {
        key: "roster_in_title",
        title: "Whole set in the title",
        what: "Set pieces carry the full list of horses in their title. That is today's rule, so this is a note, not a problem, until the moderators agree a new set-title rule.",
        tone: "note",
    },
];

export interface TodoList extends TodoListDef {
    count: number;
    items: TodoItem[];
}

const LIST_FOR_FLAG: Partial<Record<FlagKey, TodoListKey>> = {
    number_in_title: "number_in_title",
    no_colour: "no_colour",
    shop_or_sale_title: "shop_or_sale_title",
    description_in_title: "description_in_title",
    wrong_scale: "wrong_scale",
    no_mold: "no_mold",
    mold_name_disagrees: "mold_name_disagrees",
    title_punctuation: "title_punctuation",
    title_lowercase: "title_lowercase",
    year_as_text: "year_as_text",
    colour_in_title: "colour_in_title",
    roster_in_title: "roster_in_title",
    mold_no_generation: "mold_no_generation",
    empty_mold: "empty_mold",
};

/** Stablemates first (the 16 October survey), then maker, mold and title. */
function byStablemateFirst(a: TodoItem, b: TodoItem): number {
    const sa = a.scale === STABLEMATE ? 0 : 1;
    const sb = b.scale === STABLEMATE ? 0 : 1;
    return (
        sa - sb ||
        (a.maker ?? "").localeCompare(b.maker ?? "") ||
        (a.moldTitle ?? "").localeCompare(b.moldTitle ?? "") ||
        a.title.localeCompare(b.title)
    );
}

/** Every to-do list, computed from every row of the Registry. */
export function computeTodoLists(rows: CheckRow[]): TodoList[] {
    const byId = new Map(rows.map((r) => [r.id, r]));
    const releases = rows.filter(isRelease);
    const molds = rows.filter(isMold);
    const lists = new Map<TodoListKey, TodoItem[]>(TODO_LISTS.map((d) => [d.key, []]));
    const push = (key: TodoListKey, item: TodoItem) => lists.get(key)!.push(item);

    const kidsOf = new Map<string, CheckRow[]>();
    for (const r of releases)
        if (r.parent_id) (kidsOf.get(r.parent_id) ?? kidsOf.set(r.parent_id, []).get(r.parent_id)!).push(r);
    const byNumber = new Map<string, NumberMate[]>();
    for (const r of releases) {
        const n = modelNumberOf(r);
        if (!n) continue;
        const k = `${normName(r.maker)}|${n}`;
        (byNumber.get(k) ?? byNumber.set(k, []).get(k)!).push({
            ...r,
            mold_title: byId.get(r.parent_id ?? "")?.title ?? null,
        });
    }

    const itemFor = (row: CheckRow, kind: FlagKey, detail: string | null = null): TodoItem => {
        const mold = row.parent_id ? (byId.get(row.parent_id) ?? null) : null;
        return {
            key: row.id,
            kind,
            id: row.id,
            title: row.title,
            detail,
            maker: row.maker,
            scale: row.scale,
            moldId: isMold(row) ? row.id : (mold?.id ?? null),
            moldTitle: isMold(row) ? row.title : (mold?.title ?? null),
        };
    };

    // Per-row checks.
    const seenSets = new Set<string>();
    for (const r of releases) {
        const mold = r.parent_id ? (byId.get(r.parent_id) ?? null) : null;
        const n = modelNumberOf(r);
        // Duplicates, number clashes and set pieces are listed per group below.
        const flags = releaseFlags(r, { mold });
        for (const f of flags) {
            const list = LIST_FOR_FLAG[f];
            if (!list) continue;
            const detail =
                f === "wrong_scale"
                    ? `${r.scale} under a ${mold?.scale} mold`
                    : f === "mold_name_disagrees"
                      ? `Mold box says “${String(r.attributes?.mold_name)}”`
                      : f === "number_in_title"
                        ? `Number box: ${text(attr(r, "model_number")) || "empty"}`
                        : null;
            push(list, itemFor(r, f, detail));
        }
        // A set is listed once, by its name and number, with the pieces it lacks.
        const label = setLabel(r.title);
        if (n && label && hasRosterInTitle(r.title)) {
            const setKey = `set:${normName(r.maker)}|${normTitle(label)}|${n}`;
            if (seenSets.has(setKey)) continue;
            seenSets.add(setKey);
            const group = (byNumber.get(`${normName(r.maker)}|${n}`) ?? []).filter(
                (m) => setLabel(m.title) && normTitle(setLabel(m.title)) === normTitle(label),
            );
            const pieces = rosterPieces(r.title);
            const filed = group.map((m) => m.mold_title).filter((t): t is string => !!t);
            const missing = pieces.filter((p) => !filed.some((t) => sameWords(stripGeneration(t), stripGeneration(p))));
            for (const piece of missing)
                push("set_missing_pieces", {
                    ...itemFor(
                        r,
                        "set_missing_pieces",
                        `#${n} names ${piece}, but no piece of this set is filed under a ${piece} mold`,
                    ),
                    key: `${setKey}|${normTitle(piece)}`,
                    title: `${label} · ${piece}`,
                });
        }
    }

    // Identical releases (health's relKey, orphans included): one item per group.
    const dupGroups = new Map<string, CheckRow[]>();
    for (const r of releases) {
        const k = duplicateKey(r);
        (dupGroups.get(k) ?? dupGroups.set(k, []).get(k)!).push(r);
    }
    for (const [k, group] of dupGroups) {
        if (group.length < 2) continue;
        push("duplicates", {
            ...itemFor(group[0], "duplicate_release", `${group.length} identical releases`),
            key: `dup:${k}`,
        });
    }
    // Model numbers shared by releases that are not one set: one item per number.
    for (const [k, group] of byNumber) {
        if (group.length < 2) continue;
        const clash = group.some((a) => group.some((b) => a.id !== b.id && !sameSet(a, b)));
        if (!clash) continue;
        const n = modelNumberOf(group[0]);
        push("duplicates", {
            ...itemFor(
                group[0],
                "number_clash",
                `#${n} is on ${group.length} releases: ${[...new Set(group.map((g) => g.title))].slice(0, 3).join(" · ")}`,
            ),
            key: `num:${k}`,
            title: `#${n} ${group[0].title}`,
        });
    }

    for (const m of molds) {
        for (const f of moldFlags(m, kidsOf.get(m.id) ?? [])) {
            const list = LIST_FOR_FLAG[f];
            if (list) push(list, itemFor(m, f));
        }
    }
    // Other row types (artist resins and the rest) share the format checks.
    for (const r of rows) {
        if (isRelease(r) || isMold(r)) continue;
        for (const f of commonFlags(r)) push(LIST_FOR_FLAG[f]!, itemFor(r, f));
    }

    for (const p of nearNamePairs(rows))
        push("near_name", {
            key: `name:${normName(p.a)}|${normName(p.b)}`,
            kind: "near_name",
            id: null,
            title: `${p.a} / ${p.b}`,
            detail: `${p.countA} row${p.countA === 1 ? "" : "s"} / ${p.countB} row${p.countB === 1 ? "" : "s"}`,
            maker: null,
            scale: null,
            moldId: null,
            moldTitle: null,
        });

    return TODO_LISTS.map((def) => {
        const items = lists.get(def.key)!.sort(byStablemateFirst);
        return { ...def, count: items.length, items };
    });
}
