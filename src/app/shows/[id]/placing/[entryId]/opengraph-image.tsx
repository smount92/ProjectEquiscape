/**
 * /shows/[id]/placing/[entryId]/opengraph-image — the ROSETTE CARD.
 *
 * The link-preview art that does the marketing: leather ground,
 * the placing's ribbon-colored rosette, the horse large, place
 * label huge, MHH wordmark. Card JSX lives in
 * src/lib/shows/placingOgCard.tsx; this route only fetches.
 *
 * Same cookie-less anon-client pattern as the show OG image —
 * never a session-bound read. loadPublicPlacing enforces the
 * public-data gate (results published, entry live and placed);
 * anything short of that renders the generic brand card, so an
 * unpublished placing can never leak through a crawler's fetch.
 */

import { ImageResponse } from "next/og";

import { placeLabel, ribbonHex } from "@/lib/shows/placings";
import { PLACING_OG_SIZE, PlacingGenericCard, PlacingOgCard } from "@/lib/shows/placingOgCard";
import { placingFieldLine } from "@/lib/shows/placingShare";
import { loadOgPhotoDataUri, loadPublicPlacing } from "@/lib/shows/placingShareRead";
import { createAnonClient } from "@/lib/supabase/anon";

export const size = PLACING_OG_SIZE;
export const contentType = "image/png";
export const alt = "A show placing on Model Horse Hub";

export default async function OpengraphImage({
    params,
}: {
    params: Promise<{ id: string; entryId: string }>;
}) {
    const { id, entryId } = await params;

    const anon = createAnonClient();
    const data = await loadPublicPlacing(anon, id, entryId);
    if (!data) {
        return new ImageResponse(<PlacingGenericCard />, size);
    }

    // Entry photos are webp — inline a JPEG rendition (satori
    // can't decode webp); null falls back to the 🐴 block.
    const photoDataUri = await loadOgPhotoDataUri(data.photoUrl);

    // Result dates are calendar dates — UTC keeps the printed day
    // honest (same rule as the show OG card).
    const dateLabel = data.show.resultDate
        ? new Date(data.show.resultDate).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
          })
        : null;

    return new ImageResponse(
        (
            <PlacingOgCard
                horseName={data.horseName}
                placeText={placeLabel(data.place)}
                ribbonColor={ribbonHex(data.place) ?? "#B8860B"}
                place={data.place}
                className={data.className}
                showTitle={data.show.title}
                fieldLine={placingFieldLine(data.place, data.totalEntries)}
                photoUrl={photoDataUri}
                dateLabel={dateLabel}
            />
        ),
        size,
    );
}
