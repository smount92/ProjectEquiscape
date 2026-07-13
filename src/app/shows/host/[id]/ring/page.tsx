/**
 * Phase E2 — /shows/host/[id]/ring: THE LIVE RING CONSOLE.
 * Staff-gated (host/co-host/steward/judge) by getRingConsole; live
 * shows only. Any status renders — the console itself shows
 * friendly run-of-day guidance when the show isn't running yet
 * (recording stays disabled until it is).
 */

import { notFound, redirect } from "next/navigation";

import { getRingConsole } from "@/app/actions/shows-v2-ring";
import { showsV2Enabled } from "@/lib/shows/flags";
import { createClient } from "@/lib/supabase/server";
import CommandCenterLayout from "@/components/layouts/CommandCenterLayout";
import RingConsole from "@/components/shows/RingConsole";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Ring Console",
    description: "Call classes, record placings by leg tag, run the callbacks.",
};

export default async function RingConsolePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    if (!showsV2Enabled()) notFound();

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { id } = await params;
    const result = await getRingConsole({ showId: id });
    // Bad id, missing show, online-mode show, or a non-staff viewer —
    // the ring doesn't exist for them.
    if (!result.success) notFound();

    const { console: data } = result;

    return (
        <CommandCenterLayout
            title={`Ring — ${data.show.title}`}
            description="Leg tags first: tap entries in placing order, split or combine at the table, run the championship callbacks."
            mainContent={<RingConsole data={data} />}
        />
    );
}
