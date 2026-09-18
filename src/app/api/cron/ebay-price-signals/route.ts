// ============================================================
// Vercel Cron: eBay price signals
// Schedule: daily, 07:00 UTC (0 7 * * *) — see vercel.json. That is the
// minute eBay's daily call budget resets, so every run starts full.
//
// Requires CRON_SECRET, plus EBAY_CLIENT_ID / EBAY_CLIENT_SECRET and
// NEXT_PUBLIC_EBAY_COMPS=1. Without any of those it is a clean no-op,
// not an error — the route must be safe to schedule before the feature
// is switched on.
//
// WHAT THE RUN LEDGER SAID (2026-09-17). The cron fired every Monday
// and wrote 5, 7, then 1 signals from a 150-model slice, against 535
// from the manual catch-up. Ordering was by the signals table alone, so
// a model swept with no result still sorted as never-read and came up
// again — the same unproductive slice each week. Ordering now runs on
// the attempt ledger (catalog_price_sweeps, 211; lib/ebay/schedule).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { ebayCompsLive } from "@/lib/ebay/flag";
import { attemptRows, planSweep, tallyOutcomes } from "@/lib/ebay/schedule";
import { sweep, type SweepTarget } from "@/lib/ebay/sweep";

/**
 * The 2026-09-14 run swept 150 models sequentially in ~66 s (~0.44 s
 * each). The slice below runs four searches at a time: ~1,000 × 0.44 / 4
 * ≈ 2 minutes, inside this 5-minute budget with room for a slow eBay
 * day. A run that dies mid-slice writes nothing at all, so the budget
 * is not optional.
 */
export const maxDuration = 300;

/**
 * How many models one daily run touches. eBay's Analytics API reports
 * this keyset's Browse limit as 5,000 calls per day (read 2026-09-18:
 * limit 5000, window 86,400 s, resets 07:00 UTC). 1,000 a day is 20% of
 * that — every reachable model (~3,100) re-priced every three days, and
 * 4,000 calls a day still free for owner-triggered catch-ups. Raised
 * from a weekly 150 on 2026-09-18 when the owner asked why the budget
 * sat unused.
 */
const SLICE = 1000;
const WORKERS = 4;

/** Loose facade for tables not yet in the generated types (211). */
interface LooseResult<T> {
    data: T[] | null;
    error: { code?: string; message?: string } | null;
}
interface LooseQuery {
    select: (cols: string) => LooseQuery;
    eq: (k: string, v: string) => LooseQuery;
    range: (from: number, to: number) => Promise<LooseResult<Record<string, unknown>>>;
    upsert: (
        rows: Record<string, unknown>[],
        opts: { onConflict: string },
    ) => Promise<{ error: { code?: string; message?: string } | null }>;
}

function missingTable(error: { code?: string; message?: string } | null, table: string): boolean {
    return !!error && (error.code === "42P01" || (error.message ?? "").includes(table));
}

/**
 * PAGINATED, not .limit(N): PostgREST silently caps a single request at
 * 1,000 rows. That cap has produced a wrong number four separate times
 * in this codebase's history — paginate every catalog-wide read, always.
 * Signals passed 600 rows in September; attempts will pass 1,000 by
 * winter.
 */
