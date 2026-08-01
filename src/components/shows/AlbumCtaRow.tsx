"use client";

/**
 * Wave 4b — the STICKY CTA ROW, pinned under the site header while
 * the visitor wanders the wall. Primary brass "Enter this show"
 * opens a "Pick your class" dialog — the program accordion with
 * per-class Enter buttons feeding the EXISTING EnterClassDialog
 * flow (class-first, unchanged). Anon visitors get the 4a
 * sign-in-with-redirect pattern instead. Secondary: share. If the
 * viewer has entries, a compact pill jumps to #entries.
 *
 * The row only ever links/opens — every entry rule stays with the
 * server (validateEntry + RLS), exactly as on the legacy layout.
 */

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { listMyEntrantHorses } from "@/app/actions/show-readiness";
import type { ConsoleClass, ConsoleDivision } from "@/lib/shows/console";
import type { EntrantHorse } from "@/lib/shows/public";
import type { ShowMode, ShowStatus } from "@/lib/shows/types";
import ShareButton from "@/components/ShareButton";
import EnterClassDialog from "@/components/shows/EnterClassDialog";
import ProgramAccordion from "@/components/shows/ProgramAccordion";
import { useShowToast } from "@/components/shows/useShowToast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface AlbumCtaRowProps {
    showId: string;
    showTitle: string;
    mode: ShowMode;
    status: ShowStatus;
    authed: boolean;
    divisions: ConsoleDivision[];
    horses: EntrantHorse[];
    /** The viewer's LIVE entries (scratched excluded) — the pill. */
    myEntryCount: number;
}

export default function AlbumCtaRow({
    showId,
    showTitle,
    mode,
    status,
    authed,
    divisions,
    horses,
    myEntryCount,
}: AlbumCtaRowProps) {
    const router = useRouter();
    const { showToast, toastNode } = useShowToast();
    const entriesOpen = status === "entries_open";

    const [pickerOpen, setPickerOpen] = useState(false);
    const [activeClass, setActiveClass] = useState<ConsoleClass | null>(null);
    // Remounts the entry dialog fresh each time it opens.
    const [dialogNonce, setDialogNonce] = useState(0);

    // Same client-side refetch the entry section uses (Batch 3): a
    // horse made public mid-visit becomes enterable without reload.
    const [freshHorses, setFreshHorses] = useState<EntrantHorse[] | null>(null);
    const effectiveHorses = freshHorses ?? horses;

    const refreshHorses = useCallback(async () => {
        const result = await listMyEntrantHorses();
        if (result.success) setFreshHorses(result.horses);
    }, []);

    const handlePickClass = (cls: ConsoleClass) => {
        setPickerOpen(false);
        setDialogNonce((n) => n + 1);
        setActiveClass(cls);
    };

    return (
        <div
            className="sticky top-(--header-height) z-40 -mx-1 flex flex-wrap items-center gap-2 border-b border-input bg-background/95 px-1 py-2 backdrop-blur-md sm:gap-3"
            data-testid="album-cta-row"
        >
            {entriesOpen &&
                (authed ? (
                    <button
                        type="button"
                        className="btn-brass"
                        onClick={() => setPickerOpen(true)}
                        data-testid="album-enter-cta"
                    >
                        Enter this show
                    </button>
                ) : (
                    <Link
                        href={`/login?redirectTo=${encodeURIComponent(`/shows/${showId}`)}`}
                        className="btn-brass"
                        data-testid="album-enter-cta"
                    >
                        Sign in to enter
                    </Link>
                ))}
            <span className="text-foreground">
                <ShareButton
                    title={showTitle}
                    text={`${showTitle} — a ${mode === "live" ? "live" : "online"} model horse show on Model Horse Hub`}
                />
            </span>
            {authed && myEntryCount > 0 && (
                <a
                    href="#entries"
                    className="ml-auto inline-flex items-center gap-1 rounded-full border border-forest/40 bg-card px-3 py-1 text-xs font-semibold text-forest no-underline hover:bg-forest/10"
                    data-testid="album-my-entries-pill"
                >
                    Your entries: {myEntryCount}
                    <span aria-hidden="true">↓</span>
                </a>
            )}

            {/* "Pick your class" — the program accordion with Enter
                buttons; picking one hands off to EnterClassDialog. */}
            <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
                <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-[640px]">
                    <DialogHeader>
                        <DialogTitle>Pick your class</DialogTitle>
                        <DialogDescription>
                            Every class in the program — pick one and choose which horse to
                            enter.
                        </DialogDescription>
                    </DialogHeader>
                    {effectiveHorses.length === 0 && (
                        <p className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                            You need a public horse in your stable before you can enter —{" "}
                            <a
                                href="#entries"
                                className="font-semibold text-forest underline"
                                onClick={() => setPickerOpen(false)}
                            >
                                the readiness panel below
                            </a>{" "}
                            walks you through it.
                        </p>
                    )}
                    <ProgramAccordion
                        divisions={divisions}
                        canEnter={authed && entriesOpen && effectiveHorses.length > 0}
                        onEnter={handlePickClass}
                        defaultOpenIndex={0}
                    />
                </DialogContent>
            </Dialog>

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
                        showToast(`${horseName} is entered — see Your entries below.`);
                        router.refresh();
                    }}
                />
            )}

            {toastNode}
        </div>
    );
}
