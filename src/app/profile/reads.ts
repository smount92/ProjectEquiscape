/**
 * Server-side reads for a member's public profile.
 *
 * Colocated with the route (the `src/app/market/listings.ts`
 * precedent) rather than in the actions file, because these take a
 * SupabaseClient — a "use server" module may only export async
 * functions with serializable arguments.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE
 * ------------------------------------
 * A profile is a PUBLIC page about someone else. RLS alone is not a
 * sufficient gate here, twice over:
 *
 *   * `posts_select` admits a group's posts when THE VIEWER is a
 *     member — not when the group is public. Viewer and subject in
 *     the same private barn would leak that barn's posts onto a
 *     public page. `isGloballyVisible` (src/lib/feed/stream) is the
 *     load-bearing filter, exactly as the feed uses it.
 *   * `membership_select` is `USING (true)` until migration 167 is
 *     pasted, and even after it keys on `is_private`, which is a
 *     two-state collapse of a three-state `visibility` column — a
 *     legacy `restricted` barn passes. So barns are filtered on
 *     `visibility = 'public'` in app code, the same bar the feed
 *     uses, and never on RLS or `is_private`.
 *
 * Everything here degrades to empty rather than throwing: a profile
 * must render even when a section's migration has not been pasted.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isAuditNote, isGloballyVisible } from "@/lib/feed/stream";
import { getPostColumnSupport } from "@/lib/feed/columnSupport";
import { getExhibitorCardCount, getExhibitorStar } from "@/lib/shows/horseTitles";
import { showStandingsEnabled } from "@/lib/shows/flags";
import { showYearOf } from "@/lib/shows/showYear";
import { HORSE_TITLE_LABELS, nextStarProgress, type HorseTitleCode } from "@/lib/shows/titles";
import { getStandings } from "@/app/actions/standings";
import {
    defaultCustomization,
    sanitizeCustomization,
    type ProfileCustomization,
} from "./customization";

/** Untyped escape hatch for columns the generator has not seen yet. */
type LooseClient = SupabaseClient<never, never, never>;

function loose(client: SupabaseClient): LooseClient {
    return client as unknown as LooseClient;
}

// ── Customization ────────────────────────────────────────────────

/**
 * A member's saved customization, or the default.
 *
 * Tolerant in the `fetchSupporterBadge` (142) mould: migrations are
 * pasted by hand while main auto-deploys, so until 171 is applied
 * this select is a PostgREST 42703. A missing column must mean "not
 * customized", never a broken profile.
 */
export async function fetchProfileCustomization(
    client: SupabaseClient,
    userId: string,
): Promise<ProfileCustomization> {
    // DEFINER read first (199): users has no anon SELECT policy, so the
    // direct column read below returns nothing for logged-out visitors —
    // a member's banner and tagline existed only for logged-in viewers
    // (MHI caught it by signing out). The RPC serves exactly the payload
    // the member designed for their public page, to everyone.
    try {
        const rpc = client.rpc.bind(client) as unknown as (
            fn: string,
            args: { p_user_id: string },
        ) => Promise<{ data: unknown; error: { message?: string } | null }>;
        const { data, error } = await rpc("get_profile_customization", { p_user_id: userId });
        if (!error && data) return sanitizeCustomization(data);
    } catch {
        /* pre-199 — fall through to the direct read */
    }
    try {
        const { data, error } = await loose(client)
            .from("users")
            .select("profile_customization")
            .eq("id", userId)
            .maybeSingle();
        if (error || !data) return defaultCustomization();
        return sanitizeCustomization((data as { profile_customization?: unknown }).profile_customization);
    } catch {
        return defaultCustomization();
    }
}

// ── The championship line ────────────────────────────────────────

export interface ProfileSeason {
    showYear: number;
    /** Season rank among stables. Null when standings are dark or unplaced. */
    rank: number | null;
    /** Season points. Null when standings are dark (not "zero"). */
    points: number | null;
    placings: number | null;
    championships: number | null;
    careerPoints: number;
    liveCards: number;
    stakesCards: number;
    star: { label: string; stars: number } | null;
    nextStar: { label: string; pointsNeeded: number } | null;
    /** True when rank/points were deliberately not computed. */
    standingsDark: boolean;
}

