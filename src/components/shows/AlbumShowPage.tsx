/**
 * Wave 4b — THE ALBUM SHOW PAGE (Mock A): photos first, program
 * second. The flag-gated sibling of PublicShowV2Page — same route,
 * same payloads (getPublicShow / getMyShowEntries / getShowGallery /
 * getShowChampions), restructured top to bottom:
 *
 *   1. Compact leather masthead — title, host line, ONE status line
 *      with a Details disclosure (AlbumMasthead).
 *   2. Sticky CTA row — brass "Enter this show" → "Pick your class"
 *      → the existing EnterClassDialog flow (AlbumCtaRow).
 *   3. Filter chips + THE WALL — every entry across all classes as
 *      one photo wall, one lightbox reel (AlbumWall).
 *   4. #entries — My Entries + readiness + the program accordion
 *      under #program (AlbumEntrySection).
 *   5. About + Rules cards, unchanged vocabulary.
 *   On completed shows the champions strip renders ABOVE the wall.
 *
 * Renders ONLY behind NEXT_PUBLIC_SHOW_PAGE_V3 (the route branches;
 * flag off leaves PublicShowV2Page byte-identical). No new server
 * reads — this page consumes exactly what the legacy page fetches.
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
import type { EntrantHorse, MyShowEntry } from "@/lib/shows/public";
import { getShowRole } from "@/lib/shows/queries";
import type { ShowChampionsData } from "@/lib/shows/ring";
import type { StaffRole } from "@/lib/shows/types";
import { createClient } from "@/lib/supabase/server";
import { showsV4Enabled } from "@/lib/shows/flags";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import RichText from "@/components/RichText";
import AlbumCtaRow from "@/components/shows/AlbumCtaRow";
import AlbumEntrySection from "@/components/shows/AlbumEntrySection";
import AlbumMasthead from "@/components/shows/AlbumMasthead";
import AlbumWall from "@/components/shows/AlbumWall";
import EntryRibbon from "@/components/shows/EntryRibbon";
import { buildShowJsonLd, StaffBanner } from "@/components/shows/PublicShowV2Page";
import ShowChampions from "@/components/shows/ShowChampions";

export default async function AlbumShowPage({ showId }: { showId: string }) {
    const result = await getPublicShow({ showId });
    // Bad id, missing show, and drafts all land here.
    if (!result.success) notFound();
    const { show, divisions, entryCount } = result;
    const showJsonLd = buildShowJsonLd(show);

    // Auth is OPTIONAL — anon browsers read everything, authed
    // viewers additionally get their entries + the entry flow.
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    let myEntries: MyShowEntry[] = [];
    let horses: EntrantHorse[] = [];
    let staffRole: StaffRole | null = null;
    if (user) {
        const entriesResult = await getMyShowEntries({ showId });
        if (entriesResult.success) myEntries = entriesResult.entries;
        if (show.status === "entries_open") {
            const horsesResult = await getMyEntrantHorses();
            if (horsesResult.success) horses = horsesResult.horses;
        }
        const roleResult = await getShowRole(supabase, showId, user.id);
        if (!("error" in roleResult)) staffRole = roleResult.role;
    }

    // THE WALL's feed — online shows only, from entries_open onward
    // (live shows have no entry photos by design). The blind rule
    // lives in getShowGallery: a blind payload carries no owner
    // identities, and the wall never re-derives them.
    let gallery: ShowGalleryData | null = null;
    if (show.mode === "online" && GALLERY_STATUSES.includes(show.status)) {
        const galleryResult = await getShowGallery({ showId });
        if (galleryResult.success) gallery = galleryResult.gallery;
    }

    // Champions — published results only, both modes.
    let champions: ShowChampionsData | null = null;
    if (RESULTS_STATUSES.includes(show.status)) {
        const championsResult = await getShowChampions({ showId });
        if (championsResult.success) champions = championsResult.champions;
    }

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
                />

                {staffRole && <StaffBanner show={show} role={staffRole} />}

                {/* #results — notification deep-links land here; the
                    champions strip sits ABOVE the wall by design. */}
                {champions && (
                    <div id="results" className="scroll-mt-32">
                        <ShowChampions champions={champions} />
                    </div>
                )}

                {/* #gallery — v4: the at-a-glance ENTRY RIBBON funneling
                    into class rooms (the wall stopped scaling past ~30
                    entries). Flag off: THE WALL, byte-identical. Online
                    shows only, like the legacy gallery. */}
                {show.mode === "online" && (
                    <div id="gallery" className="scroll-mt-32">
                        {gallery ? (
                            showsV4Enabled() ? (
                                <EntryRibbon showId={showId} gallery={gallery} />
                            ) : (
                                <AlbumWall
                                    showId={showId}
                                    gallery={gallery}
                                    authed={!!user}
                                    hasRules={!!show.rulesMd}
                                />
                            )
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
