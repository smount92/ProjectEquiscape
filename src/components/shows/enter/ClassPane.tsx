"use client";

/**
 * The centre of the entry page: the current class, its limits in plain
 * words, a search box, and your horses — either in the three tiers the
 * ledger decides, or as one list A to Z.
 *
 *   Eligible        nothing stands in the way; breed matches the class,
 *                   or the class names no breed
 *   Check first     enterable, but something is uncertain: scale or
 *                   finish may not fit, or the class names a breed this
 *                   horse isn't listed as
 *   Not eligible    a rule the server will refuse: already in this
 *                   class, already in another halter class, or at your
 *                   limit here
 *
 * Nothing here is un-selectable (owner, 2026-10-11: never block an
 * edge case; any horse may be entered anywhere). The tiers forecast,
 * the server refuses. The A-to-Z view and the search exist for the
 * member with three hundred horses. The horses already in the class
 * live on the right, with the selection.
 */

import { Fragment, useMemo, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";

import { classLabel, type ClassLedger, type HorseVerdict } from "@/lib/shows/entrantLedger";
import { friendlyClassStatus } from "@/lib/shows/plainWords";
import type { EntrantHorse } from "@/lib/shows/public";
import { Input } from "@/components/ui/input";
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

type View = "tiers" | "az";

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4";

/** Case-insensitive match on name or breed. */
function matches(horse: EntrantHorse, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return horse.name.toLowerCase().includes(q) || (horse.breed ?? "").toLowerCase().includes(q);
}

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
    const [view, setView] = useState<View>("tiers");
    const [query, setQuery] = useState("");
    const verdictOf = useMemo(() => new Map(cls.verdicts.map((v) => [v.horseId, v])), [cls.verdicts]);
    const takingEntries = cls.state !== "closed";

    // The search applies to every view; the tiers keep their own order,
    // the A-to-Z view sorts by name.
    const keep = (id: string) => {
        const h = horsesById.get(id);
        return !!h && matches(h, query);
    };
    const fits = cls.fits.filter(keep);
    const maybe = cls.maybe.filter(keep);
    const blocked = cls.blocked.filter(keep);
    const az = [...horsesById.values()]
        .filter((h) => matches(h, query))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
        .map((h) => h.id);
    const shown = view === "az" ? az.length : fits.length + maybe.length + blocked.length;

    const card = (horseId: string) => {
        const horse = horsesById.get(horseId);
        if (!horse) return null;
        const v: HorseVerdict | undefined = verdictOf.get(horseId);
        const blockedHorse = !!v?.blocked;
        return (
            <Fragment key={horseId}>
                <HorseCard
                    horse={horse}
                    selected={selection.has(horseId)}
                    blocked={blockedHorse}
                    reason={v?.reason ?? v?.hint ?? null}
                    breedMatch={!!v?.breedMatch}
                    photoUrl={online ? photoUrlFor(horseId) : null}
                    showPhotoControl={online}
                    pickerOpen={pickerHorseId === horseId}
                    onToggle={() => onToggle(horseId)}
                    onChangePhoto={() => onChangePhoto(horseId)}
                />
                {pickerHorseId === horseId && <div className="col-span-full">{renderPicker(horseId)}</div>}
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
                            You&rsquo;re at your limit in this class — more would be refused.
                        </p>
                    )}

                    {/* Search + view, for the member with three hundred horses. */}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search your horses by name or breed…"
                            aria-label="Search your horses by name or breed"
                            className="h-9 min-w-[12rem] flex-1"
                            id="enter-horse-search"
                        />
                        <div className="flex rounded-md border border-input p-0.5" role="group" aria-label="View">
                            {(
                                [
                                    ["tiers", "By eligibility"],
                                    ["az", "All horses A–Z"],
                                ] as [View, string][]
                            ).map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    aria-pressed={view === key}
                                    onClick={() => setView(key)}
                                    className={`min-h-8 cursor-pointer rounded px-2.5 text-xs font-semibold ${
                                        view === key ? "bg-forest text-primary-foreground" : "text-foreground hover:bg-muted"
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <span className="text-xs text-muted-foreground" aria-live="polite" data-testid="horse-count">
                            {query.trim() ? `${shown} of ${horsesById.size} horses` : `${horsesById.size} horses`}
                        </span>
                    </div>

                    {shown === 0 ? (
                        <p className="mt-4 text-sm text-muted-foreground">
                            No horse in your stable is named or bred &ldquo;{query.trim()}&rdquo;.
                        </p>
                    ) : view === "az" ? (
                        <section className="mt-4" data-testid="az-horses" aria-label="All horses A to Z">
                            <p className="m-0 mb-2 text-xs text-muted-foreground">
                                Every horse, A to Z. The note on a card is a forecast; the host&rsquo;s rules decide at entry.
                            </p>
                            <div className={GRID}>{az.map(card)}</div>
                        </section>
                    ) : (
                        <>
                            {fits.length > 0 && (
                                <Tier
                                    title="Eligible"
                                    note={
                                        cls.breedNamed
                                            ? "Listed as the breed this class is for; nothing stands in the way."
                                            : "Nothing stands in the way."
                                    }
                                    count={fits.length}
                                    testId="fits-horses"
                                >
                                    <div className={GRID}>{fits.map(card)}</div>
                                </Tier>
                            )}

                            {maybe.length > 0 && (
                                <Tier
                                    title="Check first"
                                    note="These can still be entered. The note on each card says what to check; the host's rules decide at entry."
                                    count={maybe.length}
                                    testId="maybe-horses"
                                >
                                    <div className={GRID}>{maybe.map(card)}</div>
                                </Tier>
                            )}

                            {blocked.length > 0 && (
                                <Tier
                                    title="Not eligible"
                                    note="These would be refused for this class. Each card says why. You can still pick one if you need to — the host's rules decide."
                                    count={blocked.length}
                                    testId="blocked-horses"
                                >
                                    <div className={GRID}>{blocked.map(card)}</div>
                                </Tier>
                            )}
                        </>
                    )}
                </>
            )}
        </section>
    );
}
