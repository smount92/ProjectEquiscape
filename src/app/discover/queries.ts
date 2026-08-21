/**
 * Members room — server-side reads.
 *
 * Every query here is BOUNDED and BATCHED: one page of the directory
 * costs a fixed handful of round trips no matter how many cards are on
 * it. In particular the public model count comes from
 * `discover_users_view` (which already carries `public_horse_count` via
 * the SECURITY DEFINER `count_user_horses_public`), so 24 cards cost one
 * count query, not 24.
 *
 * READ-ONLY and RLS-legal as the schema stands today — no migration, no
 * policy change. Two consequences worth knowing about:
 *
 *   • `users.is_suspended` (migration 148) was never added to the
 *     column-level GRANT list in 133/142, so it is unreadable — and
 *     unfilterable — from a client key. Deleted/tombstoned accounts ARE
 *     excluded, because the view filters `account_status = 'active'`
 *     (which is what 034's tombstone flow sets) and `is_test_account`.
 *     Hiding suspended members needs the view to do it; see the note in
 *     the page header.
 *
 *   • `user_blocks` RLS only exposes your OWN outgoing blocks
 *     (`auth.uid() = blocker_id`), so "hide the people I blocked" is
 *     exactly what we can honour. "Hide people who blocked me" is not
 *     readable and is not attempted.
 *
 * Activity ordering: `users` has no last_seen column. The proxy is the
 * site's own event spine — `activity_events` (horse added, follow, sale,
 * provenance) unioned with `posts` (talking) — reduced to a latest-ping
 * per person. See sortMemberRoster() for how quiet members still page.
 */

import { createClient } from "@/lib/supabase/server";
import { resolveAvatarUrls } from "@/lib/utils/avatars.server";
import {
    aliasIlikePattern,
    latestActivityByUser,
    MEMBERS_PAGE_SIZE,
    pageSlice,
    pickTopBadges,
    sortMemberRoster,
    totalPagesFor,
    type MemberBadge,
    type MemberFilters,
    type MemberRosterEntry,
} from "@/lib/members/directory";

/**
 * How much of the roster the "recently active" order can rank. That sort
 * cannot be expressed as a PostgREST `order()` (the key is not a column),
 * so it ranks in memory over compact id/alias/created_at rows. A–Z and
 * Newest do not use this path at all — they page in the database.
 */
const ROSTER_LIMIT = 2000;

/** How far back a ping still counts as "recently active". */
const ACTIVITY_WINDOW_DAYS = 180;

/** Per-source cap on the activity scan (both are created_at-indexed). */
const ACTIVITY_SCAN_LIMIT = 1000;

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

/** One collector card. */
export interface MemberCard {
    id: string;
    aliasName: string;
    createdAt: string;
    /** Signed URL (the avatars bucket is private) or null. */
    avatarUrl: string | null;
    bio: string | null;
    publicHorseCount: number;
    hasStudio: boolean;
    avgRating: number;
    ratingCount: number;
    /** Latest activity ping, or null when this person has been quiet. */
    lastActiveAt: string | null;
    /** Empty when the member has hidden their badges. */
    badges: MemberBadge[];
    isVerified: boolean;
    isTrustedCurator: boolean;
    isSupporter: boolean;
    isFollowing: boolean;
    isSelf: boolean;
}

export interface MembersDirectoryPage {
    members: MemberCard[];
    /** Total matching members (capped by ROSTER_LIMIT on the active sort). */
    total: number;
    page: number;
    totalPages: number;
    /** True when the active-sort roster hit its cap and the tail is unranked. */
    rosterTruncated: boolean;
}

/** Raw shape of one `discover_users_view` row we read. */
interface ViewRow {
    id: string;
    alias_name: string;
    created_at: string;
    avatar_url: string | null;
    bio: string | null;
    public_horse_count: number | null;
    avg_rating: number | null;
    rating_count: number | null;
    has_studio: boolean | null;
}

const VIEW_COLUMNS =
    "id, alias_name, created_at, avatar_url, bio, public_horse_count, avg_rating, rating_count, has_studio";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The people this viewer has blocked — they do not appear in the room. */
async function fetchBlockedIds(supabase: Supabase, viewerId: string): Promise<string[]> {
    const { data } = await supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", viewerId);
    return ((data ?? []) as { blocked_id: string }[])
        .map((r) => r.blocked_id)
        .filter((id) => UUID_RE.test(id));
}

/** PostgREST `not.in` list, or null when there is nothing to exclude. */
function notInList(ids: string[]): string | null {
    return ids.length > 0 ? `(${ids.join(",")})` : null;
}

