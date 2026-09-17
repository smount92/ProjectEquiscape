/**
 * Qualification cards on a show record — NAN (NAMHSA) and OMEQ
 * (USOMHS, the photo-show counterpart).
 *
 * One vocabulary for the record form, the passport chip, the
 * dashboard tracker and the server validation, so a colour can never
 * mean one thing on the form and another on the passport.
 *
 * We TRACK what a shower earned. The programs issue the cards; this
 * is the shower's own record of them (self-reported unless the show
 * ran on MHH). Wording here is ours, not the programs'.
 */

export type QualifierProgram = "nan" | "omeq";
export type QualifierCard = "green" | "yellow" | "pink" | "blue" | "orange" | "purple";

export interface QualifierCardInfo {
    value: QualifierCard;
    glyph: string;
    /** "Blue · breed / halter" — colour first, the way showers say it. */
    label: string;
}

export interface QualifierProgramInfo {
    value: QualifierProgram;
    /** On chips: "NAN", "OMEQ". */
    short: string;
    /** In the picker. */
    label: string;
    issuer: string;
    url: string;
    /** Years after the earning year a card still counts (see isQualifierExpired). */
    liveYears: number;
    /** Plain words for the tracker footer. */
    validity: string;
    cards: QualifierCardInfo[];
}

export const QUALIFIER_PROGRAMS: QualifierProgramInfo[] = [
    {
        value: "nan",
        short: "NAN",
        label: "NAN card (NAMHSA)",
        issuer: "NAMHSA",
        url: "https://www.namhsa.org/",
        liveYears: 3,
        validity: "NAN cards stay live for three years after the year they're earned.",
        cards: [
            { value: "green", glyph: "🟢", label: "Green · OF halter" },
            { value: "yellow", glyph: "🟡", label: "Yellow · CM/AR halter" },
            { value: "pink", glyph: "🩷", label: "Pink · performance" },
        ],
    },
    {
        value: "omeq",
        short: "OMEQ",
        label: "OMEQ card (USOMHS)",
        issuer: "USOMHS",
        url: "https://www.usomhs.com/omeq",
        liveYears: 1,
        validity: "OMEQ cards count for two championships — the year they're earned and the next.",
        cards: [
            { value: "blue", glyph: "🔵", label: "Blue · breed / halter" },
            { value: "orange", glyph: "🟠", label: "Orange · collectibility / workmanship" },
            { value: "purple", glyph: "🟣", label: "Purple · performance" },
        ],
    },
];

const PROGRAM_BY_VALUE = new Map(QUALIFIER_PROGRAMS.map((p) => [p.value, p]));

export function isQualifierProgram(x: unknown): x is QualifierProgram {
    return typeof x === "string" && PROGRAM_BY_VALUE.has(x as QualifierProgram);
}

export function programInfo(program: QualifierProgram): QualifierProgramInfo {
    return PROGRAM_BY_VALUE.get(program)!;
}

export function cardInfo(program: QualifierProgram, card: string | null | undefined): QualifierCardInfo | null {
    if (!card) return null;
    return programInfo(program).cards.find((c) => c.value === card) ?? null;
}

/** Expired once the card is older than the program keeps it live. */
export function isQualifierExpired(program: QualifierProgram, year: number, now: Date = new Date()): boolean {
    return now.getFullYear() - year > programInfo(program).liveYears;
}

/** The passport chip: "🔵 OMEQ card · 2026". */
export function qualifierChip(program: QualifierProgram, card: string | null, year: number | null): string {
    const glyph = cardInfo(program, card)?.glyph ?? "🎫";
    return `${glyph} ${programInfo(program).short} card${year ? ` · ${year}` : ""}`;
}

/** The chip's hover text: colour, meaning, card ID, validity. */
export function qualifierTitle(
    program: QualifierProgram,
    card: string | null,
    cardId: string | null,
): string {
    const info = programInfo(program);
    const c = cardInfo(program, card);
    return [c?.label ?? "Card", cardId ? `#${cardId}` : null, info.validity].filter(Boolean).join(" · ");
}

export interface QualifierValue {
    program: QualifierProgram;
    card: QualifierCard;
    year: number;
    cardId: string | null;
}

export const MAX_CARD_ID = 40;
export const MIN_CARD_YEAR = 1990;

/**
 * Server + form validation. No program = no card (the other fields
 * are ignored). A program needs one of ITS colours and a plausible
 * year; the card ID is optional free text.
 */
export function validateQualifier(
    input: { program: unknown; card: unknown; year: unknown; cardId: unknown },
    now: Date = new Date(),
): { ok: true; value: QualifierValue | null } | { ok: false; error: string } {
    if (input.program == null || input.program === "") return { ok: true, value: null };
    if (!isQualifierProgram(input.program)) return { ok: false, error: "Unknown qualifier program." };
    const program = input.program;
    const info = programInfo(program);

    const card = typeof input.card === "string" ? input.card : "";
    if (!info.cards.some((c) => c.value === card)) {
        return { ok: false, error: `Pick the ${info.short} card colour.` };
    }

    const year = typeof input.year === "string" ? Number(input.year) : input.year;
    const maxYear = now.getFullYear() + 1;
    if (typeof year !== "number" || !Number.isInteger(year) || year < MIN_CARD_YEAR || year > maxYear) {
        return { ok: false, error: `Card year should be between ${MIN_CARD_YEAR} and ${maxYear}.` };
    }

    const rawId = typeof input.cardId === "string" ? input.cardId.trim() : "";
    if (rawId.length > MAX_CARD_ID) {
        return { ok: false, error: `Card ID is too long (max ${MAX_CARD_ID} characters).` };
    }

    return { ok: true, value: { program, card: card as QualifierCard, year, cardId: rawId || null } };
}

/**
 * Read a record row's card, preferring the 210 columns and falling
 * back to the 030 NAN columns (pre-paste rows, and rows the backfill
 * hasn't touched). Shared by both passport pages and the tracker.
 */
export function qualifierFromRow(row: {
    qualifier_program?: unknown;
    qualifier_card?: unknown;
    qualifier_year?: unknown;
    qualifier_card_id?: unknown;
    is_nan_qualifying?: unknown;
    nan_card_type?: unknown;
    nan_year?: unknown;
}): { program: QualifierProgram | null; card: string | null; year: number | null; cardId: string | null } {
    if (isQualifierProgram(row.qualifier_program)) {
        return {
            program: row.qualifier_program,
            card: typeof row.qualifier_card === "string" ? row.qualifier_card : null,
            year: typeof row.qualifier_year === "number" ? row.qualifier_year : null,
            cardId: typeof row.qualifier_card_id === "string" ? row.qualifier_card_id : null,
        };
    }
    if (row.is_nan_qualifying === true) {
        return {
            program: "nan",
            card: typeof row.nan_card_type === "string" ? row.nan_card_type : null,
            year: typeof row.nan_year === "number" ? row.nan_year : null,
            cardId: null,
        };
    }
    return { program: null, card: null, year: null, cardId: null };
}

/** The four camelCase fields the passport timeline / record form read. */
export function qualifierDisplayFields(row: Parameters<typeof qualifierFromRow>[0]): {
    qualifierProgram: QualifierProgram | null;
    qualifierCard: string | null;
    qualifierYear: number | null;
    qualifierCardId: string | null;
} {
    const q = qualifierFromRow(row);
    return {
        qualifierProgram: q.program,
        qualifierCard: q.card,
        qualifierYear: q.year,
        qualifierCardId: q.cardId,
    };
}
