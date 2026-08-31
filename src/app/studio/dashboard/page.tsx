import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
    getArtistCommissions,
    getArtistProfile,
    getSlotUsage,
} from "@/app/actions/art-studio";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import IncomePanel from "@/components/studio/IncomePanel";
import IntakeControls from "@/components/studio/IntakeControls";
import PipelineBoard from "@/components/studio/PipelineBoard";
import { Panel, StudioStatusPill } from "@/components/studio/StudioBits";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { summarizeIncome, type IncomeRow } from "@/lib/studio/income";
import { ballIsWith, slotState } from "@/lib/studio/pipeline";

export const metadata: Metadata = {
    title: "Studio dashboard",
    robots: { index: false },
};

/**
 * THE BUSINESS TRACKER.
 *
 * Three things an artist currently keeps in a spreadsheet: the pipeline
 * (what's on the bench and who owes the next move), the books (what did I
 * earn, which months were good, what's still owed), and intake (am I open,
 * how many slots).
 *
 * v1's dashboard was three counters and a tab strip.
 */
export default async function StudioDashboardPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?redirectTo=%2Fstudio%2Fdashboard");

    const profile = await getArtistProfile(user.id);
    if (!profile) redirect("/studio/setup");

    const [commissions, slotsUsed] = await Promise.all([
        getArtistCommissions(),
        getSlotUsage(user.id),
    ]);

    const slots = slotState(slotsUsed, profile.maxSlots, profile.status);

    const summary = summarizeIncome(
        commissions.map(
            (c): IncomeRow => ({
                id: c.id,
                status: c.status,
                agreedPrice: c.agreedPrice,
                depositAmount: c.depositAmount,
                depositPaid: c.depositPaid,
                finalPaid: c.finalPaid,
                completedAt: c.completedAt,
                createdAt: c.createdAt,
            }),
        ),
    );

    const waitingOnYou = commissions.filter((c) => ballIsWith(c.status) === "artist").length;

    return (
        <ExplorerLayout noHeader>
            <PageMasthead
                icon="🎨"
                title={profile.studioName}
                subtitle={
                    waitingOnYou > 0
                        ? `${waitingOnYou} commission${waitingOnYou === 1 ? "" : "s"} waiting on you`
                        : "Nothing waiting on you"
                }
                actions={
                    <>
                        <Button asChild size="sm">
                            <Link href="/studio/log-work">🖌️ Log past work</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/studio/${profile.studioSlug}`}>View your page</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <Link href="/studio/setup">Settings</Link>
                        </Button>
                    </>
                }
            />

            <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
                <div className="grid gap-6">
                    <PipelineBoard commissions={commissions} />
                    <IncomePanel summary={summary} />
                </div>

                <div className="grid gap-6 self-start">
                    <Panel
                        title="Intake"
                        icon="🚪"
                        actions={<StudioStatusPill status={slots.effectiveStatus} />}
                    >
                        <IntakeControls
                            status={profile.status}
                            maxSlots={profile.maxSlots}
                            waitlistOpen={profile.waitlistOpen}
                            statusNote={profile.statusNote}
                            slotsUsed={slotsUsed}
                        />
                    </Panel>

                    <Panel title="Your terms" icon="📜">
                        <p className="text-secondary-foreground mb-4 text-sm leading-relaxed">
                            These attach to every quote you send, and the version a commissioner
                            accepts is frozen onto their commission — so changing them here never
                            rewrites an agreement you already made.
                        </p>
                        <Button asChild variant="outline" size="wide">
                            <Link href="/studio/setup#terms">Edit terms & rates →</Link>
                        </Button>
                    </Panel>
                </div>
            </div>
        </ExplorerLayout>
    );
}
