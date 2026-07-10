"use client";

/**
 * Phase E2 — THE CALLBACK LADDER (shared by the live ring console
 * and the online judge queue's championship round).
 *
 * section → division → show: each round surfaces its candidates as
 * big tap targets (leg tags for live shows; photos side by side for
 * online). Tap order picks Champion then Reserve — the same
 * interaction as the placing recorder, capped at two. Save writes
 * through recordCallback; the server re-derives the ladder and
 * refuses anything that isn't a legal candidate.
 *
 * All ladder rules live in src/lib/shows/callbacks.ts — this
 * component renders buildCallbackLadder verbatim.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { recordCallback } from "@/app/actions/shows-v2-ring";
import {
    buildCallbackLadder,
    type CallbackRecord,
    type LadderRound,
} from "@/lib/shows/callbacks";
import { championHex, championLabel } from "@/lib/shows/placings";
import type { CallbackScope, ClassStatus, Place } from "@/lib/shows/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface LadderEntryInfo {
    id: string;
    horseName: string;
    entryNumber: number | null;
    /** Online shows judge photos; live shows pass null. */
    photoUrl: string | null;
    place: Place | null;
}

export interface LadderClassInfo {
    classId: string;
    sectionId: string;
    divisionId: string;
    status: ClassStatus;
    entries: LadderEntryInfo[];
}

interface CallbackLadderProps {
    showId: string;
    canRecord: boolean;
    classes: LadderClassInfo[];
    sections: { id: string; name: string; divisionId: string }[];
    divisions: { id: string; name: string }[];
    callbacks: CallbackRecord[];
    /** Fresh server data wanted (router.refresh by the parent). */
    onSaved: () => void;
}

export default function CallbackLadder({
    showId,
    canRecord,
    classes,
    sections,
    divisions,
    callbacks,
    onSaved,
}: CallbackLadderProps) {
    const ladder = useMemo(
        () =>
            buildCallbackLadder({
                classes: classes.map((c) => ({
                    classId: c.classId,
                    sectionId: c.sectionId,
                    divisionId: c.divisionId,
                    status: c.status,
                    entries: c.entries.map((e) => ({ id: e.id, place: e.place })),
                })),
                sections,
                divisions,
                callbacks,
            }),
        [classes, sections, divisions, callbacks],
    );

    const entryById = useMemo(() => {
        const map = new Map<string, LadderEntryInfo>();
        for (const cls of classes) for (const e of cls.entries) map.set(e.id, e);
        return map;
    }, [classes]);

    const rounds = [
        ...ladder.sections,
        ...ladder.divisions,
        ...(ladder.show ? [ladder.show] : []),
    ];
    if (rounds.length === 0) return null;

    const decided = rounds.filter((r) => r.state === "decided").length;

    return (
        <section className="ledger-card" aria-labelledby="callback-ladder-heading">
            <div className="flex flex-wrap items-center gap-3">
                <span className="ledger-tab !mb-0" id="callback-ladder-heading">
                    Championship Callbacks
                </span>
                <span className="stamp" data-testid="ladder-progress">
                    {decided} of {rounds.length} callbacks decided
                </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
                Section champions come from the 1st-place entries; division champions from
                the section champions; the grand champion from the division champions. Tap
                Champion first, then Reserve.
            </p>
            <div className="mt-4 flex flex-col gap-4">
                {rounds.map((round) => (
                    <CallbackRound
                        key={`${round.scope}:${round.scopeId ?? "show"}`}
                        showId={showId}
                        round={round}
                        canRecord={canRecord}
                        entryById={entryById}
                        onSaved={onSaved}
                    />
                ))}
            </div>
        </section>
    );
}

function roundTitle(round: LadderRound): string {
    if (round.scope === "section") {
        return round.divisionName ? `${round.divisionName} · ${round.label}` : round.label;
    }
    if (round.scope === "division") return round.label;
    return "Grand Championship";
}

function scopeBadge(scope: CallbackScope): string {
    return scope === "section" ? "Section" : scope === "division" ? "Division" : "Show";
}