/**
 * Latest activity ping per member, from the two stores that record one.
 * Both queries are window-bounded and row-capped; neither is per-card.
 */
async function fetchLastActive(supabase: Supabase): Promise<Map<string, string>> {
    const since = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 86_400_000).toISOString();

    const [events, posts] = await Promise.all([
        supabase
            .from("activity_events")
            .select("actor_id, created_at")
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(ACTIVITY_SCAN_LIMIT),
        supabase
            .from("posts")
            .select("author_id, created_at")
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(ACTIVITY_SCAN_LIMIT),
    ]);

    const eventRows = (events.data ?? []) as { actor_id: string | null; created_at: string }[];
    const postRows = (posts.data ?? []) as { author_id: string | null; created_at: string }[];

    return latestActivityByUser([
        ...eventRows.map((r) => ({ userId: r.actor_id, at: r.created_at })),
        ...postRows.map((r) => ({ userId: r.author_id, at: r.created_at })),
    ]);
}

/**
 * A–Z / Newest: the database does the ordering AND the paging. Scales
 * past any roster size.
 */
async function fetchOrderedPage(
    supabase: Supabase,
    filters: MemberFilters,
    blocked: string[],
): Promise<{ rows: ViewRow[]; total: number }> {
    const from = (filters.page - 1) * MEMBERS_PAGE_SIZE;
    const exclude = notInList(blocked);
    const pattern = filters.q ? aliasIlikePattern(filters.q) : null;

    let rowsQuery = supabase.from("discover_users_view").select(VIEW_COLUMNS);
    // The count comes off `users` rather than the view: the view's WHERE
    // is exactly these two predicates, and counting the bare table skips
    // the per-row count functions in the view's target list.
    let countQuery = supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("account_status", "active")
        .eq("is_test_account", false);

    if (pattern) {
        rowsQuery = rowsQuery.ilike("alias_name", pattern);
        countQuery = countQuery.ilike("alias_name", pattern);
    }
    if (exclude) {
        rowsQuery = rowsQuery.not("id", "in", exclude);
        countQuery = countQuery.not("id", "in", exclude);
    }

    rowsQuery =
        filters.sort === "az"
            ? rowsQuery.order("alias_name", { ascending: true })
            : rowsQuery.order("created_at", { ascending: false });
    // Stable tiebreak so a member never appears on two pages at once.
    rowsQuery = rowsQuery.order("id", { ascending: true });

    const [{ data }, { count }] = await Promise.all([
        rowsQuery.range(from, from + MEMBERS_PAGE_SIZE - 1),
        countQuery,
    ]);

    return { rows: (data ?? []) as unknown as ViewRow[], total: count ?? (data?.length ?? 0) };
}

/**
 * Recently active: rank a compact roster in memory, then fetch only the
 * page's rows from the view. Two small queries instead of one big one.
 */
async function fetchActivePage(
    supabase: Supabase,
    filters: MemberFilters,
    blocked: string[],
): Promise<{ rows: ViewRow[]; total: number; truncated: boolean; lastActive: Map<string, string> }> {
    const exclude = notInList(blocked);

    let rosterQuery = supabase
        .from("users")
        .select("id, alias_name, created_at")
        .eq("account_status", "active")
        .eq("is_test_account", false)
        .order("created_at", { ascending: false })
        .limit(ROSTER_LIMIT + 1);

    if (filters.q) rosterQuery = rosterQuery.ilike("alias_name", aliasIlikePattern(filters.q));
    if (exclude) rosterQuery = rosterQuery.not("id", "in", exclude);

    const [rosterResult, lastActive] = await Promise.all([rosterQuery, fetchLastActive(supabase)]);

    const rawRoster = (rosterResult.data ?? []) as {
        id: string;
        alias_name: string;
        created_at: string;
    }[];
    const truncated = rawRoster.length > ROSTER_LIMIT;
    const roster: MemberRosterEntry[] = rawRoster
        .slice(0, ROSTER_LIMIT)
        .map((r) => ({ id: r.id, aliasName: r.alias_name, createdAt: r.created_at }));

    const ordered = sortMemberRoster(roster, "active", lastActive);
    const pageIds = pageSlice(ordered, filters.page).map((e) => e.id);
    if (pageIds.length === 0) {
        return { rows: [], total: ordered.length, truncated, lastActive };
    }

    const { data } = await supabase
        .from("discover_users_view")
        .select(VIEW_COLUMNS)
        .in("id", pageIds);

    // `.in()` does not preserve our ranking — restore it.
    const byId = new Map((((data ?? []) as unknown) as ViewRow[]).map((r) => [r.id, r]));
    const rows = pageIds.map((id) => byId.get(id)).filter((r): r is ViewRow => Boolean(r));

    return { rows, total: ordered.length, truncated, lastActive };
}

