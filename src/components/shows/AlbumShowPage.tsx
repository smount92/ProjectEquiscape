/**
 * THE ALBUM SHOW PAGE (Mock A): photos first, program second.
 * The public /shows/[id] page for v2 shows — payloads are
 * getPublicShow / getMyShowEntries / getShowGallery /
 * getShowChampions, structured top to bottom:
 *
 *   1. Compact leather masthead — title, host line, ONE status line
 *      with a Details disclosure (AlbumMasthead).
 *   2. Sticky CTA row — brass "Enter this show" → "Pick your class"
 *      → the existing EnterClassDialog flow (AlbumCtaRow).
 *   3. The ENTRY RIBBON — every entry at a glance, funneling into
 *      the per-class rooms (EntryRibbon).
 *   4. #entries — My Entries + readiness + the program accordion
 *      under #program (AlbumEntrySection).
 *   5. About + Rules cards, unchanged vocabulary.
 *   On completed shows the champions strip renders ABOVE the ribbon.
 */

import Link from "next/link";
import HandlerBanner from "@/components/shows/HandlerBanner";
import { notFound } from "next/navigation";

import {
    getMyEntrantHorses,
    getMyShowEntries,
    getPublicShow,
    getShowGallery,
} from "@/app/actions/shows-v2";
import { getShowChampions } from "@/app/actions/shows-v2-ring";
import { getShowFollowState } from "@/app/actions/show-follow";
import { GALLERY_STATUSES, RESULTS_STATUSES, type ShowGalleryData } from "@/lib/shows/gallery";
import type { EntrantHorse, MyShowEntry } from "@/lib/shows/public";
import { getShowRole } from "@/lib/shows/queries";
import type { ShowChampionsData } from "@/lib/shows/ring";
import type { StaffRole } from "@/lib/shows/types";
import { createClient } from "@/lib/supabase/server";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import RichText from "@/components/RichText";
import AlbumCtaRow from "@/components/shows/AlbumCtaRow";
import AlbumEntrySection from "@/components/shows/AlbumEntrySection";
import AlbumMasthead from "@/components/shows/AlbumMasthead";
import EntryRibbon from "@/components/shows/EntryRibbon";
import { StaffBanner } from "@/components/shows/StaffBanner";
import { buildShowJsonLd } from "@/lib/shows/showJsonLd";
import ShowChampions from "@/components/shows/ShowChampions";

