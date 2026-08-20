/**
 * Championship program — the titles engine (pure rules).
 *
 * Titles are PERMANENT grants computed from a horse's career record
 * when show results publish (never revoked by later events; a
 * voided card can prevent a future grant but existing grants
 * stand — the hobby's precedent: a title, once earned, is part of
 * the horse's story).
 *
 * Horse titles (the model ledger — travel with the horse forever):
 *   CH  "Champion"  — 3 live cards from 3 different shows under
 *                     at least 2 different judges (ARBA/AKC-style
 *                     "different judges" honesty rule).
 *   ROM "Register of Merit" — 30 career points.
 *   SUP "Superior"  — 75 career points.
 *
 * Career points are RAW accumulation across all result-final
 * qualifying shows (no best-30 cap — that cap is a season-fairness
 * device; career marks reward longevity, AQHA-style).
 *
 * Exhibitor distinctions (the person ledger): star grades on
 * career stable points, PSA-style cumulative recognition.
 * Thresholds are v1-provisional (owner sign-off pending).
 *
 * The I/O layer (grantTitlesForShow) loads the inputs and inserts
 * grants with ON CONFLICT DO NOTHING — this module never touches
 * the database.
 */

// ── Horse titles ──

export type HorseTitleCode = "CH" | "ROM" | "SUP";

export const HORSE_TITLE_LABELS: Record<HorseTitleCode, string> = {
    CH: "Champion",
    ROM: "Register of Merit",
    SUP: "Superior",
};

/** CH requirements (ratified 2026-08). */
export const CH_CARDS_REQUIRED = 3;
export const CH_SHOWS_REQUIRED = 3;
export const CH_JUDGES_REQUIRED = 2;

/** Career-point marks. */
export const ROM_POINTS = 30;
export const SUPERIOR_POINTS = 75;

/** A card as the titles engine sees it. */
export interface TitleCardInput {
    showId: string;
    /** issued | transferred | redeemed | void — void never counts;
     *  redeemed still does (the WIN happened; redemption only
     *  spends the championship entry). */
    status: string;
    /** Who actually judged this card: the judge_id on its placing
     *  row (empty when unrecorded — contributes nothing to the
     *  distinct-judge count). */
    judgeIds: string[];
}

export interface HorseTitleGrant {
    code: HorseTitleCode;
    /** Human-auditable basis for the grant, stored on the row. */
    evidence: Record<string, unknown>;
}

/** Cards that count toward titles: everything but void. */
export function titleEligibleCards(cards: TitleCardInput[]): TitleCardInput[] {
    return cards.filter((c) => c.status !== "void");
}

/**
 * Evaluate which horse titles the record now supports. Returns ALL
 * currently-supported titles — the caller diffs against existing
 * grants (ON CONFLICT DO NOTHING makes re-runs idempotent anyway).
 */
export function evaluateHorseTitles(input: {
    cards: TitleCardInput[];
    careerPoints: number;
}): HorseTitleGrant[] {
    const grants: HorseTitleGrant[] = [];

    const eligible = titleEligibleCards(input.cards);
    const shows = new Set(eligible.map((c) => c.showId));
    const judges = new Set(eligible.flatMap((c) => c.judgeIds));
    if (
        eligible.length >= CH_CARDS_REQUIRED &&
        shows.size >= CH_SHOWS_REQUIRED &&
        judges.size >= CH_JUDGES_REQUIRED
    ) {
        grants.push({
            code: "CH",
            evidence: {
                cards: eligible.length,
                shows: shows.size,
                judges: judges.size,
            },
        });
    }

    if (input.careerPoints >= ROM_POINTS) {
        grants.push({ code: "ROM", evidence: { careerPoints: input.careerPoints } });
    }
    if (input.careerPoints >= SUPERIOR_POINTS) {
        grants.push({ code: "SUP", evidence: { careerPoints: input.careerPoints } });
    }

    return grants;
}

/**
 * Title prefix for display next to a horse's name, most senior
 * point-mark plus CH: "CH SUP Firefly" reads wrong — the hobby
 * convention is a single compound prefix, CH outranking marks and
 * SUP superseding ROM (75 ⊃ 30).
 */
export function titlePrefix(codes: readonly string[]): string {
    const set = new Set(codes);
    const parts: string[] = [];
    if (set.has("CH")) parts.push("CH");
    if (set.has("SUP")) parts.push("SUP");
    else if (set.has("ROM")) parts.push("ROM");
    return parts.join(" ");
}

// ── Exhibitor distinctions ──

export type ExhibitorDistinctionCode = "STAR_1" | "STAR_2" | "STAR_3" | "STAR_4" | "STAR_5";

/**
 * PSA-style cumulative stars on career stable points.
 * V1-PROVISIONAL thresholds — owner sign-off pending; changing
 * these only affects future grants (existing grants stand).
 */
export const STAR_THRESHOLDS: { code: ExhibitorDistinctionCode; points: number }[] = [
    { code: "STAR_1", points: 50 },
    { code: "STAR_2", points: 150 },
    { code: "STAR_3", points: 400 },
    { code: "STAR_4", points: 1000 },
    { code: "STAR_5", points: 2500 },
];

export const EXHIBITOR_DISTINCTION_LABELS: Record<ExhibitorDistinctionCode, string> = {
    STAR_1: "One Star Exhibitor",
    STAR_2: "Two Star Exhibitor",
    STAR_3: "Three Star Exhibitor",
    STAR_4: "Four Star Exhibitor",
    STAR_5: "Five Star Exhibitor",
};

export interface ExhibitorDistinctionGrant {
    code: ExhibitorDistinctionCode;
    evidence: Record<string, unknown>;
}

export function evaluateExhibitorDistinctions(input: {
    careerPoints: number;
}): ExhibitorDistinctionGrant[] {
    return STAR_THRESHOLDS.filter((t) => input.careerPoints >= t.points).map((t) => ({
        code: t.code,
        evidence: { careerPoints: input.careerPoints, threshold: t.points },
    }));
}

/** The highest star earned (for the profile badge), or null. */
export function highestStar(codes: readonly string[]): ExhibitorDistinctionCode | null {
    for (let i = STAR_THRESHOLDS.length - 1; i >= 0; i--) {
        if (codes.includes(STAR_THRESHOLDS[i].code)) return STAR_THRESHOLDS[i].code;
    }
    return null;
}