/** Prefs, badges and follow state for exactly the cards on this page. */
async function enrichPage(
    supabase: Supabase,
    rows: ViewRow[],
    viewerId: string,
    lastActive: Map<string, string>,
): Promise<MemberCard[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const others = ids.filter((id) => id !== viewerId);

    const [prefsResult, badgeResult, followResult, avatarMap] = await Promise.all([
        supabase
            .from("users")
            .select("id, show_badges, is_verified, is_trusted_curator, is_supporter")
            .in("id", ids),
        supabase
            .from("user_badges")
            .select("user_id, badges(id, name, icon, tier)")
            .in("user_id", ids),
        others.length > 0
            ? supabase
                  .from("user_follows")
                  .select("following_id")
                  .eq("follower_id", viewerId)
                  .in("following_id", others)
            : Promise.resolve({ data: [] as { following_id: string }[] }),
        resolveAvatarUrls(rows.map((r) => r.avatar_url)),
    ]);

    const prefs = new Map(
        (((prefsResult.data ?? []) as unknown) as {
            id: string;
            show_badges: boolean | null;
            is_verified: boolean | null;
            is_trusted_curator: boolean | null;
            is_supporter: boolean | null;
        }[]).map((p) => [p.id, p]),
    );

    const badgesByUser = new Map<string, MemberBadge[]>();
    for (const row of ((badgeResult.data ?? []) as unknown) as {
        user_id: string;
        badges: MemberBadge | MemberBadge[] | null;
    }[]) {
        const badge = Array.isArray(row.badges) ? row.badges[0] : row.badges;
        if (!badge) continue;
        const list = badgesByUser.get(row.user_id);
        if (list) list.push(badge);
        else badgesByUser.set(row.user_id, [badge]);
    }

    const followed = new Set(
        (((followResult.data ?? []) as unknown) as { following_id: string }[]).map(
            (f) => f.following_id,
        ),
    );

    return rows.map((row) => {
        const pref = prefs.get(row.id);
        // show_badges defaults to TRUE when absent — same rule the
        // profile page's Trophy Case gate uses.
        const showBadges = pref?.show_badges ?? true;
        return {
            id: row.id,
            aliasName: row.alias_name,
            createdAt: row.created_at,
            avatarUrl: row.avatar_url ? (avatarMap.get(row.avatar_url) ?? row.avatar_url) : null,
            bio: row.bio,
            publicHorseCount: Number(row.public_horse_count ?? 0),
            hasStudio: Boolean(row.has_studio),
            avgRating: Number(row.avg_rating ?? 0),
            ratingCount: Number(row.rating_count ?? 0),
            lastActiveAt: lastActive.get(row.id) ?? null,
            badges: showBadges ? pickTopBadges(badgesByUser.get(row.id) ?? []) : [],
            isVerified: Boolean(pref?.is_verified),
            isTrustedCurator: Boolean(pref?.is_trusted_curator),
            isSupporter: Boolean(pref?.is_supporter),
            isFollowing: followed.has(row.id),
            isSelf: row.id === viewerId,
        };
    });
}

/** One page of the Members directory, ready to render. */
export async function getMembersDirectoryPage(
    filters: MemberFilters,
    viewerId: string,
): Promise<MembersDirectoryPage> {
    const supabase = await createClient();
    const blocked = await fetchBlockedIds(supabase, viewerId);

    let rows: ViewRow[];
    let total: number;
    let truncated = false;
    let lastActive: Map<string, string>;

    if (filters.sort === "active") {
        const result = await fetchActivePage(supabase, filters, blocked);
        rows = result.rows;
        total = result.total;
        truncated = result.truncated;
        lastActive = result.lastActive;
    } else {
        const [ordered, seen] = await Promise.all([
            fetchOrderedPage(supabase, filters, blocked),
            fetchLastActive(supabase),
        ]);
        rows = ordered.rows;
        total = ordered.total;
        lastActive = seen;
    }

    return {
        members: await enrichPage(supabase, rows, viewerId, lastActive),
        total,
        page: filters.page,
        totalPages: totalPagesFor(total),
        rosterTruncated: truncated,
    };
}
