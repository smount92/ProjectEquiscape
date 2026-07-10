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
                        <div className="brass-plaque px-4 py-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                <span
                                    className="text-engraved-brass font-mono text-lg font-bold tracking-[0.18em]"
                                    data-testid={`card-code-${card.code}`}
                                >
                                    {card.code}
                                </span>
                                <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-bold tracking-wide uppercase ${STATUS_CLASSES[card.status]}`}
                                >
                                    {STATUS_LABELS[card.status]}
                                </span>
                            </div>
                            <p className="text-engraved-brass mt-1 mb-0 text-sm font-semibold">
                                {card.earnedPlace === 1 ? "1st" : "2nd"} — {card.className}
                            </p>
                            <p className="mt-0.5 mb-0 text-xs text-[color:var(--brass-ink)] opacity-80">
                                {card.showTitle}
                                {card.showYear !== null &&
                                    ` · Show year ${showYearLabel(card.showYear)}`}
                            </p>
                            <a
                                href={`/cards/${card.code}`}
                                className="mt-1 inline-block text-xs font-semibold text-[color:var(--brass-ink)] underline"
                            >
                                Verify this card →
                            </a>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