async function readAll(
    query: (from: number, to: number) => Promise<LooseResult<Record<string, unknown>>>,
): Promise<Record<string, unknown>[] | { error: { code?: string; message?: string } }> {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; from < 20_000; from += 1000) {
        const { data, error } = await query(from, from + 999);
        if (error) return { error };
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < 1000) break;
    }
    return rows;
}

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
        const loose = (admin as unknown as { from: (t: string) => LooseQuery }).from.bind(admin);
        const now = new Date();

        // Rows worth asking about: a model number long enough to read out
        // of a listing title. The shorter ones ("85") are matchable only
        // when a seller writes "#85", which is too rare to spend a request
        // on.
        const catalog = await readAll((from, to) =>
            admin
                .from("catalog_items")
                .select("id, title, maker, scale, attributes")
                .not("attributes->>model_number", "is", null)
                .range(from, to) as unknown as Promise<LooseResult<Record<string, unknown>>>,
        );
        if ("error" in catalog) throw new Error(`catalog read failed: ${catalog.error.message}`);
        const rows = catalog as {
            id: string;
            title: string | null;
            maker: string | null;
            scale: string | null;
            attributes: Record<string, unknown> | null;
        }[];

        const signals = () => admin.from("catalog_price_signals");

        const seen = await readAll((from, to) =>
            signals().select("catalog_item_id, observed_at").range(from, to) as unknown as Promise<
                LooseResult<Record<string, unknown>>
            >,
        );
        if ("error" in seen) throw new Error(`signals read failed: ${seen.error.message}`);
        const lastSignal = new Map(
            seen.map((s) => [s.catalog_item_id as string, s.observed_at as string]),
        );

        // The attempt ledger (211). null before the paste: the planner
        // then rotates the never-read pool by day instead.
        let lastAttempt: Map<string, string> | null = null;
        const tried = await readAll((from, to) =>
            loose("catalog_price_sweeps").select("catalog_item_id, swept_at").range(from, to),
        );
        if ("error" in tried) {
            if (!missingTable(tried.error, "catalog_price_sweeps")) {
                throw new Error(`sweep ledger read failed: ${tried.error.message}`);
            }
        } else {
            lastAttempt = new Map(
                tried.map((t) => [t.catalog_item_id as string, t.swept_at as string]),
            );
        }

        // A model a member flagged as wrongly matched is OFF the sweep
        // until an admin resolves the flag — a wrong price that keeps
        // coming back after being reported would be worse than none.
        // Tolerant: before migration 196 the table is missing and the
        // set stays empty.
        const flagged = new Set<string>();
        try {
            const { data: flags } = await (loose("catalog_price_signal_flags")
                .select("catalog_item_id")
                .eq("status", "active") as unknown as Promise<LooseResult<{ catalog_item_id: string }>>);
            for (const f of flags ?? []) flagged.add(f.catalog_item_id);
        } catch {
            /* pre-196 */
        }

        const candidates: SweepTarget[] = rows
            .map((r) => ({
                id: r.id,
                title: String(r.title ?? ""),
                maker: r.maker ?? null,
                modelNumber: String(r.attributes?.model_number ?? ""),
                scale: r.scale ?? null,
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

        // Never-attempted first, then stalest attempt (lib/ebay/schedule).
        const plan = planSweep({ candidates: unambiguous, lastSignal, lastAttempt, now });

        // ?limit=N overrides the slice for manual runs (still behind
        // CRON_SECRET). The weekly cron sends none and gets the default;
        // an owner-triggered catch-up can cover the whole reachable set
        // in one pass. Capped inside the Browse API's daily budget AND the
        // function's: 2,000 × 0.44 s / 4 workers ≈ 4 minutes.
        const requested = Number(request.nextUrl.searchParams.get("limit"));
        const sliceSize = Number.isFinite(requested) && requested > 0
            ? Math.min(requested, 2000)
            : SLICE;

        // ?ids=a,b,c re-sweeps exactly those models (matching-rule fixes,
        // resolved wrong-model flags) without spending the whole budget.
        // Ids that aren't in the candidate pool are simply absent from the
        // result — the response's `swept` count is the receipt.
        const idsParam = request.nextUrl.searchParams.get("ids");
        const onlyIds = idsParam
            ? new Set(idsParam.split(",").map((s) => s.trim()).filter(Boolean))
            : null;
        const pool = onlyIds ? plan.ordered.filter((c) => onlyIds.has(c.id)) : plan.ordered;

        const slice = pool.slice(0, sliceSize);
        const outcome = await sweep(slice, { concurrency: WORKERS });

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
                observed_at: now.toISOString(),
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
        const today = now.toISOString().slice(0, 10);
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
        for (let i = 0; i < historyRows.length; i += 500) {
            const chunk = historyRows.slice(i, i + 500);
            const { error: histError } = await loose("catalog_price_history")
                .upsert(chunk, { onConflict: "catalog_item_id,source,observed_on" });
            if (histError) {
                if (!missingTable(histError, "catalog_price_history")) {
                    Sentry.captureException(histError, { tags: { domain: "cron" } });
                    logger.error("CronEbay", "history append failed", histError);
                }
                break;
            }
            historyWritten += chunk.length;
        }

        // The attempt ledger (211): every model this run asked about,
        // whatever the answer, so next Monday's slice moves on. Tolerant
        // pre-211: the week rotation above already keeps the slice moving.
        const sampleSizes = new Map(outcome.signals.map((s) => [s.catalogItemId, s.sampleSize]));
        const attempts = attemptRows(outcome.perTarget, sampleSizes, now);
        let attemptsRecorded = 0;
        for (let i = 0; i < attempts.length; i += 500) {
            const chunk = attempts.slice(i, i + 500);
            const { error: attemptError } = await loose("catalog_price_sweeps")
                .upsert(chunk as unknown as Record<string, unknown>[], { onConflict: "catalog_item_id" });
            if (attemptError) {
                if (!missingTable(attemptError, "catalog_price_sweeps")) {
                    Sentry.captureException(attemptError, { tags: { domain: "cron" } });
                    logger.error("CronEbay", "attempt ledger write failed", attemptError);
                }
                break;
            }
            attemptsRecorded += chunk.length;
        }

        // The rejection profile is the feedback loop on the matching
        // rules — logged every run so "too strict" or "not strict enough"
        // is an observation rather than an argument.
        const summary = {
            considered: unambiguous.length,
            ambiguousExcluded: candidates.length - unambiguous.length,
            neverAttempted: plan.neverAttempted,
            orderedBy: plan.basis,
            swept: slice.length,
            searched: outcome.searched,
            outcomes: tallyOutcomes(outcome.perTarget),
            written,
            historyWritten,
            attemptsRecorded,
            rejections: outcome.rejections,
            errors: outcome.errors.length,
        };
        logger.info("CronEbay", "sweep complete", summary);

        return NextResponse.json({ ...summary, errors: outcome.errors.slice(0, 5) });
    } catch (err) {
        Sentry.captureException(err, { tags: { domain: "cron" } });
        logger.error("CronEbay", "sweep failed", err);
        return NextResponse.json({ error: "sweep failed" }, { status: 500 });
    }
}
