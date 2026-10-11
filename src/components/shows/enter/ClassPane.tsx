"use client";

/**
 * The centre of the entry page: the current class, its limits in plain
 * words, then your horses in three tiers the ledger decides —
 *
 *   Looks like it lines up   nothing stands in the way; breed matches
 *                            the class, or the class names no breed
 *   Maybe?                   enterable, but something is uncertain:
 *                            scale or finish may not fit, or the class
 *                            names a breed this horse isn't listed as
 *   Can't enter this class   a rule the server WILL refuse: already in
 *                            this class, already in another halter
 *                            class, or at your limit here
 *
 * The owner asked for the knowns and the warnings to be kept apart
 * (2026-10-11). The horses already in the class live on the right, with
 * the selection — that panel is the answer to "who did I put where".
 */

import { Fragment, type ReactNode, type RefObject } from "react";
import Link from "next/link";

import { classLabel, type ClassLedger, type HorseVerdict } from "@/lib/shows/entrantLedger";
import { friendlyClassStatus } from "@/lib/shows/plainWords";
import type { EntrantHorse } from "@/lib/shows/public";
import HorseCard from "./HorseCard";
import type { SelectedHorse } from "./shared";

interface ClassPaneProps {
    showId: string;
    cls: ClassLedger;
    limits: string;
    horsesById: Map<string, EntrantHorse>;
    online: boolean;
    selection: Map<string, SelectedHorse>;
    photoUrlFor: (horseId: string) => string | null;
    pickerHorseId: string | null;
    renderPicker: (horseId: string) => ReactNode;
    onToggle: (horseId: string) => void;
    onChangePhoto: (horseId: string) => void;
    headingRef: RefObject<HTMLHeadingElement | null>;
}

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4";

function Tier({
    title,
    note,
    count,
    testId,
    children,
}: {
    title: string;
    note: string;
    count: number;
    testId: string;
    children: ReactNode;
}) {
    return (
        <section className="mt-5" data-testid={testId} aria-label={title}>
            <h3 className="m-0 flex items-baseline gap-2 font-serif text-base font-bold text-foreground">
                {title}
                <span className="font-sans text-xs font-normal text-muted-foreground">({count})</span>
            </h3>
            <p className="m-0 mb-2 text-xs text-muted-foreground">{note}</p>
            {children}
        </section>
    );
}

export default function ClassPane({
    showId,
    cls,
    limits,
    horsesById,
    online,
    selection,
    photoUrlFor,
    pickerHorseId,
    renderPicker,
    onToggle,
    onChangePhoto,
    headingRef,
}: ClassPaneProps) {
    const verdictOf = new Map(cls.verdicts.map((v) => [v.horseId, v]));
    const takingEntries = cls.state !== "closed";

    const card = (horseId: string) => {
        const horse = horsesById.get(horseId);
        if (!horse) return null;
        const v: HorseVerdict | undefined = verdictOf.get(horseId);
        const blocked = !!v?.blocked;
        return (
            <Fragment key={horseId}>
                <HorseCard
                    horse={horse}
                    selected={selection.has(horseId)}
                    blocked={blocked}
                    reason={v?.reason ?? v?.hint ?? null}
                    breedMatch={!!v?.breedMatch}
                    photoUrl={online ? photoUrlFor(horseId) : null}
                    showPhotoControl={online}
                    pickerOpen={pickerHorseId === horseId}
                    onToggle={() => onToggle(horseId)}
                    onChangePhoto={() => onChangePhoto(horseId)}
                />
                {pickerHorseId === horseId && !blocked && <div className="col-span-full">{renderPicker(horseId)}</div>}
            </Fragment>
        );
    };

    return (
        <section className="ledger-card min-w-0" aria-labelledby="enter-class-heading">
            <p className="m-0 text-xs tracking-wide text-muted-foreground uppercase">
                {cls.sectionName} · {cls.divisionName}
            </p>
            <h2
                id="enter-class-heading"
                ref={headingRef}
                tabIndex={-1}
                className="m-0 font-serif text-xl font-bold text-forest outline-none"
            >
                {classLabel(cls)}
            </h2>
            <p className="m-0 mt-1 text-sm text-muted-foreground" data-testid="class-limits">
                {limits}
            </p>

            {!takingEntries ? (
                <p className="mt-4 text-sm text-muted-foreground" role="note">
                    This class isn&rsquo;t taking entries ({friendlyClassStatus(cls.status).toLowerCase()}).
                </p>
            ) : horsesById.size === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground" role="note">
                    You need at least one public horse to enter.{" "}
                    <Link
                        href={`/add-horse?returnTo=${encodeURIComponent(`/shows/${showId}/enter`)}`}
                        className="font-semibold text-forest underline"
                    >
                        Add a horse
                    </Link>{" "}
                    (or make one public in your stable), then come back.
                </p>
            ) : (
                <>
                    {cls.state === "full" && (
                        <p className="mt-3 text-sm font-semibold text-muted-foreground" role="note">
                            You&rsquo;re at your limit in this class.
                        </p>
                    )}

                    {cls.fits.length > 0 && (
                        <Tier
                            title="Looks like it lines up"
                            note={
                                cls.breedNamed
                                    ? "Listed as the breed this class is for, and nothing else stands in the way."
                                    : "Nothing stands in the way."
                            }
                            count={cls.fits.length}
                            testId="fits-horses"
                        >
                            <div className={GRID}>{cls.fits.map(card)}</div>
                        </Tier>
                    )}

                    {cls.maybe.length > 0 && (
                        <Tier
                            title="Maybe?"
                            note="You can still pick these. The note on each card says what's uncertain; the host's rules decide at entry."
                            count={cls.maybe.length}
                            testId="maybe-horses"
                        >
                            <div className={GRID}>{cls.maybe.map(card)}</div>
                        </Tier>
                    )}

                    {cls.fits.length === 0 && cls.maybe.length === 0 && (
                        <p className="mt-4 text-sm text-muted-foreground">
                            None of your horses can go in this class right now.
                        </p>
                    )}

                    {cls.blocked.length > 0 && (
                        <Tier
                            title="Can't enter this class"
                            note="These would be refused. Each card says why."
                            count={cls.blocked.length}
                            testId="blocked-horses"
                        >
                            <div className={GRID}>{cls.blocked.map(card)}</div>
                        </Tier>
                    )}
                </>
            )}
        </section>
    );
}
