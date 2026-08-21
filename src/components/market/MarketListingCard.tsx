/**
 * Marketplace front door — the provenance listing card.
 *
 * The pitch of this platform in one tile: a photo, an asking price,
 * and the horse's VERIFIED COMPETITIVE RECORD sitting right next to
 * it. No other model-horse marketplace can put those three things on
 * the same card.
 *
 * The card is a link to the passport (/community/[id]) — the passport
 * IS the listing page, carrying the full trophy case, qualification
 * cards, ownership history and the BuyerPanel. Nothing here duplicates
 * that; the card's whole job is to make the passport worth opening.
 *
 * The record chip is the one interactive part, and it sits OUTSIDE the
 * card link so opening the quick-look doesn't navigate. It used to be
 * a static badge here because HorseRecordChip fetched through
 * getMarketHorseRecord, which called requireAuth() and failed for
 * exactly the logged-out buyer this front door exists to convert; it
 * now reads the anon-safe path (marketPublicRecord.ts), so a visitor
 * with no account can open a horse's record right in the grid.
 */

import Link from "next/link";

import HorseRecordChip from "@/components/market/HorseRecordChip";
import TrustedBadge from "@/components/TrustedBadge";
import { Badge } from "@/components/ui/badge";
import { finishBadgeClass } from "@/lib/stable/badges";
import { getThumbUrl } from "@/lib/utils/imageUrl";
import { listingPriceLabel } from "@/lib/market/listingFilters";
import { recordChipLabel } from "@/lib/market/recordSummary";
import type { MarketListing } from "@/app/market/listings";

const NOTES_PREVIEW_CHARS = 72;

export default function MarketListingCard({ listing }: { listing: MarketListing }) {
    const priceLabel = listingPriceLabel(listing.tradeStatus, listing.listingPrice);
    const isForSale = listing.tradeStatus === "For Sale";
    // Empty-state honesty: no record, no chip, no noise.
    const hasRecord = recordChipLabel(listing.recordSummary) !== null;
    const notes = listing.marketplaceNotes?.trim();

    return (
        <div className="flex flex-col">
            <Link
                href={`/community/${listing.id}?from=market`}
                className="group block no-underline"
                aria-label={`${listing.customName} — ${priceLabel}`}
            >
                {/* Photo + price stamp */}
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-input bg-muted">
                    {listing.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={getThumbUrl(listing.thumbnailUrl)}
                            alt={listing.customName}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-3xl opacity-40">
                            🐎
                        </div>
                    )}

                    <span
                        className={`absolute bottom-2 left-2 rounded-full px-2.5 py-1 text-xs font-bold text-white shadow-sm ${
                            isForSale ? "bg-success" : "bg-info"
                        }`}
                    >
                        {isForSale ? "💲" : "🤝"} {priceLabel}
                    </span>

                    {listing.conditionGrade && (
                        <span className="absolute top-2 right-2 rounded-full bg-(--paper-lit) px-2 py-0.5 text-[0.65rem] font-semibold text-secondary-foreground shadow-sm">
                            {listing.conditionGrade}
                        </span>
                    )}
                </div>

                {/* Identity */}
                <div className="mt-3 px-1">
                    <h3 className="truncate font-serif text-lg font-bold text-foreground">
                        {listing.customName}
                    </h3>
                    <p className="truncate text-sm text-secondary-foreground">
                        {listing.refName ?? "Unlisted mold"}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {listing.finishType && (
                            <Badge className={finishBadgeClass(listing.finishType)}>
                                {listing.finishType}
                            </Badge>
                        )}
                        {listing.scale && (
                            <span className="text-xs text-secondary-foreground">{listing.scale}</span>
                        )}
                    </div>

                    {notes && (
                        <p
                            className="mt-2 truncate rounded-md bg-muted px-2 py-1 text-xs text-secondary-foreground"
                            title={notes}
                        >
                            📝{" "}
                            {notes.length > NOTES_PREVIEW_CHARS
                                ? `${notes.slice(0, NOTES_PREVIEW_CHARS)}…`
                                : notes}
                        </p>
                    )}
                </div>
            </Link>

            {/* The differentiator: a verified competitive record beside
                the asking price, one click from the full detail. Outside
                the Link so the dialog opens instead of navigating, and
                absent entirely when the horse has no record. */}
            {hasRecord && listing.recordSummary && (
                <div className="mt-2 px-1">
                    <HorseRecordChip
                        horseId={listing.id}
                        horseName={listing.customName}
                        summary={listing.recordSummary}
                    />
                </div>
            )}

            {/* Seller line — outside the card link so the profile link
                and the trust badge are their own targets. */}
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-input px-1 pt-2.5 text-xs">
                <Link
                    href={`/profile/${encodeURIComponent(listing.ownerAlias)}`}
                    className="truncate text-(--primary) no-underline hover:underline"
                >
                    @{listing.ownerAlias}
                </Link>
                {listing.isTrustedSeller && <TrustedBadge />}
            </div>
        </div>
    );
}
