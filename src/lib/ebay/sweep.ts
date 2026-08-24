/**
 * The weekly sweep: turn eBay active listings into a price signal per
 * catalog entry.
 *
 * WHY THIS IS NOT "QUERY EVERY MODEL". The catalog holds ~10,900 entries
 * and only ~2,900 are matchable at all (a model number that is long
 * enough to read out of a listing title AND identifies exactly one
 * release). Even those cannot all be swept weekly inside a sane rate
 * limit, so the sweep takes a bounded slice per run, oldest reading
 * first. Over enough weeks every reachable model gets covered, and the
 * ones members actually look at get refreshed soonest because they were
 * seeded first.
 *
 * The orchestration lives here rather than in the route so it can be
 * tested without HTTP.
 */

import { searchActiveListings, buildQuery, type EbayListing } from "@/lib/ebay/client";
import {
    buildNumberIndex,
    isMatch,
    matchListing,
    type MatchCandidate,
    type RejectReason,
} from "@/lib/ebay/matching";

export interface SweepTarget extends MatchCandidate {}

export interface SignalListing {
    title: string;
    price: number;
    url: string;
}

export interface PriceSignal {
    catalogItemId: string;
    askingLow: number;
    askingMedian: number;
    askingHigh: number;
    currency: string;
    sampleSize: number;
    matchBasis: string;
    /** Up to three of the matched listings, cheapest first — the
     *  receipts the aggregate was computed from, EPN-tracked when the
     *  campaign header was sent. */
    listings: SignalListing[];
}

export interface SweepOutcome {
    signals: PriceSignal[];
    /** Counted, not thrown away — the rejection profile is how we learn
     *  whether the matching rules are too strict or not strict enough. */
    rejections: Record<string, number>;
    searched: number;
    errors: string[];
}

export function median(values: number[]): number {
    const s = [...values].sort((a, b) => a - b);
    if (!s.length) return 0;
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * A signal drawn from a single listing is one person's asking price, not
 * a market. Showing it as though it were a market reading is the quiet
 * kind of wrong this whole feature has to avoid, so the floor is 3.
 */
export const MIN_SAMPLE = 3;

/**
 * Mixed currencies cannot be averaged. The sweep prices against one
 * marketplace, so a stray non-matching currency is dropped rather than
 * silently converted at a rate we do not have.
 */
export function summarise(
    catalogItemId: string,
    listings: EbayListing[],
    matchBasis: string
): PriceSignal | null {
    if (!listings.length) return null;
    const currency = listings[0].currency;
    const sameCurrency = listings.filter((l) => l.currency === currency);
    const prices = sameCurrency.map((l) => l.price).filter((p) => Number.isFinite(p) && p > 0);
    if (prices.length < MIN_SAMPLE) return null;
    // The receipts: cheapest three of the listings that were actually
    // priced from. A listing with no usable URL is skipped rather than
    // rendered as a dead link.
    const receipts = [...sameCurrency]
        .sort((a, b) => a.price - b.price)
        .flatMap((l) => {
            const url = l.itemAffiliateWebUrl ?? l.itemWebUrl;
            return url ? [{ title: l.title, price: l.price, url }] : [];
        })
        .slice(0, 3);
    return {
        catalogItemId,
        askingLow: Math.min(...prices),
        askingMedian: median(prices),
        askingHigh: Math.max(...prices),
        currency,
        sampleSize: prices.length,
        matchBasis,
        listings: receipts,
    };
}

export interface SweepDeps {
    search?: typeof searchActiveListings;
}

/**
 * Sweep a slice of catalog rows. `targets` is the slice; choosing it
 * (oldest reading first, matchable only) is the caller's job.
 */
export async function sweep(
    targets: SweepTarget[],
    deps: SweepDeps = {}
): Promise<SweepOutcome> {
    const search = deps.search ?? searchActiveListings;
    const index = buildNumberIndex(targets);
    const signals: PriceSignal[] = [];
    const rejections: Record<string, number> = {};
    const errors: string[] = [];
    let searched = 0;

    const note = (reason: RejectReason | "below-min-sample") => {
        rejections[reason] = (rejections[reason] ?? 0) + 1;
    };

    for (const target of targets) {
        if (!target.modelNumber) { note("no-model-number-in-listing"); continue; }
        let listings: EbayListing[];
        try {
            listings = await search(buildQuery(target.maker, target.title, target.modelNumber));
            searched++;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`${target.id}: ${message}`);
            // A rate limit means every subsequent call fails too; stopping
            // keeps the run's partial results rather than burning through
            // the rest of the slice generating identical errors.
            if (/rate limit/i.test(message)) break;
            continue;
        }

        const accepted: EbayListing[] = [];
        for (const listing of listings) {
            const outcome = matchListing(listing, index);
            if (!isMatch(outcome)) { note(outcome.reason); continue; }
            // A listing that matches a DIFFERENT model than the one we
            // searched for is not this model's comp, however good the
            // match is. Search results are fuzzy; matching is not.
            if (outcome.catalogId !== target.id) { note("no-catalog-row-for-number"); continue; }
            accepted.push(listing);
        }

        const signal = summarise(target.id, accepted, "model-number-and-maker");
        if (signal) signals.push(signal);
        else if (accepted.length) note("below-min-sample");
    }

    return { signals, rejections, searched, errors };
}
