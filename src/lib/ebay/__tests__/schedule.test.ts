import { describe, it, expect } from "vitest";

import { attemptRows, dayKey, planSweep, tallyOutcomes } from "@/lib/ebay/schedule";

const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `m${String(i).padStart(3, "0")}` }));

describe("dayKey", () => {
    it("puts the 07:00 UTC run and a same-day retry on the same day", () => {
        expect(dayKey(new Date("2026-09-18T07:00:00Z"))).toBe("2026-09-18");
        expect(dayKey(new Date("2026-09-18T23:59:59Z"))).toBe("2026-09-18");
        expect(dayKey(new Date("2026-09-19T07:00:00Z"))).toBe("2026-09-19");
    });
});

describe("planSweep with the attempt ledger (211)", () => {
    it("never-attempted first, then stalest attempt — a no-match model does NOT return to the front", () => {
        const candidates = ids(5);
        const lastSignal = new Map([["m001", "2026-08-25T00:00:00Z"]]);
        const lastAttempt = new Map([
            ["m000", "2026-09-07T07:00:00Z"], // swept, nothing matched
            ["m001", "2026-08-25T00:00:00Z"], // swept, signal written
            ["m003", "2026-09-14T07:00:00Z"], // swept, nothing matched
        ]);
        const plan = planSweep({ candidates, lastSignal, lastAttempt, now: new Date("2026-09-21T07:00:00Z") });
        expect(plan.basis).toBe("attempts");
        expect(plan.neverAttempted).toBe(2);
        expect(plan.ordered.map((c) => c.id)).toEqual(["m002", "m004", "m001", "m000", "m003"]);
    });
});

describe("planSweep before the ledger exists (day rotation)", () => {
    const candidates = ids(40);
    const lastSignal = new Map([["m010", "2026-08-25T00:00:00Z"], ["m011", "2026-09-07T00:00:00Z"]]);

    it("rotates the never-read pool so consecutive days take different slices", () => {
        const a = planSweep({ candidates, lastSignal, lastAttempt: null, now: new Date("2026-09-18T07:00:00Z") });
        const b = planSweep({ candidates, lastSignal, lastAttempt: null, now: new Date("2026-09-19T07:00:00Z") });
        expect(a.basis).toBe("day-rotation");
        const sliceA = a.ordered.slice(0, 10).map((c) => c.id);
        const sliceB = b.ordered.slice(0, 10).map((c) => c.id);
        expect(sliceA).not.toEqual(sliceB);
        // Both slices come from the never-read pool.
        expect(sliceA.some((id) => lastSignal.has(id))).toBe(false);
        expect(sliceB.some((id) => lastSignal.has(id))).toBe(false);
    });

    it("is stable within a day, so a retry re-covers the same models", () => {
        const a = planSweep({ candidates, lastSignal, lastAttempt: null, now: new Date("2026-09-18T07:00:00Z") });
        const b = planSweep({ candidates, lastSignal, lastAttempt: null, now: new Date("2026-09-18T15:00:00Z") });
        expect(a.ordered.map((c) => c.id)).toEqual(b.ordered.map((c) => c.id));
    });

    it("puts already-read models last, stalest reading first", () => {
        const plan = planSweep({ candidates, lastSignal, lastAttempt: null, now: new Date("2026-09-14T07:00:00Z") });
        expect(plan.ordered.slice(-2).map((c) => c.id)).toEqual(["m010", "m011"]);
        expect(plan.neverAttempted).toBe(38);
    });
});

describe("attemptRows / tallyOutcomes", () => {
    it("records one row per model asked about, with the sample behind a signal", () => {
        const now = new Date("2026-09-21T07:00:30Z");
        const rows = attemptRows(
            { a: "signal", b: "no-match", c: "error" },
            new Map([["a", 7]]),
            now,
        );
        expect(rows).toEqual([
            { catalog_item_id: "a", swept_at: now.toISOString(), outcome: "signal", sample_size: 7 },
            { catalog_item_id: "b", swept_at: now.toISOString(), outcome: "no-match", sample_size: 0 },
            { catalog_item_id: "c", swept_at: now.toISOString(), outcome: "error", sample_size: 0 },
        ]);
        expect(tallyOutcomes({ a: "signal", b: "no-match", c: "error", d: "no-match" })).toEqual({
            signal: 1,
            "no-match": 2,
            error: 1,
            skipped: 0,
        });
    });
});