/**
 * Another member's season — the public-record half of `getMySeason`.
 *
 * `getMySeason` is hard-scoped to `auth.uid()` and cannot be pointed
 * at someone else, but almost everything it reads is public record
 * by policy, so the line is legally reconstructible:
 *
 *   * `exhibitor_career`      — "Exhibitor career is public record", USING (true) (163)
 *   * `exhibitor_distinctions`— "Distinctions are public record",   USING (true) (159)
 *   * card COUNTS             — get_exhibitor_card_count, a SECURITY DEFINER
 *                               RPC that deliberately returns counts and no
 *                               card codes, so a profile never becomes a
 *                               card-enumeration surface (164)
 *   * rank / points           — getStandings, which computes the whole season
 *                               leaderboard from public show data and is not
 *                               viewer-scoped
 *
 * The one thing that stays shut is `qualification_cards` itself:
 * "Card people read their cards" restricts SELECT to the owner and
 * show staff (118), and nothing has loosened it. Counts only, by design.
 *
 * WHY RANK IS FLAG-GATED. `getStandings` is a season-wide scan —
 * every counted show, every entry paged past PostgREST's 1000-row
 * cap, chunked placings. That is fine on /standings, which a member
 * visits deliberately; running it on every profile view is not. It
 * is also the surface `NEXT_PUBLIC_SHOW_STANDINGS` exists to keep
 * dark. So rank/points ride the same flag, and the rest of the line
 * — which is cheap and already shipped on the strap — always shows.
 */
export async function fetchProfileSeason(
    client: SupabaseClient,
    userId: string,
): Promise<ProfileSeason | null> {
    const showYear = showYearOf(new Date());
    const standingsLive = showStandingsEnabled();

    const [careerRes, distinctionRows, cards, star] = await Promise.all([
        safeMaybeSingle<{ career_points: number }>(
            client,
            "exhibitor_career",
            "career_points",
            "user_id",
            userId,
        ),
        safeSelect<{ distinction_code: string }>(
            client,
            "exhibitor_distinctions",
            "distinction_code",
            "user_id",
            userId,
        ),
        getExhibitorCardCount(userId),
        getExhibitorStar(userId),
    ]);

    const careerPoints = careerRes?.career_points ?? 0;
    const next = nextStarProgress({
        careerPoints,
        grantedCodes: distinctionRows.map((d) => d.distinction_code),
    });

    let rank: number | null = null;
    let points: number | null = null;
    let placings: number | null = null;
    let championships: number | null = null;

    if (standingsLive) {
        try {
            const standings = await getStandings({ showYear, scope: "stables" });
            if (standings.success && standings.scope === "stables") {
                const row = standings.rows.find((r) => r.ownerId === userId);
                points = row?.points ?? 0;
                rank = row?.rank ?? null;
                placings = row?.placings ?? 0;
                championships = row?.championships ?? 0;
            }
        } catch {
            // A standings failure must not cost the rest of the line.
        }
    }

    const season: ProfileSeason = {
        showYear,
        rank,
        points,
        placings,
        championships,
        careerPoints,
        liveCards: cards?.liveCards ?? 0,
        stakesCards: cards?.stakesCards ?? 0,
        star: star ? { label: star.label, stars: star.stars } : null,
        nextStar: next ? { label: next.label, pointsNeeded: next.pointsNeeded } : null,
        standingsDark: !standingsLive,
    };

    // A member with no record at all gets no scoreboard — same bar
    // MySeasonCard uses, so a brand-new profile is not all zeroes.
    const empty =
        season.careerPoints === 0 &&
        season.liveCards === 0 &&
        season.star === null &&
        !season.points;
    return empty ? null : season;
}

// ── Their horses' titles ─────────────────────────────────────────

export interface StableTitle {
    horseId: string;
    horseName: string;
    code: HorseTitleCode;
    label: string;
    showYear: number | null;
}

