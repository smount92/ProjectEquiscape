/**
 * THE PAYMENT LEDGER — time payments, made legible.
 * Pure, no I/O.
 *
 * This is the headline feature of the whole deal room, and the reason is
 * in the plan (§2.6.4): escrow is what a platform builds when it does not
 * know its market. Six monthly installments arranged in a Facebook DM,
 * tracked in nobody's spreadsheet, with a $400 resin off the market for
 * half a year on a handshake — that is what this hobby actually runs on,
 * and nothing has ever given either side a shared, honest record of it.
 *
 * We record; we never settle. Every row here is TWO self-attestations
 * with dates — the payer says "sent", the payee says "received" — which
 * is exactly the shape the existing Safe-Trade paid_at / verified_at
 * pair already has, scaled from one payment to N.
 *
 * TWO RULES THIS MODULE ENFORCES ON ITSELF:
 *
 *  1. Overdue is FACTUAL, NEVER ENFORCED. `installmentState` will report
 *     a row as overdue; nothing here cancels a deal, forfeits a payment,
 *     charges a fee, or relists a horse. What happens on a missed payment
 *     is in the parties' own terms box, in their own words, and it is
 *     their business to act on it.
 *
 *  2. Confirmation is the payee's alone. A payer marking "sent" moves
 *     nothing but their own column.
 */

// ── Rows ──────────────────────────────────────────────────────────────

export interface Installment {
    id: string;
    /** 1-based position in the plan. Stable; rows are never renumbered. */
    seq: number;
    amount: number;
    /** ISO date (yyyy-mm-dd), or null for "when we get to it". */
    dueDate: string | null;
    /** When the payer said the money left. */
    markedSentAt: string | null;
    /** When the payee said the money arrived. */
    confirmedAt: string | null;
    /** Either party's note on this row — a reference number, a reason. */
    note: string | null;
}

/** A row's state, derived. Nothing is stored twice. */
export type InstallmentState =
    /** Not due yet, nothing sent. */
    | "scheduled"
    /** Due today or in the past, nothing sent. Factual, not punitive. */
    | "due"
    /** Past its due date with nothing sent. Factual, not punitive. */
    | "overdue"
    /** Payer says it's gone; payee hasn't confirmed. */
    | "sent"
    /** Both sides agree this one is done. */
    | "confirmed";

const DAY_MS = 86_400_000;

/** Parse yyyy-mm-dd (or a full ISO stamp) as a UTC instant, or null. */
export function parseDate(iso: string | null | undefined): number | null {
    if (!iso) return null;
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
    const t = d.getTime();
    return Number.isNaN(t) ? null : t;
}

export function installmentState(row: Installment, now: Date = new Date()): InstallmentState {
    if (row.confirmedAt) return "confirmed";
    if (row.markedSentAt) return "sent";
    const due = parseDate(row.dueDate);
    if (due === null) return "scheduled";
    // Compare against the END of the due day so a payment due today is
    // "due", not "overdue", anywhere in the world.
    const endOfDueDay = due + DAY_MS - 1;
    const t = now.getTime();
    if (t > endOfDueDay) return "overdue";
    if (t >= due) return "due";
    return "scheduled";
}

const STATE_LABELS: Record<InstallmentState, string> = {
    scheduled: "Scheduled",
    due: "Due today",
    overdue: "Past due",
    sent: "Marked sent",
    confirmed: "Received",
};

export function installmentStateLabel(state: InstallmentState): string {
    return STATE_LABELS[state];
}

/** Whole days a row is past its due date. 0 when not overdue. */
export function daysOverdue(row: Installment, now: Date = new Date()): number {
    if (installmentState(row, now) !== "overdue") return 0;
    const due = parseDate(row.dueDate);
    if (due === null) return 0;
    return Math.floor((now.getTime() - (due + DAY_MS - 1)) / DAY_MS) + 1;
}

// ── Summary ───────────────────────────────────────────────────────────

export interface LedgerSummary {
    count: number;
    /** Sum of every row's amount. */
    total: number;
    /** Sum of rows the payer has marked sent (confirmed rows included). */
    sentTotal: number;
    /** Sum of rows the payee has confirmed. */
    confirmedTotal: number;
    /** total − confirmedTotal. What the record still shows outstanding. */
    remaining: number;
    /** 0–100, by confirmed money rather than by row count. */
    progressPct: number;
    confirmedCount: number;
    /** Rows marked sent but not yet confirmed — the payee's queue. */
    awaitingConfirmation: Installment[];
    /** Rows past their due date with nothing sent. Stated, never acted on. */
    overdue: Installment[];
    /** The soonest unpaid row with a due date. */
    nextDue: Installment | null;
    /** Every row confirmed — the plan is done. */
    allConfirmed: boolean;
}

