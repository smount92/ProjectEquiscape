import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import FocusLayout from "@/components/layouts/FocusLayout";
import CatalogSubMasthead from "@/components/catalog/CatalogSubMasthead";
import { Button } from "@/components/ui/button";
import WantButton from "@/components/reference/WantButton";
import ReferencePhotoGallery from "@/components/reference/ReferencePhotoGallery";
import { referenceHref, referencePagesEnabled } from "@/lib/catalog/referenceUrl";
import { createAnonClient } from "@/lib/supabase/anon";
import {
    resolveReferenceItem,
    getActiveListingsForCatalog,
    getCatalogPhotos,
    getCatalogCounts,
    getChildReleases,
    getReferenceMarket,
} from "@/app/actions/reference-pages";
import { buildEbaySearchUrl } from "@/lib/utils/ebayAffiliate";

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
    if (!referencePagesEnabled()) return [];

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
    if (!item) return { title: "Model Not Found" };

    const attrs = item.attributes ?? {};
    const year = attrs.release_year_start ? ` (${attrs.release_year_start})` : "";
    const title = `${item.maker} ${item.title} — value & collector info`;
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

function fmtLabel(key: string): string {
    return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
    // Ships dark: 404 until NEXT_PUBLIC_REFERENCE_PAGES=1 flips it on.
    if (!referencePagesEnabled()) notFound();

    const { maker, slug } = await params;
    const item = await resolveReferenceItem(maker, slug);
    if (!item) notFound();

    const isMold = item.item_type === "plastic_mold";

    // Everything in parallel — all anon-safe / aggregate-only and cookie-free,
    // so this page statically generates + ISR-caches. Per-user state (the
    // "already wanted?" check) is fetched client-side by WantButton.
    const [counts, market, listings, photos, childReleases] = await Promise.all([
        getCatalogCounts(item.id),
        getReferenceMarket(item.id),
        getActiveListingsForCatalog(item.id),
        getCatalogPhotos(item.id, 8),
        isMold ? getChildReleases(item.id) : Promise.resolve([]),
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
    const chip = (label: string, value: unknown) =>
        value != null && value !== "" ? (
            <span className="rounded-full border border-input bg-muted px-3 py-1 text-sm text-secondary-foreground">
                {label} <b className="text-foreground">{String(value)}</b>
            </span>
        ) : null;

    const specRows: [string, string][] = [
        ["Maker", item.maker],
        ["Scale", item.scale ?? "—"],
        ...Object.entries(attrs)
            .filter(([k, v]) => v != null && v !== "" && k !== "source" && k !== "source_id")
            .map(([k, v]) => [fmtLabel(k), String(v)] as [string, string]),
    ];

    return (
        <FocusLayout noHeader>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
            />
            <CatalogSubMasthead
                icon={isMold ? "🗿" : "🐴"}
                title={item.title}
                subtitle={<>by {item.maker}{isMold ? " · Mold" : ""}</>}
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
                            {item.maker}
                            {item.scale ? ` · ${item.scale}` : ""}
                            {isMold ? " · Mold" : ""}
                        </div>
                        {isMold && (
                            <p className="rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-secondary-foreground">
                                This is a <b className="text-foreground">mold</b> (the sculpture). Collectors
                                finish it in many different colors, so the photos below are a range of finishes —
                                not a single model.
                            </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {chip("Year", attrs.release_year_start)}
                            {chip("Finish", attrs.finish)}
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
                                rel="noopener noreferrer"
                                className="text-sm text-secondary-foreground underline decoration-dotted hover:text-foreground"
                            >
                                🔎 Find one on eBay ↗
                            </a>
                        </div>
                    </div>
                </div>

                {/* BLUE BOOK TEASER */}
                <section>
                    <h2 className="mb-3 font-serif text-xl font-bold text-foreground">Blue Book value</h2>
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
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 border-t border-input px-5 py-3">
                                    <span className="text-sm text-secondary-foreground">
                                        Full price history &amp; trend charts
                                    </span>
                                    <Link
                                        href="/market"
                                        className="ml-auto rounded-full border border-[color:var(--color-warning)] px-3 py-1 text-xs font-bold tracking-wide text-[color:var(--color-warning)] uppercase"
                                    >
                                        🔒 Members
                                    </Link>
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

                {/* RELEASES ON THIS MOLD (mold → versions, Discogs-style) */}
                {isMold && childReleases.length > 0 && (
                    <section>
                        <h2 className="mb-3 font-serif text-xl font-bold text-foreground">
                            Releases on this mold{" "}
                            <span className="text-sm font-normal text-muted-foreground">
                                ({childReleases.length})
                            </span>
                        </h2>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {childReleases.map((r) => (
                                <Link
                                    key={r.id}
                                    href={referenceHref({
                                        id: r.id,
                                        maker: item.maker,
                                        title: r.title,
                                        maker_slug: r.makerSlug,
                                        slug: r.slug,
                                    })}
                                    className="flex flex-col rounded-lg border border-input bg-card px-4 py-3 no-underline transition-colors hover:border-forest"
                                >
                                    <span className="font-semibold text-foreground">{r.title}</span>
                                    {r.color && <span className="text-sm text-muted-foreground">{r.color}</span>}
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
                    <div className="overflow-hidden rounded-xl border border-input bg-card shadow-sm">
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
