/**
 * What this member has on the block.
 *
 * Each card opens the horse's passport, which IS the listing page —
 * full record, condition, ownership history and the message-seller
 * flow. That is the marketplace's own contract ("listings link to
 * the horse's passport"), so this strip is a shortcut into /market,
 * never a second, thinner listing surface.
 */

import Link from "next/link";

import { EmptyNote, SectionHeading } from "./ProfileSection";

export interface ForSaleCard {
    id: string;
    customName: string;
    refName: string;
    thumbnailUrl: string | null;
    tradeStatus: string;
    listingPrice: number | null;
}

function priceLabel(card: ForSaleCard): string {
    if (card.listingPrice === null) {
        return card.tradeStatus === "For Sale" ? "For Sale" : "Open to Offers";
    }
    const money = `$${card.listingPrice.toLocaleString("en-US")}`;
    return card.tradeStatus === "For Sale" ? money : `~${money}`;
}

export default function ForSaleStrip({
    alias,
    isOwnProfile,
    cards,
}: {
    alias: string;
    isOwnProfile: boolean;
    cards: ForSaleCard[];
}) {
    return (
        <section className="animate-fade-in-up mt-10" id="for-sale">
            <SectionHeading
                title="🏷️ On the Block"
                note={
                    cards.length > 0 ? (
                        <Link href="/market" className="no-underline hover:underline">
                            browse the marketplace →
                        </Link>
                    ) : undefined
                }
            />

            {cards.length === 0 ? (
                <EmptyNote
                    icon="🤝"
                    title={isOwnProfile ? "Nothing listed right now" : "Nothing for sale today"}
                >
                    {isOwnProfile
                        ? "Set a horse to For Sale or Open to Offers in your stable and its passport becomes the listing — record, condition and all."
                        : `@${alias} isn't selling at the moment. The Want List matchmaker will tell you if that changes.`}
                </EmptyNote>
            ) : (
                <div className="shelfwrap">
                    <div
                        className="shelf-strip"
                        tabIndex={0}
                        role="region"
                        aria-label={`Horses for sale from ${alias}`}
                    >
                        {cards.map((card) => (
                            <Link key={card.id} href={`/community/${card.id}`} className="polaroid w-[200px]">
                                <div className="polaroid-photo">
                                    {card.thumbnailUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={card.thumbnailUrl} alt={card.customName} loading="lazy" />
                                    ) : (
                                        <span>No Photo</span>
                                    )}
                                </div>
                                <div className="polaroid-name">{card.customName}</div>
                                <div className="polaroid-breed">{card.refName}</div>
                                <div className="mt-1 text-center">
                                    <span
                                        className={
                                            card.tradeStatus === "For Sale" ? "stamp stamp-red" : "stamp"
                                        }
                                    >
                                        {priceLabel(card)}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
