/**
 * Phase E2 — /shows/host/[id]/ring/board: THE ANNOUNCER BOARD.
 *
 * Deliberately PUBLIC (no auth): this page is meant to be
 * projected at the venue and shared to entrants' phones. It shows
 * only class names and placed results — the same data the public
 * results page publishes — and the RLS public-read policies (118)
 * gate every row. The proxy allows the /shows subtree through;
 * every other /shows page enforces its own auth server-side.
 */

import { notFound } from "next/navigation";

import { getRingBoard } from "@/app/actions/shows-v2-ring";
import { showsV2Enabled } from "@/lib/shows/flags";
import RingBoard from "@/components/shows/RingBoard";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Ring Board — Model Horse Hub",
    description: "Now judging, on deck, and the latest results.",
};

export default async function RingBoardPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    if (!showsV2Enabled()) notFound();

    const { id } = await params;
    const result = await getRingBoard({ showId: id });
    // Missing/draft shows and online shows have no board.
    if (!result.success) notFound();

    return <RingBoard initial={result.board} />;
}
