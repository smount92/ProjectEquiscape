"use client";

/**
 * Wave 4a — RIBBON-TRAY JUDGING (/shows/host/[id]/judge).
 *
 * The judge works class by class between two leather rails: a sticky
 * class header (prev/next + "All classes" jump list) on top and THE
 * RIBBON TRAY stuck to the bottom. Tapping a horse pins the lowest
 * empty ribbon on it; tapping a ribbon in the tray (or a placed
 * horse) takes exactly that ribbon back — nobody else shifts. The
 * model is a sparse place → entry map (judgeTray.ts), not an ordered
 * list, which is the whole anxiety fix.
 *
 * Every tray change autosaves (debounced ~900ms, one request in
 * flight, latest state wins) through the unchanged recordPlacings
 * contract; the tray whispers "Saving… / Saved ✓". "Class done →"
 * runs the final save with markDone and moves to the next unplaced
 * class. Blind judging stays server-enforced — no aliases in the
 * payload means none render.
 *
 * Mobile-first: a volunteer judge places 22 classes on her phone.
 */

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { recordPlacings } from "@/app/actions/shows-v2";
import {
    publishClassResults,
    setClassRubric,
    unpublishClassResults,
    writeCritique,
} from "@/app/actions/shows-v4";
import EntryScorePad from "@/components/shows/EntryScorePad";
import { RUBRIC_TEMPLATES, orderByScore } from "@/lib/shows/rubrics";
import type { JudgeQueueClass, JudgeQueueData, JudgeQueueEntry } from "@/lib/shows/gallery";
import {
    AUTOSAVE_DEBOUNCE_MS,
    autosaveReducer,
    clearSlot,
    entryAriaLabel,
    hydrateTray,
    INITIAL_AUTOSAVE,
    placeOfEntry,
    relaxDelayMs,
    tapEntry,
    toServerPlacings,
    whisperText,
    type TraySlots,
} from "@/lib/shows/judgeTray";
import { placeLabel, ribbonHex } from "@/lib/shows/placings";
import type { Place } from "@/lib/shows/types";
import PhotoLightbox from "@/components/PhotoLightbox";
import CallbackLadder from "@/components/shows/CallbackLadder";
import JudgeClassHeader from "@/components/shows/JudgeClassHeader";
import RibbonTray from "@/components/shows/RibbonTray";
import { Textarea } from "@/components/ui/textarea";

function classLabel(cls: { classNumber: string | null; className: string }): string {
    return cls.classNumber ? `${cls.classNumber} · ${cls.className}` : cls.className;
}

/** Clock read kept out of the component body (react-hooks/purity —
 *  same pattern as catalog/page.tsx). Only ever called from the
 *  async save pipeline and effects, never during render. */
function nowMs(): number {
    return Date.now();
}

