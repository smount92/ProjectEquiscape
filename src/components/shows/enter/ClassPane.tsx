"use client";

/**
 * The centre of the entry page: the current class, its limits in
 * plain words, your entries already in it, then YOUR HORSES FOR THIS
 * CLASS (the ledger's `applicable`) as cards, and the "Other horses"
 * fold (the ledger's `other`) with each verdict's reason. Blocked
 * horses are not selectable; soft mismatches are, with a warning —
 * the server decides.
 */

import { Fragment, type ReactNode, type RefObject } from "react";
import Link from "next/link";

import { classLabel, type ClassLedger } from "@/lib/shows/entrantLedger";
import { friendlyClassStatus } from "@/lib/shows/plainWords";
import type { EntrantHorse } from "@/lib/shows/public";
import HorseCard from "./HorseCard";
import type { SelectedHorse } from "./shared";

interface ClassPaneProps {
    showId: string;
    cls: ClassLedger;
    limits: string;
    horsesById: Map<string, EntrantHorse>;
    /** Names of your live entries already in this class. */
    enteredNames: string[];
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

export default function ClassPane({
    showId,
    cls,
    limits,
    horsesById,
    enteredNames,
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
        const v = verdictOf.get(horseId);
        const blocked = !!v?.blocked;
        return (
            <Fragment key={horseId}>
                <HorseCard
                    horse={horse}
                    selected={selection.has(horseId)}
                    blocked={blocked}
                    reason={v?.reason ?? null}
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
            {enteredNames.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Already entered:</span>
                    {enteredNames.map((name, i) => (
                        <span
                            key={`${name}-${i}`}
                            className="rounded-full border border-forest/40 bg-card px-2 py-0.5 text-xs font-semibold text-forest"
                        >
                            ✓ {name}
                        </span>
                    ))}
                </div>
            )}

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
                    <h3 className="mt-4 mb-2 font-serif text-base font-bold text-foreground">
                        Your horses for this class
                    </h3>
                    {cls.applicable.length === 0 ? (
                        <p className="m-0 text-sm text-muted-foreground">
                            None of your horses is a clean fit — see Other horses below.
                        </p>
                    ) : (
                        <div className={GRID} data-testid="applicable-horses">
                            {cls.applicable.map(card)}
                        </div>
                    )}

                    {cls.other.length > 0 && (
                        <details className="mt-4" data-testid="other-horses">
                            <summary className="cursor-pointer font-serif text-sm font-bold text-foreground">
                                Other horses ({cls.other.length})
                            </summary>
                            <p className="m-0 my-2 text-xs text-muted-foreground">
                                Greyed horses can&rsquo;t enter this class. A ⚠ warning may still be accepted —
                                the host&rsquo;s rules decide at entry.
                            </p>
                            <div className={GRID}>{cls.other.map(card)}</div>
                        </details>
                    )}
                </>
            )}
        </section>
    );
}
