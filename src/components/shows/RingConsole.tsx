"use client";

/**
 * Phase E2 — THE LIVE RING CONSOLE (/shows/host/[id]/ring): the
 * flagship Barn Mode surface. Built for a steward standing at the
 * table with a clipboard in one hand: LARGE tap targets, leg-tag
 * numbers first (that's how horses are identified at a live show —
 * design doc §4), high contrast in sunlight and at 6am lamplight.
 *
 *   1. CLASS CALLER — run-order board; NOW JUDGING huge, ON DECK
 *      next; tap to call (scheduled→called via updateClass, the
 *      existing class state machine).
 *   2. PLACING RECORDER — tap entries in placing order (the
 *      JudgeQueue interaction, restyled for gloves-and-sunlight);
 *      save = recordPlacings, class → placed.
 *   3. SPLIT / COMBINE at the table — minimal dialogs over the
 *      existing splitClass/combineClasses actions (they refuse
 *      illegal states server-side).
 *   4. CALLBACKS — the championship ladder (CallbackLadder).
 *
 * OFFLINE RESILIENCE (pragmatic Barn Mode): when a placing save
 * THROWS (network down), the slate queues in localStorage and
 * retries on the browser 'online' event plus a slow interval, with
 * a visible pending count. See src/lib/shows/retryQueue.ts for the
 * honest boundary — this is a retry queue, not offline-first sync.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
    combineClasses,
    recordPlacings,
    splitClass,
    updateClass,
} from "@/app/actions/shows-v2";
import {
    enqueueSave,
    flushQueue,
    loadQueue,
    type PendingPlacingSave,
} from "@/lib/shows/retryQueue";
import { deriveRunOrder, type RingClass, type RingConsoleData } from "@/lib/shows/ring";
import { MAX_PLACE, placeLabel, ribbonHex } from "@/lib/shows/placings";
import { formatStatus } from "@/lib/shows/stateMachine";
import type { ClassStatus, Place } from "@/lib/shows/types";
import CallbackLadder from "@/components/shows/CallbackLadder";
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
import { Input } from "@/components/ui/input";

/** Retry cadence while saves are pending (the 'online' event fires
 *  immediately on reconnect; this catches flaky-but-up networks). */
const FLUSH_INTERVAL_MS = 30_000;

function classLabel(cls: { classNumber: string | null; className: string }): string {
    return cls.classNumber ? `${cls.classNumber} · ${cls.className}` : cls.className;
}

