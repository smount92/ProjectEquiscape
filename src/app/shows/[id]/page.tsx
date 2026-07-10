/**
 * /shows/[id] — THE RESOLVER (Phase E2 cutover).
 *
 * One indexed primary-key lookup decides which system owns the id:
 *   - a v2 show → the v2 public show page (anon-visible, RLS-gated),
 *   - anything else (legacy event id, junk, flag off) → the legacy
 *     events-based page, byte-for-byte unchanged in LegacyShowPage.
 *
 * /shows/v2/[id] permanently redirects here, so old shared links
 * keep working. The legacy page enforces its own login redirect;
 * the v2 page is public by design.
 */

import { createClient } from "@/lib/supabase/server";
import { showsV2Enabled } from "@/lib/shows/flags";
import { resolveShowRoute } from "@/lib/shows/resolver";
import LegacyShowPage from "./LegacyShowPage";
import PublicShowV2Page from "@/components/shows/PublicShowV2Page";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Show — Model Horse Hub",
    description: "Show details, classlist, entries, and results.",
};

export default async function ShowDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const supabase = await createClient();

    const target = await resolveShowRoute(supabase, id, showsV2Enabled());
    if (target === "v2") return <PublicShowV2Page showId={id} />;
    return <LegacyShowPage showId={id} />;
}
