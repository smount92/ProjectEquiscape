/**
 * Profile customization — the pure half ("make it theirs").
 *
 * Colocated beside the route it serves, the same way /market keeps
 * `listings.ts` next to its page. No I/O here: this module is the
 * single source of truth for what a customization payload may
 * contain, and every value that reaches the page passes through
 * `sanitizeCustomization` first.
 *
 * WHY A CURATED THEME ENUM AND NOT A COLOR PICKER
 * -----------------------------------------------
 * The brief is "let members make it theirs without breaking the
 * leather identity or legibility". Free-form colors can't promise
 * that — one member picks #FFF for the masthead and the cream text
 * ramp vanishes. So a theme is an *id*, and the id maps to a fixed
 * set of CSS custom properties here in code. A hand-crafted jsonb
 * write of `{"theme":"#fff"}` falls through to the default; there is
 * no path from user input to a raw CSS value.
 *
 * WHY IT STAYS LEGIBLE IN BOTH MODES, BY CONSTRUCTION
 * ---------------------------------------------------
 * A theme may only restyle the MATERIAL ramps — the leather body
 * (--leather*), the trim (--brass*), the stitching (--thread). It
 * may never touch the text-on-leather ramp (--leather-text*), and
 * every leather tone below is dark. Cream-on-dark is therefore
 * invariant across the whole registry.
 *   * Lamplight (html[data-theme="night"]) redefines the semantic
 *     tokens but deliberately leaves the material ramps alone —
 *     "leather is already a night material" — so a theme survives
 *     night mode unchanged, and stays cream-on-dark.
 *   * Simple Mode ([data-simple-mode="true"]) force-flattens
 *     .leather-panel to var(--color-saddle) with an UNLAYERED rule
 *     that outranks these variables. Themes therefore *neutralise*
 *     themselves in Simple Mode and every profile falls back to the
 *     one known-accessible surface. That is deliberate: the
 *     accessibility mode wins over the decoration.
 *
 * This is the token-rebinding idiom `src/lib/theme/parchment.ts`
 * established — a CSSProperties bag of custom properties spread onto
 * a wrapper — not the banned inline-color style.
 */

/** Section ids a member may switch off on their own profile. */
export const PROFILE_SECTIONS = [
    "season",
    "stars",
    "trophies",
    "barns",
    "posts",
    "market",
    "ledger",
    "reviews",
] as const;

export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

const SECTION_SET: ReadonlySet<string> = new Set(PROFILE_SECTIONS);

/** Human labels for the settings UI. */
export const SECTION_LABELS: Record<ProfileSection, string> = {
    season: "Championship line",
    stars: "Stars of the Stable",
    trophies: "Trophy Case",
    barns: "Barns",
    posts: "Recent posts",
    market: "For sale",
    ledger: "Show record",
    reviews: "Reviews",
};

/**
 * A theme is a patch over the material ramps. Keys are CSS custom
 * property names WITHOUT the leading `--`; values are literal colors
 * authored here, never user input.
 */
export interface ProfileTheme {
    id: string;
    /** Shown in the picker. */
    label: string;
    /** One-line flavour for the picker. */
    blurb: string;
    /** Swatch colors for the picker chip: [leather, trim]. */
    swatch: [string, string];
    vars: Record<string, string>;
}

