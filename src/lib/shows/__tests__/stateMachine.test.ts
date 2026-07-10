import { describe, it, expect } from "vitest";
import {
    canCombineClass,
    canSplitClass,
    canTransition,
    canTransitionClass,
    formatStatus,
    isShowMutableForClasslist,
    legalNextStatuses,
} from "@/lib/shows/stateMachine";
import type { ClassStatus, ShowStatus } from "@/lib/shows/types";

describe("stateMachine — show lifecycle", () => {
    describe("happy path, live mode", () => {
        const path: [ShowStatus, ShowStatus][] = [
            ["draft", "published"],
            ["published", "entries_open"],
            ["entries_open", "entries_closed"],
            ["entries_closed", "running"],
            ["running", "results_review"],
            ["results_review", "completed"],
            ["completed", "archived"],
        ];
        it.each(path)("%s → %s is legal", (from, to) => {
            expect(canTransition(from, to, "live")).toEqual({ ok: true });
        });
    });

    describe("happy path, online mode", () => {
        it("entries_closed → judging is legal online", () => {
            expect(canTransition("entries_closed", "judging", "online")).toEqual({ ok: true });
        });
        it("judging → results_review is legal online", () => {
            expect(canTransition("judging", "results_review", "online")).toEqual({ ok: true });
        });
    });

    describe("mode gates", () => {
        it("online show cannot enter running", () => {
            const r = canTransition("entries_closed", "running", "online");
            expect(r.ok).toBe(false);
            if (!r.ok) expect(r.reason).toMatch(/only live shows/i);
        });
        it("live show cannot enter judging", () => {
            const r = canTransition("entries_closed", "judging", "live");
            expect(r.ok).toBe(false);
            if (!r.ok) expect(r.reason).toMatch(/only online shows/i);
        });
    });

    describe("illegal jumps", () => {
        const illegal: [ShowStatus, ShowStatus][] = [
            ["draft", "entries_open"],
            ["draft", "completed"],
            ["published", "running"],
            ["entries_open", "results_review"],
            ["running", "completed"],
            ["completed", "draft"],
            ["archived", "draft"],
            ["archived", "completed"],
        ];
        it.each(illegal)("%s → %s is refused with a reason", (from, to) => {
            const r = canTransition(from, to, "live");
            expect(r.ok).toBe(false);
            if (!r.ok) expect(r.reason.length).toBeGreaterThan(10);
        });
    });

    describe("recovery transitions", () => {
        it("published → draft (unpublish) is legal", () => {
            expect(canTransition("published", "draft", "live")).toEqual({ ok: true });
        });
        it("entries_closed → entries_open (reopen entries) is legal", () => {
            expect(canTransition("entries_closed", "entries_open", "online")).toEqual({ ok: true });
        });
        it("results_review → running (fix a recording mistake) is legal for live", () => {
            expect(canTransition("results_review", "running", "live")).toEqual({ ok: true });
        });
        it("results_review → judging is legal for online but not live", () => {
            expect(canTransition("results_review", "judging", "online")).toEqual({ ok: true });
            expect(canTransition("results_review", "judging", "live").ok).toBe(false);
        });
    });

    it("self-transition is refused", () => {
        const r = canTransition("draft", "draft", "live");
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toMatch(/already/i);
    });

    it("archived is terminal for every target", () => {
        const targets: ShowStatus[] = [
            "draft", "published", "entries_open", "entries_closed",
            "running", "judging", "results_review", "completed",
        ];
        for (const to of targets) {
            expect(canTransition("archived", to, "live").ok).toBe(false);
            expect(canTransition("archived", to, "online").ok).toBe(false);
        }
    });
});

describe("stateMachine — class lifecycle", () => {
    it("walks scheduled → called → judging → placed", () => {
        expect(canTransitionClass("scheduled", "called")).toEqual({ ok: true });
        expect(canTransitionClass("called", "judging")).toEqual({ ok: true });
        expect(canTransitionClass("judging", "placed")).toEqual({ ok: true });
    });

    it("allows skipping called (online shows judge from scheduled)", () => {
        expect(canTransitionClass("scheduled", "judging")).toEqual({ ok: true });
    });

    it("placed can reopen to judging to fix mistakes", () => {
        expect(canTransitionClass("placed", "judging")).toEqual({ ok: true });
    });

    it("combined is terminal", () => {
        const targets: ClassStatus[] = ["scheduled", "called", "judging", "placed", "cancelled"];
        for (const to of targets) {
            expect(canTransitionClass("combined", to).ok).toBe(false);
        }
    });

    it("cancelled can only be un-cancelled back to scheduled", () => {
        expect(canTransitionClass("cancelled", "scheduled")).toEqual({ ok: true });
        expect(canTransitionClass("cancelled", "judging").ok).toBe(false);
        expect(canTransitionClass("cancelled", "placed").ok).toBe(false);
    });

    it("refuses placed → scheduled and judging → cancelled", () => {
        expect(canTransitionClass("placed", "scheduled").ok).toBe(false);
        expect(canTransitionClass("judging", "cancelled").ok).toBe(false);
    });

    it("refuses self-transition", () => {
        expect(canTransitionClass("scheduled", "scheduled").ok).toBe(false);
    });
});

describe("stateMachine — split/combine legality", () => {
    it("split allowed while scheduled or called", () => {
        expect(canSplitClass("scheduled")).toEqual({ ok: true });
        expect(canSplitClass("called")).toEqual({ ok: true });
    });
    it("split refused once judging/placed/combined/cancelled", () => {
        for (const s of ["judging", "placed", "combined", "cancelled"] as ClassStatus[]) {
            const r = canSplitClass(s);
            expect(r.ok).toBe(false);
            if (!r.ok) expect(r.reason).toContain(s);
        }
    });
    it("combine mirrors split legality", () => {
        expect(canCombineClass("scheduled")).toEqual({ ok: true });
        expect(canCombineClass("called")).toEqual({ ok: true });
        expect(canCombineClass("placed").ok).toBe(false);
        expect(canCombineClass("combined").ok).toBe(false);
    });
});

describe("stateMachine — helpers", () => {
    it("formatStatus humanizes underscores", () => {
        expect(formatStatus("entries_open")).toBe("entries open");
        expect(formatStatus("results_review")).toBe("results review");
        expect(formatStatus("draft")).toBe("draft");
    });
    it("isShowMutableForClasslist is false once results are final", () => {
        expect(isShowMutableForClasslist("running")).toBe(true);
        expect(isShowMutableForClasslist("judging")).toBe(true);
        expect(isShowMutableForClasslist("results_review")).toBe(false);
        expect(isShowMutableForClasslist("completed")).toBe(false);
        expect(isShowMutableForClasslist("archived")).toBe(false);
    });
});

describe("stateMachine — legalNextStatuses", () => {
    it("lists exactly the reachable statuses for the show's mode", () => {
        expect(legalNextStatuses("draft", "live")).toEqual(["published"]);
        expect(legalNextStatuses("entries_closed", "live")).toEqual([
            "entries_open",
            "running",
        ]);
        expect(legalNextStatuses("entries_closed", "online")).toEqual([
            "entries_open",
            "judging",
        ]);
        expect(legalNextStatuses("results_review", "online")).toEqual([
            "judging",
            "completed",
        ]);
        expect(legalNextStatuses("archived", "live")).toEqual([]);
    });
});
