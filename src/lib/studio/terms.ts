/**
 * Structured commission terms — pure, no I/O.
 *
 * v1 stored terms as a single `terms_text` blob: unqueryable, uncomparable,
 * and impossible to attach to a specific agreement. The research doc (1.3)
 * found that the terms which actually recur across every commission contract
 * are a small closed set of ~8 fields, so that is what we model.
 *
 * The payoff is `snapshotTerms`: at the moment the commissioner accepts, the
 * artist's CURRENT terms are frozen onto the commission row. The artist may
 * change their studio terms afterwards; the commission keeps the ones that
 * were agreed. That snapshot is what makes the record worth anything in a
 * disagreement.
 */

export interface StudioTerms {
    /** Percentage of the agreed price due before work starts. 0 = none. */
    depositPercent: number;
    /** Whether the deposit can be returned before work begins. */
    depositRefundableBeforeStart: boolean;
    /** Revisions included in the quoted price. */
    revisionsIncluded: number;
    /** Flat fee for a revision beyond the allowance. Null = "quoted at the time". */
    extraRevisionFee: number | null;
    /** Share of the agreed price owed if the commissioner cancels mid-work. */
    killFeePercent: number;
    turnaroundMinDays: number | null;
    turnaroundMaxDays: number | null;
    acceptsRush: boolean;
    /** Who is responsible for getting the model to the artist and back. */
    clientShipsModel: boolean;
    shippingNote: string | null;
    /** Anything structured fields can't carry. Not a substitute for them. */
    extraNote: string | null;
}

/**
 * Defaults drawn from the norms in the research doc: 50% deposit,
 * non-refundable once started, 2 revisions, 50% kill fee, no rush orders.
 * A brand-new studio starts somewhere defensible rather than empty.
 */
export const DEFAULT_TERMS: StudioTerms = {
    depositPercent: 50,
    depositRefundableBeforeStart: true,
    revisionsIncluded: 2,
    extraRevisionFee: null,
    killFeePercent: 50,
    turnaroundMinDays: null,
    turnaroundMaxDays: null,
    acceptsRush: false,
    clientShipsModel: true,
    shippingNote: null,
    extraNote: null,
};

function clampPercent(n: unknown, fallback: number): number {
    const v = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(v)) return fallback;
    return Math.min(100, Math.max(0, Math.round(v)));
}

function positiveIntOrNull(n: unknown): number | null {
    const v = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(v) || v <= 0) return null;
    return Math.round(v);
}

function moneyOrNull(n: unknown): number | null {
    const v = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(v) || v < 0) return null;
    return Math.round(v * 100) / 100;
}

/**
 * Coerce anything — a jsonb column, a form payload, a legacy row with the
 * fields spread across columns — into a complete StudioTerms. Never throws;
 * missing fields fall back to DEFAULT_TERMS. This is the feature-detection
 * seam: before migration 170 is applied the columns simply aren't there, and
 * every studio reads as the defaults instead of 500ing.
 */
export function coerceTerms(raw: unknown): StudioTerms {
    if (!raw || typeof raw !== "object") return { ...DEFAULT_TERMS };
    const r = raw as Record<string, unknown>;
    const pick = <T>(...keys: string[]): T | undefined => {
        for (const k of keys) if (r[k] !== undefined && r[k] !== null) return r[k] as T;
        return undefined;
    };

    return {
        depositPercent: clampPercent(
            pick("depositPercent", "deposit_percent"),
            DEFAULT_TERMS.depositPercent,
        ),
        depositRefundableBeforeStart:
            pick<boolean>(
                "depositRefundableBeforeStart",
                "deposit_refundable_before_start",
            ) ?? DEFAULT_TERMS.depositRefundableBeforeStart,
        // `?? default` rather than `|| default`: a studio that deliberately
        // includes ZERO revisions must not silently inherit the default 2.
        revisionsIncluded: (() => {
            const raw = pick("revisionsIncluded", "revisions_included");
            const v = typeof raw === "number" ? raw : Number(raw);
            if (raw === undefined || !Number.isFinite(v) || v < 0) {
                return DEFAULT_TERMS.revisionsIncluded;
            }
            return Math.round(v);
        })(),
        extraRevisionFee: moneyOrNull(pick("extraRevisionFee", "extra_revision_fee")),
        killFeePercent: clampPercent(
            pick("killFeePercent", "kill_fee_percent"),
            DEFAULT_TERMS.killFeePercent,
        ),
        turnaroundMinDays: positiveIntOrNull(
            pick("turnaroundMinDays", "turnaround_min_days"),
        ),
        turnaroundMaxDays: positiveIntOrNull(
            pick("turnaroundMaxDays", "turnaround_max_days"),
        ),
        acceptsRush: pick<boolean>("acceptsRush", "accepts_rush") ?? DEFAULT_TERMS.acceptsRush,
        clientShipsModel:
            pick<boolean>("clientShipsModel", "client_ships_model") ??
            DEFAULT_TERMS.clientShipsModel,
        shippingNote: (pick<string>("shippingNote", "shipping_note") || null) ?? null,
        extraNote:
            (pick<string>("extraNote", "extra_note", "terms_text") || null) ?? null,
    };
}

