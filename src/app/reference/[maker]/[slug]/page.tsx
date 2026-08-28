import { notFound } from "next/navigation";
import { catalogDisplayName } from "@/lib/catalog/displayName";
import type { Metadata } from "next";
import Link from "next/link";
import BlueBookProCharts from "@/components/BlueBookProCharts";
import FocusLayout from "@/components/layouts/FocusLayout";
import CatalogSubMasthead from "@/components/catalog/CatalogSubMasthead";
import { Button } from "@/components/ui/button";
import WantButton from "@/components/reference/WantButton";
import ReferencePhotoGallery from "@/components/reference/ReferencePhotoGallery";
import { referenceHref } from "@/lib/catalog/referenceUrl";
import { missingFieldLabels } from "@/lib/catalog/editableFields";
import { createAnonClient } from "@/lib/supabase/anon";
import {
    resolveReferenceItem,
    getActiveListingsForCatalog,
    getMoldTimelineData,
    getCatalogPhotos,
    getCatalogCounts,
    getReferenceMarket,
    getReferenceMarketHistory,
} from "@/app/actions/reference-pages";
import {
    buildEbaySearchUrl,
    EBAY_AFFILIATE_DISCLOSURE,
    EBAY_AFFILIATE_REL,
} from "@/lib/utils/ebayAffiliate";
import GlossaryLink from "@/components/GlossaryLink";
import EbaySignalCard, { type EbaySignalView } from "@/components/reference/EbaySignalCard";
import MoldTimeline from "@/components/reference/MoldTimeline";
import { getMoldCustoms } from "@/lib/catalog/moldCustoms";
import { deriveAttribution } from "@/lib/catalog/taxonomy";
import ViewBeacon from "@/components/metrics/ViewBeacon";

interface Props {
    params: Promise<{ maker: string; slug: string }>;
}

// This page renders via createAnonClient (cookie-less) end to end — the
// global <Header> reads the session cookie, but Header rendering doesn't
// force *this* route dynamic; only a page's own use of the cookie-based
// server client would. That cookie-free data path is what makes build-time
// SSG + daily ISR safe here (see generateStaticParams + revalidate below).
// The DB load is additionally wrapped in unstable_cache in reference-pages.ts
// (each read cached ~1h) so on-demand renders of the long tail don't
// re-query per hit.

export const revalidate = 86400; // 24h ISR
export const dynamicParams = true; // long tail renders on demand, then caches

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

/**
 * Prebuild a bounded top-N of the most-relevant reference pages at build time
 * so they're served from the static/ISR cache from the first request instead
 * of a cold on-demand render. Ranked by collector (owner) count via the
 * existing anon-safe batch RPC get_catalog_stats (migration 134) — the same
 * aggregate already used on /catalog — so this adds no new DB objects.
 * Everything here goes through the cookie-less createAnonClient, matching the
 * page's own data path. Never throws: any DB hiccup just yields an empty
 * params list and dynamicParams + ISR cover every page on first request.
 */
