"use client";

/**
 * Wave 4b — the album's "#entries" body: the viewer's entries +
 * readiness panel (MyEntriesCard / ShowReadinessPanel) and the
 * program accordion under #program (divisions collapsed with counts →
 * the class rows, whose Enter links go to the entry page).
 *
 * Entering lives on /shows/[id]/enter (EnterShowWorkbench) — this
 * section only links there (program Enter, Re-enter). It still owns
 * the self-scratch confirm and the horse refetch behind the readiness
 * panel.
 */

import { useCallback, useMemo, useState } from "react";
import PrintTagsLink from "@/components/shows/PrintTagsLink";
import type { UserTier } from "@/lib/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { scratchEntry } from "@/app/actions/shows-v2";
import { listMyEntrantHorses } from "@/app/actions/show-readiness";
import type { ConsoleClass, ConsoleDivision } from "@/lib/shows/console";
import type { EntrantHorse, MyShowEntry } from "@/lib/shows/public";
import type { ShowMode, ShowStatus } from "@/lib/shows/types";
import ProgramAccordion from "@/components/shows/ProgramAccordion";
import ShowReadinessPanel from "@/components/shows/ShowReadinessPanel";
import {
    classLabel,
    MyEntriesCard,
} from "@/components/shows/ShowEntrySectionParts";
import { useShowToast } from "@/components/shows/useShowToast";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface AlbumEntrySectionProps {
    showId: string;
    mode: ShowMode;
    status: ShowStatus;
    divisions: ConsoleDivision[];
    myEntries: MyShowEntry[];
    horses: EntrantHorse[];
    authed: boolean;
    /** Season for the card-gate badges (defaults to Season 1). */
    showYear?: number | null;
    /** Whether the show is MHH-sanctioned; gates the card-gate badge. */
    showIsQualifying?: boolean;
    /** The viewer's tier, for the Pro-gated tag printer (null = signed out). */
    viewerTier?: UserTier | null;
}

export default function AlbumEntrySection({
    showId,
    mode,
    status,
    divisions,
    showYear,
    showIsQualifying,
    myEntries,
    horses,
    viewerTier = null,
    authed,
}: AlbumEntrySectionProps) {
    const router = useRouter();
    const entriesOpen = status === "entries_open";
    const canEnter = authed && entriesOpen;

    const { showToast, toastNode } = useShowToast();
    const [scratchTarget, setScratchTarget] = useState<MyShowEntry | null>(null);
    const [scratching, setScratching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // The readiness panel makes a horse public mid-visit; refetch so
    // the program's Enter links appear without a reload.
    const [freshHorses, setFreshHorses] = useState<EntrantHorse[] | null>(null);
    const effectiveHorses = freshHorses ?? horses;

    const handleHorsesReady = useCallback(async () => {
        const result = await listMyEntrantHorses();
        if (result.success) setFreshHorses(result.horses);
        router.refresh();
    }, [router]);

    const classById = useMemo(() => {
        const map = new Map<string, ConsoleClass>();
        for (const division of divisions) {
            for (const section of division.sections) {
                for (const cls of section.classes) map.set(cls.id, cls);
            }
        }
        return map;
    }, [divisions]);

    const handleScratch = async () => {
        if (!scratchTarget) return;
        setScratching(true);
        setError(null);
        const result = await scratchEntry({ entryId: scratchTarget.id });
        if (result.success) {
            setScratchTarget(null);
            showToast(`${scratchTarget.horseName} scratched — the entry stays on the record.`);
            router.refresh();
        } else {
            setError(result.error);
        }
        setScratching(false);
    };

    const hasLiveEntry = (classId: string, horseId: string) =>
        myEntries.some(
            (e) => e.classId === classId && e.horseId === horseId && e.status !== "scratched",
        );

    return (
        <>
            {error && scratchTarget === null && (
                <p role="alert" className="text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}

            {authed && myEntries.length > 0 && (
                <MyEntriesCard
                    myEntries={myEntries}
                    classById={classById}
                    entriesOpen={entriesOpen}
                    scratching={scratching}
                    hasLiveEntry={hasLiveEntry}
                    onScratch={(entry) => {
                        setError(null);
                        setScratchTarget(entry);
                    }}
                    // Re-enter renders as a Link when showId is set; this
                    // fallback is never reached on the album page.
                    onReenter={(cls) => router.push(`/shows/${showId}/enter?class=${cls.id}`)}
                    showId={showId}
                />
            )}
            {authed && myEntries.some((e) => e.status !== "scratched") && (
                <PrintTagsLink showId={showId} tier={viewerTier} />
            )}

            {entriesOpen && !authed && (
                <div
                    className="ledger-card flex flex-wrap items-center gap-3 text-sm text-muted-foreground"
                    role="note"
                >
                    <span>Entries are open — sign in to enter your horses.</span>
                    <Button asChild size="sm">
                        <Link href={`/login?redirectTo=${encodeURIComponent(`/shows/${showId}/enter`)}`}>
                            Sign in to enter
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href="/signup">Create free account</Link>
                    </Button>
                </div>
            )}
            {canEnter && effectiveHorses.length === 0 && (
                <ShowReadinessPanel showId={showId} mode={mode} onHorsesReady={handleHorsesReady} />
            )}

            {/* ── The program (accordion) ── */}
            <section
                id="program"
                className="ledger-card scroll-mt-32"
                aria-labelledby="album-program-heading"
            >
                <span className="ledger-tab" id="album-program-heading">
                    Program
                </span>
                <ProgramAccordion
                    divisions={divisions}
                    canEnter={canEnter && effectiveHorses.length > 0}
                    showId={showId}
                    showYear={showYear}
                    showIsQualifying={showIsQualifying}
                />
            </section>

            {/* Self-scratch confirm — same pause, same plain words as
                the legacy layout. */}
            <Dialog
                open={scratchTarget !== null}
                onOpenChange={(next) => {
                    if (!next && !scratching) setScratchTarget(null);
                }}
            >
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>
                            {scratchTarget && `Scratch ${scratchTarget.horseName}?`}
                        </DialogTitle>
                        <DialogDescription>
                            {scratchTarget &&
                                `This withdraws ${scratchTarget.horseName} from ${
                                    classById.get(scratchTarget.classId)
                                        ? classLabel(classById.get(scratchTarget.classId)!)
                                        : "its class"
                                }. Scratching keeps the entry on the record as history — you can re-enter while entries are open, which creates a fresh entry.`}
                        </DialogDescription>
                    </DialogHeader>
                    {error && (
                        <p role="alert" className="text-sm font-semibold text-destructive">
                            {error}
                        </p>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            size="wide"
                            onClick={() => setScratchTarget(null)}
                            disabled={scratching}
                        >
                            Keep the entry
                        </Button>
                        <Button
                            type="button"
                            variant="destructive-outline"
                            size="wide"
                            onClick={handleScratch}
                            disabled={scratching}
                            data-testid="self-scratch-confirm"
                        >
                            {scratching ? "Scratching…" : "Scratch entry"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {toastNode}
        </>
    );
}
