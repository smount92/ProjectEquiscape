import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import FocusLayout from "@/components/layouts/FocusLayout";
import CatalogSubMasthead from "@/components/catalog/CatalogSubMasthead";
import { referenceHref, referencePagesEnabled } from "@/lib/catalog/referenceUrl";
import { getMakerIndex, getMakerMolds, getMakerRecent } from "@/app/actions/maker-hubs";

interface Props {
    params: Promise<{ maker: string }>;
}

// Maker hub — the landing page for "<maker> model horses". Same anon-safe,
// cookie-less data path as the reference leaf pages (createAnonClient +
// unstable_cache in maker-hubs.ts), so daily ISR applies. Bounded queries
// only: the shared maker index (one cached paged scan) plus two per-maker
// queries — never a per-item loop.

export const revalidate = 86400; // 24h ISR
export const dynamicParams = true;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    if (!referencePagesEnabled()) return { title: "Not Found" };
    const { maker } = await params;
    const summary = (await getMakerIndex()).find((m) => m.makerSlug === maker);
    if (!summary) return { title: "Maker Not Found" };

    const title = `${summary.maker} Model Horses — Reference & Values | Model Horse Hub`;
    const description = `Every ${summary.maker} model on record: ${summary.count.toLocaleString()} molds and releases with specs, collector photos, and Blue Book values on Model Horse Hub — the community model-horse catalog.`;
    const canonical = `${APP_URL}/reference/${summary.makerSlug}`;

    return {
        title,
        description,
        alternates: { canonical },
        openGraph: {
            title,
            description,
            url: canonical,
            type: "website",
            siteName: "Model Horse Hub",
        },
        twitter: { card: "summary", title, description },
    };
}

export default async function MakerHubPage({ params }: Props) {
    // Ships dark with the rest of the reference surface: 404 until
    // NEXT_PUBLIC_REFERENCE_PAGES=1.
    if (!referencePagesEnabled()) notFound();

    const { maker } = await params;
    const index = await getMakerIndex();
    const summary = index.find((m) => m.makerSlug === maker);
    if (!summary) notFound();

    const [molds, recent] = await Promise.all([getMakerMolds(maker), getMakerRecent(maker, 12)]);
    const otherMakers = index.filter((m) => m.makerSlug !== maker).slice(0, 12);
    const catalogSearchHref = `/catalog?maker=${encodeURIComponent(summary.maker)}`;

    // CollectionPage JSON-LD from data already fetched — no extra queries.
    const collectionJsonLd = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${summary.maker} Model Horses`,
        url: `${APP_URL}/reference/${summary.makerSlug}`,
        description: `Reference catalog of ${summary.count.toLocaleString()} ${summary.maker} models.`,
        hasPart: molds.slice(0, 20).map((m) => ({
            "@type": "Product",
            name: m.title,
            brand: { "@type": "Brand", name: summary.maker },
            url: `${APP_URL}${referenceHref({ id: m.id, maker: summary.maker, title: m.title, maker_slug: m.makerSlug, slug: m.slug })}`,
        })),
    };

    return (
        <FocusLayout noHeader>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
            />
            <CatalogSubMasthead
                icon="🏷️"
                title={summary.maker}
                subtitle={
                    <>
                        {summary.count.toLocaleString()} model{summary.count === 1 ? "" : "s"} on
                        record
                    </>
                }
                backHref="/reference"
                backLabel="All Makers"
            />

            <div className="flex flex-col gap-8">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                    <p className="m-0 text-secondary-foreground">
                        The community-maintained record of every{" "}
                        <b className="text-foreground">{summary.maker}</b> model —{" "}
                        <b className="text-foreground tabular-nums">
                            {summary.count.toLocaleString()}
                        </b>{" "}
                        entr{summary.count === 1 ? "y" : "ies"} and counting.
                    </p>
                    <Link
                        href={catalogSearchHref}
                        className="text-sm font-bold whitespace-nowrap text-forest hover:underline"
                    >
                        Search {summary.maker} in the catalog →
                    </Link>
                </div>

                {/* MOLDS */}
                {molds.length > 0 && (
                    <section>
                        <h2 className="mb-3 font-serif text-xl font-bold text-foreground">
                            Molds{" "}
                            <span className="text-sm font-normal text-muted-foreground">
                                ({molds.length})
                            </span>
                        </h2>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {molds.map((m) => (
                                <Link
                                    key={m.id}
                                    href={referenceHref({
                                        id: m.id,
                                        maker: summary.maker,
                                        title: m.title,
                                        maker_slug: m.makerSlug,
                                        slug: m.slug,
                                    })}
                                    className="flex items-baseline justify-between gap-3 rounded-lg border border-input bg-card px-4 py-3 no-underline transition-colors hover:border-forest"
                                >
                                    <span className="font-semibold text-foreground">{m.title}</span>
                                    {m.releaseCount > 0 && (
                                        <span className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
                                            {m.releaseCount} release{m.releaseCount === 1 ? "" : "s"}
                                        </span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* RECENT ADDITIONS */}
                {recent.length > 0 && (
                    <section>
                        <h2 className="mb-3 font-serif text-xl font-bold text-foreground">
                            Recent additions
                        </h2>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {recent.map((r) => (
                                <Link
                                    key={r.id}
                                    href={referenceHref({
                                        id: r.id,
                                        maker: r.maker,
                                        title: r.title,
                                        maker_slug: r.makerSlug,
                                        slug: r.slug,
                                    })}
                                    className="rounded-lg border border-input bg-card px-4 py-3 font-semibold text-foreground no-underline transition-colors hover:border-forest"
                                >
                                    {r.title}
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* OTHER MAKERS */}
                {otherMakers.length > 0 && (
                    <section>
                        <h2 className="mb-3 font-serif text-xl font-bold text-foreground">
                            More makers
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {otherMakers.map((m) => (
                                <Link
                                    key={m.makerSlug}
                                    href={`/reference/${m.makerSlug}`}
                                    className="rounded-full border border-input bg-muted px-3 py-1 text-sm text-secondary-foreground no-underline transition-colors hover:border-forest hover:text-foreground"
                                >
                                    {m.maker}{" "}
                                    <span className="text-muted-foreground tabular-nums">
                                        {m.count.toLocaleString()}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </FocusLayout>
    );
}
