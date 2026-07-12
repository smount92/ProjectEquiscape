import { createAnonClient } from "@/lib/supabase/anon";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import FocusLayout from "@/components/layouts/FocusLayout";
import CatalogSubMasthead from "@/components/catalog/CatalogSubMasthead";
import { Button } from "@/components/ui/button";
import WantButton from "@/components/reference/WantButton";
import ReferencePhotoGallery from "@/components/reference/ReferencePhotoGallery";
import { referenceHref, referencePagesEnabled } from "@/lib/catalog/referenceUrl";
import {
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

// Cookie-free page (all data via the anon client) → statically generated + ISR
// cached. Keeps a full Googlebot crawl of ~11k pages off the hot DB path.
export const revalidate = 3600;

interface CatalogRow {
    id: string;
    item_type: string;
    title: string;
    maker: string;
    maker_slug: string | null;
    slug: string | null;
    scale: string | null;
    attributes: Record<string, unknown> | null;
}

async function resolveItem(makerSlug: string, slug: string): Promise<CatalogRow | null> {
    const supabase = createAnonClient();
    const { data } = await supabase
        .from("catalog_items")
        .select("id, item_type, title, maker, maker_slug, slug, scale, attributes")
        .eq("maker_slug", makerSlug)
        .eq("slug", slug)
        .maybeSingle();
    return (data as CatalogRow | null) ?? null;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { maker, slug } = await params;
    const item = await resolveItem(maker, slug);
    if (!item) return { title: "Model Not Found — Model Horse Hub" };

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
    const item = await resolveItem(maker, slug);
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
                                            href={`/stable/${l.id}`}
                                            className="mt-1 rounded-lg border border-forest py-2 text-center text-sm font-bold text-forest hover:bg-forest hover:text-white"
                                        >
                                            Message seller ›
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
