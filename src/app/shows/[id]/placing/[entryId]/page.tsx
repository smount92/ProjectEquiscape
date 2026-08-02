/**
 * /shows/[id]/placing/[entryId] — SHARE-YOUR-PLACING (growth).
 *
 * Every published placing becomes a beautiful public page: the
 * winner posts the link, the rosette OG card (./opengraph-image)
 * markets the platform in every feed preview, and the page itself
 * converts the curious visitor.
 *
 * PUBLIC BY DESIGN, but only AFTER results publish:
 * loadPublicPlacing returns null — and this page 404s — for
 * unpublished shows, scratched entries, and unplaced entries. The
 * route is anon-reachable through the existing /shows prefix in
 * proxy.ts (verified: "/shows" sits in publicPaths and every
 * subtree page enforces its own gate — this one's gate is the
 * results-published check).
 *
 * The session client is used for the viewer's auth state (the
 * anon CTA) and the data read alike — the read touches only
 * anon-visible rows, so anon and authed visitors see the same
 * placing. Metadata uses the cookie-less anon client per the show
 * page's precedent.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { showsV2Enabled } from "@/lib/shows/flags";
import { placeLabel } from "@/lib/shows/placings";
import { placingShareDescription, placingShareTitle } from "@/lib/shows/placingShare";
import { loadPublicPlacing } from "@/lib/shows/placingShareRead";
import { createAnonClient } from "@/lib/supabase/anon";
import { createClient } from "@/lib/supabase/server";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PlacingCelebration from "@/components/shows/PlacingCelebration";

// The CTA block reads the viewer's session — cookie-bound, so this
// route renders per-request like the rest of the shows subtree.
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

const GENERIC_METADATA: Metadata = {
    title: "Show placing",
    description: "A placing on Model Horse Hub, the digital home for the model horse hobby.",
};

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string; entryId: string }>;
}): Promise<Metadata> {
    const { id, entryId } = await params;
    if (!showsV2Enabled()) return GENERIC_METADATA;

    // Cookie-less anon client — metadata must never introduce a
    // session-bound read (same rule as /shows/[id]).
    const anon = createAnonClient();
    const data = await loadPublicPlacing(anon, id, entryId);
    if (!data) return GENERIC_METADATA;

    const facts = {
        horseName: data.horseName,
        place: data.place,
        className: data.className,
        showTitle: data.show.title,
        totalEntries: data.totalEntries,
        mode: data.show.mode,
    };
    const title = placingShareTitle(facts);
    const description = placingShareDescription(facts);
    const canonical = `${APP_URL}/shows/${id}/placing/${entryId}`;

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
        // ./opengraph-image.tsx supplies the rosette card art; this
        // opts shared links into the large-preview card.
        twitter: { card: "summary_large_image" },
    };
}

export default async function PlacingSharePage({
    params,
}: {
    params: Promise<{ id: string; entryId: string }>;
}) {
    const { id, entryId } = await params;
    if (!showsV2Enabled()) notFound();

    const supabase = await createClient();
    const data = await loadPublicPlacing(supabase, id, entryId);
    // Unpublished shows, scratched entries, participation rows, bad
    // ids — all one 404. Nothing pre-publish leaks through here.
    if (!data) notFound();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // JSON-LD: the placing as a structured achievement — search
    // engines see horse + place + show without parsing prose.
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Event",
        name: `${data.show.title} — ${data.className}`,
        description: `${data.horseName} placed ${placeLabel(data.place)} in ${data.className}.`,
        eventStatus: "https://schema.org/EventScheduled",
        ...(data.show.resultDate ? { endDate: data.show.resultDate } : {}),
    };

    return (
        <ExplorerLayout frameless noHeader>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <PlacingCelebration
                data={data}
                authed={!!user}
                shareUrl={`${APP_URL}/shows/${id}/placing/${entryId}`}
            />
        </ExplorerLayout>
    );
}
