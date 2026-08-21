import { describe, it, expect } from "vitest";

import {
    buildNudgeContent,
    canNudgeAgain,
    classifyOverdueShow,
    cutoffDate,
    cutoffIso,
    daysSince,
    nudgeLinkFor,
    sortOverdue,
    ENTRIES_CLOSED_STALLED_DAYS,
    JUDGING_NO_DEADLINE_DAYS,
    NUDGE_COOLDOWN_DAYS,
    RESULTS_REVIEW_STALLED_DAYS,
    RUNNING_IDLE_DAYS,
    RUNNING_PAST_DATE_DAYS,
    type OverdueShowInput,
} from "@/lib/admin/overdueShows";

/**
 * The predicates behind the admin's overdue queue. The hourly cron
 * nudges exactly one shape (judging past judging_ends_at) and nothing
 * watches the rest, so what matters here is that each predicate fires
 * only when it should — a queue that cries wolf gets ignored, and this
 * one exists precisely because nobody was looking.
 */

const NOW = new Date("2026-08-20T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

function show(over: Partial<OverdueShowInput>): OverdueShowInput {
    return {
        id: "show-1",
        title: "Summerween",
        hostId: "host-1",
        status: "judging",
        judgingEndsAt: null,
        entriesCloseAt: null,
        showDate: null,
        updatedAt: ago(1),
        ...over,
    };
}

describe("daysSince / cutoffs", () => {
    it("floors to whole days and never goes negative", () => {
        expect(daysSince(ago(3), NOW)).toBe(3);
        expect(daysSince(ago(0.9), NOW)).toBe(0);
        expect(daysSince(new Date(NOW.getTime() + 5 * DAY).toISOString(), NOW)).toBe(0);
    });

    it("treats an unparseable stamp as zero rather than NaN", () => {
        expect(daysSince("not a date", NOW)).toBe(0);
    });

    it("emits a timestamp cutoff and a DATE cutoff, because shows uses both", () => {
        expect(cutoffIso(NOW, 7)).toBe("2026-08-13T12:00:00.000Z");
        expect(cutoffDate(NOW, 7)).toBe("2026-08-13");
    });
});

describe("classifyOverdueShow — judging", () => {
    it("fires the moment judging_ends_at passes (the cron's own predicate)", () => {
        const verdict = classifyOverdueShow(
            show({ status: "judging", judgingEndsAt: ago(4) }),
            NOW,
        );
        expect(verdict).toMatchObject({ reason: "judging_overdue", overdueDays: 4 });
    });

    it("stays quiet while the judging deadline is still in the future", () => {
        const future = new Date(NOW.getTime() + 2 * DAY).toISOString();
        expect(classifyOverdueShow(show({ judgingEndsAt: future }), NOW)).toBeNull();
    });

    it("catches judging with NO deadline — the shape the cron can never see", () => {
        // The cron filters `.not(judging_ends_at, is, null)`, so these
        // rows are invisible to the clock forever.
        const verdict = classifyOverdueShow(
            show({ judgingEndsAt: null, updatedAt: ago(JUDGING_NO_DEADLINE_DAYS) }),
            NOW,
        );
        expect(verdict?.reason).toBe("judging_no_deadline");
    });

    it("gives a deadline-less judging show its grace period first", () => {
        const verdict = classifyOverdueShow(
            show({ judgingEndsAt: null, updatedAt: ago(JUDGING_NO_DEADLINE_DAYS - 1) }),
            NOW,
        );
        expect(verdict).toBeNull();
    });
});

describe("classifyOverdueShow — the states nothing advances", () => {
    it("flags entries_closed that never became running or judging", () => {
        const verdict = classifyOverdueShow(
            show({
                status: "entries_closed",
                entriesCloseAt: ago(ENTRIES_CLOSED_STALLED_DAYS + 2),
            }),
            NOW,
        );
        expect(verdict).toMatchObject({ reason: "entries_closed_stalled" });
    });

    it("measures a hand-closed show from updated_at when no deadline was posted", () => {
        const verdict = classifyOverdueShow(
            show({
                status: "entries_closed",
                entriesCloseAt: null,
                updatedAt: ago(ENTRIES_CLOSED_STALLED_DAYS),
            }),
            NOW,
        );
        expect(verdict).toMatchObject({ reason: "entries_closed_stalled" });
    });

    it("leaves a freshly closed show alone", () => {
        expect(
            classifyOverdueShow(show({ status: "entries_closed", entriesCloseAt: ago(1) }), NOW),
        ).toBeNull();
    });

    it("flags a live show still running past its show date", () => {
        const showDate = cutoffDate(NOW, RUNNING_PAST_DATE_DAYS + 1);
        const verdict = classifyOverdueShow(
            show({ status: "running", showDate, updatedAt: ago(0) }),
            NOW,
        );
        // Edited yesterday, but the DATE is what says it's stalled.
        expect(verdict?.reason).toBe("running_stalled");
    });

    it("falls back to idleness for a running show with no date on file", () => {
        expect(
            classifyOverdueShow(
                show({ status: "running", showDate: null, updatedAt: ago(RUNNING_IDLE_DAYS) }),
                NOW,
            )?.reason,
        ).toBe("running_stalled");
        expect(
            classifyOverdueShow(
                show({ status: "running", showDate: null, updatedAt: ago(1) }),
                NOW,
            ),
        ).toBeNull();
    });

    it("flags results that were never published to entrants", () => {
        expect(
            classifyOverdueShow(
                show({ status: "results_review", updatedAt: ago(RESULTS_REVIEW_STALLED_DAYS) }),
                NOW,
            )?.reason,
        ).toBe("results_review_stalled");
    });

    it("has no opinion about states that are not stuck", () => {
        for (const status of ["draft", "published", "entries_open", "completed", "archived"]) {
            expect(classifyOverdueShow(show({ status, updatedAt: ago(400) }), NOW)).toBeNull();
        }
    });
});

describe("nudgeLinkFor", () => {
    it("reuses the cron's exact link for judging, so the two dedupe against each other", () => {
        expect(nudgeLinkFor("abc", "judging_overdue")).toBe("/shows/host/abc#judging-overdue");
        expect(nudgeLinkFor("abc", "judging_no_deadline")).toBe("/shows/host/abc#judging-overdue");
    });

    it("gives the states the cron ignores their own dedupe key", () => {
        expect(nudgeLinkFor("abc", "entries_closed_stalled")).toBe("/shows/host/abc#stalled");
        expect(nudgeLinkFor("abc", "running_stalled")).toBe("/shows/host/abc#stalled");
        expect(nudgeLinkFor("abc", "results_review_stalled")).toBe("/shows/host/abc#stalled");
    });
});

describe("canNudgeAgain", () => {
    it("lets a never-nudged host through", () => {
        expect(canNudgeAgain(null, NOW)).toBe(true);
    });

    it("holds the cooldown, then releases it", () => {
        expect(canNudgeAgain(ago(NUDGE_COOLDOWN_DAYS - 1), NOW)).toBe(false);
        expect(canNudgeAgain(ago(NUDGE_COOLDOWN_DAYS), NOW)).toBe(true);
    });
});

describe("buildNudgeContent", () => {
    it("names the show and asks, never scolds", () => {
        const text = buildNudgeContent("Summerween", {
            reason: "judging_overdue",
            since: ago(4),
            overdueDays: 4,
        });
        expect(text).toContain("Summerween");
        expect(text).toContain("4 days ago");
        expect(text).toContain("when ready");
    });

    it("writes a different body per reason", () => {
        const bodies = (
            [
                "judging_overdue",
                "judging_no_deadline",
                "entries_closed_stalled",
                "running_stalled",
                "results_review_stalled",
            ] as const
        ).map((reason) => buildNudgeContent("Summerween", { reason, since: ago(9), overdueDays: 9 }));
        expect(new Set(bodies).size).toBe(5);
    });

    it("says 'today' rather than '0 days ago'", () => {
        const text = buildNudgeContent("Summerween", {
            reason: "judging_overdue",
            since: ago(0),
            overdueDays: 0,
        });
        expect(text).toContain("today");
        expect(text).not.toContain("0 day");
    });
});

describe("sortOverdue", () => {
    it("puts entrants-are-waiting first, then the longest wait", () => {
        const sorted = sortOverdue([
            { reason: "running_stalled" as const, overdueDays: 90 },
            { reason: "judging_overdue" as const, overdueDays: 2 },
            { reason: "judging_overdue" as const, overdueDays: 40 },
        ]);
        expect(sorted.map((r) => r.overdueDays)).toEqual([40, 2, 90]);
    });
});
