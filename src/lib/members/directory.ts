/**
 * The Members room — URL vocabulary and pure ordering/formatting helpers.
 *
 * /discover is the member directory (the URL keeps its old name; the room
 * is called "Members" everywhere a human can read it). Its browse state
 * lives entirely in the URL:
 *
 *   /discover?q=…&sort=active|az|newest&page=…
 *
 * Pure functions only (no React, no Supabase) so the server page, the
 * client filter bar and the unit tests all share one source of truth.
 * Mirrors src/lib/catalog/filterParams.ts.
 */

export const MEMBER_SORTS = ["active", "az", "newest"] as const;
export type MemberSort = (typeof MEMBER_SORTS)[number];

/**
 * Default order is "recently active" — a directory whose front page is
 * "whoever signed up last" tells you nothing about who is actually here.
 */
export const DEFAULT_MEMBER_SORT: MemberSort = "active";

/** One page of collector cards. */
export const MEMBERS_PAGE_SIZE = 24;

/** Below this a substring alias search matches most of the community. */
export const MEMBER_SEARCH_MIN_LENGTH = 2;
const MEMBER_SEARCH_MAX_LENGTH = 60;

/** Parsed browse state. Absent `q` = no search. `page` is 1-based. */
export interface MemberFilters {
    q?: string;
    sort: MemberSort;
    page: number;
}

export const MEMBER_SORT_LABELS: Record<MemberSort, string> = {
    active: "Recently active",
    az: "A–Z",
    newest: "Newest",
};

function first(v: string | string[] | undefined): string | undefined {
    return Array.isArray(v) ? v[0] : v;
}

/**
 * Strip the characters PostgREST/Postgres read as wildcards out of a
 * user-typed alias search. PostgREST rewrites `*` to `%` in like/ilike
 * patterns *after* our value is on the wire, so a backslash escape does
 * not save us — dropping them is the only honest option. `_` matches any
 * single character in SQL LIKE and gets the same treatment.
 *
 * Also trims, collapses whitespace and caps the length so the pattern
 * can never grow unbounded from the query string.
 */
export function sanitizeAliasQuery(raw: string | undefined): string {
    if (!raw) return "";
    return raw
        .replace(/[%_*\\]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MEMBER_SEARCH_MAX_LENGTH);
}

/** The `ilike` pattern for a sanitized alias query (substring match). */
export function aliasIlikePattern(q: string): string {
    return `%${q}%`;
}

/**
 * Parse Next.js searchParams into MemberFilters. Unknown values are
 * dropped rather than trusted: sort must be in the vocabulary, page is
 * clamped to a sane integer, and q is sanitized + length-gated.
 */
export function parseMemberSearchParams(
    params: Record<string, string | string[] | undefined>,
): MemberFilters {
    const filters: MemberFilters = { sort: DEFAULT_MEMBER_SORT, page: 1 };

    const q = sanitizeAliasQuery(first(params.q));
    if (q.length >= MEMBER_SEARCH_MIN_LENGTH) filters.q = q;

    const sort = first(params.sort)?.trim();
    if (sort && (MEMBER_SORTS as readonly string[]).includes(sort)) {
        filters.sort = sort as MemberSort;
    }

    const page = Number.parseInt(first(params.page) ?? "", 10);
    if (Number.isFinite(page) && page > 1) filters.page = Math.min(page, 10_000);

    return filters;
}

/**
 * Serialize filters back to a query string. Defaults (no q, sort=active,
 * page=1) are omitted so the pristine /discover URL stays canonical.
 */
export function buildMemberSearchParams(filters: Partial<MemberFilters>): URLSearchParams {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.sort && filters.sort !== DEFAULT_MEMBER_SORT) params.set("sort", filters.sort);
    if (filters.page && filters.page > 1) params.set("page", String(filters.page));
    return params;
}

/** The canonical href for a browse state. */
export function membersHref(filters: Partial<MemberFilters>): string {
    const qs = buildMemberSearchParams(filters).toString();
    return qs ? `/discover?${qs}` : "/discover";
}

/* ── Activity ordering ─────────────────────────────────────────────
   `users` has no last_seen column (checked: none exists, and adding
   one needs a migration). The cheapest honest proxy is the site's own
   event spine: activity_events (horse added, followed, sold, hoofprint
   entries) plus posts (talking). Latest row per person wins. */

/** One raw activity row, from either source, normalized. */
export interface ActivityPing {
    userId: string | null | undefined;
    at: string | null | undefined;
}

