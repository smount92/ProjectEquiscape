/**
 * Phase E1 — /shows/host/[id]/judge: the online judging queue.
 * Staff-gated (judge / host / co-host) by getJudgeQueue; online
 * expert-judged shows only. Blind judging is server-enforced —
 * the payload carries no owner identities while the blind rule
 * holds.
 */

import { notFound, redirect } from "next/navigation";

import { getJudgeQueue } from "@/app/actions/shows-v2";
import { showsV2Enabled } from "@/lib/shows/flags";
import { createClient } from "@/lib/supabase/server";
import CommandCenterLayout from "@/components/layouts/CommandCenterLayout";
import JudgeQueue from "@/components/shows/JudgeQueue";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Judge Queue",
    description: "Work the classes: photos side by side, tap to place.",
};

export default async function JudgeQueuePage({
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
    const result = await getJudgeQueue({ showId: id });
    // Bad id, missing show, wrong mode/judging, or a viewer without
    // the judge/host/co-host role — the queue doesn't exist for them.
    if (!result.success) notFound();

    const { queue } = result;

    return (
        <CommandCenterLayout
            title={`Judging — ${queue.show.title}`}
            description="Photos side by side. Tap entries in placing order, add critiques, mark each class done."
            mainContent={<JudgeQueue queue={queue} />}
        />
    );
}
