// ============================================================
// Vercel Cron: Refresh Market Prices
// Schedule: Daily at 06:00 UTC (0 6 * * *) — see vercel.json.
//
// Requires CRON_SECRET environment variable in Vercel dashboard.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { withHeartbeat } from "@/lib/ops/heartbeat";
import * as Sentry from "@sentry/nextjs";

async function runJob(request: NextRequest) {
    // Verify Vercel cron secret
    const authHeader = request.headers.get("authorization");
    // Unset-secret guard: without it, an env missing CRON_SECRET
    // (e.g. preview deploys) accepts the literal "Bearer undefined".
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const admin = getAdminClient();
        // Supabase returns errors rather than throwing; a failed main step
        // must fail the run, or the heartbeat would call it on time.
        const { error: marketError } = await admin.rpc("refresh_market_prices");
        if (marketError) throw new Error(`refresh_market_prices: ${marketError.message}`);

        // Auto-unpark horses with expired transfer PINs (Trn-04 fix)
        let unparkResult = null;
        try {
            const { data, error } = await admin.rpc("auto_unpark_expired_transfers");
            if (error) throw error;
            unparkResult = data;
        } catch (err) {
            Sentry.captureException(err, { tags: { domain: "cron" } });
            logger.error("CronMarket", "auto_unpark_expired_transfers failed", err);
        }

        // System garbage collection
        let gcResult = null;
        try {
            const { data, error } = await admin.rpc("cleanup_system_garbage");
            if (error) throw error;
            gcResult = data;
        } catch (err) {
            Sentry.captureException(err, { tags: { domain: "cron" } });
            logger.error("CronMarket", "cleanup_system_garbage failed", err);
        }

        // Evaluate complex relational badges (too heavy for after() hooks)
        let badgesAwarded = 0;
        try {
            const { evaluateComplexBadges } = await import("@/lib/utils/achievements-cron");
            badgesAwarded = await evaluateComplexBadges(admin);
        } catch (err) {
            Sentry.captureException(err, { tags: { domain: "cron" } });
            logger.error("CronMarket", "evaluateComplexBadges failed", err);
        }

        // Refresh trusted sellers materialized view (Community Trusted badge)
        let trustedRefreshed = false;
        try {
            const { error } = await admin.rpc("refresh_mv_trusted_sellers");
            if (error) throw error;
            trustedRefreshed = true;
        } catch (err) {
            Sentry.captureException(err, { tags: { domain: "cron" } });
            logger.error("CronMarket", "refresh_mv_trusted_sellers failed", err);
        }

        // The owner's daily Registry Desk digest: in the bell only, once a
        // day (registry_digests holds the day), listing every removal and
        // merge. Waits quietly until updates 242 and 244 are in.
        let registryDigest = null;
        try {
            const { sendRegistryDigest } = await import("@/lib/registry/digest");
            registryDigest = await sendRegistryDigest(admin);
        } catch (err) {
            Sentry.captureException(err, { tags: { domain: "cron" } });
            logger.error("CronMarket", "sendRegistryDigest failed", err);
        }

        return NextResponse.json({
            success: true,
            refreshedAt: new Date().toISOString(),
            gc: gcResult,
            badgesAwarded,
            trustedRefreshed,
            registryDigest,
        });
    } catch (error) {
        Sentry.captureException(error, { tags: { domain: "cron" }, level: "fatal" });
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

// Every authorised run records a heartbeat for Admin › Ops (MHH-029).
export async function GET(request: NextRequest) {
    return withHeartbeat("refresh-market", request, runJob);
}
