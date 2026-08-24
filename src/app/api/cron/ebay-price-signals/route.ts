// ============================================================
// Vercel Cron: eBay price signals
// Schedule: weekly, Mondays 07:00 UTC (0 7 * * 1) — see vercel.json.
//
// Requires CRON_SECRET, plus EBAY_CLIENT_ID / EBAY_CLIENT_SECRET and
// NEXT_PUBLIC_EBAY_COMPS=1. Without any of those it is a clean no-op,
// not an error — the route must be safe to schedule before the feature
// is switched on.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { ebayCompsLive } from "@/lib/ebay/flag";
import { sweep, type SweepTarget } from "@/lib/ebay/sweep";

/**
 * How many models one run touches. Deliberately small: eBay's Browse API
 * is rate limited per day, ~2,900 catalog rows are matchable, and a
 * weekly cadence over a few hundred covers the reachable set in a couple
 * of months without ever approaching the ceiling. Raise it only with a
 * real rate-limit number in hand.
 */
const SLICE = 150;

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    // Unset-secret guard: without it, an env missing CRON_SECRET
    // (e.g. preview deploys) accepts the literal "Bearer undefined".
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!ebayCompsLive()) {
        return NextResponse.json({ skipped: "ebay comps not enabled or not configured" });
    }

    try {
        const admin = getAdminClient();

        // Rows worth asking about: a model number long enough to read out
        // of a listing title. The shorter ones ("85") are matchable only
        // when a seller writes "#85", which is too rare to spend a request
        // on. Ambiguity is handled inside matching, not here.
        const { data: rows, error } = await admin
            .from("catalog_items")
            .select("id, title, maker, scale, attributes")
            .not("attributes->>model_number", "is", null)
            .limit(4000);
        if (error) throw new Error(`catalog read failed: ${error.message}`);

        const signals = () => admin.from("catalog_price_signals");

        const { data: seen } = await signals().select("catalog_item_id, observed_at");
        const lastSeen = new Map((seen ?? []).map((s) => [s.catalog_item_id, s.observed_at]));

        // A model a member flagged as wrongly matched is OFF the sweep
        // until an admin resolves the flag — a wrong price that keeps
        // coming back after being reported would be worse than none.
        // Tolerant: before migration 196 the table is missing and the
        // set stays empty.
        const flagged = new Set<string>();
        try {
            const { data: flags } = await (admin as unknown as {
                from: (t: string) => {
                    select: (c: string) => { eq: (k: string, v: string) => Promise<{ data: { catalog_item_id: string }[] | null }> };
                };
            }).from("catalog_price_signal_flags").select("catalog_item_id").eq("status", "active");
            for (const f of flags ?? []) flagged.add(f.catalog_item_id);
        } catch {
            /* pre-196 */
        }

        const candidates: SweepTarget[] = (rows ?? [])
            .map((r) => ({
                id: r.id as string,
                title: String(r.title ?? ""),
                maker: (r.maker as string | null) ?? null,
                modelNumber: String((r.attributes as Record<string, unknown>)?.model_number ?? ""),
                scale: (r.scale as string | null) ?? null,
            }))
            .filter((c) => /^[0-9]{4,6}[A-Za-z]?$/.test(c.modelNumber.trim().toUpperCase()))
            .filter((c) => !flagged.has(c.id));

        // Never-read models first, then the stalest. New entries get a
        // price before old ones get a fresher one.
        candidates.sort((a, b) => {
            const sa = lastSeen.get(a.id) ?? "";
            const sb = lastSeen.get(b.id) ?? "";
            return sa.localeCompare(sb);
        });

        // ?limit=N overrides the slice for manual runs (still behind
        // CRON_SECRET). The weekly cron sends none and gets the default;
        // an owner-triggered catch-up can cover the whole reachable set
        // in one pass. Capped well inside the Browse API's daily budget.
        const requested = Number(request.nextUrl.searchParams.get("limit"));
        const sliceSize = Number.isFinite(requested) && requested > 0
            ? Math.min(requested, 900)
            : SLICE;

        const slice = candidates.slice(0, sliceSize);
        const outcome = await sweep(slice);

        let written = 0;
        for (const s of outcome.signals) {
            const row = {
                catalog_item_id: s.catalogItemId,
                asking_low: s.askingLow,
                asking_median: s.askingMedian,
                asking_high: s.askingHigh,
                currency: s.currency,
                sample_size: s.sampleSize,
                match_basis: s.matchBasis,
                listings: s.listings,
                source: "ebay-browse",
                observed_at: new Date().toISOString(),
            };
            let { error: upsertError } = await signals()
                .upsert(row, { onConflict: "catalog_item_id" });
            // Pre-196 the listings column does not exist; the aggregate is
            // still worth keeping rather than failing the whole write.
            if (upsertError && (upsertError.code === "PGRST204" || /listings/.test(upsertError.message ?? ""))) {
                const { listings: _dropped, ...withoutListings } = row;
                void _dropped;
                ({ error: upsertError } = await signals()
                    .upsert(withoutListings, { onConflict: "catalog_item_id" }));
            }
            if (upsertError) {
                Sentry.captureException(upsertError, { tags: { domain: "cron" } });
                logger.error("CronEbay", "signal upsert failed", upsertError);
                continue;
            }
            written++;
        }

        // The rejection profile is the feedback loop on the matching
        // rules — logged every run so "too strict" or "not strict enough"
        // is an observation rather than an argument.
        logger.info("CronEbay", "sweep complete", {
            considered: candidates.length,
            swept: slice.length,
            searched: outcome.searched,
            written,
            rejections: outcome.rejections,
            errors: outcome.errors.length,
        });

        return NextResponse.json({
            considered: candidates.length,
            swept: slice.length,
            written,
            rejections: outcome.rejections,
            errors: outcome.errors.slice(0, 5),
        });
    } catch (err) {
        Sentry.captureException(err, { tags: { domain: "cron" } });
        logger.error("CronEbay", "sweep failed", err);
        return NextResponse.json({ error: "sweep failed" }, { status: 500 });
    }
}
