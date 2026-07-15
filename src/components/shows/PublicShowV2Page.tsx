/**
 * THE PUBLIC SHOW PAGE for shows v2 — a server component shared by
 * the /shows/[id] resolver (Phase E2 cutover). Formerly the body
 * of /shows/v2/[id]/page.tsx (Phase D), which now permanently
 * redirects here.
 *
 * Anon-visible for every non-draft status (RLS + getPublicShow).
 * Phase E2 adds the CHAMPIONS ladder once results publish.
 * Deferred by design (do not build here):
 *  - Show-string / packer integration: legacy show_string_entries
 *    .class_id FKs to legacy event_classes — cross-linking to
 *    show_classes needs a schema decision.
 *  - Fees: manual checklist (fee_info free text, shown above the
 *    entry section so entrants see cost before entering), Phase F.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import {
    getMyEntrantHorses,
    getMyShowEntries,
    getPublicShow,
    getShowGallery,
} from "@/app/actions/shows-v2";
import { getShowChampions } from "@/app/actions/shows-v2-ring";
import { GALLERY_STATUSES, RESULTS_STATUSES, type ShowGalleryData } from "@/lib/shows/gallery";
import type { EntrantHorse, MyShowEntry, PublicShow } from "@/lib/shows/public";
import type { ShowChampionsData } from "@/lib/shows/ring";
import { formatStatus } from "@/lib/shows/stateMachine";
import { createClient } from "@/lib/supabase/server";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import RichText from "@/components/RichText";
import ShowChampions from "@/components/shows/ShowChampions";
import ShowEntryGallery from "@/components/shows/ShowEntryGallery";
import ShowEntrySection from "@/components/shows/ShowEntrySection";
import { Badge } from "@/components/ui/badge";

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
            {/* Explicit leather-text colors: inherited ink is dark in day
                mode and invisible on the leather panel. */}
            <dt className="text-xs font-semibold tracking-wide uppercase text-(--leather-text-muted)">
                {label}
            </dt>
            <dd className="text-sm text-(--leather-text)">{value}</dd>
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
                {/* Lit-paper backing: the forest stamp ink has no contrast
                    directly on leather. */}
                <span className="stamp bg-(--paper-lit) text-lg">{formatStatus(show.status)}</span>
                <Badge variant="secondary">
                    {show.mode === "live" ? "Live show" : "Online photo show"}
                </Badge>
                {show.judging === "community_vote" && (
                    <Badge variant="secondary">Community vote</Badge>
                )}
                {show.isMhhQualifying && <Badge>MHH Qualifying</Badge>}
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <MastheadFact
                    label="Host"
                    value={
                        <Link
                            href={`/profile/${encodeURIComponent(show.hostAlias)}`}
                            className="text-(--leather-text) hover:underline"
                        >
                            @{show.hostAlias}
                        </Link>
                    }
                />
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

/** Event JSON-LD — built only from data PublicShowV2Page already fetched
 *  (no extra queries). https://schema.org/Event */
function buildShowJsonLd(show: PublicShow) {
    const startDate = show.mode === "live" ? show.showDate : show.entriesOpenAt;
    return {
        "@context": "https://schema.org",
        "@type": "Event",
        name: show.title,
        ...(startDate ? { startDate } : {}),
        eventAttendanceMode:
            show.mode === "live"
                ? "https://schema.org/OfflineEventAttendanceMode"
                : "https://schema.org/OnlineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        organizer: { "@type": "Person", name: show.hostAlias },
        location:
            show.mode === "live"
                ? { "@type": "Place", name: show.venueName ?? undefined, address: show.venueAddress ?? undefined }
                : { "@type": "VirtualLocation", url: `${process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com"}/shows/${show.id}` },
    };
}

export default async function PublicShowV2Page({ showId }: { showId: string }) {
    const result = await getPublicShow({ showId });
    // Bad id, missing show, and drafts all land here.
    if (!result.success) notFound();
    const { show, divisions, entryCount } = result;
    const showJsonLd = buildShowJsonLd(show);

    // Auth is OPTIONAL on this page — anon browsers read everything,
    // authed viewers additionally get their entries + the entry flow.
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    let myEntries: MyShowEntry[] = [];
    let horses: EntrantHorse[] = [];
    if (user) {
        const entriesResult = await getMyShowEntries({ showId });
        if (entriesResult.success) myEntries = entriesResult.entries;
        if (show.status === "entries_open") {
            const horsesResult = await getMyEntrantHorses();
            if (horsesResult.success) horses = horsesResult.horses;
        }
    }

    // THE ENTRY GALLERY — online shows only, from entries_open
    // onward. Live shows have no entry photos by design. The blind
    // rule lives in getShowGallery: a blind payload carries no
    // owner identities.
    let gallery: ShowGalleryData | null = null;
    if (show.mode === "online" && GALLERY_STATUSES.includes(show.status)) {
        const galleryResult = await getShowGallery({ showId });
        if (galleryResult.success) gallery = galleryResult.gallery;
    }

    // THE CHAMPIONS LADDER (Phase E2) — published results only,
    // both modes: rosettes for section/division/grand champions.
    let champions: ShowChampionsData | null = null;
    if (RESULTS_STATUSES.includes(show.status)) {
        const championsResult = await getShowChampions({ showId });
        if (championsResult.success) champions = championsResult.champions;
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
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(showJsonLd) }} />
            <div className="flex flex-col gap-6">
                <ShowMasthead show={show} entryCount={entryCount} />

                {champions && <ShowChampions champions={champions} />}

                {show.feeInfo && (
                    <section className="ledger-card" aria-labelledby="show-fees-heading">
                        <span className="ledger-tab" id="show-fees-heading">
                            Fees
                        </span>
                        {/* Fees v1 = manual checklist (LOCKED decision) — the
                            host's free-text instructions; Stripe lands Phase F.
                            Moved above the entry section so entrants see fees
                            BEFORE they enter, not after. */}
                        <p className="text-sm whitespace-pre-wrap text-secondary-foreground">
                            {show.feeInfo}
                        </p>
                    </section>
                )}

                {show.isMhhQualifying && (
                    <p className="text-sm text-muted-foreground">
                        Classes marked &ldquo;qualifying&rdquo; earn digital cards for 1st and 2nd
                        place.
                    </p>
                )}

                <ShowEntrySection
                    showId={showId}
                    mode={show.mode}
                    status={show.status}
                    divisions={divisions}
                    myEntries={myEntries}
                    horses={horses}
                    authed={!!user}
                />

                {gallery && <ShowEntryGallery gallery={gallery} authed={!!user} />}

                {show.aboutMd && (
                    <section className="ledger-card" aria-labelledby="show-about-heading">
                        <span className="ledger-tab" id="show-about-heading">
                            About this show
                        </span>
                        <RichText content={show.aboutMd} />
                    </section>
                )}

                {show.rulesMd && (
                    <section className="ledger-card" aria-labelledby="show-rules-heading">
                        <span className="ledger-tab" id="show-rules-heading">
                            Rules
                        </span>
                        <RichText content={show.rulesMd} />
                    </section>
                )}
            </div>
        </ExplorerLayout>
    );
}
