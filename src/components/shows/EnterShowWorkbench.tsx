"use client";

/**
 * THE ENTRY PAGE (/shows/[id]/enter) — the single owner of entering a
 * show. Classes on the left, your horses for the current class in the
 * middle (pre-filtered by the entrant ledger, with an "Other horses"
 * fold that says why), the horses you picked on the right, and
 * "Enter class" commits them in one press and moves on to the next
 * class with room. Phones stack it: class strip on top, horses as the
 * body, the selection as a docked bottom sheet carrying the button.
 *
 * Every decision comes from lib/shows/entrantLedger (built from the
 * server's own myEntries after each press — no optimistic guesses);
 * the server (enterClassBatch → enterOne → validateEntry + RLS)
 * stays the authority and its refusals are shown verbatim.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { enterClassBatch } from "@/app/actions/shows-v2";
import { track } from "@/lib/analytics";
import type { ConsoleDivision } from "@/lib/shows/console";
import { DOC_KINDS, type DocKind } from "@/lib/shows/documents";
import { buildEntrantLedger, classLabel } from "@/lib/shows/entrantLedger";
import type { EntrantHorse, MyShowEntry, PublicShow } from "@/lib/shows/public";
import { MAX_BATCH_ENTRIES } from "@/lib/shows/schemas";
import ClassPane from "@/components/shows/enter/ClassPane";
import ClassRail from "@/components/shows/enter/ClassRail";
import DoneView from "@/components/shows/enter/DoneView";
import PhotoPicker from "@/components/shows/enter/PhotoPicker";
import SelectionPanel from "@/components/shows/enter/SelectionPanel";
import SelectionRow from "@/components/shows/enter/SelectionRow";
import {
    classLimitsText,
    defaultPhotoId,
    EMPTY_SELECTION,
    hasRoom,
    indexClasses,
    nextClassWithRoom,
    type EntryPhoto,
    type SelectedHorse,
} from "@/components/shows/enter/shared";
import { useHorsePhotos } from "@/components/shows/enter/useHorsePhotos";

interface EnterShowWorkbenchProps {
    show: Pick<PublicShow, "id" | "title" | "mode">;
    divisions: ConsoleDivision[];
    myEntries: MyShowEntry[];
    horses: EntrantHorse[];
    initialClassId?: string | null;
    initialHorseId?: string | null;
}

interface Flash {
    label: string;
    items: { horseId: string; name: string; ok: boolean; text: string }[];
}

const isTyping = (el: EventTarget | null) =>
    el instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(el.tagName) || el.isContentEditable);

export default function EnterShowWorkbench({
    show,
    divisions,
    myEntries: initialEntries,
    horses,
    initialClassId = null,
    initialHorseId = null,
}: EnterShowWorkbenchProps) {
    const online = show.mode === "online";
    const [myEntries, setMyEntries] = useState(initialEntries);
    const ledger = useMemo(() => buildEntrantLedger({ divisions, myEntries, horses }), [divisions, myEntries, horses]);
    const consoleClasses = useMemo(() => indexClasses(divisions), [divisions]);
    const horsesById = useMemo(() => new Map(horses.map((h) => [h.id, h])), [horses]);

    const [classId, setClassId] = useState<string | null>(() => {
        if (initialClassId && ledger.byClass[initialClassId]) return initialClassId;
        return ledger.classes.find(hasRoom)?.classId ?? ledger.classes[0]?.classId ?? null;
    });
    const [selection, setSelection] = useState<Map<string, SelectedHorse>>(() => {
        const cls = classId ? ledger.byClass[classId] : undefined;
        const v = cls?.verdicts.find((x) => x.horseId === initialHorseId);
        return v && !v.blocked && cls?.state !== "closed" ? new Map([[v.horseId, EMPTY_SELECTION]]) : new Map();
    });
    const [failed, setFailed] = useState<Record<string, string>>({});
    const [pickerHorseId, setPickerHorseId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [flash, setFlash] = useState<Flash | null>(null);
    const [done, setDone] = useState(false);
    const photos = useHorsePhotos();
    const headingRef = useRef<HTMLHeadingElement>(null);

    const current = classId ? ledger.byClass[classId] : undefined;

    // ── Selection ──
    /** Online: give a newly selected horse its default (primary) photo. */
    const ensurePhoto = useCallback(
        (horseId: string) => {
            if (!online) return;
            const apply = (list: EntryPhoto[]) =>
                setSelection((prev) => {
                    const s = prev.get(horseId);
                    if (!s || s.photoId) return prev;
                    const next = new Map(prev);
                    next.set(horseId, { ...s, photoId: defaultPhotoId(list) });
                    return next;
                });
            const cached = photos.photos[horseId];
            if (cached) apply(cached);
            else void photos.load(horseId).then(apply);
        },
        [online, photos],
    );

    // A ?horse= preselection gets its photo like any other pick.
    const preselected = useRef(false);
    useEffect(() => {
        if (preselected.current) return;
        preselected.current = true;
        for (const id of selection.keys()) ensurePhoto(id);
    }, [selection, ensurePhoto]);

    const updateSel = (horseId: string, patch: Partial<SelectedHorse>) =>
        setSelection((prev) => {
            const next = new Map(prev);
            next.set(horseId, { ...(prev.get(horseId) ?? EMPTY_SELECTION), ...patch });
            return next;
        });

    const toggle = (horseId: string) => {
        // Any horse may be picked for any class (owner, 2026-10-11); the
        // ledger only forecasts, the server refuses. A closed class is the
        // one exception — there is nothing to submit to.
        if (current?.state === "closed") return;
        if (selection.has(horseId)) {
            setSelection((prev) => {
                const next = new Map(prev);
                next.delete(horseId);
                return next;
            });
            if (pickerHorseId === horseId) setPickerHorseId(null);
            return;
        }
        updateSel(horseId, {});
        ensurePhoto(horseId);
    };

    const openPicker = (horseId: string) => {
        if (pickerHorseId === horseId) return setPickerHorseId(null);
        if (!selection.has(horseId)) toggle(horseId);
        else if (!photos.photos[horseId]) void photos.load(horseId);
        setPickerHorseId(horseId);
    };

    // ── Class changes: clear the selection, move focus to the heading ──
    const goToClass = (id: string | null) => {
        setSelection(new Map());
        setFailed({});
        setPickerHorseId(null);
        setError(null);
        if (id) {
            setClassId(id);
            setDone(false);
        } else {
            setDone(true);
        }
    };
    const mounted = useRef(false);
    useEffect(() => {
        if (!mounted.current) {
            mounted.current = true;
            return;
        }
        headingRef.current?.focus();
    }, [classId]);

    // ── Enter class ──
    const remaining = current?.remaining ?? null;
    const blockedReason = !current
        ? "Pick a class first."
        : current.state === "closed"
          ? "This class isn't taking entries."
          : selection.size > MAX_BATCH_ENTRIES
            ? `Enter at most ${MAX_BATCH_ENTRIES} horses at a time.`
            : online && [...selection.values()].some((s) => !s.photoId)
              ? "Every horse needs a judged photo."
              : null;
    // Over the host's per-entrant cap is a warning, not a block: the
    // server refuses the extra horses one by one with its own words.
    const capWarning =
        current && remaining !== null && selection.size > remaining
            ? remaining === 0
                ? "You're already at your limit in this class — these would be refused."
                : `Only ${remaining} more of your horses fit this class — the rest would be refused.`
            : null;
    const canSubmit = !!current && selection.size > 0 && blockedReason === null && !submitting;

    const submit = async () => {
        if (!current || !canSubmit) return;
        setSubmitting(true);
        setError(null);
        const label = classLabel(current);
        const entries = [...selection.entries()].map(([horseId, s]) => {
            const name = horsesById.get(horseId)?.name ?? "this horse";
            const doc = s.doc;
            let documentation: { documentId: string } | { kind: DocKind; title: string; body: string } | undefined;
            if (doc.mode === "existing") documentation = { documentId: doc.documentId };
            else if (doc.mode === "new" && doc.body.trim()) {
                // Same default title the old dialog used: "Breed — Duns Blazing".
                const kindLabel = DOC_KINDS.find((k) => k.value === doc.kind)?.label ?? "Documentation";
                documentation = { kind: doc.kind, title: `${kindLabel} — ${name}`, body: doc.body };
            }
            return {
                horseId,
                photoId: online ? s.photoId : null,
                handlerId: s.handler?.id ?? null,
                documentation,
            };
        });
        const res = await enterClassBatch({ showId: show.id, classId: current.classId, entries }).catch(() => ({
            success: false as const,
            error: "Something went wrong — check your connection and try again.",
        }));
        setSubmitting(false);
        if (!res.success) {
            setError(res.error);
            return;
        }

        const nameOf = (id: string) => horsesById.get(id)?.name ?? "Horse";
        setFlash({
            label,
            items: res.results.map((r) => ({
                horseId: r.horseId,
                name: nameOf(r.horseId),
                ok: r.success,
                text: r.success
                    ? r.documentationNote
                        ? `entered — the documentation didn't save: ${r.documentationNote}`
                        : "entered"
                    : (r.error ?? "not entered"),
            })),
        });
        const ok = res.results.filter((r) => r.success);
        for (let i = 0; i < ok.length; i++) track("show_entry", { show_id: show.id });

        // The server's re-read is the truth; if it failed, add what we know.
        const nextEntries =
            res.myEntries ??
            [
                ...myEntries,
                ...ok.map((r) => ({
                    id: r.entryId ?? `${current.classId}-${r.horseId}`,
                    classId: current.classId,
                    horseId: r.horseId,
                    horseName: nameOf(r.horseId),
                    entryNumber: r.entryNumber ?? null,
                    status: "entered" as const,
                    handlerAlias: null,
                    photoId: selection.get(r.horseId)?.photoId ?? null,
                    place: null,
                })),
            ];
        setMyEntries(nextEntries);

        const refused = res.results.filter((r) => !r.success);
        if (refused.length === 0) {
            const nextLedger = buildEntrantLedger({ divisions, myEntries: nextEntries, horses });
            goToClass(nextClassWithRoom(nextLedger, current.classId));
            return;
        }
        // Some were refused: stay, keep only those selected, with their reasons.
        const refusedIds = new Set(refused.map((r) => r.horseId));
        setSelection((prev) => new Map([...prev].filter(([id]) => refusedIds.has(id))));
        setFailed(Object.fromEntries(refused.map((r) => [r.horseId, r.error ?? "Not entered."])));
    };

    // ── Keyboard: Enter submits a non-empty selection; Escape clears ──
    const keys = useRef({ submit, canSubmit, clear: () => setSelection(new Map()) });
    useEffect(() => {
        keys.current = { submit, canSubmit, clear: () => setSelection(new Map()) };
    });
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (isTyping(e.target)) return;
            if (e.key === "Enter" && keys.current.canSubmit) {
                e.preventDefault();
                void keys.current.submit();
            } else if (e.key === "Escape") {
                keys.current.clear();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    // ── Render ──
    const classesEntered = ledger.classes.filter((c) => c.mineLive > 0).length;
    const nameForEntry = (horseId: string) =>
        horsesById.get(horseId)?.name ?? myEntries.find((e) => e.horseId === horseId)?.horseName ?? "Horse";
    const photoUrlFor = (horseId: string) => {
        const id = selection.get(horseId)?.photoId;
        return (id && photos.photos[horseId]?.find((p) => p.id === id)?.publicUrl) || null;
    };

    return (
        <div className="flex flex-col gap-4 pb-40 lg:pb-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <p className="m-0 text-muted-foreground" data-testid="enter-progress">
                    {ledger.liveEntries} {ledger.liveEntries === 1 ? "entry" : "entries"} in {classesEntered}{" "}
                    {classesEntered === 1 ? "class" : "classes"} · {ledger.classesWithRoom}{" "}
                    {ledger.classesWithRoom === 1 ? "class" : "classes"} with room
                </p>
                <button
                    type="button"
                    className="ml-auto cursor-pointer font-semibold text-forest underline"
                    onClick={() => (done ? goToClass(classId ?? nextClassWithRoom(ledger, null)) : goToClass(null))}
                >
                    {done ? "Back to classes" : "Done"}
                </button>
            </div>

            <div aria-live="polite" role="status">
                {flash && (
                    <div className="rounded-md border border-input bg-card px-3 py-2 text-sm" data-testid="batch-verdicts">
                        <div className="flex items-start gap-2">
                            <span className="flex-1 font-semibold text-foreground">{flash.label}</span>
                            <button type="button" className="cursor-pointer text-muted-foreground" aria-label="Dismiss" onClick={() => setFlash(null)}>
                                ✕
                            </button>
                        </div>
                        <ul className="m-0 list-none p-0">
                            {flash.items.map((it) => (
                                <li key={it.horseId} className={it.ok ? "text-forest" : "font-semibold text-destructive"}>
                                    {it.ok ? "✓" : "✗"} {it.name} — {it.text}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {done || !current ? (
                <DoneView
                    showId={show.id}
                    ledger={ledger}
                    myEntries={myEntries}
                    onKeepEntering={
                        nextClassWithRoom(ledger, null) ? () => goToClass(nextClassWithRoom(ledger, null)) : null
                    }
                />
            ) : (
                <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[260px_minmax(0,1fr)_300px] lg:items-start lg:gap-5">
                    <ClassRail classes={ledger.classes} selectedClassId={classId} onSelect={goToClass} />
                    <ClassPane
                        showId={show.id}
                        cls={current}
                        limits={classLimitsText(
                            consoleClasses.get(current.classId) ?? {
                                maxPerEntrant: current.maxPerEntrant,
                                allowedScales: null,
                                allowedFinishes: null,
                            },
                        )}
                        horsesById={horsesById}
                        online={online}
                        selection={selection}
                        photoUrlFor={photoUrlFor}
                        pickerHorseId={pickerHorseId}
                        renderPicker={(horseId) => (
                            <PhotoPicker
                                horseId={horseId}
                                horseName={nameForEntry(horseId)}
                                photos={photos.photos[horseId]}
                                loading={!!photos.loading[horseId]}
                                selectedPhotoId={selection.get(horseId)?.photoId ?? null}
                                onPick={(photoId) => updateSel(horseId, { photoId })}
                                onUploaded={(p) => {
                                    photos.add(horseId, p);
                                    updateSel(horseId, { photoId: p.id });
                                }}
                                onRefresh={() => void photos.load(horseId)}
                                onClose={() => setPickerHorseId(null)}
                            />
                        )}
                        onToggle={toggle}
                        onChangePhoto={openPicker}
                        headingRef={headingRef}
                    />
                    <SelectionPanel
                        classLabel={classLabel(current)}
                        count={selection.size}
                        remaining={remaining}
                        blockedReason={blockedReason}
                        warning={capWarning}
                        submitting={submitting}
                        error={error}
                        onSubmit={() => void submit()}
                        onSkip={() => goToClass(nextClassWithRoom(ledger, current.classId))}
                        canSkip={!!nextClassWithRoom(ledger, current.classId)}
                        entered={current.myHorseIds.map((horseId) => ({
                            horseId,
                            name: nameForEntry(horseId),
                            photoUrl: online ? photoUrlFor(horseId) : null,
                        }))}
                    >
                        {[...selection.entries()].map(([horseId, sel]) => {
                            const horse = horsesById.get(horseId);
                            if (!horse) return null;
                            return (
                                <SelectionRow
                                    key={horseId}
                                    horse={horse}
                                    sel={sel}
                                    photoUrl={photoUrlFor(horseId)}
                                    online={online}
                                    error={failed[horseId] ?? null}
                                    onChange={(patch) => updateSel(horseId, patch)}
                                    onRemove={() => toggle(horseId)}
                                    onChangePhoto={() => openPicker(horseId)}
                                />
                            );
                        })}
                    </SelectionPanel>
                </div>
            )}
        </div>
    );
}
