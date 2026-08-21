import { describe, it, expect } from "vitest";
import {
    COMMISSION_STATUSES,
    TRANSITIONS,
    availableTransitions,
    ballIsWith,
    canTransition,
    intakeFor,
    isTerminal,
    normalizeStatus,
    progress,
    revisionState,
    slotState,
    statusBlurb,
    type CommissionStatus,
} from "@/lib/studio/pipeline";

describe("normalizeStatus", () => {
    it("passes current statuses through untouched", () => {
        for (const s of COMMISSION_STATUSES) {
            expect(normalizeStatus(s)).toBe(s);
        }
        expect(normalizeStatus("declined")).toBe("declined");
        expect(normalizeStatus("cancelled")).toBe("cancelled");
    });

    it("maps every v1 status forward so old rows still render", () => {
        expect(normalizeStatus("review")).toBe("awaiting_approval");
        expect(normalizeStatus("revision")).toBe("in_progress");
        expect(normalizeStatus("shipping")).toBe("completed");
    });

    it("falls back to requested for junk rather than throwing", () => {
        expect(normalizeStatus(null)).toBe("requested");
        expect(normalizeStatus(undefined)).toBe("requested");
        expect(normalizeStatus("")).toBe("requested");
        expect(normalizeStatus("not_a_status")).toBe("requested");
    });
});