export async function generateStaticParams(): Promise<{ maker: string; slug: string }[]> {
    try {
        const supabase = createAnonClient();

        // Page through all catalog rows (mirrors sitemap.ts's pattern) — cheap,
        // anon-readable columns only.
        const PAGE = 1000;
        const rows: { id: string; maker_slug: string | null; slug: string | null }[] = [];
        for (let from = 0; from < 20_000; from += PAGE) {
            const { data, error } = await supabase
                .from("catalog_items")
                .select("id, maker_slug, slug")
                .range(from, from + PAGE - 1);
            if (error || !data || data.length === 0) break;
            rows.push(...(data as { id: string; maker_slug: string | null; slug: string | null }[]));
            if (data.length < PAGE) break;
        }

        const withSlugs = rows.filter((r) => r.maker_slug && r.slug);
        if (withSlugs.length === 0) return [];

        // Rank by collector count, batching get_catalog_stats to stay under
        // RPC/payload limits.
        const CHUNK = 500;
        const ownerCounts = new Map<string, number>();
        const rpc = supabase.rpc.bind(supabase) as unknown as (
            fn: string,
            args: { p_ids: string[] },
        ) => Promise<{ data: { catalog_id: string; owner_count: number }[] | null }>;
        for (let i = 0; i < withSlugs.length; i += CHUNK) {
            const chunk = withSlugs.slice(i, i + CHUNK);
            const { data } = await rpc("get_catalog_stats", { p_ids: chunk.map((r) => r.id) });
            for (const row of data ?? []) {
                ownerCounts.set(row.catalog_id, Number(row.owner_count) || 0);
            }
        }

        const TOP_N = 300;
        const ranked = withSlugs
            .slice()
            .sort((a, b) => (ownerCounts.get(b.id) ?? 0) - (ownerCounts.get(a.id) ?? 0))
            .slice(0, TOP_N);

        return ranked.map((r) => ({ maker: r.maker_slug as string, slug: r.slug as string }));
    } catch {
        // Never block the build over a ranking query — ISR covers the rest.
        return [];
    }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { maker, slug } = await params;
    const item = await resolveReferenceItem(maker, slug);
    // notFound() HERE, not just in the page body: metadata resolves
    // before the response head flushes, so this is what makes a missing
    // model a real HTTP 404. The page-body notFound() alone produced a
    // soft-404 (200 + "Model Not Found") on every bad slug in
    // production — poison for exactly the Google crawl traffic the
    // reference pages exist to catch.
    if (!item) notFound();

    const attrs = item.attributes ?? {};
    const year = attrs.release_year_start ? ` (${attrs.release_year_start})` : "";
    const title = `${catalogDisplayName(item.maker, item.title)} — value & collector info`;
    const description = `${item.title}${year} by ${item.maker}${item.scale ? `, ${item.scale}` : ""}. See specs, photos, current listings, and Blue Book value on Model Horse Hub — the community model-horse catalog.`;
    const canonical = `${APP_URL}/reference/${item.maker_slug}/${item.slug}`;
    const photos = await getCatalogPhotos(item.id, 1);

    return {
        title,
        description,
        alternates: { canonical },
        openGraph: {
            title,
            description,
            url: canonical,
            type: "article",
            siteName: "Model Horse Hub",
            ...(photos[0]
                ? { images: [{ url: photos[0].url, width: 800, height: 600, alt: item.title }] }
                : {}),
        },
        twitter: {
            card: photos[0] ? "summary_large_image" : "summary",
            title,
            description,
            ...(photos[0] ? { images: [photos[0].url] } : {}),
        },
    };
}

/**
 * The eBay asking-price signal for one model, or null. Null when there is
 * no signal, when migration 196 has not landed, or when a member has an
 * ACTIVE wrong-model flag on it — a disputed signal is hidden the moment
 * it is disputed, not after review.
 */