export default function JudgeQueue({ queue }: { queue: JudgeQueueData }) {
    const router = useRouter();
    const { show, classes, sections, divisions, callbacks } = queue;
    const [activeIndex, setActiveIndex] = useState(() => {
        // Open at the first class still awaiting placement.
        const first = classes.findIndex((c) => c.status !== "placed");
        return first >= 0 ? first : 0;
    });
    // Classes marked done this session — server props catch up via
    // router.refresh(); this keeps progress + advance instant.
    const [locallyDone, setLocallyDone] = useState<ReadonlySet<string>>(() => new Set());
    const [toast, setToast] = useState<string | null>(null);
    // Watermark mask (owner ask, 2026-09-01): an overlay in the JUDGE'S
    // VIEW ONLY over the photo's watermark corner — the stored photo is
    // untouched. Defaults on for blind shows; the judge can toggle it.
    const [maskWatermarks, setMaskWatermarks] = useState<boolean>(show.blindBrowsing);
    const [celebrating, setCelebrating] = useState(false);
    const ladderRef = useRef<HTMLDivElement | null>(null);

    // First-visit instruction: a queue with no ribbons pinned anywhere yet.
    const [showHint] = useState(
        () =>
            classes.every((c) => c.status !== "placed") &&
            classes.every((c) => c.entries.every((e) => e.place === null)),
    );

    const placedIds = useMemo(() => {
        const ids = new Set<string>();
        for (const c of classes) if (c.status === "placed") ids.add(c.classId);
        for (const id of locallyDone) ids.add(id);
        return ids;
    }, [classes, locallyDone]);
    const placedCount = placedIds.size;
    const serverPlacedCount = classes.filter((c) => c.status === "placed").length;

    const activeClass = classes[activeIndex];
    const canRecord = show.status === "judging";

    // Transient "class done" toast.
    useEffect(() => {
        if (toast === null) return;
        const timer = setTimeout(() => setToast(null), 2600);
        return () => clearTimeout(timer);
    }, [toast]);

    // The championship round mounts from SERVER truth (contract
    // unchanged); once the 🎉 shows and the ladder is real, scroll
    // it into view a beat later.
    const ladderMounted = classes.length > 0 && serverPlacedCount === classes.length;
    useEffect(() => {
        if (!celebrating || !ladderMounted) return;
        const timer = setTimeout(() => {
            ladderRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        }, 1400);
        return () => clearTimeout(timer);
    }, [celebrating, ladderMounted]);

    // Any edit re-opens a class server-side (recordPlacings flips it
    // back to judging) — drop the optimistic ✓ so the header stays
    // honest, and step out of the celebration if we were in it.
    const handleClassEdited = (cls: JudgeQueueClass) => {
        setLocallyDone((prev) => {
            if (!prev.has(cls.classId)) return prev;
            const next = new Set(prev);
            next.delete(cls.classId);
            return next;
        });
        setCelebrating(false);
    };

    const handleClassDone = (cls: JudgeQueueClass) => {
        const done = new Set(placedIds);
        done.add(cls.classId);
        setLocallyDone((prev) => {
            const next = new Set(prev);
            next.add(cls.classId);
            return next;
        });
        // Advance to the next class not yet marked done (forward from
        // here, wrapping) — or celebrate when that was the last one.
        let nextIndex: number | null = null;
        for (let step = 1; step < classes.length; step++) {
            const i = (activeIndex + step) % classes.length;
            if (!done.has(classes[i].classId)) {
                nextIndex = i;
                break;
            }
        }
        if (nextIndex !== null) {
            setToast(`${classLabel(cls)} done ✓`);
            setActiveIndex(nextIndex);
        } else {
            setCelebrating(true);
        }
    };

    if (classes.length === 0) {
        return (
            <div className="ledger-card">
                <span className="ledger-tab">Judge Queue</span>
                <p className="text-sm text-muted-foreground">
                    This show has no classes to judge yet.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <JudgeClassHeader
                items={classes.map((c) => ({
                    classId: c.classId,
                    className: c.className,
                    classNumber: c.classNumber,
                    entryCount: c.entries.length,
                    placed: placedIds.has(c.classId),
                }))}
                activeIndex={activeIndex}
                placedCount={placedCount}
                onNavigate={setActiveIndex}
            />

            {!canRecord && (
                <p className="text-sm text-muted-foreground">
                    {show.status === "results_review"
                        ? "This show is in results review — reopen judging from the console to change placings."
                        : "Recording opens when the show enters judging."}
                </p>
            )}

            {showHint && canRecord && (
                <p data-testid="tray-hint" className="text-sm text-muted-foreground">
                    Tap a horse to pin the next ribbon on it. Tap a ribbon in the tray to
                    take it back. Everything saves as you go.
                </p>
            )}

            {activeClass && (
                <ClassRecorder
                    key={activeClass.classId}
                    cls={activeClass}
                    canRecord={canRecord}
                    canPublish={queue.viewerRole === "host" || queue.viewerRole === "co_host"}
                    onEdited={() => handleClassEdited(activeClass)}
                    onDone={() => handleClassDone(activeClass)}
                />
            )}

            {celebrating && (
                <div className="ledger-card" role="status" data-testid="judging-complete">
                    <p className="text-base font-semibold text-forest">
                        All {classes.length} classes judged 🎉 — championship callbacks are
                        ready.
                    </p>
                </div>
            )}

            {/* ── THE CHAMPIONSHIP ROUND (Phase E2) — once every class
                is placed, the same section → division → show callback
                ladder as the live ring, photos side by side. ── */}
            {ladderMounted && (
                <div ref={ladderRef}>
                    <CallbackLadder
                        showId={show.id}
                        canRecord={canRecord}
                        classes={classes.map((c) => ({
                            classId: c.classId,
                            sectionId: c.sectionId,
                            divisionId: c.divisionId,
                            status: c.status,
                            entries: c.entries.map((e) => ({
                                id: e.id,
                                horseName: e.horseName,
                                entryNumber: e.entryNumber,
                                photoUrl: e.photoUrl,
                                place: e.place,
                            })),
                        }))}
                        sections={sections}
                        divisions={divisions}
                        callbacks={callbacks}
                        onSaved={() => router.refresh()}
                    />
                </div>
            )}

            {/* Persistent live region: the container pre-exists so the
                class-done announcement is actually read out. */}
            <div
                role="status"
                aria-live="polite"
                className="pointer-events-none fixed bottom-28 left-1/2 z-50 -translate-x-1/2"
            >
                {toast && (
                    <span
                        data-testid="judge-toast"
                        className="stamp bg-(--paper-lit) block max-w-[calc(100vw-2rem)] text-center shadow-lg"
                    >
                        {toast}
                    </span>
                )}
            </div>
        </div>
    );
}

/**
 * One class's ribbon-tray recorder. Mounted per class (key=classId);
 * local state is the source of truth while judging — server props
 * refresh underneath via router.refresh() and re-hydrate on the next
 * mount of this class.
 */
function ClassRecorder({
    cls,
    canRecord,
    canPublish,
    onEdited,
    onDone,
}: {
    cls: JudgeQueueClass;
    canRecord: boolean;
    /** v4: host/co-host may publish this class's results (rolling reveal). */
    canPublish: boolean;
    /** Fires on every local edit — the parent drops its optimistic ✓. */
    onEdited: () => void;
    onDone: () => void;
}) {
    const router = useRouter();
    const [slots, setSlots] = useState<TraySlots>(() => hydrateTray(cls.entries));
    const [notes, setNotes] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        for (const e of cls.entries) if (e.note) initial[e.id] = e.note;
        return initial;
    });
    const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null);
    const [refusal, setRefusal] = useState<string | null>(null);
    // Scored judging (205): the freshest sheet + total per entry, held
    // HERE because the score pad unmounts when its panel closes — a
    // reopened pad must re-light its taps from this cache, not from
    // server props that only refresh on navigation.
    const [liveTotals, setLiveTotals] = useState<Record<string, number | null>>({});
    const [liveScores, setLiveScores] = useState<Record<string, Record<string, number>>>({});
    // Same cache for critiques — their editor unmounts with its panel
    // too, and stale-empty text on reopen reads as (and can become)
    // data loss.
    const [liveCritiques, setLiveCritiques] = useState<Record<string, { model: string; photo: string }>>({});
    const [rubricBusy, setRubricBusy] = useState(false);
    const [doneSaving, setDoneSaving] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [autosave, dispatch] = useReducer(autosaveReducer, INITIAL_AUTOSAVE);
    // The savedAtMs whose "Saved just now ✓" has relaxed to "Saved ✓".
    // Keyed to the timestamp so a fresh save un-relaxes by identity —
    // no state resets in effects needed.
    const [relaxedAtMs, setRelaxedAtMs] = useState<number | null>(null);

    // Latest-state mirrors for the async save pipeline: the payload
    // always reflects the newest tap, whichever request carries it.
    // Written in the depless effect below (never during render) and
    // read only by timers, handlers and save completions.
    const payloadRef = useRef({ slots, notes });
    const versionRef = useRef(0);
    const savedVersionRef = useRef(0);
    const inFlightRef = useRef(false);
    const pendingDoneRef = useRef(false);
    const onDoneRef = useRef(onDone);
    const onEditedRef = useRef(onEdited);

    const markChanged = () => {
        versionRef.current += 1;
        dispatch({ type: "change" });
        onEditedRef.current();
    };

    /**
     * The single save pipeline (autosave + Class done). One request
     * in flight; a done-tap during a flight queues behind it; a
     * success for a stale version immediately chases the newest
     * state. Errors preserve the tray and wait for a change/retry.
     */
    const runSave = async (markDone: boolean): Promise<void> => {
        if (!canRecord) return;
        if (inFlightRef.current) {
            if (markDone) pendingDoneRef.current = true;
            return;
        }
        if (!markDone && versionRef.current <= savedVersionRef.current) return;
        inFlightRef.current = true;
        const sentVersion = versionRef.current;
        if (markDone) setDoneSaving(true);
        dispatch({ type: "saveStart" });
        const { slots: currentSlots, notes: currentNotes } = payloadRef.current;
        const result = await recordPlacings({
            classId: cls.classId,
            placings: toServerPlacings(currentSlots, currentNotes),
            // EVERY note she touched rides along, placed or not —
            // unplaced ones persist server-side as participation rows.
            // An empty string is an explicit clear.
            notes: Object.fromEntries(
                Object.entries(currentNotes).map(([id, text]) => [id, text.trim()]),
            ),
            markDone,
        });
        inFlightRef.current = false;
        if (markDone) setDoneSaving(false);
        if (!result.success) {
            pendingDoneRef.current = false;
            dispatch({ type: "saveError", version: sentVersion, error: result.error });
            return;
        }
        savedVersionRef.current = Math.max(savedVersionRef.current, sentVersion);
        dispatch({ type: "saveSuccess", version: sentVersion, atMs: nowMs() });
        router.refresh();
        if (markDone) {
            pendingDoneRef.current = false;
            onDoneRef.current();
            return;
        }
        if (pendingDoneRef.current) {
            pendingDoneRef.current = false;
            void runSave(true);
            return;
        }
        if (versionRef.current > sentVersion) void runSave(false);
    };
    const runSaveRef = useRef(runSave);

    // Keep the mirrors fresh after every commit. React flushes
    // passive effects before processing the next discrete event, so
    // handlers and timers always read the latest committed state.
    useEffect(() => {
        payloadRef.current = { slots, notes };
        onDoneRef.current = onDone;
        onEditedRef.current = onEdited;
        runSaveRef.current = runSave;
    });

    // Debounce: every edit re-arms the ~900ms timer.
    useEffect(() => {
        if (!canRecord || autosave.version === 0) return;
        if (autosave.version <= savedVersionRef.current) return;
        const timer = setTimeout(() => {
            void runSaveRef.current(false);
        }, AUTOSAVE_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [autosave.version, canRecord]);

    // Relax "Saved just now ✓" to "Saved ✓" ~30s after a save lands.
    // Clock reads stay in the effect; the state write happens only in
    // the timer callback. A stale relax (older savedAtMs) is inert.
    useEffect(() => {
        if (autosave.status !== "saved" || autosave.savedAtMs === null) return;
        const at = autosave.savedAtMs;
        const timer = setTimeout(() => setRelaxedAtMs(at), relaxDelayMs(at, nowMs()));
        return () => clearTimeout(timer);
    }, [autosave.status, autosave.savedAtMs]);

    const whisper = whisperText(
        autosave,
        autosave.savedAtMs !== null && autosave.savedAtMs !== relaxedAtMs,
    );

    const handleTapEntry = (entryId: string) => {
        if (!canRecord) return;
        const result = tapEntry(payloadRef.current.slots, entryId);
        if (result.kind === "refused") {
            setRefusal(result.message);
            return;
        }
        setRefusal(null);
        setSlots(result.slots);
        markChanged();
    };

    const handleClearSlot = (place: Place) => {
        if (!canRecord) return;
        setRefusal(null);
        setSlots((prev) => clearSlot(prev, place));
        markChanged();
    };

    const handleNoteChange = (entryId: string, value: string) => {
        setNotes((prev) => ({ ...prev, [entryId]: value }));
        markChanged();
    };

    const handleRetry = () => {
        dispatch({ type: "retry" });
        void runSaveRef.current(false);
    };

    const lightboxImages = useMemo(
        () =>
            cls.entries
                .filter((e) => e.photoUrl)
                .map((e) => ({
                    url: e.photoUrl as string,
                    label: [e.entryNumber !== null ? `#${e.entryNumber}` : null, e.horseName]
                        .filter(Boolean)
                        .join(" · "),
                })),
        [cls.entries],
    );

    // ── Scored judging (205) ─────────────────────────────────────
    // Fresh totals reported by the score pads override the
    // server-loaded ones, so "sort tray by scores" is always live.
    const scoredOrder = cls.rubric
        ? orderByScore(
              cls.entries.map((e) => ({
                  entryId: e.id,
                  total: liveTotals[e.id] !== undefined ? liveTotals[e.id] : e.scoreTotal,
              })),
          )
        : [];
    const scoredTies = scoredOrder.slice(0, 6).filter((o) => o.tiedWithPrev).length;
    const applyScoreOrder = () => {
        if (!canRecord || scoredOrder.length === 0) return;
        const next: Partial<Record<Place, string>> = {};
        scoredOrder.slice(0, 6).forEach((o, i) => {
            next[(i + 1) as Place] = o.entryId;
        });
        setRefusal(null);
        setSlots(next);
        markChanged();
    };
    const handleRubricPick = async (templateKey: string) => {
        setRubricBusy(true);
        const res = await setClassRubric({
            classId: cls.classId,
            templateKey: templateKey === "" ? null : templateKey,
        });
        setRubricBusy(false);
        if (!res.success) setRefusal(res.error ?? "Could not set the rubric.");
        else router.refresh();
    };

    return (
        <section className="flex flex-col gap-3" aria-label={`Judging ${classLabel(cls)}`}>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                    {cls.divisionName} · {cls.sectionName}
                </span>
                {cls.status === "placed" && <span className="stamp">placed</span>}
            </div>

            {canRecord && !cls.resultsPublishedAt && (
                <div className="border-input bg-card flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border px-3 py-2 text-sm">
                    <label className="flex items-center gap-2">
                        <span className="font-semibold">🎯 Rubric</span>
                        <select
                            value={cls.rubric?.key ?? ""}
                            disabled={rubricBusy}
                            onChange={(e) => void handleRubricPick(e.target.value)}
                            className="border-input bg-background rounded-md border px-2 py-1 text-sm"
                            aria-label="Scoring rubric for this class"
                        >
                            <option value="">None — ribbon tray only</option>
                            {RUBRIC_TEMPLATES.map((t) => (
                                <option key={t.key} value={t.key}>{t.name}</option>
                            ))}
                        </select>
                    </label>
                    {cls.rubric && (
                        <>
                            <button
                                type="button"
                                onClick={applyScoreOrder}
                                disabled={scoredOrder.length === 0}
                                className="text-forest cursor-pointer text-sm font-semibold hover:underline disabled:cursor-default disabled:opacity-45"
                            >
                                Sort tray by scores ({scoredOrder.length} of {cls.entries.length} scored)
                            </button>
                            {scoredTies > 0 && (
                                <span className="text-(--brass) text-xs font-semibold">
                                    {scoredTies} tie{scoredTies === 1 ? "" : "s"} — your call stands
                                </span>
                            )}
                        </>
                    )}
                </div>
            )}

            {cls.entries.length === 0 && !canRecord && (
                <p className="text-sm text-muted-foreground">No live entries in this class.</p>
            )}

            {cls.entries.length > 0 && (
                <ul className="grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3">
                    {cls.entries.map((entry) => {
                        const place = placeOfEntry(slots, entry.id);
                        const hasNote = Boolean(notes[entry.id]?.trim());
                        return (
                            <li key={entry.id} className="flex flex-col gap-1.5">
                                <div
                                    className={`relative overflow-hidden rounded-lg border-2 bg-card transition-all ${
                                        place !== null
                                            ? "border-forest ring-2 ring-forest"
                                            : "border-input"
                                    }`}
                                >
                                    <button
                                        type="button"
                                        data-testid="judge-entry"
                                        aria-pressed={place !== null}
                                        aria-label={entryAriaLabel(entry.horseName, place)}
                                        disabled={!canRecord}
                                        className="block w-full cursor-pointer p-0 text-left disabled:cursor-default"
                                        onClick={() => handleTapEntry(entry.id)}
                                    >
                                        {entry.photoUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={entry.photoUrl}
                                                alt=""
                                                // object-CONTAIN: a judge must see the
                                                // whole model — cropping legs and ears
                                                // off non-square photos was costing
                                                // entries their extremities.
                                                className="aspect-square w-full bg-black/15 object-contain"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div
                                                className="flex aspect-square w-full items-center justify-center bg-muted text-4xl"
                                                aria-hidden="true"
                                            >
                                                🐴
                                            </div>
                                        )}
                                        {entry.entryNumber !== null && (
                                            <span
                                                aria-hidden="true"
                                                className="absolute top-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-xs font-semibold text-white"
                                            >
                                                #{entry.entryNumber}
                                            </span>
                                        )}
                                        {place !== null && (
                                            <span
                                                className="stamp absolute top-1.5 left-1.5 inline-flex items-center gap-1.5 bg-(--paper-lit)"
                                                data-testid="place-chip"
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    className="inline-block h-2.5 w-2.5 rounded-full border border-border"
                                                    style={{
                                                        backgroundColor:
                                                            ribbonHex(place) ?? undefined,
                                                    }}
                                                />
                                                {placeLabel(place)}
                                            </span>
                                        )}
                                        <span
                                            aria-hidden="true"
                                            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-2 pt-7 pb-1.5"
                                        >
                                            <span className="block truncate pr-[5.75rem] text-sm font-medium text-white">
                                                {entry.horseName}
                                            </span>
                                            {entry.ownerAlias !== null && (
                                                <span className="block truncate pr-[5.75rem] text-xs text-white/75">
                                                    @{entry.ownerAlias}
                                                </span>
                                            )}
                                            {/* What she's judging: sex · breed · color,
                                                registry-backed when the owner never set
                                                them. Blind-safe — describes the horse. */}
                                            {entry.identity && (
                                                <span className="block truncate pr-[5.75rem] text-[0.68rem] text-white/70">
                                                    {entry.identity}
                                                </span>
                                            )}
                                            {/* Calibration at a glance (205): the running
                                                total on every scored card, so a judge can
                                                see the class's spread — and what's still
                                                unscored — without opening panels. */}
                                            {cls.rubric && (
                                                <span className="block text-xs font-semibold text-white/90 tabular-nums">
                                                    {(liveTotals[entry.id] !== undefined
                                                        ? liveTotals[entry.id]
                                                        : entry.scoreTotal) != null
                                                        ? `🎯 ${liveTotals[entry.id] ?? entry.scoreTotal}`
                                                        : "🎯 not scored"}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                    {/* Corner tools — siblings of the place button, never nested. */}
                                    <div className="absolute right-1.5 bottom-1.5 flex gap-1.5">
                                        {canRecord && (
                                            <button
                                                type="button"
                                                data-testid="entry-critique"
                                                aria-expanded={noteOpenFor === entry.id}
                                                aria-label={`${hasNote ? "Edit" : "Add"} critique for ${entry.horseName}`}
                                                className="flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-md bg-black/60 text-sm text-white transition-all hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                                                onClick={() =>
                                                    setNoteOpenFor((cur) =>
                                                        cur === entry.id ? null : entry.id,
                                                    )
                                                }
                                            >
                                                <span aria-hidden="true">✎{hasNote ? " ✓" : ""}</span>
                                            </button>
                                        )}
                                        {entry.photoUrl && (
                                            <button
                                                type="button"
                                                data-testid="entry-zoom"
                                                aria-label={`Zoom ${entry.horseName} photo`}
                                                className="flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-md bg-black/60 text-sm text-white transition-all hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                                                onClick={() =>
                                                    setLightboxIndex(
                                                        lightboxImages.findIndex(
                                                            (img) => img.url === entry.photoUrl,
                                                        ),
                                                    )
                                                }
                                            >
                                                <span aria-hidden="true">🔍</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {noteOpenFor === entry.id && (
                                    <div className="flex flex-col gap-2">
                                        {cls.rubric && (
                                            <EntryScorePad
                                                entry={entry}
                                                rubric={cls.rubric}
                                                initialScores={liveScores[entry.id] ?? entry.scoreData ?? {}}
                                                onSaved={(id, scores, total) => {
                                                    setLiveScores((prev) => ({ ...prev, [id]: scores }));
                                                    setLiveTotals((prev) => ({ ...prev, [id]: total }));
                                                }}
                                            />
                                        )}
                                        <Textarea
                                            value={
                                                entry.id in notes
                                                    ? notes[entry.id]
                                                    : (entry.note ?? "")
                                            }
                                            onChange={(e) => handleNoteChange(entry.id, e.target.value)}
                                            placeholder="Placing note (rides with the trophy-case record)…"
                                            maxLength={2000}
                                            rows={2}
                                            aria-label={`Placing note for ${entry.horseName}`}
                                        />
                                        <EntryCritiqueEditor
                                            entry={entry}
                                            initial={liveCritiques[entry.id]}
                                            onSaved={(id, model, photo) =>
                                                setLiveCritiques((prev) => ({
                                                    ...prev,
                                                    [id]: { model, photo },
                                                }))
                                            }
                                        />
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* Judge tools — at the TRAY, where the thumb already is.
                (The rubric bar at the top has the same sort; a judge
                who just scored 14 entries is at the bottom.) More
                class-level buttons land here as they're invented. */}
            {canRecord && cls.rubric && (
                <div className="border-input bg-card flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-sm">
                    <button
                        type="button"
                        onClick={applyScoreOrder}
                        disabled={scoredOrder.length === 0}
                        className="text-forest cursor-pointer font-semibold hover:underline disabled:cursor-default disabled:opacity-45"
                    >
                        🎯 Place by scores ({scoredOrder.length} of {cls.entries.length} scored)
                    </button>
                    {scoredTies > 0 && (
                        <span className="text-(--brass) text-xs font-semibold">
                            {scoredTies} tie{scoredTies === 1 ? "" : "s"} — your call stands
                        </span>
                    )}
                    <span className="text-muted-foreground text-xs">
                        fills the tray from totals; adjust any ribbon after
                    </span>
                </div>
            )}

            {canRecord && (
                <RibbonTray
                    entries={cls.entries.map((e) => ({
                        id: e.id,
                        horseName: e.horseName,
                        photoUrl: e.photoUrl,
                    }))}
                    slots={slots}
                    onClearSlot={handleClearSlot}
                    onDone={() => {
                        setRefusal(null);
                        void runSaveRef.current(true);
                    }}
                    doneSaving={doneSaving}
                    whisper={whisper}
                    error={autosave.error}
                    onRetry={handleRetry}
                    refusal={refusal}
                    hasEntries={cls.entries.length > 0}
                />
            )}

            {canPublish && cls.status === "placed" && (
                <PublishClassControl cls={cls} />
            )}

            {lightboxIndex !== null && lightboxIndex >= 0 && (
                <PhotoLightbox
                    images={lightboxImages}
                    initialIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                />
            )}
        </section>
    );
}

/**
 * v4 — per-ENTRY critique (model + photo separated; unplaced entries
 * included: the MEPSA teaching tradition). Saves via writeCritique;
 * hidden from entrants until the class's results publish.
 *
 * Initial text prefers the PARENT CACHE over server props: this
 * editor unmounts with its panel, and props only refresh on
 * navigation — reopening used to show a saved critique as EMPTY (the
 * judge read it as data loss), and saving from that empty state
 * would have made it one.
 */
function EntryCritiqueEditor({
    entry,
    initial,
    onSaved,
}: {
    entry: JudgeQueueEntry;
    initial?: { model: string; photo: string };
    onSaved?: (entryId: string, model: string, photo: string) => void;
}) {
    const [model, setModel] = useState(initial?.model ?? entry.critiqueText ?? "");
    const [photo, setPhoto] = useState(initial?.photo ?? entry.critiquePhotoText ?? "");
    const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        setState("saving");
        setError(null);
        const result = await writeCritique({
            entryId: entry.id,
            critique: model.trim() || null,
            photoCritique: photo.trim() || null,
        });
        if (result.success) {
            setState("saved");
            onSaved?.(entry.id, model, photo);
        } else {
            setState("error");
            setError(result.error);
        }
    };

    return (
        <div className="flex flex-col gap-2 rounded-md border border-input bg-card/60 p-2">
            <p className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Critique for the entrant (revealed with class results)
            </p>
            <Textarea
                value={model}
                onChange={(e) => { setModel(e.target.value); setState("idle"); }}
                placeholder="The model — conformation, breed fit, condition…"
                maxLength={2000}
                rows={2}
                aria-label={`Model critique for ${entry.horseName}`}
            />
            <Textarea
                value={photo}
                onChange={(e) => { setPhoto(e.target.value); setState("idle"); }}
                placeholder="The photo — angle, light, footing… (kept separate so photo skill never reads as a model fault)"
                maxLength={2000}
                rows={2}
                aria-label={`Photo critique for ${entry.horseName}`}
            />
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    className="btn-brass rounded px-3 py-1 text-sm"
                    disabled={state === "saving" || (!model.trim() && !photo.trim())}
                    onClick={() => void save()}
                >
                    {state === "saving" ? "Saving…" : "Save critique"}
                </button>
                {state === "saved" && (
                    <span className="text-xs text-muted-foreground">Saved ✓</span>
                )}
                {state === "error" && error && (
                    <span role="alert" className="text-xs text-destructive">{error}</span>
                )}
            </div>
        </div>
    );
}

/**
 * v4 — the rolling reveal: host/co-host publishes a placed class's
 * results (and critiques) to the public class room while the rest of
 * the show is still being judged. Unpublish = corrections hatch.
 */
function PublishClassControl({ cls }: { cls: JudgeQueueClass }) {
    const router = useRouter();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const published = !!cls.resultsPublishedAt;

    const toggle = async () => {
        setPending(true);
        setError(null);
        const result = published
            ? await unpublishClassResults({ classId: cls.classId })
            : await publishClassResults({ classId: cls.classId });
        if (!result.success) setError(result.error);
        else router.refresh();
        setPending(false);
    };

    return (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-input bg-card/60 p-3">
            {/* min-w keeps the copy readable; flex-wrap sends the button to its own row on phones instead of compressing this column to a sliver. */}
            <div className="min-w-[13rem] flex-1 basis-52">
                <p className="m-0 text-sm font-medium">
                    {published ? "Results are live in the class room" : "Class is judged — results not yet public"}
                </p>
                <p className="m-0 text-xs text-muted-foreground">
                    {published
                        ? "Entrants can see placings and critiques for this class."
                        : "Publish to reveal this class's ribbon rail and critiques while you keep judging."}
                </p>
            </div>
            <button
                type="button"
                className="btn-brass w-full shrink-0 rounded px-3 py-1.5 text-center text-sm sm:w-auto"
                disabled={pending}
                onClick={() => void toggle()}
            >
                {pending ? "Working…" : published ? "Unpublish" : "Publish class results"}
            </button>
            {error && (
                <p role="alert" className="w-full text-xs text-destructive">{error}</p>
            )}
        </div>
    );
}


/**
 * The judge's photo tile: object-CONTAIN in a square frame (a judge
 * must see the whole model — cropping cost entries their legs and
 * ears), plus an optional watermark cover — a dark band over the
 * IMAGE'S bottom-right corner, where the site's watermark pill lives.
 * The cover exists only in this view; the stored photo is untouched.
 * Geometry is computed from the natural dimensions so letterboxing
 * doesn't misplace the band.
 */
function MaskedEntryPhoto({ photoUrl, mask }: { photoUrl: string; mask: boolean }) {
    const [ratio, setRatio] = useState<number | null>(null); // naturalW / naturalH

    // Rendered image rect inside a square, object-contain container
    // (percentages of the container):
    const landscape = (ratio ?? 1) >= 1;
    const rw = landscape ? 100 : (ratio ?? 1) * 100;
    const rh = landscape ? 100 / (ratio ?? 1) : 100;
    const offRight = (100 - rw) / 2;
    const offBottom = (100 - rh) / 2;

    return (
        <span className="relative block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={photoUrl}
                alt=""
                className="aspect-square w-full bg-black/15 object-contain"
                loading="lazy"
                onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth && img.naturalHeight) {
                        setRatio(img.naturalWidth / img.naturalHeight);
                    }
                }}
            />
            {mask && ratio !== null && (
                <span
                    aria-hidden="true"
                    title="Watermark hidden for blind judging (your view only)"
                    className="absolute flex items-end justify-end rounded-sm bg-neutral-900/95 pr-1 text-[0.55rem] text-white/40"
                    style={{
                        right: offRight + "%",
                        bottom: offBottom + "%",
                        width: rw * 0.6 + "%",
                        height: Math.max(9, rh * 0.11) + "%",
                    }}
                >
                    🕶
                </span>
            )}
        </span>
    );
}
