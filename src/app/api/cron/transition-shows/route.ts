import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import * as Sentry from "@sentry/nextjs";

/**
 * Cron endpoint: Auto-transition expired shows from "open" → "judging".
 * Runs every 6 hours. Complements the lazy auto-transition on page view.
 *
 * Schedule: 0 *​/6 * * * (every 6 hours)
 * Auth: Bearer CRON_SECRET header
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const admin = getAdminClient();

        // Find all shows past their deadline that are still "open"
        const { data: expiredShows, error } = await admin
            .from("events")
            .select("id, name")
            .eq("show_status", "open")
            .lt("ends_at", new Date().toISOString())
            .in("event_type", ["photo_show", "live_show"]);

        if (error) throw error;

        let transitioned = 0;
        for (const show of (expiredShows ?? [])) {
            // CAS guard: only update if still "open"
            const { error: updateError } = await admin
                .from("events")
                .update({ show_status: "judging" })
                .eq("id", show.id)
                .eq("show_status", "open");

            if (!updateError) transitioned++;
        }

        return NextResponse.json({
            success: true,
            transitioned,
            total_checked: expiredShows?.length ?? 0,
            checkedAt: new Date().toISOString(),
        });
    } catch (error) {
        Sentry.captureException(error, { tags: { domain: "cron" }, level: "error" });
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
