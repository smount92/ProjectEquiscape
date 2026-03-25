// ============================================================
// Vercel Cron: Refresh Market Prices
// Schedule: Every 6 hours (0 */6 * * *)
//
// To activate, add to vercel.json:
// {
//     "crons": [{
//         "path": "/api/cron/refresh-market",
//         "schedule": "0 */6 * * *"
//     }]
// }
//
// Requires CRON_SECRET environment variable in Vercel dashboard.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
    // Verify Vercel cron secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const admin = getAdminClient();
        await admin.rpc("refresh_market_prices");

        // Auto-unpark horses with expired transfer PINs (Trn-04 fix)
        let unparkResult = null;
        try {
            const { data } = await admin.rpc("auto_unpark_expired_transfers");
            unparkResult = data;
        } catch (err) { logger.error("CronMarket", "auto_unpark_expired_transfers failed", err); }

        // System garbage collection
        let gcResult = null;
        try {
            const { data } = await admin.rpc("cleanup_system_garbage");
            gcResult = data;
        } catch (err) { logger.error("CronMarket", "cleanup_system_garbage failed", err); }

        // Evaluate complex relational badges (too heavy for after() hooks)
        let badgesAwarded = 0;
        try {
            const { evaluateComplexBadges } = await import("@/lib/utils/achievements-cron");
            badgesAwarded = await evaluateComplexBadges(admin);
        } catch (err) { logger.error("CronMarket", "evaluateComplexBadges failed", err); }

        // Refresh trusted sellers materialized view (Community Trusted badge)
        let trustedRefreshed = false;
        try {
            await admin.rpc("refresh_mv_trusted_sellers");
            trustedRefreshed = true;
        } catch (err) { logger.error("CronMarket", "refresh_mv_trusted_sellers failed", err); }

        return NextResponse.json({
            success: true,
            refreshedAt: new Date().toISOString(),
            gc: gcResult,
            badgesAwarded,
            trustedRefreshed,
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