async function getEbaySignalForReference(catalogItemId: string): Promise<EbaySignalView | null> {
    try {
        const supabase = createAnonClient();
        const { data: flag } = await supabase
            .from("catalog_price_signal_flags" as never)
            .select("id")
            .eq("catalog_item_id", catalogItemId)
            .eq("status", "active")
            .limit(1);
        if ((flag ?? []).length > 0) return null;

        const { data, error } = await supabase
            .from("catalog_price_signals" as never)
            .select("asking_low, asking_median, asking_high, sample_size, observed_at, listings")
            .eq("catalog_item_id", catalogItemId)
            .maybeSingle();
        if (error || !data) return null;
        const row = data as unknown as {
            asking_low: number; asking_median: number; asking_high: number;
            sample_size: number; observed_at: string;
            listings: { title: string; price: number; url: string }[] | null;
        };
        const rawListings = Array.isArray(row.listings) ? row.listings : [];
        const listings = rawListings.filter(
            (l) => l && typeof l.url === "string" && l.url.startsWith("http") &&
                   typeof l.title === "string" && Number.isFinite(Number(l.price)),
        );

        // The asking-price series (197). Starts as a single point the day
        // the ledger lands and grows a point a week; the card decides how
        // much of a trend that is worth showing. Pre-197 the query errors
        // and the card simply gets no history.
        let history: { observedOn: string; askingMedian: number }[] = [];
        try {
            const { data: hist } = await supabase
                .from("catalog_price_history" as never)
                .select("observed_on, asking_median")
                .eq("catalog_item_id", catalogItemId)
                .order("observed_on", { ascending: true })
                .limit(730);
            history = ((hist ?? []) as unknown as { observed_on: string; asking_median: number }[])
                .filter((h) => h && typeof h.observed_on === "string" && Number.isFinite(Number(h.asking_median)))
                .map((h) => ({ observedOn: h.observed_on, askingMedian: Number(h.asking_median) }));
        } catch {
            /* pre-197 */
        }

        return {
            askingLow: Number(row.asking_low),
            askingMedian: Number(row.asking_median),
            askingHigh: Number(row.asking_high),
            sampleSize: row.sample_size,
            observedAt: row.observed_at,
            listings,
            history,
        };
    } catch {
        return null;
    }
}

