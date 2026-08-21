import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import MarketListingCard from "@/components/market/MarketListingCard";
import MarketListingFilters from "@/components/market/MarketListingFilters";
import { Button } from "@/components/ui/button";
import {
    buildListingHref,
    countActiveListingFilters,
    guideHandoffHref,
    LISTINGS_PAGE_SIZE,
    parseListingFilters,
    parseListingPage,
    type RawSearchParams,
} from "@/lib/market/listingFilters";
import { getMarketListingsPage } from "@/app/market/listings";

/**
 * The marketplace front door.
 *
 * The audit's verdict was "the market is a price guide that can't
 * sell": every for-sale horse existed only as a facet scattered across
 * six other pages, while /market showed aggregate sale statistics. So
 * /market is now the browse — the URL stays (it is in the nav, the
 * sitemap, and every inbound link) and the Blue Book moved intact to
 * /market/guide, linked from here and from every empty state.
 *
 * What makes these listings different from any other model-horse
 * marketplace is on the card: a VERIFIED competitive record beside the
 * asking price. Each card opens the horse's passport, which is the
 * listing page — full trophy case, qualification cards, condition,
 * ownership history, and the message-the-seller flow. Sales still
 * happen off-platform; this is discovery, not checkout.
 */

export const metadata: Metadata = {
    title: "Model Horse Marketplace — Buy Model Horses With Verified Show Records",
    description:
        "Browse model horses for sale from collectors, each with its full passport: verified show records, condition grade, and ownership history. Plus the Blue Book price guide of real completed sales.",
    alternates: { canonical: "/market" },
};

function SellerPointer() {
    return (
        <div className="border-input bg-card/50 rounded-lg border p-6 backdrop-blur-sm">
            <h3 className="mb-1 font-serif text-lg font-bold">Sell from your stable</h3>
            <p className="text-secondary-foreground mb-4 text-sm">
                Open a horse in your stable, choose <strong>Edit</strong>, and set its trade status to
                “For Sale” or “Open to Offers”. Its passport becomes the listing — record, condition and
                all — and it appears here.
            </p>
            <Button asChild variant="outline" size="wide">
                <Link href="/stable">Open your stable →</Link>
            </Button>
        </div>
    );
}

function WantListPointer() {
    return (
        <div className="border-input bg-card/50 rounded-lg border p-6 backdrop-blur-sm">
            <h3 className="mb-1 font-serif text-lg font-bold">Hunting a specific model?</h3>
            <p className="text-secondary-foreground mb-4 text-sm">
                Add it to your Want List and the Matchmaker tells you the moment a collector lists one —
                no refreshing this page every morning.
            </p>
            <Button asChild variant="outline" size="wide">
                <Link href="/wishlist">Open your Want List →</Link>
            </Button>
        </div>
    );
}

function BlueBookPointer() {
    return (
        <div className="border-input bg-card/50 rounded-lg border p-6 backdrop-blur-sm">
            <h3 className="mb-1 font-serif text-lg font-bold">📈 Blue Book price guide</h3>
            <p className="text-secondary-foreground mb-4 text-sm">
                What did this mold actually sell for? Average, median and range for 10,500+ catalog items,
                drawn from completed Model Horse Hub transactions. Free, and never behind a paywall.
            </p>
            <Button asChild variant="outline" size="wide">
                <Link href="/market/guide">Open the Blue Book →</Link>
            </Button>
        </div>
    );
}

