import { describe, it, expect } from "vitest";

import {
    addCadence,
    buildPlan,
    canConfirmReceived,
    canMarkSent,
    canUnconfirm,
    canUnmarkSent,
    coerceInstallment,
    coerceInstallments,
    daysOverdue,
    installmentState,
    installmentStateLabel,
    ledgerHeadline,
    ledgerSummary,
    parseDate,
    planMatchesPrice,
    sortInstallments,
    type Installment,
} from "../ledger";
import { formatDate, formatMoney } from "../terms";

const NOW = new Date("2026-09-15T12:00:00Z");

const row = (patch: Partial<Installment> = {}): Installment => ({
    id: patch.id ?? `i${patch.seq ?? 1}`,
    seq: patch.seq ?? 1,
    amount: patch.amount ?? 100,
    dueDate: patch.dueDate ?? null,
    markedSentAt: patch.markedSentAt ?? null,
    confirmedAt: patch.confirmedAt ?? null,
    note: patch.note ?? null,
});

describe("payment ledger", () => {
    // ── Row state ──

    it("has a label for every state it can report", () => {
        const states = [
            installmentState(row(), NOW),
            installmentState(row({ dueDate: "2026-09-15" }), NOW),
            installmentState(row({ dueDate: "2026-09-01" }), NOW),
            installmentState(row({ markedSentAt: "2026-09-10T00:00:00Z" }), NOW),
            installmentState(row({ confirmedAt: "2026-09-11T00:00:00Z" }), NOW),
        ];
        for (const state of states) expect(installmentStateLabel(state)).toBeTruthy();
    });

    it("calls a payment due today 'due', not 'past due', anywhere in the world", () => {
        expect(installmentState(row({ dueDate: "2026-09-15" }), NOW)).toBe("due");
        expect(
            installmentState(row({ dueDate: "2026-09-15" }), new Date("2026-09-15T23:59:00Z")),
        ).toBe("due");
        expect(
            installmentState(row({ dueDate: "2026-09-15" }), new Date("2026-09-16T00:01:00Z")),
        ).toBe("overdue");
    });

    it("reads a row with no due date as scheduled rather than overdue", () => {
        expect(installmentState(row({ dueDate: null }), NOW)).toBe("scheduled");
        expect(daysOverdue(row({ dueDate: null }), NOW)).toBe(0);
    });

    it("lets sent and confirmed outrank the calendar — a paid row is never 'past due'", () => {
        expect(
            installmentState(row({ dueDate: "2020-01-01", markedSentAt: "2026-01-01T00:00:00Z" }), NOW),
        ).toBe("sent");
        expect(
            installmentState(
                { ...row({ dueDate: "2020-01-01" }), confirmedAt: "2026-01-01T00:00:00Z" },
                NOW,
            ),
        ).toBe("confirmed");
    });

    it("counts whole days past due", () => {
        expect(daysOverdue(row({ dueDate: "2026-09-14" }), NOW)).toBe(1);
        expect(daysOverdue(row({ dueDate: "2026-09-05" }), NOW)).toBe(10);
        expect(daysOverdue(row({ dueDate: "2026-09-20" }), NOW)).toBe(0);
    });

    // ── Summary ──

    it("totals by money confirmed, not by rows ticked", () => {
        const rows = [
            row({ seq: 1, amount: 100, confirmedAt: "2026-07-01T00:00:00Z" }),
            row({ seq: 2, amount: 100, markedSentAt: "2026-09-01T00:00:00Z" }),
            row({ seq: 3, amount: 100, dueDate: "2026-09-01" }),
            row({ seq: 4, amount: 100, dueDate: "2026-12-01" }),
        ];
        const s = ledgerSummary(rows, NOW);
        expect(s.count).toBe(4);
        expect(s.total).toBe(400);
        expect(s.confirmedTotal).toBe(100);
        expect(s.sentTotal).toBe(200);
        expect(s.remaining).toBe(300);
        expect(s.progressPct).toBe(25);
        expect(s.confirmedCount).toBe(1);
        expect(s.awaitingConfirmation.map((r) => r.seq)).toEqual([2]);
        expect(s.overdue.map((r) => r.seq)).toEqual([3]);
        expect(s.nextDue?.seq).toBe(3);
        expect(s.allConfirmed).toBe(false);
    });

    it("reports done only when every row is confirmed", () => {
        const done = [
            row({ seq: 1, confirmedAt: "2026-01-01T00:00:00Z" }),
            row({ seq: 2, confirmedAt: "2026-02-01T00:00:00Z" }),
        ];
        const s = ledgerSummary(done, NOW);
        expect(s.allConfirmed).toBe(true);
        expect(s.progressPct).toBe(100);
        expect(s.remaining).toBe(0);
    });

    it("handles an empty ledger without dividing by zero", () => {
        const s = ledgerSummary([], NOW);
        expect(s).toMatchObject({ count: 0, total: 0, progressPct: 0, allConfirmed: false });
        expect(s.nextDue).toBeNull();
    });

    it("picks the soonest unpaid row as next due, whatever order the rows arrive in", () => {
        const rows = [
            row({ seq: 3, dueDate: "2026-11-01" }),
            row({ seq: 1, dueDate: "2026-12-01" }),
            row({ seq: 2, dueDate: "2026-10-01" }),
        ];
        expect(ledgerSummary(rows, NOW).nextDue?.seq).toBe(2);
        expect(sortInstallments(rows).map((r) => r.seq)).toEqual([1, 2, 3]);
    });

    // ── Building a plan ──

    it("splits a total into equal payments that add back up exactly", () => {
        const plan = buildPlan({
            total: 400,
            count: 6,
            startDate: "2026-10-01",
            cadence: "monthly",
        });
        expect(plan).toHaveLength(6);
        const sum = plan.reduce((s, r) => s + r.amount, 0);
        expect(Math.round(sum * 100)).toBe(40000);
    });

    it("puts the rounding remainder on the FIRST payment, not the last", () => {
        // $100 over 3 is 33.33/33.33/33.34 — hobby sellers ask for the odd
        // cents up front, and a surprise on the final payment six months
        // later is exactly what turns into a complaint.
        const plan = buildPlan({ total: 100, count: 3, startDate: null, cadence: "monthly" });
        expect(plan[0].amount).toBe(33.34);
        expect(plan[1].amount).toBe(33.33);
        expect(plan[2].amount).toBe(33.33);
    });

    it("numbers rows from 1 and never emits fewer than one", () => {
        expect(buildPlan({ total: 50, count: 0, startDate: null, cadence: "weekly" })).toHaveLength(1);
        expect(
            buildPlan({ total: 50, count: 3, startDate: null, cadence: "weekly" }).map((r) => r.seq),
        ).toEqual([1, 2, 3]);
    });

    it("produces zero-amount rows rather than NaN when the total is missing", () => {
        const plan = buildPlan({ total: 0, count: 3, startDate: "2026-10-01", cadence: "weekly" });
        expect(plan.every((r) => r.amount === 0)).toBe(true);
        expect(plan[2].dueDate).toBe("2026-10-15");
    });

    it("walks the calendar for each cadence", () => {
        expect(addCadence("2026-10-01", "weekly", 2)).toBe("2026-10-15");
        expect(addCadence("2026-10-01", "biweekly", 1)).toBe("2026-10-15");
        expect(addCadence("2026-10-01", "monthly", 3)).toBe("2027-01-01");
        expect(addCadence(null, "monthly", 3)).toBeNull();
    });

    it("clamps a monthly plan into short months instead of skipping one", () => {
        // The 31st of January plus one month is the 28th of February —
        // not the 3rd of March, which is what naive date arithmetic gives.
        expect(addCadence("2026-01-31", "monthly", 1)).toBe("2026-02-28");
        expect(addCadence("2026-01-31", "monthly", 3)).toBe("2026-04-30");
    });

    it("checks a plan adds up to the agreed price, tolerating a single cent", () => {
        expect(planMatchesPrice([{ amount: 33.34 }, { amount: 33.33 }, { amount: 33.33 }], 100)).toBe(true);
        expect(planMatchesPrice([{ amount: 50 }, { amount: 40 }], 100)).toBe(false);
        // No agreed price to check against yet — nothing to contradict.
        expect(planMatchesPrice([{ amount: 50 }], null)).toBe(true);
    });

    // ── Permissions ──

    it("lets only the paying side mark a payment sent", () => {
        expect(canMarkSent(row(), "b", "b").ok).toBe(true);
        const wrong = canMarkSent(row(), "a", "b");
        expect(wrong.ok).toBe(false);
        if (wrong.ok) return;
        expect(wrong.reason).toMatch(/only the paying side/i);
    });

    it("refuses to name a payer the terms never named", () => {
        const nobody = canMarkSent(row(), "a", null);
        expect(nobody.ok).toBe(false);
        if (nobody.ok) return;
        expect(nobody.reason).toMatch(/who is paying/i);
        expect(canConfirmReceived(row(), "a", null).ok).toBe(false);
    });

    it("will not let the same person both send and confirm", () => {
        expect(canConfirmReceived(row(), "b", "b").ok).toBe(false);
        expect(canConfirmReceived(row(), "a", "b").ok).toBe(true);
    });

    it("lets the payee confirm cash in hand, even if nobody clicked 'sent' first", () => {
        // Cash at a live show is a real way this hobby pays; a payee who
        // has the money should not have to wait on a form.
        expect(canConfirmReceived(row({ markedSentAt: null }), "a", "b").ok).toBe(true);
    });

    it("lets a payer un-mark their own mistake, but never after it is confirmed", () => {
        expect(canUnmarkSent(row({ markedSentAt: "2026-09-01T00:00:00Z" }), "b", "b").ok).toBe(true);
        expect(canUnmarkSent(row(), "b", "b").ok).toBe(false);
        expect(
            canUnmarkSent(
                row({ markedSentAt: "2026-09-01T00:00:00Z", confirmedAt: "2026-09-02T00:00:00Z" }),
                "b",
                "b",
            ).ok,
        ).toBe(false);
    });

    it("never lets a confirmation be taken back — that is what makes it evidence", () => {
        const result = canUnconfirm();
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toMatch(/dispute/i);
        expect(canMarkSent(row({ confirmedAt: "2026-09-01T00:00:00Z" }), "b", "b").ok).toBe(false);
        expect(canConfirmReceived(row({ confirmedAt: "2026-09-01T00:00:00Z" }), "a", "b").ok).toBe(
            false,
        );
    });

    it("refuses to mark the same payment sent twice", () => {
        expect(canMarkSent(row({ markedSentAt: "2026-09-01T00:00:00Z" }), "b", "b").ok).toBe(false);
    });

    // ── Coercion ──

    it("reads a database row, snake_case columns and all", () => {
        const parsed = coerceInstallment({
            id: "abc",
            seq: "2",
            amount: "75.5",
            due_date: "2026-10-01",
            marked_sent_at: "2026-10-02T00:00:00Z",
            confirmed_at: null,
            note: "check #114",
        });
        expect(parsed).toEqual({
            id: "abc",
            seq: 2,
            amount: 75.5,
            dueDate: "2026-10-01",
            markedSentAt: "2026-10-02T00:00:00Z",
            confirmedAt: null,
            note: "check #114",
        });
    });

    it("drops a row with no id and survives junk input", () => {
        expect(coerceInstallment({ seq: 1 })).toBeNull();
        expect(coerceInstallment(null)).toBeNull();
        expect(coerceInstallments(null)).toEqual([]);
        expect(coerceInstallments([{ nope: true }, { id: "x", seq: 1, amount: 5 }])).toHaveLength(1);
    });

    it("sorts coerced rows by seq", () => {
        const rows = coerceInstallments([
            { id: "b", seq: 2, amount: 1 },
            { id: "a", seq: 1, amount: 1 },
        ]);
        expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
    });

    it("parses both a date and a full stamp", () => {
        expect(parseDate("2026-10-01")).toBe(Date.UTC(2026, 9, 1));
        expect(parseDate("2026-10-01T06:00:00Z")).toBe(Date.UTC(2026, 9, 1, 6));
        expect(parseDate(null)).toBeNull();
        expect(parseDate("nonsense")).toBeNull();
    });

    // ── The headline ──

    it("states progress factually, never punitively", () => {
        const line = ledgerHeadline(
            ledgerSummary(
                [
                    row({ seq: 1, confirmedAt: "2026-01-01T00:00:00Z" }),
                    row({ seq: 2, confirmedAt: "2026-02-01T00:00:00Z" }),
                    row({ seq: 3, dueDate: "2026-10-01" }),
                ],
                NOW,
            ),
            formatMoney,
            formatDate,
        );
        expect(line).toBe("2 of 3 paid · next due Oct 1, 2026");
        // Factual, and in the same voice as everything else.
        expect(line).not.toMatch(/late|overdue|!|LATE/);
    });

    it("says 'past due' plainly when something is, and nothing more", () => {
        const line = ledgerHeadline(
            ledgerSummary([row({ seq: 1, dueDate: "2026-08-01" })], NOW),
            formatMoney,
            formatDate,
        );
        expect(line).toMatch(/1 past due/);
    });

    it("says so when there is no plan and when one is paid off", () => {
        expect(ledgerHeadline(ledgerSummary([], NOW), formatMoney, formatDate)).toBe(
            "No payment plan",
        );
        expect(
            ledgerHeadline(
                ledgerSummary([row({ amount: 250, confirmedAt: "2026-01-01T00:00:00Z" })], NOW),
                formatMoney,
                formatDate,
            ),
        ).toBe("Paid in full — $250");
    });
});
