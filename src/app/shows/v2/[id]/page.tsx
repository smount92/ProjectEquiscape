/**
 * Phase D — the PUBLIC show page for shows v2.
 *
 * INTERIM PATH: /shows/v2/[id]. The /shows/[id] slot still belongs
 * to the legacy photo-show detail page until the Phase E cutover
 * retires it — at that point this route moves to /shows/[id] and
 * this one redirects.
 *
 * Anon-visible for every non-draft status (RLS + getPublicShow).
 * Deferred by design (do not build here):
 *  - Show-string / packer integration: legacy show_string_entries
 *    .class_id FKs to legacy event_classes — cross-linking to
 *    show_classes needs a schema decision at the Phase E cutover.
 *  - Community voting UI and all judging: Phase E.
 *  - Fees: manual checklist (fee_info free text below), Phase F.
 */

import { notFound } from "next/navigation";

import { getMyEntrantHorses, getMyShowEntries, getPublicShow } from "@/app/actions/shows-v2";
import { showsV2Enabled } from "@/lib/shows/flags";
import type { EntrantHorse, MyShowEntry, PublicShow } from "@/lib/shows/public";
import { formatStatus } from "@/lib/shows/stateMachine";
import { createClient } from "@/lib/supabase/server";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import RichText from "@/components/RichText";
import ShowEntrySection from "@/components/shows/ShowEntrySection";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Show — Model Horse Hub",
    description: "Show details, classlist, and entries.",
};

function formatDate(iso: string | null, withTime = false): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    });
}

function MastheadFact({ label, value }: { label: string; value: React.ReactNode }) {
    if (value === null || value === undefined || value === "") return null;
    return (
        <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-semibold tracking-wide uppercase opacity-75">{label}</dt>
            <dd className="text-sm">{value}</dd>
        </div>
    );
}

/** Leather masthead (lite): title facts on saddle leather, stitched. */
function ShowMasthead({ show, entryCount }: { show: PublicShow; entryCount: number }) {
    return (
        <section
            className="leather-panel stitched flex flex-col gap-4 rounded-lg p-5 sm:p-6"
            aria-label="Show overview"
        >
            <div className="flex flex-wrap items-center gap-3">
                <span className="stamp text-lg">{formatStatus(show.status)}</span>
                <Badge variant="secondary">
                    {show.mode === "live" ? "Live show" : "Online photo show"}
                </Badge>
                {show.judging === "community_vote" && (
                    <Badge variant="secondary">Community vote</Badge>
                )}
                {show.isMhhQualifying && <Badge>MHH Qualifying</Badge>}
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <MastheadFact label="Host" value={`@${show.hostAlias}`} />
                {show.mode === "live" ? (
                    <>
                        <MastheadFact label="Show date" value={formatDate(show.showDate)} />
                        <MastheadFact label="Venue" value={show.venueName} />
                        <MastheadFact label="Address" value={show.venueAddress} />
                        <MastheadFact
                            label="Entries close"
                            value={formatDate(show.entriesCloseAt, true)}
                        />
                    </>
                ) : (
                    <>
                        <MastheadFact
                            label="Entries open"
                            value={formatDate(show.entriesOpenAt, true)}
                        />
                        <MastheadFact
                            label="Entries close"
                            value={formatDate(show.entriesCloseAt, true)}
                        />
                        <MastheadFact
                            label="Judging ends"
                            value={formatDate(show.judgingEndsAt, true)}
                        />
                    </>
                )}
                <MastheadFact
                    label="Entries"
                    value={entryCount > 0 ? `${entryCount} entr${entryCount === 1 ? "y" : "ies"}` : "None yet"}
                />
                <MastheadFact label="Sanctioning" value={show.sanctioningNote} />
            </dl>
        </section>
    );
}

export default async function PublicShowPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    if (!showsV2Enabled()) notFound();

    const { id } = await params;
    const result = await getPublicShow({ showId: id });
    // Bad id, missing show, and drafts all land here.
    if (!result.success) notFound();
    const { show, divisions, entryCount } = result;

    // Auth is OPTIONAL on this page — anon browsers read everything,
    // authed viewers additionally get their entries + the entry flow.
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    let myEntries: MyShowEntry[] = [];
    let horses: EntrantHorse[] = [];
    if (user) {
        const entriesResult = await getMyShowEntries({ showId: id });
        if (entriesResult.success) myEntries = entriesResult.entries;
        if (show.status === "entries_open") {
            const horsesResult = await getMyEntrantHorses();
            if (horsesResult.success) horses = horsesResult.horses;
        }
    }

    return (
        <ExplorerLayout
            title={show.title}
            description={
                show.mode === "live"
                    ? "A live show — bring the horses, we bring the paperwork."
                    : "An online photo show — enter from your stable."
            }
        >
            <div className="flex flex-col gap-6">
                <ShowMasthead show={show} entryCount={entryCount} />

                <ShowEntrySection
                    mode={show.mode}
                    status={show.status}
                    divisions={divisions}
                    myEntries={myEntries}
                    horses={horses}
                    authed={!!user}
                />

                {show.rulesMd && (
                    <section className="ledger-card" aria-labelledby="show-rules-heading">
                        <span className="ledger-tab" id="show-rules-heading">
                            Rules
                        </span>
                        <RichText content={show.rulesMd} />
                    </section>
                )}

                {show.feeInfo && (
                    <section className="ledger-card" aria-labelledby="show-fees-heading">
                        <span className="ledger-tab" id="show-fees-heading">
                            Fees
                        </span>
                        {/* Fees v1 = manual checklist (LOCKED decision) — the
                            host's free-text instructions; Stripe lands Phase F. */}
                        <p className="text-sm whitespace-pre-wrap text-secondary-foreground">
                            {show.feeInfo}
                        </p>
                    </section>
                )}
            </div>
        </ExplorerLayout>
    );
}