/**
 * Titles held by the member's PUBLIC horses.
 *
 * `horse_titles` is readable for any horse the viewer can already
 * see — "Titles readable for visible horses" (160) mirrors
 * `user_horses` visibility — so passing only public horse ids keeps
 * private stock out by construction rather than by filter.
 */
export async function fetchStableTitles(
    client: SupabaseClient,
    horses: readonly { id: string; customName: string }[],
): Promise<StableTitle[]> {
    if (horses.length === 0) return [];
    const nameById = new Map(horses.map((h) => [h.id, h.customName]));
    try {
        const { data, error } = await loose(client)
            .from("horse_titles")
            .select("horse_id, title_code, show_year")
            .in("horse_id", [...nameById.keys()]);
        if (error || !Array.isArray(data)) return [];
        const out: StableTitle[] = [];
        for (const raw of data) {
            const row = raw as { horse_id?: unknown; title_code?: unknown; show_year?: unknown };
            if (typeof row.horse_id !== "string" || typeof row.title_code !== "string") continue;
            const code = row.title_code as HorseTitleCode;
            if (!(code in HORSE_TITLE_LABELS)) continue;
            const horseName = nameById.get(row.horse_id);
            if (!horseName) continue;
            out.push({
                horseId: row.horse_id,
                horseName,
                code,
                label: HORSE_TITLE_LABELS[code],
                showYear: typeof row.show_year === "number" ? row.show_year : null,
            });
        }
        const order: Record<string, number> = { CH: 0, SUP: 1, ROM: 2 };
        out.sort(
            (a, b) =>
                (order[a.code] ?? 9) - (order[b.code] ?? 9) || a.horseName.localeCompare(b.horseName),
        );
        return out;
    } catch {
        return [];
    }
}

// ── Their barns ──────────────────────────────────────────────────

export interface ProfileBarn {
    id: string;
    name: string;
    slug: string;
    groupType: string;
    region: string | null;
    role: string;
}

/**
 * The member's PUBLIC barn memberships.
 *
 * Private and restricted barns are never listed, and the filter is
 * ours, not RLS's — see the file header for why neither the
 * pre-167 `USING (true)` policy nor the post-167 `is_private` one
 * can be trusted to do it. `visibility = 'public'` is the same
 * exact-match bar `filterToGloballyVisible` applies in the feed.
 */
export async function fetchProfileBarns(
    client: SupabaseClient,
    userId: string,
): Promise<ProfileBarn[]> {
    try {
        const { data: memberships, error } = await client
            .from("group_memberships")
            .select("group_id, role")
            .eq("user_id", userId);
        if (error || !memberships || memberships.length === 0) return [];

        const roleById = new Map<string, string>();
        for (const row of memberships as { group_id: string; role: string | null }[]) {
            roleById.set(row.group_id, row.role ?? "member");
        }

        const { data: groups } = await client
            .from("groups")
            .select("id, name, slug, group_type, region, visibility")
            .in("id", [...roleById.keys()])
            .eq("visibility", "public")
            .order("name");

        return ((groups ?? []) as Record<string, unknown>[]).map((g) => ({
            id: g.id as string,
            name: g.name as string,
            slug: g.slug as string,
            groupType: (g.group_type as string) ?? "club",
            region: (g.region as string | null) ?? null,
            role: roleById.get(g.id as string) ?? "member",
        }));
    } catch {
        return [];
    }
}

// ── Their recent posts ───────────────────────────────────────────

export interface ProfilePost {
    id: string;
    content: string;
    createdAt: string;
    likesCount: number;
    repliesCount: number;
}

const PROFILE_POST_LIMIT = 5;

/**
 * The member's most recent posts that the whole site can see.
 *
 * There is no author-filtered read in the posts actions — `getPosts`
 * takes a context and `getFeedStream` derives its author list from
 * the viewer's follows — so this queries the table and reuses the
 * feed's own pure visibility rule rather than duplicating it.
 *
 * Over-fetches before filtering: most of what a member writes is
 * barn talk and passport comments, which the filter removes.
 */
