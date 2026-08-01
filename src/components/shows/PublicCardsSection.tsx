/**
 * Public passport — "MHH Qualification Cards" section (Wave 2).
 *
 * Async server component wrapper: fetches a PUBLIC horse's live
 * cards through the anon-safe get_public_horse_cards RPC (migration
 * 141) and renders the exact same brass-plaque section the private
 * passport uses, so a buyer sees the record the seller sees. Each
 * plaque links to /cards/[code] for independent verification.
 *
 * Renders NOTHING (no wrapper, no gap) when the horse has no live
 * cards, the horse is not public, or the RPC does not exist yet —
 * the owner applies migrations by hand, and this section must never
 * break the live passport while 141 is pending.
 */

import QualificationCardsSection from "@/components/shows/QualificationCardsSection";
import { getPublicHorseCards } from "@/lib/shows/publicCards";

export default async function PublicCardsSection({ horseId }: { horseId: string }) {
    const cards = await getPublicHorseCards(horseId);
    if (cards.length === 0) return null;
    return (
        <div className="animate-fade-in-up mt-8">
            <QualificationCardsSection cards={cards} />
        </div>
    );
}