export function ledgerSummary(rows: Installment[], now: Date = new Date()): LedgerSummary {
    const sorted = sortInstallments(rows);
    let total = 0;
    let sentTotal = 0;
    let confirmedTotal = 0;
    let confirmedCount = 0;
    const awaitingConfirmation: Installment[] = [];
    const overdue: Installment[] = [];
    let nextDue: Installment | null = null;
    let nextDueAt = Number.POSITIVE_INFINITY;

    for (const row of sorted) {
        const amount = Number.isFinite(row.amount) ? row.amount : 0;
        total += amount;
        const state = installmentState(row, now);
        if (state === "confirmed") {
            sentTotal += amount;
            confirmedTotal += amount;
            confirmedCount += 1;
            continue;
        }
        if (state === "sent") {
            sentTotal += amount;
            awaitingConfirmation.push(row);
            continue;
        }
        if (state === "overdue") overdue.push(row);
        const due = parseDate(row.dueDate);
        if (due !== null && due < nextDueAt) {
            nextDueAt = due;
            nextDue = row;
        }
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    total = round(total);
    sentTotal = round(sentTotal);
    confirmedTotal = round(confirmedTotal);

    return {
        count: sorted.length,
        total,
        sentTotal,
        confirmedTotal,
        remaining: round(total - confirmedTotal),
        progressPct: total > 0 ? Math.min(100, Math.round((confirmedTotal / total) * 100)) : 0,
        confirmedCount,
        awaitingConfirmation,
        overdue,
        nextDue,
        allConfirmed: sorted.length > 0 && confirmedCount === sorted.length,
    };
}

/** By seq. The database orders the same way; this makes the pure path agree. */
export function sortInstallments(rows: Installment[]): Installment[] {
    return [...rows].sort((a, b) => a.seq - b.seq);
}

// ── Building a plan (a suggestion the parties edit, not a policy) ─────

export type PlanCadence = "weekly" | "biweekly" | "monthly";

export interface DraftInstallment {
    seq: number;
    amount: number;
    dueDate: string | null;
}

/**
 * Split a total into N rows on a cadence.
 *
 * This is arithmetic offered to the composer, not terms authored by the
 * platform: the parties choose the total, the count, the start date and
 * the cadence, and then edit any row they like before proposing it. The
 * rounding remainder goes on the FIRST row rather than the last — hobby
 * sellers ask for the odd cents up front, and a buyer discovering an
 * extra 2 cents on their final payment six months later is exactly the
 * kind of small surprise that turns into a complaint.
 */
export function buildPlan(input: {
    total: number;
    count: number;
    startDate: string | null;
    cadence: PlanCadence;
}): DraftInstallment[] {
    const count = Math.max(1, Math.min(120, Math.round(input.count)));
    const totalCents = Math.round((Number.isFinite(input.total) ? input.total : 0) * 100);
    if (totalCents <= 0) {
        return Array.from({ length: count }, (_, i) => ({
            seq: i + 1,
            amount: 0,
            dueDate: addCadence(input.startDate, input.cadence, i),
        }));
    }

    const base = Math.floor(totalCents / count);
    const remainder = totalCents - base * count;

    return Array.from({ length: count }, (_, i) => ({
        seq: i + 1,
        amount: (base + (i === 0 ? remainder : 0)) / 100,
        dueDate: addCadence(input.startDate, input.cadence, i),
    }));
}

/** yyyy-mm-dd plus n cadence steps, in UTC. Null start ⇒ null dates. */
export function addCadence(
    startDate: string | null,
    cadence: PlanCadence,
    steps: number,
): string | null {
    const start = parseDate(startDate);
    if (start === null) return null;
    const d = new Date(start);
    if (cadence === "weekly") d.setUTCDate(d.getUTCDate() + steps * 7);
    else if (cadence === "biweekly") d.setUTCDate(d.getUTCDate() + steps * 14);
    else {
        // Monthly: keep the day-of-month, clamping into short months so
        // the 31st becomes the 28th/30th rather than skipping a month.
        const day = d.getUTCDate();
        d.setUTCDate(1);
        d.setUTCMonth(d.getUTCMonth() + steps);
        const lastDay = new Date(
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
        ).getUTCDate();
        d.setUTCDate(Math.min(day, lastDay));
    }
    return d.toISOString().slice(0, 10);
}

/** The plan's rows add up to the agreed price (within a cent). */
export function planMatchesPrice(
    rows: { amount: number }[],
    price: number | null,
): boolean {
    if (price == null || !Number.isFinite(price)) return true;
    const sum = rows.reduce((s, r) => s + (Number.isFinite(r.amount) ? r.amount : 0), 0);
    return Math.abs(Math.round(sum * 100) - Math.round(price * 100)) <= 1;
}

// ── Who may do what ───────────────────────────────────────────────────

export type LedgerActionResult = { ok: true } | { ok: false; reason: string };

/**
 * The payer marks a row sent. Refusal strings are user-facing sentences.
 *
 * `payer` is the party the TERMS name as owing the money, which for a
 * trade may be either side or neither — the caller resolves it from the
 * deal kind and the terms and passes the answer in.
 */
export function canMarkSent(
    row: Installment,
    actor: "a" | "b",
    payer: "a" | "b" | null,
): LedgerActionResult {
    if (payer === null) {
        return { ok: false, reason: "These terms don't say who is paying yet." };
    }
    if (actor !== payer) {
        return { ok: false, reason: "Only the paying side can mark a payment as sent." };
    }
    if (row.confirmedAt) {
        return { ok: false, reason: "This payment has already been confirmed as received." };
    }
    if (row.markedSentAt) {
        return { ok: false, reason: "You have already marked this payment as sent." };
    }
    return { ok: true };
}

/** The payer un-marks a row they marked in error, before it is confirmed. */
export function canUnmarkSent(
    row: Installment,
    actor: "a" | "b",
    payer: "a" | "b" | null,
): LedgerActionResult {
    if (payer === null || actor !== payer) {
        return { ok: false, reason: "Only the paying side can change this." };
    }
    if (row.confirmedAt) {
        return { ok: false, reason: "This payment has already been confirmed as received." };
    }
    if (!row.markedSentAt) {
        return { ok: false, reason: "This payment isn't marked as sent." };
    }
    return { ok: true };
}

/**
 * The payee confirms the money arrived.
 *
 * Deliberately permitted even when the payer never marked it sent: cash
 * in hand at a live show is a real way this hobby pays, and a payee who
 * has the money should be able to say so without waiting on a form.
 */
export function canConfirmReceived(
    row: Installment,
    actor: "a" | "b",
    payer: "a" | "b" | null,
): LedgerActionResult {
    if (payer === null) {
        return { ok: false, reason: "These terms don't say who is paying yet." };
    }
    if (actor === payer) {
        return { ok: false, reason: "Only the receiving side can confirm a payment arrived." };
    }
    if (row.confirmedAt) {
        return { ok: false, reason: "This payment is already confirmed." };
    }
    return { ok: true };
}

/**
 * A confirmation is a receipt. Once given it stands — the whole value of
 * the ledger as evidence rests on neither side being able to un-say what
 * they said. Disagreement after a confirmation is a dispute, which
 * freezes and preserves rather than rewriting.
 */
export function canUnconfirm(): LedgerActionResult {
    return {
        ok: false,
        reason:
            "A confirmed payment can't be un-confirmed — it is part of the record. Raise a dispute instead.",
    };
}

// ── Coercion ──────────────────────────────────────────────────────────

/** Read a database row (or anything) into an Installment. Never throws. */
export function coerceInstallment(raw: unknown): Installment | null {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : null;
    if (!id) return null;
    const seqRaw = r.seq;
    const seq = typeof seqRaw === "number" ? seqRaw : Number(seqRaw);
    const amountRaw = r.amount;
    const amount = typeof amountRaw === "number" ? amountRaw : Number(amountRaw);
    const dateStr = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
    return {
        id,
        seq: Number.isFinite(seq) ? Math.round(seq) : 0,
        amount: Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0,
        dueDate: dateStr(r.dueDate ?? r.due_date)?.slice(0, 10) ?? null,
        markedSentAt: dateStr(r.markedSentAt ?? r.marked_sent_at),
        confirmedAt: dateStr(r.confirmedAt ?? r.confirmed_at),
        note: dateStr(r.note),
    };
}

export function coerceInstallments(raw: unknown): Installment[] {
    if (!Array.isArray(raw)) return [];
    const out: Installment[] = [];
    for (const item of raw) {
        const row = coerceInstallment(item);
        if (row) out.push(row);
    }
    return sortInstallments(out);
}

// ── One-line status, for the deal strip ───────────────────────────────

/**
 * The single sentence the deal strip shows about payment. Factual and
 * neutral: "2 of 6 paid · next due Sep 1" — never "LATE" in red capitals
 * at someone who agreed to pay a stranger $400 over six months.
 */
export function ledgerHeadline(
    summary: LedgerSummary,
    formatMoney: (n: number | null) => string,
    formatDate: (iso: string | null) => string,
): string {
    if (summary.count === 0) return "No payment plan";
    if (summary.allConfirmed) return `Paid in full — ${formatMoney(summary.total)}`;
    const parts = [`${summary.confirmedCount} of ${summary.count} paid`];
    if (summary.awaitingConfirmation.length > 0) {
        parts.push(
            `${summary.awaitingConfirmation.length} awaiting confirmation`,
        );
    }
    if (summary.overdue.length > 0) {
        parts.push(
            `${summary.overdue.length} past due`,
        );
    } else if (summary.nextDue?.dueDate) {
        parts.push(`next due ${formatDate(summary.nextDue.dueDate)}`);
    }
    return parts.join(" · ");
}
