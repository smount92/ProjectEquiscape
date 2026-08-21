"use server";

/**
 * The admin Insights reader — first-party object metrics, aggregate only.
 *
 * A separate file rather than an addition to actions/admin.ts, so this lands
 * as a new file instead of a diff in a 1100-line module the console
 * reorganisation is still moving around.
 *
 * What this answers that Vercel Web Analytics cannot: Vercel knows a URL got
 * traffic. It does not know that the URL is a horse, whose horse it is, or
 * that the same horse also gets attention through the market. These numbers
 * come off our own rollups, keyed by object, which is what makes "your
 * listing got 12 views this week" possible at all.
 *
 * Everything degrades to null when migration 175 has not been pasted; the
 * tab renders "—" rather than an error, per house convention.
 */

import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth";
import { isMissingMetricsSchema, metricsDb } from "@/lib/metrics/db";
import { ENTITY_TYPES, type EntityType } from "@/lib/metrics/entities";
import { entityKey, resolveEntityNames, type ResolvedEntity } from "@/lib/metrics/resolve";

/** Days of DAU history the chart shows. */
const SERIES_DAYS = 14;
/** Window for the leaderboards and per-type totals. */
const WINDOW_DAYS = 7;
/** Rows per entity type on the leaderboard. */
const PER_TYPE = 5;

export interface ActivityDay {
    day: string;
    memberDau: number;
    anonDau: number;
    views: number;
}

export interface TopObject {
    entityType: EntityType;
    entityId: string;
    views: number;
    uniques: number;
    name: string;
    href: string | null;
}

export interface EntityTotal {
    entityType: EntityType;
    views: number;
    uniques: number;
}

export interface AdminInsights {
    /** Oldest first, one entry per day that had any activity. */
    activity: ActivityDay[];
    /** Seven-day totals per entity type, busiest first. */
    totals: EntityTotal[];
    /** Top objects of the last seven days, grouped by the caller. */
    top: TopObject[];
    /** True when 175 is live. False means every number above is empty. */
    schemaReady: boolean;
    windowDays: number;
    seriesDays: number;
}

function serviceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

const EMPTY: AdminInsights = {
    activity: [],
    totals: [],
    top: [],
    schemaReady: false,
    windowDays: WINDOW_DAYS,
    seriesDays: SERIES_DAYS,
};

function isEntityType(value: unknown): value is EntityType {
    return typeof value === "string" && (ENTITY_TYPES as readonly string[]).includes(value);
}

const num = (v: unknown): number => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
};

export async function getAdminInsights(): Promise<
    { success: true; insights: AdminInsights } | { success: false; error: string }
> {
    try {
        await requireAdmin();
    } catch {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const admin = metricsDb(serviceClient());

        // The UTC day the series should start on. Computed here rather than
        // in SQL so the chart's x-axis and the RPC windows agree exactly.
        const startDay = new Date(Date.now() - (SERIES_DAYS - 1) * 86_400_000)
            .toISOString()
            .slice(0, 10);

        // Three reads, issued together. The two RPCs are service_role-only
        // (migration 175) and the table read relies on the service role
        // bypassing RLS — no policy grants SELECT to anyone else.
        const [seriesRes, totalsRes, topRes] = await Promise.all([
            admin
                .from("site_activity_daily")
                .select("day, member_dau, anon_dau, views")
                .gte("day", startDay)
                .order("day", { ascending: true }),
            admin.rpc("metrics_entity_totals", { p_days: WINDOW_DAYS }),
            admin.rpc("metrics_top_objects", { p_days: WINDOW_DAYS, p_per_type: PER_TYPE }),
        ]);

        // Any of the three reporting a missing relation means the migration
        // is not in yet. That is a "—", not a failure.
        const missing =
            isMissingMetricsSchema(seriesRes.error) ||
            isMissingMetricsSchema(totalsRes.error) ||
            isMissingMetricsSchema(topRes.error);
        if (missing) {
            return { success: true, insights: EMPTY };
        }

        const firstError = seriesRes.error || totalsRes.error || topRes.error;
        if (firstError) {
            return { success: false, error: firstError.message };
        }

        const activity: ActivityDay[] = ((seriesRes.data ?? []) as Record<string, unknown>[]).map(
            (r) => ({
                day: String(r.day ?? ""),
                memberDau: num(r.member_dau),
                anonDau: num(r.anon_dau),
                views: num(r.views),
            }),
        );

        const totals: EntityTotal[] = ((totalsRes.data ?? []) as Record<string, unknown>[])
            .filter((r) => isEntityType(r.etype))
            .map((r) => ({
                entityType: r.etype as EntityType,
                views: num(r.total_views),
                uniques: num(r.total_uniques),
            }));

        const rawTop = ((topRes.data ?? []) as Record<string, unknown>[]).filter(
            (r) => isEntityType(r.etype) && typeof r.eid === "string",
        );

        // One batched name lookup for every leaderboard row at once.
        const names = await resolveEntityNames(
            admin,
            rawTop.map((r) => ({ type: r.etype as EntityType, id: String(r.eid) })),
        );

        const top: TopObject[] = rawTop.map((r) => {
            const entityType = r.etype as EntityType;
            const entityId = String(r.eid);
            const resolved: ResolvedEntity = names[entityKey(entityType, entityId)] ?? {
                name: entityId,
                href: null,
            };
            return {
                entityType,
                entityId,
                views: num(r.total_views),
                uniques: num(r.total_uniques),
                name: resolved.name,
                href: resolved.href,
            };
        });

        return {
            success: true,
            insights: {
                activity,
                totals,
                top,
                schemaReady: true,
                windowDays: WINDOW_DAYS,
                seriesDays: SERIES_DAYS,
            },
        };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}