export default function RingConsole({ data }: { data: RingConsoleData }) {
    const router = useRouter();
    const { show, viewerRole, sections, divisions, callbacks } = data;
    const running = show.status === "running";
    const canManage = viewerRole === "host" || viewerRole === "co_host";

    // ── Optimistic status overlay: queued offline saves flip the
    // class locally so the run order advances without the server. ──
    const [statusOverlay, setStatusOverlay] = useState<Map<string, ClassStatus>>(
        () => new Map(),
    );
    const classes = useMemo<RingClass[]>(
        () =>
            data.classes.map((c) => ({
                ...c,
                status: statusOverlay.get(c.classId) ?? c.status,
            })),
        [data.classes, statusOverlay],
    );

    // ── The pending-saves queue ──
    const [pending, setPending] = useState<PendingPlacingSave[]>([]);
    const [queueNotice, setQueueNotice] = useState<string | null>(null);
    const flushing = useRef(false);

    const runFlush = useCallback(async () => {
        if (flushing.current) return;
        flushing.current = true;
        try {
            const result = await flushQueue(window.localStorage, show.id, (save) =>
                recordPlacings({
                    classId: save.classId,
                    placings: save.placings,
                    markDone: save.markDone,
                }),
            );
            setPending(result.remaining);
            if (result.rejected.length > 0) {
                // The server REFUSED these saves — they are dropped, not
                // retried; the steward re-records against fresh state.
                setQueueNotice(
                    `A queued save was refused and dropped: ${result.rejected[0].error}`,
                );
            }
            if (result.flushed.length > 0) router.refresh();
        } finally {
            flushing.current = false;
        }
    }, [show.id, router]);

    useEffect(() => {
        setPending(loadQueue(window.localStorage, show.id));
    }, [show.id]);

    useEffect(() => {
        if (pending.length === 0) return;
        const onOnline = () => void runFlush();
        window.addEventListener("online", onOnline);
        const interval = window.setInterval(() => void runFlush(), FLUSH_INTERVAL_MS);
        return () => {
            window.removeEventListener("online", onOnline);
            window.clearInterval(interval);
        };
    }, [pending.length, runFlush]);

    /** Recorder save path: try live; queue on network failure. */
    const saveSlate = useCallback(
        async (
            classId: string,
            placings: { entryId: string; place: number; note?: string }[],
            markDone: boolean,
        ): Promise<{ queued: boolean; error: string | null }> => {
            try {
                const result = await recordPlacings({ classId, placings, markDone });
                if (!result.success) return { queued: false, error: result.error };
                router.refresh();
                return { queued: false, error: null };
            } catch {
                // Network down — queue and carry on (Barn Mode).
                const queue = enqueueSave(window.localStorage, show.id, {
                    classId,
                    placings,
                    markDone,
                    queuedAt: new Date().toISOString(),
                });
                setPending(queue);
                setStatusOverlay((prev) => {
                    const next = new Map(prev);
                    next.set(classId, markDone ? "placed" : "judging");
                    return next;
                });
                return { queued: true, error: null };
            }
        },
        [router, show.id],
    );

    // ── Run order ──
    const { currentIndex, onDeckIndex } = deriveRunOrder(classes);
    const current = currentIndex !== null ? classes[currentIndex] : null;
    const onDeck = onDeckIndex !== null ? classes[onDeckIndex] : null;
    const judgeable = classes.filter(
        (c) => c.status !== "cancelled" && c.status !== "combined",
    );
    const placedCount = judgeable.filter((c) => c.status === "placed").length;

    const [callError, setCallError] = useState<string | null>(null);
    const [calling, setCalling] = useState<string | null>(null);
    const callClass = async (classId: string) => {
        setCalling(classId);
        setCallError(null);
        try {
            const result = await updateClass({ classId, patch: { status: "called" } });
            if (!result.success) setCallError(result.error);
            else router.refresh();
        } catch {
            setCallError(
                "You look offline — calling a class needs a connection (queued saves still flush when you're back).",
            );
        }
        setCalling(null);
    };

    return (
        <div className="flex flex-col gap-4">
            {/* ── Pending saves — the Barn Mode indicator ── */}
            {pending.length > 0 && (
                <div
                    className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-amber-500/60 bg-card p-3"
                    role="status"
                    data-testid="pending-saves"
                >
                    <span className="stamp">
                        {pending.length} save{pending.length === 1 ? "" : "s"} pending
                    </span>
                    <span className="text-sm text-secondary-foreground">
                        Recorded here, waiting for signal — they retry automatically when
                        you&apos;re back online.
                    </span>
                    <Button variant="outline" size="sm" onClick={() => void runFlush()}>
                        Retry now
                    </Button>
                </div>
            )}
            {queueNotice && (
                <p role="alert" className="m-0 text-sm font-semibold text-destructive">
                    {queueNotice}
                </p>
            )}

            {/* ── NOW JUDGING masthead ── */}
            <section
                className="leather-panel stitched rounded-lg p-5 sm:p-6"
                aria-label="Now judging"
            >
                {!running ? (
                    <div className="flex flex-col gap-2">
                        {/* Friendly guidance — the ring opens with the show. */}
                        <span className="text-xs font-semibold tracking-wide uppercase text-(--leather-text-muted)">
                            The ring is quiet
                        </span>
                        <p className="m-0 text-lg font-bold text-(--leather-text)">
                            This show is {formatStatus(show.status)} — the ring console opens
                            when it&apos;s running.
                        </p>
                        <p className="m-0 text-sm text-(--leather-text-soft)">
                            {canManage
                                ? "Start the day from the show console (Overview → status), then come back here to call the first class."
                                : "Ask the host to start the show, then this page runs the day."}
                        </p>
                    </div>
                ) : current ? (
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold tracking-wide uppercase text-(--leather-text-muted)">
                            Now judging
                        </span>
                        <p
                            className="m-0 font-serif text-3xl font-bold text-(--leather-text) sm:text-4xl"
                            data-testid="now-judging"
                        >
                            {classLabel(current)}
                        </p>
                        <p className="m-0 text-sm text-(--leather-text-soft)">
                            {current.divisionName} · {current.sectionName} ·{" "}
                            {current.entries.length} entr
                            {current.entries.length === 1 ? "y" : "ies"}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold tracking-wide uppercase text-(--leather-text-muted)">
                            Now judging
                        </span>
                        <p className="m-0 text-lg font-bold text-(--leather-text)">
                            No class on the table — call the next one.
                        </p>
                    </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className="stamp bg-(--paper-lit)" data-testid="ring-progress">
                        {placedCount} of {judgeable.length} classes placed
                    </span>
                    {onDeck && (
                        <span className="text-sm text-(--leather-text-soft)">
                            <span className="font-semibold uppercase text-(--leather-text-muted)">
                                On deck:
                            </span>{" "}
                            <span className="text-(--leather-text)" data-testid="on-deck">
                                {classLabel(onDeck)}
                            </span>
                        </span>
                    )}
                    {running && onDeck && (
                        <Button
                            size="sm"
                            onClick={() => callClass(onDeck.classId)}
                            disabled={calling !== null}
                            data-testid="call-on-deck"
                        >
                            {calling === onDeck.classId ? "Calling…" : "Call to the table"}
                        </Button>
                    )}
                </div>
            </section>

            {callError && (
                <p role="alert" className="m-0 text-sm font-semibold text-destructive">
                    {callError}
                </p>
            )}

            {/* ── The placing recorder for the current class ── */}
            {running && current && (
                <RingPlacingRecorder
                    key={`${current.classId}-${current.entries.map((e) => e.place).join(",")}`}
                    cls={current}
                    canManage={canManage}
                    onSave={saveSlate}
                    sectionClasses={classes.filter(
                        (c) =>
                            c.sectionId === current.sectionId &&
                            c.classId !== current.classId &&
                            (c.status === "scheduled" || c.status === "called"),
                    )}
                />
            )}

            {/* ── Run order board ── */}
            <section className="ledger-card" aria-labelledby="run-order-heading">
                <span className="ledger-tab" id="run-order-heading">
                    Run Order
                </span>
                <ul className="flex list-none flex-col gap-1.5 p-0">
                    {classes.map((cls) => {
                        const isCurrent = current?.classId === cls.classId;
                        const done = cls.status === "placed";
                        const dead = cls.status === "cancelled" || cls.status === "combined";
                        return (
                            <li
                                key={cls.classId}
                                className={`flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 ${
                                    isCurrent
                                        ? "border-forest ring-1 ring-forest"
                                        : "border-input"
                                } ${dead ? "opacity-50" : ""}`}
                                data-testid="run-order-row"
                            >
                                <span
                                    className={`text-base font-semibold ${done || dead ? "text-muted-foreground" : "text-foreground"}`}
                                >
                                    {classLabel(cls)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {cls.sectionName} · {cls.entries.length} entr
                                    {cls.entries.length === 1 ? "y" : "ies"}
                                </span>
                                <span className="stamp ml-auto">{formatStatus(cls.status)}</span>
                                {running && cls.status === "scheduled" && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => callClass(cls.classId)}
                                        disabled={calling !== null}
                                    >
                                        {calling === cls.classId ? "Calling…" : "Call"}
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </section>

            {/* ── The championship ladder ── */}
            <CallbackLadder
                showId={show.id}
                canRecord={running}
                classes={classes.map((c) => ({
                    classId: c.classId,
                    sectionId: c.sectionId,
                    divisionId: c.divisionId,
                    status: c.status,
                    entries: c.entries.map((e) => ({
                        id: e.id,
                        horseName: e.horseName,
                        entryNumber: e.entryNumber,
                        photoUrl: null, // live shows judge the model, not a photo
                        place: e.place,
                    })),
                }))}
                sections={sections}
                divisions={divisions}
                callbacks={callbacks}
                onSaved={() => router.refresh()}
            />
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// The placing recorder — leg tags first, gloves-and-sunlight big.
// ══════════════════════════════════════════════════════════════

function RingPlacingRecorder({
    cls,
    canManage,
    onSave,
    sectionClasses,
}: {
    cls: RingClass;
    canManage: boolean;
    onSave: (
        classId: string,
        placings: { entryId: string; place: number }[],
        markDone: boolean,
    ) => Promise<{ queued: boolean; error: string | null }>;
    /** Sibling classes still awaiting judging (combine targets). */
    sectionClasses: RingClass[];
}) {
    const router = useRouter();
    const [order, setOrder] = useState<string[]>(() =>
        cls.entries
            .filter((e) => e.place !== null)
            .sort((a, b) => (a.place as number) - (b.place as number))
            .map((e) => e.id),
    );
    const [saving, setSaving] = useState<"save" | "done" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [dialog, setDialog] = useState<"split" | "combine" | null>(null);

    const placeOf = (entryId: string): Place | null => {
        const i = order.indexOf(entryId);
        return i >= 0 ? ((i + 1) as Place) : null;
    };

    const toggleEntry = (entryId: string) => {
        setError(null);
        setOrder((prev) => {
            if (prev.includes(entryId)) return prev.filter((id) => id !== entryId);
            if (prev.length >= MAX_PLACE) return prev;
            return [...prev, entryId];
        });
    };

    const save = async (markDone: boolean) => {
        setSaving(markDone ? "done" : "save");
        setError(null);
        setNotice(null);
        const result = await onSave(
            cls.classId,
            order.map((entryId, i) => ({ entryId, place: i + 1 })),
            markDone,
        );
        setSaving(null);
        if (result.error) setError(result.error);
        else if (result.queued) {
            setNotice("No signal — this slate is queued and will save when you're back online.");
        }
    };

    return (
        <section className="ledger-card" aria-label={`Placing ${classLabel(cls)}`}>
            <div className="flex flex-wrap items-center gap-3">
                <span className="ledger-tab !mb-0">Record Placings</span>
                <span className="text-sm text-muted-foreground">
                    Tap leg tags in placing order — first tap is 1st. Tap again to remove.
                </span>
            </div>

            {cls.entries.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                    No live entries on the table for this class — save &amp; mark it done to
                    move on.
                </p>
            ) : (
                <ul className="mt-4 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
                    {cls.entries.map((entry) => {
                        const place = placeOf(entry.id);
                        return (
                            <li key={entry.id}>
                                <button
                                    type="button"
                                    data-testid="ring-entry"
                                    aria-pressed={place !== null}
                                    aria-label={
                                        place !== null
                                            ? `Entry ${entry.entryNumber ?? "untagged"} ${entry.horseName} — ${placeLabel(place)}. Tap to remove.`
                                            : `Entry ${entry.entryNumber ?? "untagged"} ${entry.horseName} — tap to place`
                                    }
                                    className={`flex min-h-24 w-full cursor-pointer flex-col items-start justify-between gap-1 rounded-lg border-2 bg-card p-3 text-left transition-all ${
                                        place !== null
                                            ? "border-forest ring-2 ring-forest"
                                            : "border-input"
                                    }`}
                                    onClick={() => toggleEntry(entry.id)}
                                >
                                    <span className="flex w-full items-start justify-between gap-2">
                                        {/* THE LEG TAG — how the steward knows the horse. */}
                                        <span className="font-mono text-3xl font-bold text-foreground">
                                            {entry.entryNumber !== null
                                                ? `#${entry.entryNumber}`
                                                : "—"}
                                        </span>
                                        {place !== null && (
                                            <span
                                                className="stamp inline-flex items-center gap-1.5 bg-(--paper-lit)"
                                                data-testid="ring-place-chip"
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
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        {entry.horseName}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {error && (
                <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}
            {notice && (
                <p role="status" className="mt-3 text-sm font-semibold text-secondary-foreground">
                    {notice}
                </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                    size="wide"
                    onClick={() => save(true)}
                    disabled={saving !== null}
                    data-testid="ring-save-done"
                >
                    {saving === "done" ? "Saving…" : "Save & class done"}
                </Button>
                <Button
                    variant="outline"
                    onClick={() => save(false)}
                    disabled={saving !== null}
                    data-testid="ring-save-draft"
                >
                    {saving === "save" ? "Saving…" : "Save draft"}
                </Button>
                {order.length > 0 && (
                    <Badge variant="secondary">
                        {order.length} place{order.length === 1 ? "" : "s"}
                    </Badge>
                )}
                {/* Split/combine — the day-of pressure valves (host/co-host,
                    legal only while the class awaits judging; the actions
                    refuse illegal states with their own reasons). */}
                {canManage && (
                    <span className="ml-auto flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDialog("split")}
                            data-testid="open-split"
                        >
                            Split class…
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDialog("combine")}
                            data-testid="open-combine"
                        >
                            Combine…
                        </Button>
                    </span>
                )}
            </div>

            {dialog === "split" && (
                <SplitDialog
                    cls={cls}
                    onClose={() => setDialog(null)}
                    onDone={() => {
                        setDialog(null);
                        router.refresh();
                    }}
                />
            )}
            {dialog === "combine" && (
                <CombineDialog
                    cls={cls}
                    candidates={sectionClasses}
                    onClose={() => setDialog(null)}
                    onDone={() => {
                        setDialog(null);
                        router.refresh();
                    }}
                />
            )}
        </section>
    );
}

// ══════════════════════════════════════════════════════════════
// Split / combine dialogs — minimal, driving the existing actions.
// ══════════════════════════════════════════════════════════════

function SplitDialog({
    cls,
    onClose,
    onDone,
}: {
    cls: RingClass;
    onClose: () => void;
    onDone: () => void;
}) {
    const [name, setName] = useState(`${cls.className} B`);
    const [moving, setMoving] = useState<Set<string>>(() => new Set());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggle = (entryId: string) =>
        setMoving((prev) => {
            const next = new Set(prev);
            if (next.has(entryId)) next.delete(entryId);
            else next.add(entryId);
            return next;
        });

    const submit = async () => {
        setBusy(true);
        setError(null);
        const result = await splitClass({
            classId: cls.classId,
            newClassName: name,
            entryIdsToMove: [...moving],
        });
        setBusy(false);
        if (!result.success) {
            setError(result.error);
            return;
        }
        onDone();
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Split {classLabel(cls)}</DialogTitle>
                    <DialogDescription>
                        Tap the leg tags that MOVE to the new class; the rest stay. Lineage
                        is preserved — the published classlist is never destroyed.
                    </DialogDescription>
                </DialogHeader>
                <label className="flex flex-col gap-1 text-sm font-medium">
                    New class name
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={120}
                    />
                </label>
                <ul className="grid max-h-60 list-none grid-cols-2 gap-2 overflow-y-auto p-0 sm:grid-cols-3">
                    {cls.entries.map((entry) => (
                        <li key={entry.id}>
                            <button
                                type="button"
                                aria-pressed={moving.has(entry.id)}
                                className={`flex min-h-12 w-full cursor-pointer items-baseline gap-2 rounded-md border-2 bg-card px-3 py-2 text-left ${
                                    moving.has(entry.id)
                                        ? "border-forest ring-1 ring-forest"
                                        : "border-input"
                                }`}
                                onClick={() => toggle(entry.id)}
                            >
                                <span className="font-mono text-lg font-bold">
                                    {entry.entryNumber !== null ? `#${entry.entryNumber}` : "—"}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                    {entry.horseName}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
                {error && (
                    <p role="alert" className="text-sm font-semibold text-destructive">
                        {error}
                    </p>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button
                        onClick={submit}
                        disabled={busy || moving.size === 0 || name.trim().length === 0}
                        data-testid="confirm-split"
                    >
                        {busy ? "Splitting…" : `Split off ${moving.size} entr${moving.size === 1 ? "y" : "ies"}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function CombineDialog({
    cls,
    candidates,
    onClose,
    onDone,
}: {
    cls: RingClass;
    /** Sibling classes still awaiting judging. */
    candidates: RingClass[];
    onClose: () => void;
    onDone: () => void;
}) {
    const [name, setName] = useState(cls.className);
    const [picked, setPicked] = useState<Set<string>>(() => new Set());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggle = (classId: string) =>
        setPicked((prev) => {
            const next = new Set(prev);
            if (next.has(classId)) next.delete(classId);
            else next.add(classId);
            return next;
        });

    const submit = async () => {
        setBusy(true);
        setError(null);
        const result = await combineClasses({
            classIds: [cls.classId, ...picked],
            newClassName: name,
        });
        setBusy(false);
        if (!result.success) {
            setError(result.error);
            return;
        }
        onDone();
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Combine {classLabel(cls)}</DialogTitle>
                    <DialogDescription>
                        Pick the classes to fold together with this one. Entries move to the
                        combined class; the sources close with their lineage kept.
                    </DialogDescription>
                </DialogHeader>
                <label className="flex flex-col gap-1 text-sm font-medium">
                    Combined class name
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={120}
                    />
                </label>
                {candidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No other classes in this section are still awaiting judging.
                    </p>
                ) : (
                    <ul className="flex max-h-60 list-none flex-col gap-2 overflow-y-auto p-0">
                        {candidates.map((candidate) => (
                            <li key={candidate.classId}>
                                <button
                                    type="button"
                                    aria-pressed={picked.has(candidate.classId)}
                                    className={`flex min-h-12 w-full cursor-pointer flex-wrap items-baseline gap-2 rounded-md border-2 bg-card px-3 py-2 text-left ${
                                        picked.has(candidate.classId)
                                            ? "border-forest ring-1 ring-forest"
                                            : "border-input"
                                    }`}
                                    onClick={() => toggle(candidate.classId)}
                                >
                                    <span className="text-sm font-semibold">
                                        {classLabel(candidate)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {candidate.entries.length} entr
                                        {candidate.entries.length === 1 ? "y" : "ies"}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {error && (
                    <p role="alert" className="text-sm font-semibold text-destructive">
                        {error}
                    </p>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button
                        onClick={submit}
                        disabled={busy || picked.size === 0 || name.trim().length === 0}
                        data-testid="confirm-combine"
                    >
                        {busy ? "Combining…" : `Combine ${picked.size + 1} classes`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
