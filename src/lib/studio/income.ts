/**
 * The business tracker's arithmetic — pure, no I/O.
 *
 * Artists currently do this in a spreadsheet: what did I earn, which months
 * were good, what's still owed (research doc 1.4). We can do it for them off
 * the agreed prices we already hold.
 *
 * NOTHING HERE PROCESSES MONEY. Payments on Model Horse Hub are off-platform;
 * these are the artist's own records of prices they agreed and payments they
 * told us they received. Treat every figure as a display of what the artist
 * entered, never as a settlement.
 */

import { EARNED_STATUSES, normalizeStatus, type CommissionStatus } from "./pipeline";

export interface IncomeRow {
    id: string;
    status: string;
    /** The agreed price, or the quote if no agreement was reached. */
    agreedPrice: number | null;
    depositAmount: number | null;
    depositPaid: boolean;
    finalPaid: boolean;
    /** ISO date the commission completed, if it did. */
    completedAt: string | null;
    createdAt: string;
}

export interface MonthBucket {
    /** "2026-08" */
    key: string;
    /** "Aug 2026" */
    label: string;
    count: number;
    total: number;
}

export interface IncomeSummary {
    /** Completed + delivered, all time. */
    earnedAllTime: number;
    earnedCount: number;
    /** Completed in the trailing 12 months. */
    earnedLast12: number;
    /** Agreed but not yet finished — the value of the bench. */
    committedActive: number;
    activeCount: number;
    /** Quotes sent and not yet answered. */
    quotedOutstanding: number;
    quotedCount: number;
    /** Deposits and balances the artist has marked unpaid on live work. */
    depositsOutstanding: number;
    balanceOutstanding: number;
    /** Average value of a completed commission. */
    averageCommission: number | null;
    /** Newest first, one entry per month that had a completion. */
    byMonth: MonthBucket[];
    /** Best month in the series, for the "your best month" line. */
    bestMonth: MonthBucket | null;
}

const MONTH_LABELS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthKeyOf(iso: string): { key: string; label: string } | null {
    // Parse the date parts directly rather than through Date(), so a plain
    // "2026-08-14" isn't shifted into the previous month for anyone west of
    // UTC. Commission dates are calendar dates, not instants.
    const m = /^(\d{4})-(\d{2})/.exec(iso);
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (!year || month < 1 || month > 12) return null;
    return {
        key: `${m[1]}-${m[2]}`,
        label: `${MONTH_LABELS[month - 1]} ${year}`,
    };
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

/**
 * Roll a set of commissions into the numbers an artist actually wants on a
 * dashboard. `now` is injectable so the trailing-12 window is testable.
 */
export function summarizeIncome(
    rows: IncomeRow[],
    now: Date = new Date(),
): IncomeSummary {
    let earnedAllTime = 0;
    let earnedCount = 0;
    let earnedLast12 = 0;
    let committedActive = 0;
    let activeCount = 0;
    let quotedOutstanding = 0;
    let quotedCount = 0;
    let depositsOutstanding = 0;
    let balanceOutstanding = 0;

    const months = new Map<string, MonthBucket>();

    const cutoff = new Date(now);
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`;

    for (const row of rows) {
        const status: CommissionStatus = normalizeStatus(row.status);
        const price = row.agreedPrice != null && Number.isFinite(row.agreedPrice)
            ? row.agreedPrice
            : 0;

        if (EARNED_STATUSES.includes(status)) {
            earnedAllTime += price;
            earnedCount += 1;

            const stamp = row.completedAt || row.createdAt;
            const mk = stamp ? monthKeyOf(stamp) : null;
            if (mk) {
                if (mk.key >= cutoffKey) earnedLast12 += price;
                const bucket = months.get(mk.key) ?? {
                    key: mk.key,
                    label: mk.label,
                    count: 0,
                    total: 0,
                };
                bucket.count += 1;
                bucket.total += price;
                months.set(mk.key, bucket);
            }
            continue;
        }

        if (status === "quoted") {
            quotedOutstanding += price;
            quotedCount += 1;
            continue;
        }

        if (status === "accepted" || status === "in_progress" || status === "awaiting_approval") {
            committedActive += price;
            activeCount += 1;
            // Off-platform money the artist has flagged as still owed.
            if (!row.depositPaid && row.depositAmount) {
                depositsOutstanding += row.depositAmount;
            }
            if (!row.finalPaid && price > 0) {
                const paid = row.depositPaid && row.depositAmount ? row.depositAmount : 0;
                balanceOutstanding += Math.max(0, price - paid);
            }
        }
    }

    const byMonth = [...months.values()]
        .map((b) => ({ ...b, total: round2(b.total) }))
        .sort((a, b) => (a.key < b.key ? 1 : -1));

    const bestMonth = byMonth.length
        ? byMonth.reduce((best, b) => (b.total > best.total ? b : best), byMonth[0])
        : null;

    return {
        earnedAllTime: round2(earnedAllTime),
        earnedCount,
        earnedLast12: round2(earnedLast12),
        committedActive: round2(committedActive),
        activeCount,
        quotedOutstanding: round2(quotedOutstanding),
        quotedCount,
        depositsOutstanding: round2(depositsOutstanding),
        balanceOutstanding: round2(balanceOutstanding),
        averageCommission: earnedCount > 0 ? round2(earnedAllTime / earnedCount) : null,
        byMonth,
        bestMonth,
    };
}

/**
 * Bars for the monthly sparkline, oldest first, padded so empty months are
 * visible as gaps rather than silently collapsed. A chart that skips the
 * quiet months lies about the shape of the year.
 */
export function monthlySeries(
    byMonth: MonthBucket[],
    months = 12,
    now: Date = new Date(),
): MonthBucket[] {
    const lookup = new Map(byMonth.map((b) => [b.key, b]));
    const out: MonthBucket[] = [];
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        out.push(
            lookup.get(key) ?? {
                key,
                label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
                count: 0,
                total: 0,
            },
        );
    }
    return out;
}
