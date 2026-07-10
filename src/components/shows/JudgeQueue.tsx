"use client";

/**
 * Phase E1 — the online JUDGE QUEUE (/shows/host/[id]/judge).
 * Class-by-class: every entry photo side by side, tap entries in
 * the order they place (1st, 2nd, … 6th — the placings.ts
 * vocabulary), optional per-entry critique, then save the slate
 * (whole-class batch via recordPlacings) and mark the class done.
 *
 * Mobile-first by design — judges work from tablets and phones.
 * Blind judging: when the payload carries no owner aliases the
 * queue shows leg-tag numbers only (server-enforced, see
 * getJudgeQueue).
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { recordPlacings } from "@/app/actions/shows-v2";
import type { JudgeQueueClass, JudgeQueueData } from "@/lib/shows/gallery";
import { MAX_PLACE, placeLabel, ribbonHex } from "@/lib/shows/placings";
import type { Place } from "@/lib/shows/types";
import PhotoLightbox from "@/components/PhotoLightbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function classLabel(cls: { classNumber: string | null; className: string }): string {
    return cls.classNumber ? `${cls.classNumber} · ${cls.className}` : cls.className;
}

export default function JudgeQueue({ queue }: { queue: JudgeQueueData }) {
    const { show, classes } = queue;
    const [activeIndex, setActiveIndex] = useState(() => {
        // Open at the first class still awaiting placement.
        const first = classes.findIndex((c) => c.status !== "placed");
        return first >= 0 ? first : 0;
    });
    // Remount the per-class recorder whenever fresh server data flows.
    const [refreshNonce, setRefreshNonce] = useState(0);

    const placedCount = classes.filter((c) => c.status === "placed").length;
    const activeClass = classes[activeIndex];
    const canRecord = show.status === "judging";

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
            {/* ── Progress + class navigation ── */}
            <div className="ledger-card">
                <span className="ledger-tab">Judging Progress</span>
                <div className="flex flex-wrap items-center gap-3">
                    <span className="stamp" data-testid="judge-progress">
                        {placedCount} of {classes.length} classes placed
                    </span>
                    {!canRecord && (
                        <span className="text-sm text-muted-foreground">
                            {show.status === "results_review"
                                ? "This show is in results review — reopen judging from the console to change placings."
                                : "Recording opens when the show enters judging."}
                        </span>
                    )}
                </div>
                <div
                    className="mt-3 flex gap-1 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]"
                    role="tablist"
                    aria-label="Classes"
                >
                    {classes.map((cls, i) => (
                        <button
                            key={cls.classId}
                            role="tab"
                            aria-selected={i === activeIndex}
                            title={classLabel(cls)}
                            className={`flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-md border px-2 font-mono text-xs font-semibold whitespace-nowrap transition-all ${
                                i === activeIndex
                                    ? "border-forest bg-forest text-primary-foreground"
                                    : cls.status === "placed"
                                      ? "border-forest/40 bg-muted text-forest"
                                      : "border-input bg-card text-muted-foreground"
                            }`}
                            onClick={() => setActiveIndex(i)}
                        >
                            {cls.classNumber ?? i + 1}
                            {cls.status === "placed" && <span aria-label="placed"> ✓</span>}
                        </button>
                    ))}
                </div>
            </div>

            {activeClass && (
                <ClassRecorder
                    key={`${activeClass.classId}-${refreshNonce}`}
                    cls={activeClass}
                    canRecord={canRecord}
                    onSaved={() => {
                        setRefreshNonce((n) => n + 1);
                    }}
                    onNext={
                        activeIndex < classes.length - 1
                            ? () => setActiveIndex(activeIndex + 1)
                            : null
                    }
                />
            )}
        </div>
    );
}

