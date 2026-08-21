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
 * Deliberately a server component with no interactive parts: the Show
 * Ring's HorseRecordChip opens a dialog through getMarketHorseRecord,
 * which calls requireAuth() and would fail for exactly the logged-out
 * buyer this front door exists to convert. The record here is a static
 * chip; one click reaches the real thing.
 */

import Link from "next/link";

import TrustedBadge from "@/components/TrustedBadge";
import { Badge } from "@/components/ui/badge";
import { finishBadgeClass } from "@/lib/stable/badges";
import { getThumbUrl } from "@/lib/utils/imageUrl";
import { listingPriceLabel } from "@/lib/market/listingFilters";
import { recordChipLabel, verifiedChipLabel } from "@/lib/market/recordSummary";
import type { MarketListing } from "@/app/market/listings";

const NOTES_PREVIEW_CHARS = 72;

export default function MarketListingCard({ listing }: { listing: MarketListing }) {
    const priceLabel = listingPriceLabel(listing.tradeStatus, listing.listingPrice);
    const isForSale = listing.tradeStatus === "For Sale";
    const recordLabel = recordChipLabel(listing.recordSummary);
    const verifiedLabel = verifiedChipLabel(listing.recordSummary);
    const notes = listing.marketplaceNotes?.trim();

    return (
        <div className="flex flex-col">
            <Link
                href={`/community/${listing.id}`}
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

                    {/* The differentiator. Absent when the horse has no
                        record — never a hollow "0 placings". */}
                    {recordLabel && (
                        <div className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-warning bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
                            <span>🏆 {recordLabel}</span>
                            {verifiedLabel && (
                                <span className="text-success">· ✅ {verifiedLabel}</span>
                            )}
                        </div>
                    )}

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
