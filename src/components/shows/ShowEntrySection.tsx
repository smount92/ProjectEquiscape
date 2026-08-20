"use client";

/**
 * Phase D — the public show page's interactive body: the full
 * classlist (division → section → class) plus, for the authed
 * viewer, the "My entries" panel and the class-first entry flow.
 *
 * Entering is only offered while the show is entries_open; anyone
 * else (anon, or any other status) gets the same classlist
 * read-only. Scratch/re-enter wording is deliberate: a scratched
 * entry is history and re-entering creates a NEW entry (partial
 * unique index in migration 117).
 *
 * Wave 4b: the My Entries table and the classlist row moved
 * VERBATIM to ShowEntrySectionParts so the album page can reuse
 * them — this component keeps the state and renders the same tree.
 */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { scratchEntry } from "@/app/actions/shows-v2";
import { listMyEntrantHorses } from "@/app/actions/show-readiness";
import type { ConsoleClass, ConsoleDivision } from "@/lib/shows/console";
import type { EntrantHorse, MyShowEntry } from "@/lib/shows/public";
import type { ShowMode, ShowStatus } from "@/lib/shows/types";
import { AXIS_GLOSS } from "@/lib/shows/plainWords";
import EnterClassDialog, { type EnterableClass } from "@/components/shows/EnterClassDialog";
import ShowReadinessPanel from "@/components/shows/ShowReadinessPanel";
import {
    classLabel,
    MyEntriesCard,
    PublicClassRow,
} from "@/components/shows/ShowEntrySectionParts";
import { useShowToast } from "@/components/shows/useShowToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface ShowEntrySectionProps {
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

export default function ShowEntrySection({
    showId,
    mode,
    status,
    divisions,
    showYear,
    myEntries,
    horses,
    authed,
}: ShowEntrySectionProps) {
    const router = useRouter();
    const entriesOpen = status === "entries_open";
    const canEnter = authed && entriesOpen;

    const { showToast, toastNode } = useShowToast();
    const [activeClass, setActiveClass] = useState<EnterableClass | null>(null);
    // Remounts the dialog fresh each time it opens.
    const [dialogNonce, setDialogNonce] = useState(0);
    // Self-scratch pauses on a confirm dialog (same pattern as the
    // console's staff scratch) — scratching is a real withdrawal.
    const [scratchTarget, setScratchTarget] = useState<MyShowEntry | null>(null);
    const [scratching, setScratching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Client-side refetch of the enterable-horse list (Batch 3): a
    // horse added or made public mid-visit becomes usable without a
    // full reload. null → the server-rendered prop still stands.
    const [freshHorses, setFreshHorses] = useState<EntrantHorse[] | null>(null);
    const effectiveHorses = freshHorses ?? horses;

    const refreshHorses = useCallback(async () => {
        const result = await listMyEntrantHorses();
        if (result.success) {
            setFreshHorses(result.horses);
        }
    }, []);

    /** The readiness panel says the stable is enterable — pull the
     *  fresh horse list AND re-sync the server-rendered page. */
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

    const openDialog = (cls: EnterableClass) => {
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

    /** A scratched entry can re-enter only while no LIVE entry exists
     *  for the same class+horse (the server enforces this too). */
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

            {/* ── My entries ── */}
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

            {/* ── Entry availability notes ── */}
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

            {/* ── The classlist ── */}
            {divisions.length === 0 ? (
                <div className="ledger-card flex flex-col items-center gap-3 py-10 text-center">
                    <span className="ledger-tab">Classlist Coming</span>
                    <p className="max-w-md text-sm text-muted-foreground">
                        The host hasn&rsquo;t published the classlist yet.
                    </p>
                </div>
            ) : (
                <ul className="flex list-none flex-col gap-6 p-0">
                    {divisions.map((division) => (
                        <li key={division.id} className="ledger-card">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="ledger-tab !mb-0">{division.name}</span>
                                <Badge variant="secondary" className="capitalize">
                                    {division.axis}
                                </Badge>
                            </div>
                            {/* What the axis word MEANS — visible, never a tooltip. */}
                            <p className="mt-1 mb-0 text-xs text-muted-foreground">
                                {AXIS_GLOSS[division.axis]}
                            </p>
                            <ul className="mt-3 flex list-none flex-col gap-4 p-0">
                                {division.sections.map((section) => (
                                    <li key={section.id}>
                                        <section
                                            aria-label={section.name}
                                            className="border-l-2 border-forest/30 pl-4"
                                        >
                                            <h4 className="font-serif text-sm font-bold tracking-wide text-forest uppercase">
                                                {section.name}
                                            </h4>
                                            <ul className="mt-1 flex list-none flex-col p-0">
                                                {section.classes.map((cls) => (
                                                    <PublicClassRow
                                                        key={cls.id}
                                                        cls={cls}
                                                        showYear={showYear}
                                                        canEnter={
                                                            canEnter && effectiveHorses.length > 0
                                                        }
                                                        onEnter={openDialog}
                                                    />
                                                ))}
                                                {section.classes.length === 0 && (
                                                    <li className="py-1.5 text-sm text-muted-foreground italic">
                                                        No classes yet.
                                                    </li>
                                                )}
                                            </ul>
                                        </section>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ul>
            )}

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

            {/* Self-scratch confirm — the same pause the console's staff
                scratch takes, with the record-keeping rule in plain words. */}
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