function CallbackRound({
    showId,
    round,
    canRecord,
    entryById,
    onSaved,
}: {
    showId: string;
    round: LadderRound;
    canRecord: boolean;
    entryById: Map<string, LadderEntryInfo>;
    onSaved: () => void;
}) {
    const router = useRouter();
    // Tap order: [champion, reserve]. Pre-filled from the record.
    const [order, setOrder] = useState<string[]>(() =>
        [round.championEntryId, round.reserveEntryId].filter((id): id is string => !!id),
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const waiting = round.state === "waiting";
    const dirty =
        order[0] !== (round.championEntryId ?? undefined) ||
        (order[1] ?? null) !== round.reserveEntryId;

    const toggle = (entryId: string) => {
        if (!canRecord || waiting) return;
        setError(null);
        setOrder((prev) => {
            if (prev.includes(entryId)) return prev.filter((id) => id !== entryId);
            if (prev.length >= 2) return prev;
            return [...prev, entryId];
        });
    };

    const save = async () => {
        if (order.length === 0) return;
        setSaving(true);
        setError(null);
        const result = await recordCallback({
            showId,
            scope: round.scope,
            scopeId: round.scopeId,
            championEntryId: order[0],
            reserveEntryId: order[1] ?? null,
        });
        setSaving(false);
        if (!result.success) {
            setError(result.error);
            return;
        }
        onSaved();
        router.refresh();
    };

    return (
        <div
            className={`rounded-lg border p-3 ${
                round.state === "open"
                    ? "border-forest bg-card"
                    : "border-input bg-card"
            }`}
            data-testid="callback-round"
            data-scope={round.scope}
        >
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant={round.scope === "show" ? "default" : "secondary"}>
                    {scopeBadge(round.scope)}
                </Badge>
                <h3 className="m-0 text-base font-bold text-foreground">
                    {roundTitle(round)}
                </h3>
                {round.state === "decided" && (
                    <span className="stamp" data-testid="round-decided">
                        decided
                    </span>
                )}
                {waiting && (
                    <span className="text-xs text-muted-foreground" data-testid="round-waiting">
                        {round.scope === "section"
                            ? "Opens when every class in this section is placed."
                            : round.scope === "division"
                              ? "Opens when every section champion is chosen."
                              : "Opens when every division champion is chosen."}
                    </span>
                )}
            </div>

            {!waiting && (
                <>
                    <ul className="mt-3 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4">
                        {round.candidateEntryIds.map((entryId) => {
                            const entry = entryById.get(entryId);
                            if (!entry) return null;
                            const pickIndex = order.indexOf(entryId);
                            const kind =
                                pickIndex === 0 ? "champion" : pickIndex === 1 ? "reserve" : null;
                            return (
                                <li key={entryId}>
                                    <button
                                        type="button"
                                        data-testid="callback-candidate"
                                        aria-pressed={kind !== null}
                                        aria-label={
                                            kind !== null
                                                ? `${entry.horseName} — ${championLabel(kind, round.scope)}. Tap to remove.`
                                                : `${entry.horseName} — tap to pick`
                                        }
                                        className={`relative min-h-16 w-full cursor-pointer overflow-hidden rounded-lg border-2 bg-card p-0 text-left transition-all ${
                                            kind !== null
                                                ? "border-forest ring-2 ring-forest"
                                                : "border-input"
                                        } ${!canRecord ? "cursor-default opacity-80" : ""}`}
                                        onClick={() => toggle(entryId)}
                                        disabled={!canRecord}
                                    >
                                        {entry.photoUrl && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={entry.photoUrl}
                                                alt={entry.horseName}
                                                className="aspect-square w-full object-cover"
                                                loading="lazy"
                                            />
                                        )}
                                        {kind !== null && (
                                            <span
                                                className="stamp absolute top-2 left-2 inline-flex items-center gap-1.5 bg-(--paper-lit)"
                                                data-testid="champion-chip"
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    className="inline-block h-2.5 w-2.5 rounded-full border border-border"
                                                    style={{ backgroundColor: championHex(kind) }}
                                                />
                                                {championLabel(kind, round.scope)}
                                            </span>
                                        )}
                                        <div className="flex items-baseline gap-2 px-3 py-2.5">
                                            {entry.entryNumber !== null && (
                                                <span className="font-mono text-lg font-bold text-foreground">
                                                    #{entry.entryNumber}
                                                </span>
                                            )}
                                            <span className="truncate text-sm font-medium text-foreground">
                                                {entry.horseName}
                                            </span>
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    {error && (
                        <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
                            {error}
                        </p>
                    )}

                    {canRecord && (
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                            <Button
                                onClick={save}
                                disabled={saving || order.length === 0 || !dirty}
                                data-testid="save-callback"
                            >
                                {saving
                                    ? "Saving…"
                                    : order.length === 2
                                      ? "Save champion & reserve"
                                      : "Save champion"}
                            </Button>
                            {order.length === 1 && (
                                <span className="text-xs text-muted-foreground">
                                    Tap a second entry for Reserve (optional).
                                </span>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