function fmtLabel(key: string): string {
    if (key === "retail_price") return "Original retail";
    // Generic Title Case reads wrong for these two: "Run Type" is
    // redundant next to its own value ("Run: Web Special" is how the
    // hobby says it) and "Run Count" sounds like a tally of runs.
    if (key === "run_type") return "Run";
    if (key === "run_count") return "Pieces made";
    return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Attribute values that deserve more than String(v). */
function fmtAttrValue(key: string, v: unknown): string {
    if (key === "retail_price") {
        const n = Number(v);
        return Number.isFinite(n) ? `$${n.toFixed(2)}` : String(v);
    }
    // Run sizes are stored as plain digit strings ("2500"); four+ digits
    // are unreadable without separators. Locale pinned so the server
    // render and the client hydration can never disagree.
    if (key === "run_count") {
        const n = Number(v);
        return Number.isInteger(n) && n > 0 ? n.toLocaleString("en-US") : String(v);
    }
    return String(v);
}

/** Price tag relative to the Blue Book median. */
function medianTag(price: number | null, median: number): { text: string; over: boolean } | null {
    if (!price || !median) return null;
    const pct = Math.round(((price - median) / median) * 100);
    if (pct <= -5) return { text: `${Math.abs(pct)}% under median`, over: false };
    if (pct >= 5) return { text: `${pct}% over`, over: true };
    return { text: "at median", over: false };
}

export default async function ReferencePage({ params }: Props) {
    const { maker, slug } = await params;
    const item = await resolveReferenceItem(maker, slug);
    if (!item) notFound();

    const isMold = item.item_type === "plastic_mold";

    // Everything in parallel — all anon-safe / aggregate-only and cookie-free,
    // so this page statically generates + ISR-caches. Per-user state (the
    // "already wanted?" check) is fetched client-side by WantButton.
    const [counts, market, marketHistory, listings, photos, moldTimeline, customs, ebaySignal] =
        await Promise.all([
            getCatalogCounts(item.id),
            getReferenceMarket(item.id),
            getReferenceMarketHistory(item.id),
            getActiveListingsForCatalog(item.id),
            getCatalogPhotos(item.id, 8),
            isMold ? getMoldTimelineData(item.id) : Promise.resolve(null),
            isMold ? getMoldCustoms(item.id) : Promise.resolve([]),
            getEbaySignalForReference(item.id),
        ]);

    // Product JSON-LD — built only from data the page already fetched above
    // (no additional queries). AggregateOffer/additionalProperty are included
    // only when that data is present.
    const productJsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: item.title,
        brand: { "@type": "Brand", name: item.maker },
        url: `${APP_URL}${referenceHref(item)}`,
        ...(photos[0] ? { image: photos[0].url } : {}),
        additionalProperty: [
            {
                "@type": "PropertyValue",
                name: "Collector count",
                value: counts.collectors,
            },
        ],
        ...(market
            ? {
                  offers: {
                      "@type": "AggregateOffer",
                      priceCurrency: "USD",
                      lowPrice: Math.round(market.lowestPrice),
                      highPrice: Math.round(market.highestPrice),
                      offerCount: market.transactionVolume,
                  },
              }
            : {}),
    };

    const attrs = item.attributes ?? {};
    const missingLabels = missingFieldLabels(item);
    const chip = (label: string, value: unknown, glossary?: { anchor: string; term: string }) =>
        value != null && value !== "" ? (
            <span className="rounded-full border border-input bg-muted px-3 py-1 text-sm text-secondary-foreground">
                {label} <b className="text-foreground">{String(value)}</b>
                {glossary && <GlossaryLink anchor={glossary.anchor} term={glossary.term} />}
            </span>
        ) : null;

    // Finish jargon → its glossary definition (OF / CM / AR are the
    // hobby's densest shorthand for outsiders).
    const finishGlossary = (finish: unknown): { anchor: string; term: string } | undefined => {
        const f = String(finish ?? "").toLowerCase();
        if (f === "of" || f.includes("original finish")) return { anchor: "of", term: "OF — Original Finish" };
        if (f === "cm" || f.includes("custom")) return { anchor: "cm", term: "CM — Custom" };
        if (f === "ar" || f.includes("resin")) return { anchor: "ar", term: "AR — Artist Resin" };
        return undefined;
    };

    // Attribution split: a person (Artist) and/or a company
    // (Manufacturer) — derived until migration 156's columns flow
    // through this select. The sculptor attribute is surfaced AS the
    // Artist row, so it's excluded from the generic attribute loop.
    const attribution = deriveAttribution({
        item_type: item.item_type,
        maker: item.maker,
        sculptor: (attrs as Record<string, unknown>).sculptor as string | null | undefined,
        artist: item.artist,
        manufacturer: item.manufacturer,
    });
    // Original retail sits BESIDE the market figures, never inside them:
    // MSRP is what the maker charged once, the Blue Book is what collectors
    // actually paid. Averaging a list price into sale data would corrupt the
    // median and quietly break the claim that these numbers come from real
    // completed sales. Shown together, they tell the appreciation story.
    const retailRaw = Number((attrs as Record<string, unknown>).retail_price);
    const retailPrice = Number.isFinite(retailRaw) && retailRaw > 0 ? retailRaw : null;
    const appreciation =
        retailPrice && market?.medianPrice
            ? (() => {
                  const pct = Math.round(((market.medianPrice - retailPrice) / retailPrice) * 100);
                  if (pct >= 5) return { text: `+${pct.toLocaleString()}% vs today`, up: true };
                  if (pct <= -5) return { text: `${pct.toLocaleString()}% vs today`, up: false };
                  return { text: "about the same today", up: false };
              })()
            : null;

    const specRows: [string, string][] = [
        ...(attribution.manufacturer
            ? [["Manufacturer", attribution.manufacturer] as [string, string]]
            : []),
        ...(attribution.artist ? [["Artist", attribution.artist] as [string, string]] : []),
        ["Scale", item.scale ?? "—"],
        ...Object.entries(attrs)
            .filter(
                ([k, v]) =>
                    v != null &&
                    v !== "" &&
                    k !== "source" &&
                    k !== "source_id" &&
                    k !== "sculptor" &&
                    // Prose renders as its own section, never as a spec row.
                    k !== "registry_notes",
            )
            .map(([k, v]) => [fmtLabel(k), fmtAttrValue(k, v)] as [string, string]),
    ];

    // The annotated registry: curator-reviewed prose. Facts live in the
    // spec rows; this is the knowledge that doesn't fit a field.
    const registryNotes =
        typeof attrs.registry_notes === "string" && attrs.registry_notes.trim()
            ? attrs.registry_notes.trim()
            : null;

    // Breadcrumb structured data: Registry → maker → model. Google shows
    // the hierarchy under the result instead of a bare URL.
    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Registry", item: `${APP_URL}/reference` },
            { "@type": "ListItem", position: 2, name: item.maker, item: `${APP_URL}/reference/${item.maker_slug}` },
            { "@type": "ListItem", position: 3, name: item.title },
        ],
    };

    return (
        <FocusLayout noHeader>
            <ViewBeacon entityType="reference" entityId={item.id} />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <CatalogSubMasthead
                icon={isMold ? "🗿" : "🐴"}
                title={item.title}
                subtitle={
                    <>
                        by{" "}
                        {item.maker_slug ? (
                            <Link
                                href={`/reference/${item.maker_slug}`}
                                className="underline decoration-dotted hover:decoration-solid"
                                style={{ color: "inherit" }}
                            >
                                {item.maker}
                            </Link>
                        ) : (
                            item.maker
                        )}
                        {isMold ? " · Mold" : ""}
                    </>
                }
                backHref="/catalog"
                backLabel="Reference Catalog"
            />

            <div className="flex flex-col gap-8">
                {/* HERO */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,360px)_1fr]">
                    <ReferencePhotoGallery
                        photos={photos}
                        alt={item.title}
                        contextLabel={
                            isMold
                                ? "a collector’s finish on this mold"
                                : "contributed by a collector who owns this model"
                        }
                    />

                    <div className="flex flex-col gap-4">
                        <div className="text-sm font-bold tracking-widest text-forest uppercase">
                            {item.maker_slug ? (
                                <Link
                                    href={`/reference/${item.maker_slug}`}
                                    className="text-forest hover:underline"
                                >
                                    {item.maker}
                                </Link>
                            ) : (
                                item.maker
                            )}
                            {item.scale ? ` · ${item.scale}` : ""}
                            {isMold ? " · Mold" : ""}
                        </div>
                        {isMold && (
                            <p className="rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-secondary-foreground">
                                This is a <b className="text-foreground">mold</b>
                                <GlossaryLink anchor="mold-release" term="Mold vs. release" /> (the sculpture).
                                Collectors finish it in many different colors, so the photos below are a range of
                                finishes — not a single model.
                            </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {chip("Year", attrs.release_year_start)}
                            {chip("Finish", attrs.finish, finishGlossary(attrs.finish))}
                            {chip("Material", attrs.material)}
                            {chip("Run", attrs.run_count)}
                            {chip("Model #", attrs.model_number)}
                        </div>

                        <p className="text-secondary-foreground">
                            <b className="text-foreground tabular-nums">{counts.collectors.toLocaleString()}</b>{" "}
                            collector{counts.collectors === 1 ? "" : "s"}{" "}
                            {isMold ? "have a horse on this mold" : "have this in their stable"}.
                        </p>

                        <div className="flex flex-wrap items-center gap-3">
                            <Button asChild>
                                <Link href={`/add-horse?catalog=${item.id}`}>＋ Add to your stable</Link>
                            </Button>
                            <a
                                href={buildEbaySearchUrl(
                                    item.title,
                                    item.maker,
                                    (attrs as Record<string, string>).model_number ?? null,
                                )}
                                target="_blank"
                                rel={EBAY_AFFILIATE_REL}
                                className="text-sm text-secondary-foreground underline decoration-dotted hover:text-foreground"
                            >
                                🔎 Find one on eBay ↗
                            </a>
                        </div>
                        <p className="m-0 text-xs text-muted-foreground">{EBAY_AFFILIATE_DISCLOSURE}</p>
                    </div>
                </div>

                {/* BLUE BOOK TEASER */}
                <section>
                    <h2 className="mb-3 font-serif text-xl font-bold text-foreground">
                        Blue Book value
                        <GlossaryLink anchor="blue-book" term="Blue Book" />
                    </h2>
                    <div className="overflow-hidden rounded-xl border border-input bg-card shadow-sm">
                        {market ? (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr]">
                                    <div className="border-b border-input p-5 sm:border-r sm:border-b-0">
                                        <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                                            {isMold ? "Sale range" : "Median sale"}
                                        </div>
                                        <div className="mt-1 text-4xl font-extrabold tabular-nums text-foreground">
                                            {isMold
                                                ? `$${Math.round(market.lowestPrice)}–$${Math.round(market.highestPrice)}`
                                                : `$${Math.round(market.medianPrice).toLocaleString()}`}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {isMold ? "varies by finish" : "from completed sales"}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 p-5">
                                        <div>
                                            <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                                                {isMold ? "Typical" : "Recent range"}
                                            </div>
                                            <div className="text-lg font-bold tabular-nums text-foreground">
                                                {isMold
                                                    ? `$${Math.round(market.medianPrice).toLocaleString()}`
                                                    : `$${Math.round(market.lowestPrice)}–$${Math.round(market.highestPrice)}`}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                                                Sales logged
                                            </div>
                                            <div className="text-lg font-bold tabular-nums text-foreground">
                                                {market.transactionVolume}
                                            </div>
                                        </div>
                                        {retailPrice !== null && (
                                            <div className="col-span-2 border-t border-input pt-3">
                                                <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                                                    Original retail
                                                </div>
                                                <div className="flex flex-wrap items-baseline gap-x-2">
                                                    <span className="text-lg font-bold tabular-nums text-foreground">
                                                        ${retailPrice.toFixed(2)}
                                                    </span>
                                                    {appreciation && (
                                                        <span
                                                            className={`text-sm font-semibold ${appreciation.up ? "text-forest" : "text-muted-foreground"}`}
                                                        >
                                                            {appreciation.text}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    what it cost new — not part of the sale figures
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 border-t border-input px-5 py-3">
                                    {/* /market is public — the old 🔒 "Members" pill was a
                                        false gate. Honest link, no Pro language: nothing on
                                        /market is Pro-gated today. */}
                                    <span className="text-sm text-secondary-foreground">
                                        Full price data &amp; recent sales on the Blue Book
                                    </span>
                                    <Link
                                        href="/market"
                                        className="ml-auto text-sm font-bold whitespace-nowrap text-forest hover:underline"
                                    >
                                        See market data →
                                    </Link>
                                </div>
                                {/* Blue Book PRO — the Pro sales page's first feature,
                                    previously mounted NOWHERE (found during the
                                    first-customer verification run). Resolves the
                                    viewer's tier client-side so this ISR page stays
                                    cacheable; free viewers get the upgrade teaser. */}
                                <div className="border-t border-input p-5">
                                    <BlueBookProCharts
                                        catalogId={item.id}
                                        title={item.title}
                                        historicalData={marketHistory}
                                        averagePrice={(market.lowestPrice + market.highestPrice) / 2}
                                        medianPrice={market.medianPrice}
                                        transactionVolume={market.transactionVolume}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="p-5 text-secondary-foreground">
                                No sales logged yet.{" "}
                                <Link href="/market" className="text-forest hover:underline">
                                    Track this model in the Blue Book →
                                </Link>
                            </div>
                        )}
                    </div>
                </section>

                {/* ON EBAY RIGHT NOW — asking prices with receipts. Kept as
                    its own section, never merged into the Blue Book above:
                    the Blue Book is (will be) SOLD data; this is what
                    sellers are ASKING today, and the two must stay
                    verbally and visually distinct forever. */}
                {ebaySignal && ebaySignal.listings.length > 0 && (
                    <section>
                        <h2 className="mb-3 font-serif text-xl font-bold text-foreground">
                            On eBay right now
                        </h2>
                        <EbaySignalCard catalogItemId={item.id} signal={ebaySignal} />
                    </section>
                )}

                {/* FOR SALE NOW */}
                {listings.length > 0 && (
                    <section>
                        <h2 className="mb-3 font-serif text-xl font-bold text-foreground">
                            For sale now{" "}
                            <span className="text-sm font-normal text-muted-foreground">
                                ({listings.length} active)
                            </span>
                        </h2>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {listings.map((l) => {
                                const tag = market ? medianTag(l.price, market.medianPrice) : null;
                                return (
                                    <div
                                        key={l.id}
                                        className="flex flex-col gap-2 rounded-xl border border-input bg-card p-4 shadow-sm"
                                    >
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-xl font-extrabold tabular-nums text-foreground">
                                                {l.price != null ? `$${l.price}` : "Open to offers"}
                                            </span>
                                            {tag && (
                                                <span
                                                    className="text-xs font-bold"
                                                    style={{
                                                        color: tag.over
                                                            ? "var(--color-warning)"
                                                            : "var(--color-success, var(--color-forest))",
                                                    }}
                                                >
                                                    {tag.text}
                                                </span>
                                            )}
                                        </div>
                                        {l.notes && (
                                            <div className="line-clamp-2 text-sm text-secondary-foreground">
                                                {l.notes}
                                            </div>
                                        )}
                                        <div className="text-sm text-muted-foreground">@{l.ownerAlias}</div>
                                        <Link
                                            href={`/community/${l.id}`}
                                            className="mt-1 rounded-lg border border-forest py-2 text-center text-sm font-bold text-forest hover:bg-forest hover:text-white"
                                        >
                                            View listing ›
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* REGISTRY NOTES — the annotated registry. Community
                    prose through the same suggest→review pipeline as every
                    field; plain text, whitespace preserved, no markup. */}
                {registryNotes && (
                    <section>
                        <h2 className="mb-1 font-serif text-xl font-bold text-foreground">
                            Registry notes
                        </h2>
                        <p className="mb-2 text-xs text-muted-foreground">
                            Written by the community, reviewed by curators.{" "}
                            <Link href={`/catalog/${item.id}?suggest=true`} className="text-forest hover:underline">
                                Improve these notes →
                            </Link>
                        </p>
                        <div className="rounded-xl border border-input bg-card px-5 py-4 text-[0.95rem] leading-relaxed whitespace-pre-line text-secondary-foreground">
                            {registryNotes}
                        </div>
                    </section>
                )}

                {/* RELEASES ON THIS MOLD — the Ledger timeline (decade
                    shelves, variation folds, price chips, undated shelf).
                    Replaced the alphabetical grid, which capped at 60. */}
                {isMold && moldTimeline && (
                    <MoldTimeline data={moldTimeline} maker={item.maker} />
                )}

                {/* CUSTOMS OF THIS MOLD (Taxonomy v2 — customs are horses,
                    not catalog rows; the mold page gathers the public ones) */}
                {isMold && customs.length > 0 && (
                    <section>
                        <h2 className="mb-1 font-serif text-xl font-bold text-foreground">
                            Customs of this mold{" "}
                            <span className="text-sm font-normal text-muted-foreground">
                                ({customs.length})
                            </span>
                        </h2>
                        <p className="mb-3 text-sm text-secondary-foreground">
                            One sculpture, many hands — public customs collectors have made
                            from this mold.
                        </p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                            {customs.map((c) => (
                                <Link
                                    key={c.horseId}
                                    href={`/community/${c.horseId}`}
                                    className="flex flex-col overflow-hidden rounded-lg border border-input bg-card no-underline transition-colors hover:border-forest"
                                >
                                    {c.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={c.imageUrl}
                                            alt={c.customName}
                                            loading="lazy"
                                            className="aspect-square w-full object-cover"
                                        />
                                    ) : (
                                        <span
                                            className="flex aspect-square w-full items-center justify-center bg-muted text-3xl"
                                            aria-hidden="true"
                                        >
                                            🎨
                                        </span>
                                    )}
                                    <span className="flex flex-col gap-0.5 px-3 py-2">
                                        <span className="truncate text-sm font-semibold text-foreground">
                                            {c.customName}
                                        </span>
                                        {c.finishingArtist && (
                                            <span className="truncate text-xs text-muted-foreground">
                                                by {c.finishingArtist}
                                                {c.finishingArtistVerified ? " ✓" : ""}
                                            </span>
                                        )}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* WANTED BAR */}
                <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-[color:var(--color-warning)] bg-[color:var(--color-warning)]/5 px-5 py-4">
                    <span className="text-2xl">🎯</span>
                    <div className="min-w-[220px] flex-1">
                        <div className="font-bold text-foreground">
                            {isMold ? "Want one on this mold?" : "Want this model?"} Add it to your want list.
                        </div>
                        <div className="text-sm text-secondary-foreground">
                            Owners get a private nudge that you’re looking — even if it isn’t listed.
                        </div>
                    </div>
                    {counts.wanters > 0 && (
                        <span className="text-sm text-secondary-foreground">
                            <b className="text-foreground tabular-nums">{counts.wanters}</b> want this
                        </span>
                    )}
                    <WantButton catalogId={item.id} />
                </div>

                {/* DETAILS */}
                <section>
                    <h2 className="mb-3 font-serif text-xl font-bold text-foreground">Details</h2>
                    <div className="overflow-x-auto rounded-xl border border-input bg-card shadow-sm">
                        <table className="w-full border-collapse text-sm">
                            <tbody>
                                {specRows.map(([k, v], i) => (
                                    <tr key={k} className={i % 2 ? "bg-muted/40" : ""}>
                                        <td className="w-2/5 px-4 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                            {k}
                                        </td>
                                        <td className="px-4 py-2.5 font-semibold text-foreground">{v}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* The gaps, named. A sparse entry used to read as a dead
                        end; naming what is missing turns it into a request.
                        The catalog's defect is emptiness — no colour on ~5,000
                        rows, no year on ~3,600 — and the people who know these
                        answers are the ones reading this page. */}
                    {missingLabels.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                            This entry is missing{" "}
                            <strong className="font-semibold text-foreground">
                                {missingLabels.slice(0, 4).join(", ").toLowerCase()}
                                {missingLabels.length > 4 ? ` and ${missingLabels.length - 4} more` : ""}
                            </strong>
                            . Know any of them?{" "}
                            <Link href={`/catalog/${item.id}?suggest=true`} className="underline hover:no-underline">
                                Fill in what you know
                            </Link>
                            .
                        </p>
                    )}
                    {/* Cite the record. Facts here come from the hobby's published
                        reference and the makers' own archives; descriptions are
                        written here. Members correcting an entry beats any import. */}
                    <p className="mt-2 text-xs text-muted-foreground">
                        Facts from the hobby's published record and the makers' archives —{" "}
                        <Link href="/faq#collecting" className="underline hover:no-underline">
                            where our information comes from
                        </Link>
                        . Spot an error?{" "}
                        {/* This pointed at /catalog/suggestions/new — the NEW
                            ENTRY form — for its first day. A member clicking
                            "suggest a correction" landed on "Suggest a New
                            Catalog Entry" with 17 blank fields. The correction
                            path is the entry's own page with the edit modal
                            open. */}
                        <Link href={`/catalog/${item.id}?suggest=true`} className="underline hover:no-underline">
                            Suggest a correction
                        </Link>
                        .
                    </p>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm">
                        <Link href={`/catalog/${item.id}?suggest=true`} className="text-secondary-foreground hover:text-foreground">
                            ✎ Suggest an edit
                        </Link>
                        <Link href="/catalog/changelog" className="text-secondary-foreground hover:text-foreground">
                            📋 Change history
                        </Link>
                    </div>
                </section>
            </div>
        </FocusLayout>
    );
}