/**
 * Reduce activity rows to "when was each person last seen doing
 * something". Rows arrive newest-first but this does not assume it —
 * the max timestamp per user wins either way.
 */
export function latestActivityByUser(rows: ActivityPing[]): Map<string, string> {
    const latest = new Map<string, string>();
    for (const row of rows) {
        if (!row.userId || !row.at) continue;
        const seen = latest.get(row.userId);
        if (seen === undefined || row.at > seen) latest.set(row.userId, row.at);
    }
    return latest;
}

/** The minimum a roster entry needs to be ordered. */
export interface MemberRosterEntry {
    id: string;
    aliasName: string;
    createdAt: string;
}

function byNewest(a: MemberRosterEntry, b: MemberRosterEntry): number {
    if (a.createdAt === b.createdAt) return a.id < b.id ? -1 : 1;
    return a.createdAt < b.createdAt ? 1 : -1;
}

/**
 * Order a roster for display.
 *
 * `active` puts everyone with a recent ping first, most recent first,
 * then falls through to newest-signup-first for the quiet members — so
 * the list stays COMPLETE (every member is reachable by paging) rather
 * than becoming a truncated "who was here lately" leaderboard.
 *
 * Returns a new array; the input is not mutated.
 */
export function sortMemberRoster(
    roster: MemberRosterEntry[],
    sort: MemberSort,
    lastActive?: Map<string, string>,
): MemberRosterEntry[] {
    const out = [...roster];
    if (sort === "az") {
        out.sort((a, b) => {
            const cmp = a.aliasName.localeCompare(b.aliasName, "en", { sensitivity: "base" });
            return cmp !== 0 ? cmp : a.id < b.id ? -1 : 1;
        });
        return out;
    }
    if (sort === "newest") {
        out.sort(byNewest);
        return out;
    }
    const seen = lastActive ?? new Map<string, string>();
    out.sort((a, b) => {
        const aAt = seen.get(a.id);
        const bAt = seen.get(b.id);
        if (aAt && bAt) return aAt === bAt ? byNewest(a, b) : aAt < bAt ? 1 : -1;
        if (aAt) return -1;
        if (bAt) return 1;
        return byNewest(a, b);
    });
    return out;
}

/** The slice of an ordered roster that belongs on `page`. */
export function pageSlice<T>(items: T[], page: number, pageSize = MEMBERS_PAGE_SIZE): T[] {
    const from = Math.max(0, (page - 1) * pageSize);
    return items.slice(from, from + pageSize);
}

/** How many pages an ordered roster of `total` needs (never 0). */
export function totalPagesFor(total: number, pageSize = MEMBERS_PAGE_SIZE): number {
    return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

/* ── Card copy ─────────────────────────────────────────────────────── */

/** "Member since Mar 2024" — the line under a collector's alias. */
export function formatMemberSince(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return `Member since ${d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
}

const DAY_MS = 86_400_000;

/**
 * "Active today" / "Active 3 days ago" / "Active in Mar 2026".
 * Returns null when we have no ping for this person — a card should say
 * nothing rather than guess.
 */
export function formatLastActive(
    iso: string | null | undefined,
    now: Date = new Date(),
): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const days = Math.floor((now.getTime() - d.getTime()) / DAY_MS);
    if (days < 0) return "Active today";
    if (days === 0) return "Active today";
    if (days === 1) return "Active yesterday";
    if (days < 7) return `Active ${days} days ago`;
    if (days < 14) return "Active last week";
    if (days < 35) return `Active ${Math.floor(days / 7)} weeks ago`;
    return `Active in ${d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
}

/** "12 public models" / "1 public model" / "No public models yet". */
export function formatPublicModelCount(count: number): string {
    if (!Number.isFinite(count) || count <= 0) return "No public models yet";
    return `${count.toLocaleString()} public model${count === 1 ? "" : "s"}`;
}

/** A badge as the Trophy Case stores it, trimmed to what a card shows. */
export interface MemberBadge {
    id: string;
    name: string;
    icon: string;
    tier: number | null;
}

/**
 * The handful of badges a card has room for: rarest (highest tier)
 * first, ties broken by name so the choice is stable between renders.
 */
export function pickTopBadges(badges: MemberBadge[], limit = 3): MemberBadge[] {
    return [...badges]
        .sort((a, b) => {
            const tierDiff = (b.tier ?? 0) - (a.tier ?? 0);
            return tierDiff !== 0 ? tierDiff : a.name.localeCompare(b.name, "en");
        })
        .slice(0, limit);
}
