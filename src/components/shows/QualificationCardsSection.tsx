/**
 * Horse passport — "Qualification Cards" section (Phase F).
 *
 * Each card renders as a small brass plaque (the .brass-plaque /
 * .text-engraved-brass material recipes — constant brass ramp, so
 * night mode is safe; Simple Mode flattens both to high-contrast
 * tokens in globals.css). The short code is the star: it is the
 * card's identity and what a buyer types into /cards/[code].
 *
 * Copy rule (design doc §6): these are MHH platform qualifications
 * — never imply NAMHSA/NAN.
 */

import { showYearLabel } from "@/lib/shows/showYear";
import type { CardStatus } from "@/lib/shows/types";

export interface PassportQualificationCard {
    code: string;
    earnedPlace: 1 | 2;
    showYear: number | null;
    status: CardStatus;
    showTitle: string;
    className: string;
    issuedAt: string;
    /** The field it was won against (migration 153) — null on older cards. */
    classEntryCount?: number | null;
    classExhibitorCount?: number | null;
    isStakes?: boolean;
}

const STATUS_LABELS: Record<CardStatus, string> = {
    issued: "Issued",
    transferred: "Transferred",
    redeemed: "Redeemed",
    void: "Void",
};

/** issued/transferred are live cards; redeemed/void read muted. */
const STATUS_CLASSES: Record<CardStatus, string> = {
    issued: "bg-forest text-primary-foreground",
    transferred: "bg-forest text-primary-foreground",
    redeemed: "bg-muted text-muted-foreground",
    void: "bg-destructive/15 text-destructive line-through",
};

export default function QualificationCardsSection({
    cards,
}: {
    cards: PassportQualificationCard[];
}) {
    if (cards.length === 0) return null;

    return (
        <div className="rounded-lg border border-border-tan/30 bg-card/20 p-5">
            <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-widest text-secondary-foreground uppercase">
                <span aria-hidden="true">🏵️</span> MHH Qualification Cards
            </h3>
            <p className="mb-4 text-xs text-secondary-foreground/80">
                Platform qualifications earned on Model Horse Hub (1st or 2nd in a
                qualifying class). Not NAMHSA/NAN cards. They transfer with the horse.
            </p>

            <ul className="flex list-none flex-col gap-3 p-0">
                {cards.map((card) => (
                    <li key={card.code}>
                        {/* Lead with what the horse won. The code is a random
                            uniqueness string — it belongs in the footer as the
                            reference you quote, not as the headline. */}
                        <div className="brass-plaque px-4 py-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                <p className="text-engraved-brass m-0 text-base font-bold">
                                    {card.isStakes && (
                                        <span className="mr-1.5 tracking-widest">STAKES</span>
                                    )}
                                    {card.earnedPlace === 1 ? "1st" : "2nd"}
                                    {typeof card.classEntryCount === "number" &&
                                    typeof card.classExhibitorCount === "number"
                                        ? ` of ${card.classEntryCount} (${card.classExhibitorCount} exhibitors)`
                                        : ""}{" "}
                                    — {card.className}
                                </p>
                                <span
                                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.65rem] font-bold tracking-wide uppercase ${STATUS_CLASSES[card.status]}`}
                                >
                                    {STATUS_LABELS[card.status]}
                                </span>
                            </div>
                            <p className="text-engraved-brass mt-0.5 mb-0 text-sm font-semibold">
                                {card.showTitle}
                                {card.showYear !== null &&
                                    ` · Show year ${showYearLabel(card.showYear)}`}
                            </p>
                            {/* The code and the verify link used to sit in dark
                                ink on the dark end of the brass gradient. They
                                ride lit paper instead so they stay readable in
                                daylight and under lamplight alike. */}
                            <div className="lit-paper mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-md bg-[color:var(--paper-lit)] px-3 py-1.5 text-[color:var(--paper-lit-ink)]">
                                <span className="text-xs">
                                    <span className="font-semibold tracking-widest uppercase opacity-70">
                                        Card
                                    </span>{" "}
                                    <span
                                        className="font-mono tracking-[0.12em] select-all"
                                        data-testid={`card-code-${card.code}`}
                                    >
                                        {card.code}
                                    </span>
                                </span>
                                <a
                                    href={`/cards/${card.code}`}
                                    className="text-xs font-semibold text-[color:var(--paper-lit-ink)] underline"
                                >
                                    Verify this card →
                                </a>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
