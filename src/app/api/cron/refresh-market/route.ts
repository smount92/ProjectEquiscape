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

export async function GET(request: NextRequest) {
    // Verify Vercel cron secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const admin = getAdminClient();
        await admin.rpc("refresh_market_prices" as string);

        // System garbage collection
        let gcResult = null;
        try {
            const { data } = await admin.rpc("cleanup_system_garbage" as string);
            gcResult = data;
        } catch { /* non-blocking */ }

        return NextResponse.json({
            success: true,
            refreshedAt: new Date().toISOString(),
            gc: gcResult,
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