describe("the state machine", () => {
    it("never lets a transition target a status that does not exist", () => {
        const known = new Set<string>([...COMMISSION_STATUSES, "declined", "cancelled"]);
        for (const rules of Object.values(TRANSITIONS)) {
            for (const rule of rules) expect(known.has(rule.to)).toBe(true);
        }
    });

    it("leaves delivered, declined and cancelled with no way out", () => {
        for (const s of ["delivered", "declined", "cancelled"] as CommissionStatus[]) {
            expect(TRANSITIONS[s]).toEqual([]);
            expect(isTerminal(s)).toBe(true);
        }
    });

    it("requires a quote before an agreement can exist", () => {
        // The v1 bug: the client set the price and the artist merely
        // "accepted" it. requested can only ever become quoted or closed.
        const targets = TRANSITIONS.requested.map((t) => t.to).sort();
        expect(targets).toEqual(["cancelled", "declined", "quoted"]);
        expect(canTransition("requested", "accepted", "artist").ok).toBe(false);
        expect(canTransition("requested", "in_progress", "artist").ok).toBe(false);
    });

    it("gives acceptance to the commissioner alone", () => {
        expect(canTransition("quoted", "accepted", "client").ok).toBe(true);
        expect(canTransition("quoted", "accepted", "artist").ok).toBe(false);
    });

    it("gives approval to the commissioner, not the artist", () => {
        // v1 let the artist mark their own work complete from review.
        expect(canTransition("awaiting_approval", "completed", "client").ok).toBe(true);
        expect(canTransition("awaiting_approval", "completed", "artist").ok).toBe(false);
    });

    it("keeps the artist in charge of starting and submitting work", () => {
        expect(canTransition("accepted", "in_progress", "artist").ok).toBe(true);
        expect(canTransition("accepted", "in_progress", "client").ok).toBe(false);
        expect(canTransition("in_progress", "awaiting_approval", "artist").ok).toBe(true);
        expect(canTransition("in_progress", "awaiting_approval", "client").ok).toBe(false);
    });

    it("lets either side cancel once terms were agreed, and flags the kill fee", () => {
        for (const from of ["accepted", "in_progress", "awaiting_approval"] as CommissionStatus[]) {
            for (const party of ["artist", "client"] as const) {
                const check = canTransition(from, "cancelled", party);
                expect(check.ok).toBe(true);
                expect(check.transition?.afterAgreement).toBe(true);
            }
        }
    });

    it("does not flag a kill fee for declining before an agreement", () => {
        const check = canTransition("requested", "declined", "artist");
        expect(check.ok).toBe(true);
        expect(check.transition?.afterAgreement).toBeUndefined();
    });

    it("marks the revision loop so it can be counted", () => {
        const check = canTransition("awaiting_approval", "in_progress", "client");
        expect(check.ok).toBe(true);
        expect(check.transition?.consumesRevision).toBe(true);
    });

    it("explains a wrong-party move differently from an impossible one", () => {
        const wrongParty = canTransition("quoted", "accepted", "artist");
        expect(wrongParty.ok).toBe(false);
        expect(wrongParty.error).toMatch(/commissioner's move/i);

        const impossible = canTransition("requested", "delivered", "artist");
        expect(impossible.ok).toBe(false);
        expect(impossible.error).toMatch(/can't go from/i);
    });

    it("refuses every move out of a terminal status", () => {
        for (const s of ["delivered", "declined", "cancelled"] as CommissionStatus[]) {
            for (const party of ["artist", "client"] as const) {
                const check = canTransition(s, "in_progress", party);
                expect(check.ok).toBe(false);
                expect(check.error).toBeTruthy();
            }
        }
    });
});

describe("availableTransitions", () => {
    it("offers each party only their own moves", () => {
        expect(availableTransitions("quoted", "client").map((t) => t.to).sort()).toEqual([
            "accepted",
            "declined",
        ]);
        expect(availableTransitions("quoted", "artist").map((t) => t.to).sort()).toEqual([
            "declined",
            "quoted",
        ]);
    });

    it("offers nothing at all once the commission is closed", () => {
        expect(availableTransitions("cancelled", "artist")).toEqual([]);
        expect(availableTransitions("delivered", "client")).toEqual([]);
    });

    it("agrees with canTransition for every status and party", () => {
        const all: CommissionStatus[] = [...COMMISSION_STATUSES, "declined", "cancelled"];
        for (const from of all) {
            for (const party of ["artist", "client"] as const) {
                for (const t of availableTransitions(from, party)) {
                    expect(canTransition(from, t.to, party).ok).toBe(true);
                }
            }
        }
    });
});

describe("ballIsWith", () => {
    it("hands the ball to the side that owes the next move", () => {
        expect(ballIsWith("requested")).toBe("artist");
        expect(ballIsWith("quoted")).toBe("client");
        expect(ballIsWith("in_progress")).toBe("artist");
        expect(ballIsWith("awaiting_approval")).toBe("client");
        expect(ballIsWith("completed")).toBe("artist");
    });

    it("hands it to nobody once the commission is closed", () => {
        expect(ballIsWith("delivered")).toBeNull();
        expect(ballIsWith("declined")).toBeNull();
        expect(ballIsWith("cancelled")).toBeNull();
    });
});

describe("statusBlurb", () => {
    it("addresses the waiting side differently from the acting side", () => {
        expect(statusBlurb("quoted", "client")).not.toBe(statusBlurb("quoted", "artist"));
    });

    it("has something to say for every status and both sides", () => {
        const all: CommissionStatus[] = [...COMMISSION_STATUSES, "declined", "cancelled"];
        for (const s of all) {
            for (const party of ["artist", "client"] as const) {
                expect(statusBlurb(s, party).length).toBeGreaterThan(0);
            }
        }
    });
});

describe("progress", () => {
    it("runs from nothing to everything across the live ladder", () => {
        expect(progress("requested")).toBe(0);
        expect(progress("delivered")).toBe(1);
        expect(progress("in_progress")).toBeGreaterThan(progress("accepted"));
    });

    it("reports no progress for commissions that ended early", () => {
        expect(progress("declined")).toBe(0);
        expect(progress("cancelled")).toBe(0);
    });
});

describe("revisionState", () => {
    it("counts remaining revisions against the allowance", () => {
        const s = revisionState(1, 3);
        expect(s.remaining).toBe(2);
        expect(s.overAllowance).toBe(false);
        expect(s.label).toBe("1 of 3 revisions used");
    });

    it("flags the moment extra revisions become billable", () => {
        expect(revisionState(2, 2).overAllowance).toBe(true);
        expect(revisionState(5, 2).overAllowance).toBe(true);
        expect(revisionState(5, 2).remaining).toBe(0);
    });

    it("handles a studio that includes no revisions", () => {
        const s = revisionState(0, 0);
        expect(s.overAllowance).toBe(true);
        expect(s.label).toBe("0 revisions (none included)");
    });

    it("never reports negative or fractional counts", () => {
        const s = revisionState(-3, 2.7);
        expect(s.used).toBe(0);
        expect(s.included).toBe(2);
        expect(s.remaining).toBe(2);
    });
});

describe("slotState", () => {
    it("counts the bench against the declared maximum", () => {
        const s = slotState(3, 5, "open");
        expect(s.open).toBe(2);
        expect(s.full).toBe(false);
        expect(s.effectiveStatus).toBe("open");
        expect(s.label).toBe("3 of 5 slots filled");
    });

    it("flips a full open studio to waitlist rather than hiding it", () => {
        // Slots are capacity and transparency, not a reservation system:
        // refusing outright throws away the demand signal.
        const s = slotState(5, 5, "open");
        expect(s.full).toBe(true);
        expect(s.effectiveStatus).toBe("waitlist");
        expect(s.open).toBe(0);
    });

    it("leaves a closed studio closed however empty the bench is", () => {
        expect(slotState(0, 5, "closed").effectiveStatus).toBe("closed");
    });

    it("treats an unset maximum as uncapped", () => {
        const s = slotState(4, 0, "open");
        expect(s.full).toBe(false);
        expect(s.effectiveStatus).toBe("open");
        expect(s.label).toBe("4 on the bench");
    });
});

describe("intakeFor", () => {
    it("takes requests normally when there is room", () => {
        const intake = intakeFor(slotState(1, 5, "open"));
        expect(intake.accepting).toBe(true);
        expect(intake.asWaitlist).toBe(false);
    });

    it("queues rather than refuses when the bench is full", () => {
        const intake = intakeFor(slotState(5, 5, "open"));
        expect(intake.accepting).toBe(true);
        expect(intake.asWaitlist).toBe(true);
        expect(intake.reason).toMatch(/waitlist/i);
    });

    it("takes waitlist requests from a studio that declared waitlist", () => {
        const intake = intakeFor(slotState(0, 5, "waitlist"));
        expect(intake.accepting).toBe(true);
        expect(intake.asWaitlist).toBe(true);
    });

    it("refuses a closed studio, and says so plainly", () => {
        const intake = intakeFor(slotState(0, 5, "closed"));
        expect(intake.accepting).toBe(false);
        expect(intake.reason).toMatch(/isn't taking commissions/i);
    });

    it("honours an artist who has turned the waitlist off, once full", () => {
        const intake = intakeFor(slotState(5, 5, "open"), false);
        expect(intake.accepting).toBe(false);
        expect(intake.reason).toMatch(/isn't keeping a waitlist/i);
    });

    it("still takes requests with the waitlist off while there is room", () => {
        const intake = intakeFor(slotState(2, 5, "open"), false);
        expect(intake.accepting).toBe(true);
        expect(intake.asWaitlist).toBe(false);
    });

    it("keeps taking waitlist requests from a studio that declared waitlist", () => {
        // Declaring WAITLIST is already consent to a waitlist; the opt-out
        // is about what happens when an OPEN studio fills up.
        const intake = intakeFor(slotState(0, 5, "waitlist"), false);
        expect(intake.accepting).toBe(true);
        expect(intake.asWaitlist).toBe(true);
    });
});
