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

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { getAdminClient } from "@/lib/supabase/admin";
import { showsV2Enabled } from "@/lib/shows/flags";
import { resolveShowRoute } from "@/lib/shows/resolver";
import { getAliases } from "@/lib/shows/queries";
import LegacyShowPage from "./LegacyShowPage";
import PublicShowV2Page from "@/components/shows/PublicShowV2Page";

// force-dynamic stays: PublicShowV2Page itself reads the viewer's session
// (supabase.auth.getUser() — see src/components/shows/PublicShowV2Page.tsx)
// to populate the authed-only "My Entries" panel, and the legacy branch
// (LegacyShowPage) redirects anon visitors to /login outright. Both reads
// are cookie-bound, so this route can't be ISR'd without breaking those
// panels/redirects — see PERF-8 investigation notes below.
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

const GENERIC_METADATA: Metadata = {
    title: "Show",
    description: "Show details, classlist, entries, and results.",
};

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    const canonical = `${APP_URL}/shows/${id}`;

    // Cookie-less anon client — metadata must never introduce a session-
    // bound read (that would defeat any future caching of this segment).
    const anon = createAnonClient();
    const target = await resolveShowRoute(anon, id, showsV2Enabled());

    if (target === "v2") {
        const { data: show } = await anon
            .from("shows")
            .select("title, mode, host_id, venue_name, show_date, entries_open_at, entries_close_at, status")
            .eq("id", id)
            .maybeSingle();
        if (!show || show.status === "draft") return GENERIC_METADATA;

        const aliases = await getAliases(anon, [show.host_id as string]);
        const hostAlias =
            aliases instanceof Map ? (aliases.get(show.host_id as string) ?? "unknown") : "unknown";

        const fmt = (iso: string | null) =>
            iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;

        const dateBit =
            show.mode === "live"
                ? fmt(show.show_date as string | null)
                    ? ` on ${fmt(show.show_date as string | null)}`
                    : ""
                : fmt(show.entries_open_at as string | null) && fmt(show.entries_close_at as string | null)
                  ? ` — entries open ${fmt(show.entries_open_at as string | null)} through ${fmt(show.entries_close_at as string | null)}`
                  : "";

        const title = `${show.title}`;
        const description = `${show.mode === "live" ? "Live show" : "Online photo show"} hosted by @${hostAlias}${dateBit}.`;

        return {
            title,
            description,
            alternates: { canonical },
            openGraph: { title, description, url: canonical, type: "website", siteName: "Model Horse Hub" },
        };
    }

    // Legacy: `events` RLS is authed-only, so fetching for public metadata
    // needs the cookie-less admin client — same pattern already used for
    // public metadata in getPublicShowResults (src/app/actions/shows.ts).
    const admin = getAdminClient();
    const { data: event } = await admin
        .from("events")
        .select("name, starts_at, show_status, users!created_by(alias_name)")
        .eq("id", id)
        .maybeSingle();
    if (!event) return GENERIC_METADATA;

    const ev = event as {
        name: string;
        starts_at: string | null;
        show_status: string;
        users: { alias_name: string } | { alias_name: string }[] | null;
    };
    const hostAlias = Array.isArray(ev.users) ? ev.users[0]?.alias_name : ev.users?.alias_name;
    const title = `${ev.name}`;
    const description = `${ev.show_status === "closed" ? "Results" : "Entries"} for ${ev.name}${hostAlias ? ` hosted by @${hostAlias}` : ""}.`;

    return {
        title,
        description,
        alternates: { canonical },
        openGraph: { title, description, url: canonical, type: "website", siteName: "Model Horse Hub" },
    };
}

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
