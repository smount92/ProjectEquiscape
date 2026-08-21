import { describe, it, expect } from "vitest";
import { monthlySeries, summarizeIncome, type IncomeRow } from "@/lib/studio/income";

const NOW = new Date("2026-08-19T12:00:00Z");

function row(over: Partial<IncomeRow> = {}): IncomeRow {
    return {
        id: Math.random().toString(36).slice(2),
        status: "completed",
        agreedPrice: 500,
        depositAmount: null,
        depositPaid: false,
        finalPaid: false,
        completedAt: "2026-08-01",
        createdAt: "2026-07-01",
        ...over,
    };
}

describe("summarizeIncome", () => {
    it("reports nothing rather than NaN for an artist with no commissions", () => {
        const s = summarizeIncome([], NOW);
        expect(s.earnedAllTime).toBe(0);
        expect(s.earnedCount).toBe(0);
        expect(s.averageCommission).toBeNull();
        expect(s.byMonth).toEqual([]);
        expect(s.bestMonth).toBeNull();
    });

    it("counts completed and delivered work as earned, and nothing else", () => {
        const s = summarizeIncome(
            [
                row({ status: "completed", agreedPrice: 500 }),
                row({ status: "delivered", agreedPrice: 700 }),
                row({ status: "in_progress", agreedPrice: 900 }),
                row({ status: "quoted", agreedPrice: 300 }),
                row({ status: "declined", agreedPrice: 999 }),
                row({ status: "cancelled", agreedPrice: 999 }),
            ],
            NOW,
        );
        expect(s.earnedAllTime).toBe(1200);
        expect(s.earnedCount).toBe(2);
        expect(s.averageCommission).toBe(600);
    });

    it("counts legacy v1 statuses correctly after normalisation", () => {
        // `shipping` normalises to completed, `review` to awaiting_approval.
        const s = summarizeIncome(
            [
                row({ status: "shipping", agreedPrice: 400 }),
                row({ status: "review", agreedPrice: 600 }),
            ],
            NOW,
        );
        expect(s.earnedAllTime).toBe(400);
        expect(s.committedActive).toBe(600);
        expect(s.activeCount).toBe(1);
    });

    it("separates the value of the bench from the value of open quotes", () => {
        const s = summarizeIncome(
            [
                row({ status: "accepted", agreedPrice: 200 }),
                row({ status: "in_progress", agreedPrice: 300 }),
                row({ status: "awaiting_approval", agreedPrice: 400 }),
                row({ status: "quoted", agreedPrice: 1000 }),
                row({ status: "requested", agreedPrice: null }),
            ],
            NOW,
        );
        expect(s.committedActive).toBe(900);
        expect(s.activeCount).toBe(3);
        expect(s.quotedOutstanding).toBe(1000);
        expect(s.quotedCount).toBe(1);
    });

    it("tallies deposits and balances the artist has marked unpaid", () => {
        const s = summarizeIncome(
            [
                row({
                    status: "in_progress",
                    agreedPrice: 800,
                    depositAmount: 400,
                    depositPaid: false,
                    finalPaid: false,
                }),
                row({
                    status: "in_progress",
                    agreedPrice: 600,
                    depositAmount: 300,
                    depositPaid: true,
                    finalPaid: false,
                }),
            ],
            NOW,
        );
        expect(s.depositsOutstanding).toBe(400);
        // 800 owed in full, plus 600 less the 300 deposit already taken.
        expect(s.balanceOutstanding).toBe(1100);
    });

    it("does not chase money on work that is already paid off", () => {
        const s = summarizeIncome(
            [row({ status: "in_progress", agreedPrice: 500, depositAmount: 250, depositPaid: true, finalPaid: true })],
            NOW,
        );
        expect(s.depositsOutstanding).toBe(0);
        expect(s.balanceOutstanding).toBe(0);
    });

    it("buckets earnings by the month the work completed, newest first", () => {
        const s = summarizeIncome(
            [
                row({ completedAt: "2026-08-14", agreedPrice: 500 }),
                row({ completedAt: "2026-08-02", agreedPrice: 300 }),
                row({ completedAt: "2026-06-11", agreedPrice: 900 }),
            ],
            NOW,
        );
        expect(s.byMonth.map((b) => b.key)).toEqual(["2026-08", "2026-06"]);
        expect(s.byMonth[0]).toMatchObject({ label: "Aug 2026", count: 2, total: 800 });
        expect(s.bestMonth?.key).toBe("2026-06");
    });

    it("buckets by calendar date, not by the reader's timezone", () => {
        // A plain "2026-08-01" must not slide into July for anyone west
        // of UTC, which is what parsing it through Date() would do.
        const s = summarizeIncome([row({ completedAt: "2026-08-01", agreedPrice: 100 })], NOW);
        expect(s.byMonth[0].key).toBe("2026-08");
    });

    it("counts only the trailing twelve months in the recent total", () => {
        const s = summarizeIncome(
            [
                row({ completedAt: "2026-08-01", agreedPrice: 500 }),
                row({ completedAt: "2024-03-01", agreedPrice: 900 }),
            ],
            NOW,
        );
        expect(s.earnedAllTime).toBe(1400);
        expect(s.earnedLast12).toBe(500);
    });

    it("falls back to the creation date when a completion date is missing", () => {
        const s = summarizeIncome(
            [row({ completedAt: null, createdAt: "2026-05-09", agreedPrice: 250 })],
            NOW,
        );
        expect(s.byMonth[0].key).toBe("2026-05");
    });

    it("treats an unpriced completion as zero rather than breaking the total", () => {
        const s = summarizeIncome(
            [row({ agreedPrice: null }), row({ agreedPrice: 400 })],
            NOW,
        );
        expect(s.earnedAllTime).toBe(400);
        expect(s.earnedCount).toBe(2);
        expect(s.averageCommission).toBe(200);
    });
});

describe("monthlySeries", () => {
    it("pads quiet months so the shape of the year is honest", () => {
        const s = summarizeIncome([row({ completedAt: "2026-08-01", agreedPrice: 500 })], NOW);
        const series = monthlySeries(s.byMonth, 12, NOW);
        expect(series).toHaveLength(12);
        expect(series[series.length - 1]).toMatchObject({ key: "2026-08", total: 500 });
        expect(series[0].total).toBe(0);
    });

    it("runs oldest to newest, ready to render left to right", () => {
        const series = monthlySeries([], 3, NOW);
        expect(series.map((b) => b.key)).toEqual(["2026-06", "2026-07", "2026-08"]);
    });
});