export const PROFILE_THEMES: readonly ProfileTheme[] = [
    {
        id: "saddle",
        label: "Saddle",
        blurb: "The house leather — warm tan and brass.",
        swatch: ["#5C3A20", "#B08D3E"],
        vars: {
            "leather-deep": "#3E2414",
            leather: "#5C3A20",
            "leather-hi": "#7A4E2C",
            "brass-dark": "#7A5C22",
            brass: "#B08D3E",
            "brass-hi": "#E8C878",
            "brass-ink": "#2A1D08",
            thread: "#D9B978",
        },
    },
    {
        id: "forest",
        label: "Hunt Green",
        blurb: "Deep green tack with gold trim.",
        swatch: ["#24402F", "#AC8A3C"],
        vars: {
            "leather-deep": "#17281F",
            leather: "#24402F",
            "leather-hi": "#325742",
            "brass-dark": "#75581F",
            brass: "#AC8A3C",
            "brass-hi": "#E4C474",
            "brass-ink": "#1A2A20",
            thread: "#D3B572",
        },
    },
    {
        id: "oxblood",
        label: "Oxblood",
        blurb: "Dark red bridle leather, brass buckles.",
        swatch: ["#4E1E27", "#B08D3E"],
        vars: {
            "leather-deep": "#33131A",
            leather: "#4E1E27",
            "leather-hi": "#6B2B36",
            "brass-dark": "#7A5C22",
            brass: "#B08D3E",
            "brass-hi": "#E8C878",
            "brass-ink": "#2A1218",
            thread: "#DCB97C",
        },
    },
    {
        id: "chestnut",
        label: "Chestnut",
        blurb: "Red-brown leather with copper hardware.",
        swatch: ["#57301A", "#B9702F"],
        vars: {
            "leather-deep": "#3A1E10",
            leather: "#57301A",
            "leather-hi": "#764527",
            "brass-dark": "#7A4318",
            brass: "#B9702F",
            "brass-hi": "#EBAA6B",
            "brass-ink": "#2A1608",
            thread: "#E0A971",
        },
    },
    {
        id: "ink",
        label: "Midnight",
        blurb: "Near-black leather, cool silver trim.",
        swatch: ["#1F2A3C", "#97A3B2"],
        vars: {
            "leather-deep": "#131A26",
            leather: "#1F2A3C",
            "leather-hi": "#2E3D53",
            "brass-dark": "#5E6773",
            brass: "#97A3B2",
            "brass-hi": "#D6DEE8",
            "brass-ink": "#10151C",
            thread: "#B9C4D1",
        },
    },
    {
        id: "pewter",
        label: "Pewter",
        blurb: "Grey working leather, plain silver.",
        swatch: ["#35332F", "#A8A398"],
        vars: {
            "leather-deep": "#21201E",
            leather: "#35332F",
            "leather-hi": "#4A4741",
            "brass-dark": "#6A665C",
            brass: "#A8A398",
            "brass-hi": "#DEDACF",
            "brass-ink": "#191815",
            thread: "#C6C1B6",
        },
    },
] as const;

export const DEFAULT_THEME_ID = "saddle";

const THEME_BY_ID = new Map(PROFILE_THEMES.map((t) => [t.id, t]));

export function themeById(id: string | null | undefined): ProfileTheme {
    return (id ? THEME_BY_ID.get(id) : undefined) ?? THEME_BY_ID.get(DEFAULT_THEME_ID)!;
}

/**
 * The custom-property bag for a theme, ready to spread onto the
 * profile's root element. Returns undefined for the default theme so
 * an uncustomized profile ships no extra style attribute at all.
 */
export function themeStyle(id: string | null | undefined): Record<string, string> | undefined {
    const theme = themeById(id);
    if (theme.id === DEFAULT_THEME_ID) return undefined;
    const style: Record<string, string> = {};
    for (const [key, value] of Object.entries(theme.vars)) style[`--${key}`] = value;
    return style;
}

// ── The payload ──

export interface ProfileCustomization {
    theme: string;
    tagline: string | null;
    pronouns: string | null;
    /** Path inside the `avatars` bucket, or null. Never a URL. */
    bannerPath: string | null;
    /** Ordered user_horses ids the member pinned to the front. */
    featured: string[];
    /** Sections switched off. */
    hidden: ProfileSection[];
}

/**
 * Frozen, and never returned directly — `defaultCustomization()`
 * hands out a fresh copy. A shallow spread of this constant would
 * share the two arrays, so a caller pushing onto `featured` would
 * quietly rewrite the default for every profile in the process.
 */
export const DEFAULT_CUSTOMIZATION: Readonly<ProfileCustomization> = Object.freeze({
    theme: DEFAULT_THEME_ID,
    tagline: null,
    pronouns: null,
    bannerPath: null,
    featured: Object.freeze([] as string[]),
    hidden: Object.freeze([] as ProfileSection[]),
}) as Readonly<ProfileCustomization>;

export function defaultCustomization(): ProfileCustomization {
    return {
        theme: DEFAULT_THEME_ID,
        tagline: null,
        pronouns: null,
        bannerPath: null,
        featured: [],
        hidden: [],
    };
}

export const MAX_TAGLINE = 80;
export const MAX_PRONOUNS = 24;
export const MAX_FEATURED = 6;