/** One class's tap-to-place recorder. Remounted per class/save. */
function ClassRecorder({
    cls,
    canRecord,
    onSaved,
    onNext,
}: {
    cls: JudgeQueueClass;
    canRecord: boolean;
    onSaved: () => void;
    onNext: (() => void) | null;
}) {
    const router = useRouter();
    // The slate: entry ids in place order (index 0 = 1st).
    const [order, setOrder] = useState<string[]>(() =>
        cls.entries
            .filter((e) => e.place !== null)
            .sort((a, b) => (a.place as number) - (b.place as number))
            .map((e) => e.id),
    );
    const [notes, setNotes] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        for (const e of cls.entries) if (e.note) initial[e.id] = e.note;
        return initial;
    });
    const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null);
    const [saving, setSaving] = useState<"save" | "done" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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

    const placeOf = (entryId: string): Place | null => {
        const i = order.indexOf(entryId);
        return i >= 0 ? ((i + 1) as Place) : null;
    };

    /** Tap: unplaced entries take the next open place; placed
     *  entries step back out (everyone below moves up). */
    const toggleEntry = (entryId: string) => {
        if (!canRecord) return;
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
        const result = await recordPlacings({
            classId: cls.classId,
            placings: order.map((entryId, i) => ({
                entryId,
                place: i + 1,
                note: notes[entryId]?.trim() ? notes[entryId].trim() : undefined,
            })),
            markDone,
        });
        setSaving(null);
        if (!result.success) {
            setError(result.error);
            return;
        }
        onSaved();
        router.refresh();
        if (markDone && onNext) onNext();
    };

    return (
        <section className="ledger-card" aria-label={`Judging ${classLabel(cls)}`}>
            <div className="flex flex-wrap items-center gap-3">
                <span className="ledger-tab !mb-0">{classLabel(cls)}</span>
                <span className="text-xs text-muted-foreground">
                    {cls.divisionName} · {cls.sectionName}
                </span>
                {cls.status === "placed" && <span className="stamp">placed</span>}
            </div>

            {cls.entries.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                    No live entries in this class — mark it done and move on.
                </p>
            ) : (
                <>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Tap entries in placing order — first tap is 1st place. Tap again to
                        remove. {MAX_PLACE} places maximum.
                    </p>
                    <ul className="mt-3 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3">
                        {cls.entries.map((entry) => {
                            const place = placeOf(entry.id);
                            return (
                                <li key={entry.id} className="flex flex-col gap-1.5">
                                    <button
                                        type="button"
                                        data-testid="judge-entry"
                                        aria-pressed={place !== null}
                                        aria-label={
                                            place !== null
                                                ? `${entry.horseName} — ${placeLabel(place)}. Tap to remove.`
                                                : `${entry.horseName} — tap to place`
                                        }
                                        className={`relative min-h-11 cursor-pointer overflow-hidden rounded-lg border-2 bg-card p-0 text-left transition-all ${
                                            place !== null
                                                ? "border-forest ring-2 ring-forest"
                                                : "border-input"
                                        }`}
                                        onClick={() => toggleEntry(entry.id)}
                                    >
                                        {entry.photoUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={entry.photoUrl}
                                                alt={entry.horseName}
                                                className="aspect-square w-full object-cover"
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
                                        {place !== null && (
                                            <span
                                                className="stamp absolute top-2 left-2 inline-flex items-center gap-1.5 bg-(--paper-lit)"
                                                data-testid="place-chip"
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    className="inline-block h-2.5 w-2.5 rounded-full border border-border"
                                                    style={{
                                                        backgroundColor: ribbonHex(place) ?? undefined,
                                                    }}
                                                />
                                                {placeLabel(place)}
                                            </span>
                                        )}
                                        <div className="flex items-baseline gap-1.5 px-2 py-1.5">
                                            {entry.entryNumber !== null && (
                                                <span className="font-mono text-xs text-muted-foreground">
                                                    #{entry.entryNumber}
                                                </span>
                                            )}
                                            <span className="truncate text-sm font-medium text-foreground">
                                                {entry.horseName}
                                            </span>
                                        </div>
                                        {entry.ownerAlias !== null && (
                                            <div className="px-2 pb-1.5 text-xs text-muted-foreground">
                                                @{entry.ownerAlias}
                                            </div>
                                        )}
                                    </button>
                                    <div className="flex items-center gap-2">
                                        {entry.photoUrl && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    setLightboxIndex(
                                                        lightboxImages.findIndex(
                                                            (img) => img.url === entry.photoUrl,
                                                        ),
                                                    )
                                                }
                                            >
                                                Zoom
                                            </Button>
                                        )}
                                        {canRecord && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                aria-expanded={noteOpenFor === entry.id}
                                                onClick={() =>
                                                    setNoteOpenFor((cur) =>
                                                        cur === entry.id ? null : entry.id,
                                                    )
                                                }
                                            >
                                                {notes[entry.id]?.trim() ? "Critique ✎" : "Critique"}
                                            </Button>
                                        )}
                                    </div>
                                    {noteOpenFor === entry.id && (
                                        <Textarea
                                            value={notes[entry.id] ?? ""}
                                            onChange={(e) =>
                                                setNotes((prev) => ({
                                                    ...prev,
                                                    [entry.id]: e.target.value,
                                                }))
                                            }
                                            placeholder="Optional critique for the entrant…"
                                            maxLength={2000}
                                            rows={3}
                                            aria-label={`Critique for ${entry.horseName}`}
                                        />
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}

            {error && (
                <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}

            {canRecord && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                        onClick={() => save(true)}
                        disabled={saving !== null}
                        data-testid="save-done"
                    >
                        {saving === "done" ? "Saving…" : "Save & mark class done"}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => save(false)}
                        disabled={saving !== null}
                        data-testid="save-placings"
                    >
                        {saving === "save" ? "Saving…" : "Save placings"}
                    </Button>
                    {order.length > 0 && (
                        <Badge variant="secondary">
                            {order.length} place{order.length === 1 ? "" : "s"} assigned
                        </Badge>
                    )}
                </div>
            )}
            {!canRecord && onNext && (
                <div className="mt-4">
                    <Button variant="outline" onClick={onNext}>
                        Next class →
                    </Button>
                </div>
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
