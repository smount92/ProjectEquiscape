import type { Metadata } from "next";
import Link from "next/link";
import FocusLayout from "@/components/layouts/FocusLayout";
import CatalogSubMasthead from "@/components/catalog/CatalogSubMasthead";

import { getMakerIndex } from "@/app/actions/maker-hubs";

// Maker index — /reference lists every maker in the catalog with counts,
// each linking to its hub. Same anon-safe cookie-less data path + flag +
// daily ISR as the rest of the reference surface. One cached grouped scan
// (getMakerIndex) is the only data this page touches.

export const revalidate = 86400; // 24h ISR

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

export async function generateMetadata(): Promise<Metadata> {
    const title = "Model Horse Makers — Reference Catalog | Model Horse Hub";
    const description =
        "Browse the reference catalog by maker: Breyer, Peter Stone, artist resins, and more. The community-maintained record of every model, with specs, photos, and Blue Book values.";
    const canonical = `${APP_URL}/reference`;
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

export default async function ReferenceIndexPage() {
    const makers = await getMakerIndex();
    const total = makers.reduce((sum, m) => sum + m.count, 0);

    const collectionJsonLd = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Model Horse Makers",
        url: `${APP_URL}/reference`,
        description: `Reference catalog of ${total.toLocaleString()} model horses across ${makers.length} makers.`,
        hasPart: makers.slice(0, 20).map((m) => ({
            "@type": "CollectionPage",
            name: `${m.maker} Model Horses`,
            url: `${APP_URL}/reference/${m.makerSlug}`,
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
                title="Browse by Maker"
                subtitle={
                    <>
                        {total.toLocaleString()} models · {makers.length} maker
                        {makers.length === 1 ? "" : "s"}
                    </>
                }
                backHref="/catalog"
                backLabel="Reference Catalog"
            />

            <div className="flex flex-col gap-6">
                <p className="m-0 max-w-[62ch] text-secondary-foreground">
                    The reference catalog is the community-maintained record of every model —
                    Breyer, Stone, artist resins, and beyond. Pick a maker to browse its molds,
                    releases, and Blue Book values.
                </p>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {makers.map((m) => (
                        <Link
                            key={m.makerSlug}
                            href={`/reference/${m.makerSlug}`}
                            className="flex items-baseline justify-between gap-3 rounded-lg border border-input bg-card px-4 py-3 no-underline transition-colors hover:border-forest"
                        >
                            <span className="font-semibold text-foreground">{m.maker}</span>
                            <span className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
                                {m.count.toLocaleString()} model{m.count === 1 ? "" : "s"}
                            </span>
                        </Link>
                    ))}
                </div>

                <p className="m-0 text-sm text-secondary-foreground">
                    Looking for a specific model?{" "}
                    <Link href="/catalog" className="font-bold text-forest hover:underline">
                        Search the full catalog →
                    </Link>
                </p>
            </div>
        </FocusLayout>
    );
}