export async function fetchProfilePosts(
    client: SupabaseClient,
    userId: string,
): Promise<ProfilePost[]> {
    try {
        const support = await getPostColumnSupport(client);
        const columns = [
            "id, content, created_at, likes_count, replies_count",
            "horse_id, group_id, event_id, studio_id, help_request_id, channel_id",
            support.kind ? "kind" : null,
            support.visibility ? "visibility" : null,
        ]
            .filter(Boolean)
            .join(", ");

        let query = client
            .from("posts")
            .select(columns)
            .eq("author_id", userId)
            .is("parent_id", null)
            .order("created_at", { ascending: false })
            .limit(40);
        // A "followers" post is not public, even to a follower reading
        // this page — a profile is a public surface.
        if (support.visibility) query = query.eq("visibility", "public");

        const { data, error } = await query;
        if (error || !Array.isArray(data)) return [];
        const rows = data as unknown as Record<string, unknown>[];

        const horseIds = [
            ...new Set(rows.map((r) => r.horse_id).filter((v): v is string => typeof v === "string")),
        ];
        const groupIds = [
            ...new Set(rows.map((r) => r.group_id).filter((v): v is string => typeof v === "string")),
        ];

        const [publicHorseIds, publicGroupIds] = await Promise.all([
            idSet(client, "user_horses", horseIds, (q) =>
                q.eq("visibility", "public").is("deleted_at", null),
            ),
            idSet(client, "groups", groupIds, (q) => q.eq("visibility", "public")),
        ]);

        const out: ProfilePost[] = [];
        for (const row of rows) {
            const content = typeof row.content === "string" ? row.content : "";
            if (isAuditNote(content, row.kind as string | null | undefined)) continue;
            const visible = isGloballyVisible(
                {
                    horseId: (row.horse_id as string | null) ?? null,
                    groupId: (row.group_id as string | null) ?? null,
                    eventId: (row.event_id as string | null) ?? null,
                    studioId: (row.studio_id as string | null) ?? null,
                    helpRequestId: (row.help_request_id as string | null) ?? null,
                    channelId: (row.channel_id as string | null) ?? null,
                },
                publicHorseIds,
                publicGroupIds,
            );
            if (!visible || !content.trim()) continue;
            out.push({
                id: row.id as string,
                content,
                createdAt: (row.created_at as string) ?? "",
                likesCount: Number(row.likes_count ?? 0),
                repliesCount: Number(row.replies_count ?? 0),
            });
            if (out.length >= PROFILE_POST_LIMIT) break;
        }
        return out;
    } catch {
        return [];
    }
}

// ── small helpers ────────────────────────────────────────────────

type Filterable = {
    eq: (col: string, val: unknown) => Filterable;
    is: (col: string, val: unknown) => Filterable;
};

async function idSet(
    client: SupabaseClient,
    table: string,
    ids: string[],
    narrow: (q: Filterable) => Filterable,
): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    try {
        const base = loose(client).from(table).select("id").in("id", ids);
        const { data } = await (narrow(base as unknown as Filterable) as unknown as PromiseLike<{
            data: unknown;
        }>);
        if (!Array.isArray(data)) return new Set();
        return new Set(
            data
                .map((r) => (r as { id?: unknown }).id)
                .filter((v): v is string => typeof v === "string"),
        );
    } catch {
        return new Set();
    }
}

/** Tolerant single-row read: any error (incl. a missing table) → null. */
async function safeMaybeSingle<T>(
    client: SupabaseClient,
    table: string,
    columns: string,
    column: string,
    value: string,
): Promise<T | null> {
    try {
        const { data, error } = await loose(client)
            .from(table)
            .select(columns)
            .eq(column, value)
            .maybeSingle();
        if (error || !data) return null;
        return data as T;
    } catch {
        return null;
    }
}

/** Tolerant list read: any error (incl. a missing table) → []. */
async function safeSelect<T>(
    client: SupabaseClient,
    table: string,
    columns: string,
    column: string,
    value: string,
): Promise<T[]> {
    try {
        const { data, error } = await loose(client)
            .from(table)
            .select(columns)
            .eq(column, value);
        if (error || !Array.isArray(data)) return [];
        return data as T[];
    } catch {
        return [];
    }
}