export default async function MarketplacePage({
    searchParams,
}: {
    searchParams: Promise<RawSearchParams>;
}) {
    const params = await searchParams;
    const filters = parseListingFilters(params);
    const page = parseListingPage(params);
    const { gated, listings, total, totalListings, viewerIsAuthenticated } =
        await getMarketListingsPage(filters, page);

    const activeCount = countActiveListingFilters(filters);
    const totalPages = Math.max(1, Math.ceil(total / LISTINGS_PAGE_SIZE));
    // Someone followed an old price-guide deep link to /market.
    const guideHandoff = guideHandoffHref(params);

    const subtitle = gated
        ? "Provenance-priced listings from collectors"
        : `${totalListings.toLocaleString()} horse${totalListings === 1 ? "" : "s"} for sale — every one with its passport`;

    return (
        <ExplorerLayout noHeader>
            <PageMasthead icon="🏷️" title="The Marketplace" subtitle={subtitle} />

            <div className="mx-auto max-w-[1100px]">
                {guideHandoff && (
                    <div className="border-input bg-card/60 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm backdrop-blur-sm">
                        <span className="text-secondary-foreground">
                            📈 Looking for sale-price data? The Blue Book moved to its own page — your
                            filters came with it.
                        </span>
                        <Button asChild variant="outline" size="sm">
                            <Link href={guideHandoff}>Open the Blue Book →</Link>
                        </Button>
                    </div>
                )}

                {gated ? (
                    /* No batch read path for seller aliases and show
                       records without a session (see listings.ts) —
                       show the honest teaser rather than a grid of
                       anonymous, record-less photos. */
                    <div className="border-input bg-card rounded-lg border p-10 text-center shadow-md">
                        <div className="mb-4 text-[3rem]">🏷️</div>
                        <h2 className="mb-2 font-serif text-2xl font-bold">
                            Model horses for sale, priced by their record
                        </h2>
                        <p className="text-secondary-foreground mx-auto mb-6 max-w-[520px]">
                            Every listing on Model Horse Hub carries the horse&rsquo;s passport: verified
                            show records, qualification cards, condition grade and ownership history.
                            Create a free account to browse the listings.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <Button asChild size="wide">
                                <Link href="/signup?redirectTo=%2Fmarket">Create a free account</Link>
                            </Button>
                            <Button asChild variant="outline" size="wide">
                                <Link href="/market/guide">Browse the Blue Book price guide →</Link>
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <Suspense fallback={null}>
                            <MarketListingFilters filters={filters} />
                        </Suspense>

                        {listings.length === 0 ? (
                            <div className="border-input bg-card mt-6 rounded-lg border p-12 text-center shadow-md">
                                <div className="mb-4 text-[3rem]">🐎</div>
                                <h3 className="mb-2 font-serif text-xl font-bold">
                                    {activeCount > 0 ? "No listings match those filters" : "No horses listed right now"}
                                </h3>
                                <p className="text-secondary-foreground mx-auto max-w-[440px]">
                                    {activeCount > 0
                                        ? "Try widening the price band or clearing a filter — the marketplace is young and moves fast."
                                        : "The marketplace fills up as collectors set horses For Sale from their stables. In the meantime, the Blue Book has the sale history."}
                                </p>
                                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                                    {activeCount > 0 && (
                                        <Button asChild variant="outline" size="wide">
                                            <Link href={buildListingHref({})}>Clear filters</Link>
                                        </Button>
                                    )}
                                    <Button asChild variant="outline" size="wide">
                                        <Link href="/market/guide">Open the Blue Book →</Link>
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="mt-6 mb-4">
                                    <span className="text-muted-foreground text-sm">
                                        {total.toLocaleString()} listing{total === 1 ? "" : "s"}
                                        {activeCount > 0 ? " matching your filters" : ""}
                                    </span>
                                </div>

                                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                    {listings.map((listing) => (
                                        <MarketListingCard key={listing.id} listing={listing} />
                                    ))}
                                </div>

                                {totalPages > 1 && (
                                    <div className="border-input mt-8 flex flex-wrap items-center justify-between gap-2 border-t pt-6">
                                        {page > 1 ? (
                                            <Button asChild variant="outline" size="wide">
                                                <Link href={buildListingHref(filters, page - 1)}>← Previous</Link>
                                            </Button>
                                        ) : (
                                            <Button variant="outline" size="wide" disabled>
                                                ← Previous
                                            </Button>
                                        )}
                                        <span className="text-muted-foreground text-sm">
                                            Page {page} of {totalPages}
                                        </span>
                                        {page < totalPages ? (
                                            <Button asChild variant="outline" size="wide">
                                                <Link href={buildListingHref(filters, page + 1)}>Next →</Link>
                                            </Button>
                                        ) : (
                                            <Button variant="outline" size="wide" disabled>
                                                Next →
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {!viewerIsAuthenticated && (
                            <div className="border-input bg-card/60 mt-10 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-6 backdrop-blur-sm">
                                <div>
                                    <h3 className="font-serif text-lg font-bold">
                                        Message a seller, save a favourite, get matched
                                    </h3>
                                    <p className="text-secondary-foreground text-sm">
                                        Browsing is open to everyone. A free account adds the Want List
                                        matchmaker and lets you contact collectors directly.
                                    </p>
                                </div>
                                <Button asChild size="wide">
                                    <Link href="/signup?redirectTo=%2Fmarket">Create a free account</Link>
                                </Button>
                            </div>
                        )}
                    </>
                )}

                {/* Cross-links — the two flows that feed this page, and
                    the price guide that justifies its prices. */}
                <div className="mt-10 grid gap-4 md:grid-cols-3">
                    <WantListPointer />
                    <SellerPointer />
                    <BlueBookPointer />
                </div>

                <div className="border-input bg-card/50 mt-6 rounded-lg border p-6 text-xs backdrop-blur-sm">
                    <p>
                        🤝 Model Horse Hub is a discovery marketplace: listings link to the horse&rsquo;s
                        passport and buyers and sellers arrange the sale themselves. We never take a cut,
                        and trust features — verified show records, condition, ownership history — are
                        free for everyone, always.
                    </p>
                </div>
            </div>
        </ExplorerLayout>
    );
}