export default async function AlbumShowPage({ showId }: { showId: string }) {
    // Auth is OPTIONAL — anon browsers read everything, authed
    // viewers additionally get their entries + the entry flow.
    // WAVE 1: the show tree and "who is asking" are independent.
    const supabase = await createClient();
    const [result, { data: { user } }] = await Promise.all([
        getPublicShow({ showId }),
        supabase.auth.getUser(),
    ]);

    // Bad id, missing show, and drafts all land here.
    if (!result.success) notFound();
    const { show, divisions, entryCount } = result;
    const showJsonLd = buildShowJsonLd(show);

    // WAVE 2: five independent reads that used to run one after another
    // on a page anon visitors are hitting right now. Every gate below is
    // the one that used to guard its await, so a skipped read is still
    // never issued.
    //
    // THE WALL's feed — online shows only, from entries_open onward
    // (live shows have no entry photos by design). The blind rule
    // lives in getShowGallery: a blind payload carries no owner
    // identities, and the wall never re-derives them.
    // Champions — published results only, both modes.
    const [
        entriesResult,
        horsesResult,
        roleResult,
        galleryResult,
        championsResult,
        followState,
    ] = await Promise.all([
        user ? getMyShowEntries({ showId }) : null,
        user && show.status === "entries_open" ? getMyEntrantHorses() : null,
        user ? getShowRole(supabase, showId, user.id) : null,
        show.mode === "online" && GALLERY_STATUSES.includes(show.status)
            ? getShowGallery({ showId })
            : null,
        RESULTS_STATUSES.includes(show.status) ? getShowChampions({ showId }) : null,
        // Runs for anon too: the answer decides whether the Follow
        // control renders at all (migration 184 feature detection), and
        // an anon visitor gets the sign-in-to-follow affordance.
        getShowFollowState(showId),
    ]);

    let myEntries: MyShowEntry[] = [];
    if (entriesResult?.success) myEntries = entriesResult.entries;
    let horses: EntrantHorse[] = [];
    if (horsesResult?.success) horses = horsesResult.horses;
    let staffRole: StaffRole | null = null;
    if (roleResult && !("error" in roleResult)) staffRole = roleResult.role;
    let gallery: ShowGalleryData | null = null;
    if (galleryResult?.success) gallery = galleryResult.gallery;
    let champions: ShowChampionsData | null = null;
    if (championsResult?.success) champions = championsResult.champions;

    const liveEntryCount = myEntries.filter((e) => e.status !== "scratched").length;

    return (
        <ExplorerLayout frameless noHeader>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(showJsonLd) }}
            />
            <div className="flex flex-col gap-5">
                <AlbumMasthead show={show} entryCount={entryCount} />

                <AlbumCtaRow
                    showId={showId}
                    showTitle={show.title}
                    mode={show.mode}
                    status={show.status}
                    authed={!!user}
                    divisions={divisions}
                    horses={horses}
                    myEntryCount={liveEntryCount}
                    showYear={show.showYear}
                    showIsQualifying={show.isMhhQualifying}
                    followSupported={followState.supported}
                    isFollowing={followState.isFollowing}
                />

                {staffRole && <StaffBanner show={show} role={staffRole} />}

                {/* #results — notification deep-links land here; the
                    champions strip sits ABOVE the wall by design. */}
                {champions && (
                    <div id="results" className="scroll-mt-32">
                        <ShowChampions champions={champions} />
                    </div>
                )}

                {/* #gallery — the at-a-glance ENTRY RIBBON funneling
                    into class rooms (the wall stopped scaling past ~30
                    entries). Online shows only, like the legacy gallery. */}
                {show.mode === "online" && (
                    <div id="gallery" className="scroll-mt-32">
                        {gallery ? (
                            <EntryRibbon showId={showId} gallery={gallery} />
                        ) : (
                            <div className="ledger-card">
                                <span className="ledger-tab">Entry Album</span>
                                <p className="text-sm text-muted-foreground">
                                    The album fills up once entries open — every entry photo
                                    lands here.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                <HandlerBanner showId={showId} />
                {show.isMhhQualifying && (
                    <p className="text-sm text-muted-foreground">
                        🏅 This show is <b>MHH Sanctioned</b> — placings here earn{" "}
                        <b>Championship Series season points</b>, and 1st &amp; 2nd in
                        qualifying classes with enough competition mint{" "}
                        <b>qualification cards</b> that travel with the horse and count toward
                        permanent titles.{" "}
                        <Link
                            href="/shows/rules"
                            className="text-forest underline decoration-dotted hover:decoration-solid"
                        >
                            Full rules
                        </Link>
                        .
                    </p>
                )}

                {/* #entries — entry/scratch/class-change notifications
                    land here; the program accordion lives inside
                    under #program. */}
                <div id="entries" className="flex scroll-mt-32 flex-col gap-5">
                    <AlbumEntrySection
                        showId={showId}
                        mode={show.mode}
                        status={show.status}
                        divisions={divisions}
                        myEntries={myEntries}
                        horses={horses}
                        authed={!!user}
                        showYear={show.showYear}
                    showIsQualifying={show.isMhhQualifying}
                    />
                </div>

                {show.aboutMd && (
                    <section
                        id="about"
                        className="ledger-card scroll-mt-32"
                        aria-labelledby="show-about-heading"
                    >
                        <span className="ledger-tab" id="show-about-heading">
                            About this show
                        </span>
                        <RichText content={show.aboutMd} />
                    </section>
                )}

                {show.rulesMd && (
                    <section
                        id="rules"
                        className="ledger-card scroll-mt-32"
                        aria-labelledby="show-rules-heading"
                    >
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