/**
 * Freeze the terms onto an agreement, together with the price they applied
 * to. Stored as jsonb on the commission at acceptance.
 */
export interface TermsSnapshot extends StudioTerms {
    agreedPrice: number | null;
    depositAmount: number | null;
    snapshotAt: string;
}

export function snapshotTerms(
    terms: StudioTerms,
    agreedPrice: number | null,
    now: Date = new Date(),
): TermsSnapshot {
    return {
        ...terms,
        agreedPrice: agreedPrice ?? null,
        depositAmount: depositFor(agreedPrice, terms.depositPercent),
        snapshotAt: now.toISOString(),
    };
}

/** The deposit implied by a price and a percentage. Rounded to cents. */
export function depositFor(
    price: number | null | undefined,
    percent: number,
): number | null {
    if (price == null || !Number.isFinite(price) || price <= 0) return null;
    if (!Number.isFinite(percent) || percent <= 0) return null;
    return Math.round(price * (percent / 100) * 100) / 100;
}

/** The kill fee implied by an agreement, for the cancellation confirm step. */
export function killFeeFor(
    price: number | null | undefined,
    percent: number,
): number | null {
    return depositFor(price, percent);
}

/**
 * Render the terms as the short, scannable lines that go on the artist page
 * and into the quote. Each line stands alone — no leading bullets, no
 * sentences that only make sense in sequence.
 */
export function termsLines(terms: StudioTerms): { label: string; value: string }[] {
    const lines: { label: string; value: string }[] = [];

    lines.push({
        label: "Deposit",
        value:
            terms.depositPercent > 0
                ? `${terms.depositPercent}% up front, ${
                      terms.depositRefundableBeforeStart
                          ? "refundable until work begins"
                          : "non-refundable"
                  }`
                : "No deposit required",
    });

    lines.push({
        label: "Revisions",
        value:
            terms.revisionsIncluded > 0
                ? `${terms.revisionsIncluded} included` +
                  (terms.extraRevisionFee != null
                      ? `, then ${formatMoney(terms.extraRevisionFee)} each`
                      : ", extras quoted at the time")
                : "Quoted per revision",
    });

    if (terms.turnaroundMinDays || terms.turnaroundMaxDays) {
        lines.push({ label: "Turnaround", value: turnaroundLabel(terms) });
    }

    lines.push({
        label: "If cancelled",
        value:
            terms.killFeePercent > 0
                ? `${terms.killFeePercent}% of the agreed price is owed for work already done`
                : "No cancellation fee",
    });

    lines.push({
        label: "Rush orders",
        value: terms.acceptsRush ? "Considered" : "Not accepted",
    });

    lines.push({
        label: "Shipping",
        value:
            terms.shippingNote ||
            (terms.clientShipsModel
                ? "Commissioner ships the model to the artist"
                : "Artist supplies the model"),
    });

    return lines;
}

/**
 * Turnarounds read better in months once they pass a couple of weeks — the
 * hobby quotes "1-4 months", not "30-120 days".
 */
export function turnaroundLabel(terms: {
    turnaroundMinDays: number | null;
    turnaroundMaxDays: number | null;
}): string {
    const { turnaroundMinDays: lo, turnaroundMaxDays: hi } = terms;
    if (!lo && !hi) return "Not stated";
    const fmt = (d: number) => {
        if (d >= 30) {
            const m = Math.round(d / 30);
            return `${m} month${m === 1 ? "" : "s"}`;
        }
        if (d >= 14) return `${Math.round(d / 7)} weeks`;
        return `${d} days`;
    };
    if (lo && hi) {
        // "1–4 months" is how this hobby quotes a long job; only collapse
        // to a single unit when both ends genuinely are months.
        if (lo >= 30 && hi >= 30) return `${Math.round(lo / 30)}–${Math.round(hi / 30)} months`;
        return `${fmt(lo)} – ${fmt(hi)}`;
    }
    return lo ? `From ${fmt(lo)}` : `Up to ${fmt(hi as number)}`;
}

/** Whole dollars unless there are cents to show. */
export function formatMoney(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n)) return "—";
    const hasCents = Math.round(n * 100) % 100 !== 0;
    return `$${n.toLocaleString("en-US", {
        minimumFractionDigits: hasCents ? 2 : 0,
        maximumFractionDigits: hasCents ? 2 : 0,
    })}`;
}