/**
 * C0/C1 controls, zero-width characters and bidi overrides: the
 * standard tricks for spoofing an alias or pushing text out of its
 * box. Tested by codepoint rather than a character class so no
 * literal control byte ever has to live in this source file.
 */
function isUnsafeChar(code: number): boolean {
    return (
        code < 0x20 ||
        (code >= 0x7f && code <= 0x9f) ||
        (code >= 0x200b && code <= 0x200f) ||
        (code >= 0x202a && code <= 0x202e) ||
        (code >= 0x2066 && code <= 0x2069) ||
        code === 0xfeff
    );
}

function stripUnsafe(value: string): string {
    let out = "";
    for (const char of value) {
        if (!isUnsafeChar(char.codePointAt(0)!)) out += char;
    }
    return out;
}

function cleanLine(value: unknown, max: number): string | null {
    if (typeof value !== "string") return null;
    const cleaned = stripUnsafe(value).replace(/\s+/g, " ").trim().slice(0, max);
    return cleaned.length > 0 ? cleaned : null;
}

/** Storage paths we will hand to createSignedUrl: no traversal, no scheme. */
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;

function cleanPath(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.includes("..") || !SAFE_PATH.test(trimmed)) return null;
    return trimmed;
}

/** Postgres uuid text — the shape every user_horses id has. */
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function cleanIdList(value: unknown, max: number): string[] {
    if (!Array.isArray(value)) return [];
    const out: string[] = [];
    for (const raw of value) {
        if (typeof raw !== "string" || !UUID.test(raw)) continue;
        const id = raw.toLowerCase();
        if (out.includes(id)) continue;
        out.push(id);
        if (out.length >= max) break;
    }
    return out;
}

function cleanSections(value: unknown): ProfileSection[] {
    if (!Array.isArray(value)) return [];
    const out: ProfileSection[] = [];
    for (const raw of value) {
        if (typeof raw !== "string" || !SECTION_SET.has(raw)) continue;
        const section = raw as ProfileSection;
        if (!out.includes(section)) out.push(section);
    }
    return out;
}

/**
 * Coerce anything at all — a jsonb blob, a form payload, null, a
 * string, a hostile hand-rolled PostgREST write — into a payload the
 * page can render without further checking. Never throws.
 *
 * This runs on BOTH the write and the read path on purpose. Guarding
 * only the write would leave a row written before this code shipped
 * (or by a direct API call) free to render unchecked; running it on
 * read means the page is safe no matter what is in the column.
 */
export function sanitizeCustomization(raw: unknown): ProfileCustomization {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaultCustomization();
    const input = raw as Record<string, unknown>;
    const theme =
        typeof input.theme === "string" && THEME_BY_ID.has(input.theme)
            ? input.theme
            : DEFAULT_THEME_ID;
    return {
        theme,
        tagline: cleanLine(input.tagline, MAX_TAGLINE),
        pronouns: cleanLine(input.pronouns, MAX_PRONOUNS),
        bannerPath: cleanPath(input.bannerPath),
        featured: cleanIdList(input.featured, MAX_FEATURED),
        hidden: cleanSections(input.hidden),
    };
}

/** True when the member has changed nothing. */
export function isDefaultCustomization(c: ProfileCustomization): boolean {
    return (
        c.theme === DEFAULT_THEME_ID &&
        c.tagline === null &&
        c.pronouns === null &&
        c.bannerPath === null &&
        c.featured.length === 0 &&
        c.hidden.length === 0
    );
}

/** Section gate for the page. */
export function sectionVisible(c: ProfileCustomization, section: ProfileSection): boolean {
    return !c.hidden.includes(section);
}

/**
 * Reorder a member's public horses so their hand-picked featured ids
 * lead, in the order they chose. Ids that no longer resolve to a
 * public horse (made private, sold on, deleted) simply drop out — the
 * stored list is a wish, not a guarantee, so it never has to be
 * cleaned up when a horse changes hands.
 */
export function applyFeaturedOrder<T extends { id: string }>(
    horses: readonly T[],
    featured: readonly string[],
): T[] {
    if (featured.length === 0) return [...horses];
    const byId = new Map(horses.map((h) => [h.id, h]));
    const lead: T[] = [];
    for (const id of featured) {
        const horse = byId.get(id);
        if (horse) {
            lead.push(horse);
            byId.delete(id);
        }
    }
    return [...lead, ...horses.filter((h) => byId.has(h.id))];
}
