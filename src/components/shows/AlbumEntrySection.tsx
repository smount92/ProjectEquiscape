"use client";

/**
 * Wave 4b — the album's "#entries" body: the viewer's entries +
 * readiness panel (the SAME MyEntriesCard/ShowReadinessPanel the
 * legacy layout renders) and the program accordion under #program
 * (divisions collapsed with counts → the existing class rows with
 * Enter buttons).
 *
 * State wiring (enter dialog, self-scratch confirm, horse refetch)
 * mirrors ShowEntrySection — the blocks are shared, the layout is
 * the album's.
 */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { scratchEntry } from "@/app/actions/shows-v2";
import { listMyEntrantHorses } from "@/app/actions/show-readiness";
import type { ConsoleClass, ConsoleDivision } from "@/lib/shows/console";
import type { EntrantHorse, MyShowEntry } from "@/lib/shows/public";
import type { ShowMode, ShowStatus } from "@/lib/shows/types";
import EnterClassDialog from "@/components/shows/EnterClassDialog";
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
}

export default function AlbumEntrySection({
    showId,
    mode,
    status,
    divisions,
    showYear,
    myEntries,
    horses,
    authed,
}: AlbumEntrySectionProps) {
    const router = useRouter();
    const entriesOpen = status === "entries_open";
    const canEnter = authed && entriesOpen;

    const { showToast, toastNode } = useShowToast();
    const [activeClass, setActiveClass] = useState<ConsoleClass | null>(null);
    const [dialogNonce, setDialogNonce] = useState(0);
    const [scratchTarget, setScratchTarget] = useState<MyShowEntry | null>(null);
    const [scratching, setScratching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [freshHorses, setFreshHorses] = useState<EntrantHorse[] | null>(null);
    const effectiveHorses = freshHorses ?? horses;

    const refreshHorses = useCallback(async () => {
        const result = await listMyEntrantHorses();
        if (result.success) setFreshHorses(result.horses);
    }, []);

    const handleHorsesReady = useCallback(async () => {
        await refreshHorses();
        router.refresh();
    }, [refreshHorses, router]);

    const classById = useMemo(() => {
        const map = new Map<string, ConsoleClass>();
        for (const division of divisions) {
            for (const section of division.sections) {
                for (const cls of section.classes) map.set(cls.id, cls);
            }
        }
        return map;
    }, [divisions]);

    const openDialog = (cls: ConsoleClass) => {
        setError(null);
        setDialogNonce((n) => n + 1);
        setActiveClass(cls);
    };

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
                    onReenter={openDialog}
                />
            )}

            {entriesOpen && !authed && (
                <div
                    className="ledger-card flex flex-wrap items-center gap-3 text-sm text-muted-foreground"
                    role="note"
                >
                    <span>Entries are open — sign in to enter your horses.</span>
                    <Button asChild size="sm">
                        <Link href={`/login?redirectTo=${encodeURIComponent(`/shows/${showId}`)}`}>
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
                    onEnter={openDialog}
                    showId={showId}
                    showYear={showYear}
                />
            </section>

            {activeClass && (
                <EnterClassDialog
                    key={`${activeClass.id}-${dialogNonce}`}
                    showId={showId}
                    cls={activeClass}
                    mode={mode}
                    horses={effectiveHorses}
                    onRefreshHorses={refreshHorses}
                    onClose={() => setActiveClass(null)}
                    onEntered={({ horseName }) => {
                        showToast(`${horseName} is entered — see My Entries above.`);
                        router.refresh();
                    }}
                />
            )}

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
