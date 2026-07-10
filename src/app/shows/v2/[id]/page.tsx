/**
 * /shows/v2/[id] — RETIRED at the Phase E2 cutover.
 *
 * The interim Phase D path permanently redirects to the canonical
 * /shows/[id] (the resolver renders the v2 page there). Kept so
 * links shared during the beta never break.
 */

import { permanentRedirect } from "next/navigation";

export default async function LegacyV2ShowPath({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    permanentRedirect(`/shows/${id}`);
}
