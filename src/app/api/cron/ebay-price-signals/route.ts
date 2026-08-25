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
        // on.
        //
        // PAGINATED, not .limit(4000): PostgREST silently caps a single
        // request at 1,000 rows, so the first version of this read saw
        // under a quarter of the catalog and "considered: 812" looked
        // plausible enough that nobody questioned it. The 1,000-row cap
        // has now produced a wrong number four separate times in this
        // codebase's history; paginate every catalog-wide read, always.
        const rows: { id: string; title: string | null; maker: string | null; scale: string | null; attributes: Record<string, unknown> | null }[] = [];
        for (let from = 0; from < 20_000; from += 1000) {
            const { data: page, error } = await admin
                .from("catalog_items")
                .select("id, title, maker, scale, attributes")
                .not("attributes->>model_number", "is", null)
                .range(from, from + 999);
            if (error) throw new Error(`catalog read failed: ${error.message}`);
            if (!page || page.length === 0) break;
            rows.push(...(page as typeof rows));
            if (page.length < 1000) break;
        }

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

        // CATALOG-WIDE ambiguity, not batch-local. matchListing's own
        // ambiguity check runs against the index built from the current
        // batch, so a number shared by several different models across the
        // catalog looks unique whenever only one sibling is in the batch —
        // and its prices would silently attribute to whichever sibling got
        // swept. Same-title groups (glossy/matte variants of one release)
        // stay: they are one model for pricing purposes.
        const titlesByNumber = new Map<string, Set<string>>();
        for (const c of candidates) {
            const n = (c.modelNumber ?? "").trim().toUpperCase();
            if (!titlesByNumber.has(n)) titlesByNumber.set(n, new Set());
            titlesByNumber.get(n)!.add(c.title.trim().toLowerCase());
        }
        const unambiguous = candidates.filter(
            (c) => (titlesByNumber.get((c.modelNumber ?? "").trim().toUpperCase())?.size ?? 0) === 1,
        );

        // Never-read models first, then the stalest. New entries get a
        // price before old ones get a fresher one.
        unambiguous.sort((a, b) => {
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
            ? Math.min(requested, 4500)
            : SLICE;

        // ?ids=a,b,c re-sweeps exactly those models (matching-rule fixes,
        // resolved wrong-model flags) without spending the whole budget.
        // Ids that aren't in the candidate pool are simply absent from the
        // result — the response's `swept` count is the receipt.
        const idsParam = request.nextUrl.searchParams.get("ids");
        const onlyIds = idsParam
            ? new Set(idsParam.split(",").map((s) => s.trim()).filter(Boolean))
            : null;
        const pool = onlyIds ? unambiguous.filter((c) => onlyIds.has(c.id)) : unambiguous;

        const slice = pool.slice(0, sliceSize);
        const outcome = await sweep(slice);

        let written = 0;
        const wroteIds = new Set<string>();
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
            wroteIds.add(s.catalogItemId);
        }

        // The ledger behind the rolling signal (197): every reading that
        // landed in the signal table also appends today's aggregates to
        // catalog_price_history — aggregates only, never the listings.
        // Same-day re-runs refresh the day's row rather than stacking
        // duplicates. Tolerant pre-197: the rolling signal alone is still
        // worth keeping, so a missing table skips quietly.
        let historyWritten = 0;
        const today = new Date().toISOString().slice(0, 10);
        const historyRows = outcome.signals
            .filter((s) => wroteIds.has(s.catalogItemId))
            .map((s) => ({
                catalog_item_id: s.catalogItemId,
                asking_low: s.askingLow,
                asking_median: s.askingMedian,
                asking_high: s.askingHigh,
                currency: s.currency,
                sample_size: s.sampleSize,
                source: "ebay-browse",
                observed_on: today,
            }));
        const history = (admin as unknown as {
            from: (t: string) => {
                upsert: (
                    rows: Record<string, unknown>[],
                    opts: { onConflict: string },
                ) => Promise<{ error: { code?: string; message?: string } | null }>;
            };
        }).from.bind(admin);
        for (let i = 0; i < historyRows.length; i += 500) {
            const chunk = historyRows.slice(i, i + 500);
            const { error: histError } = await history("catalog_price_history")
                .upsert(chunk, { onConflict: "catalog_item_id,source,observed_on" });
            if (histError) {
                const missingTable =
                    histError.code === "42P01" ||
                    /catalog_price_history/.test(histError.message ?? "");
                if (!missingTable) {
                    Sentry.captureException(histError, { tags: { domain: "cron" } });
                    logger.error("CronEbay", "history append failed", histError);
                }
                break;
            }
            historyWritten += chunk.length;
        }

        // The rejection profile is the feedback loop on the matching
        // rules — logged every run so "too strict" or "not strict enough"
        // is an observation rather than an argument.
        logger.info("CronEbay", "sweep complete", {
            considered: unambiguous.length,
            ambiguousExcluded: candidates.length - unambiguous.length,
            swept: slice.length,
            searched: outcome.searched,
            written,
            historyWritten,
            rejections: outcome.rejections,
            errors: outcome.errors.length,
        });

        return NextResponse.json({
            considered: unambiguous.length,
            ambiguousExcluded: candidates.length - unambiguous.length,
            swept: slice.length,
            written,
            historyWritten,
            rejections: outcome.rejections,
            errors: outcome.errors.slice(0, 5),
        });
    } catch (err) {
        Sentry.captureException(err, { tags: { domain: "cron" } });
        logger.error("CronEbay", "sweep failed", err);
        return NextResponse.json({ error: "sweep failed" }, { status: 500 });
    }
}
