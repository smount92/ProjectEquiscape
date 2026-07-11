import { describe, it, expect } from "vitest";
import {
    COMMERCE_ACTIONS,
    TERMINAL_STATUSES,
    TRANSACTION_STATUSES,
    actorForCaller,
    canPerform,
    isTerminal,
    legalActions,
    requirePaidAt,
    type CommerceAction,
    type TransactionStatus,
} from "@/lib/commerce/stateMachine";

const SELLER = "11111111-1111-4111-8111-111111111111";
const BUYER = "22222222-2222-4222-8222-222222222222";
const STRANGER = "33333333-3333-4333-8333-333333333333";

const txn = (status: TransactionStatus) => ({
    status,
    partyAId: SELLER,
    partyBId: BUYER,
});

describe("commerce stateMachine — statuses", () => {
    it("matches the migration-060 CHECK constraint status set", () => {
        expect([...TRANSACTION_STATUSES].sort()).toEqual(
            ["cancelled", "completed", "funds_verified", "offer_made", "pending", "pending_payment"].sort(),
        );
    });

    it("completed and cancelled are terminal", () => {
        expect(TERMINAL_STATUSES).toEqual(["completed", "cancelled"]);
        expect(isTerminal("completed")).toBe(true);
        expect(isTerminal("cancelled")).toBe(true);
        expect(isTerminal("offer_made")).toBe(false);
        expect(isTerminal("pending_payment")).toBe(false);
    });

    it("no action leads out of a terminal status", () => {
        expect(legalActions("completed")).toEqual([]);
        expect(legalActions("cancelled")).toEqual([]);
    });
});

describe("commerce stateMachine — actorForCaller", () => {
    it("maps party_a to seller", () => {
        expect(actorForCaller(SELLER, txn("offer_made"))).toBe("seller");
    });
    it("maps party_b to buyer", () => {
        expect(actorForCaller(BUYER, txn("offer_made"))).toBe("buyer");
    });
    it("maps a stranger to null", () => {
        expect(actorForCaller(STRANGER, txn("offer_made"))).toBeNull();
    });
    it("null party_b (legacy rows) never matches", () => {
        expect(actorForCaller(BUYER, { partyAId: SELLER, partyBId: null })).toBeNull();
    });
});

describe("commerce stateMachine — legal transitions (happy paths)", () => {
    const legal: [CommerceAction, string, TransactionStatus][] = [
        ["accept_offer", SELLER, "offer_made"],
        ["decline_offer", SELLER, "offer_made"],
        ["retract_offer", BUYER, "offer_made"],
        ["mark_payment_sent", BUYER, "pending_payment"],
        ["verify_funds", SELLER, "pending_payment"],
        ["cancel_transaction", SELLER, "offer_made"],
        ["cancel_transaction", SELLER, "pending_payment"],
        ["cancel_transaction", SELLER, "funds_verified"],
        ["complete_transaction", SELLER, "pending"],
        ["complete_transaction", BUYER, "pending"],
        ["complete_transaction", SELLER, "funds_verified"],
        ["complete_transaction", BUYER, "funds_verified"],
    ];
    it.each(legal)("%s by %s from %s is legal", (action, caller, status) => {
        expect(canPerform(action, caller, txn(status))).toEqual({ ok: true });
    });
});

describe("commerce stateMachine — wrong actor refusals", () => {
    const wrongActor: [CommerceAction, string, TransactionStatus, RegExp][] = [
        ["accept_offer", BUYER, "offer_made", /only the seller/i],
        ["accept_offer", STRANGER, "offer_made", /only the seller/i],
        ["decline_offer", BUYER, "offer_made", /only the seller/i],
        ["retract_offer", SELLER, "offer_made", /only the buyer/i],
        ["retract_offer", STRANGER, "offer_made", /only the buyer/i],
        ["mark_payment_sent", SELLER, "pending_payment", /only the buyer/i],
        ["mark_payment_sent", STRANGER, "pending_payment", /only the buyer/i],
        ["verify_funds", BUYER, "pending_payment", /only the seller/i],
        ["verify_funds", STRANGER, "pending_payment", /only the seller/i],
        ["cancel_transaction", BUYER, "pending_payment", /only the seller/i],
        ["cancel_transaction", STRANGER, "pending_payment", /only the seller/i],
        ["complete_transaction", STRANGER, "funds_verified", /party to this transaction/i],
    ];
    it.each(wrongActor)("%s by %s in %s refuses on party", (action, caller, status, re) => {
        const r = canPerform(action, caller, txn(status));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toMatch(re);
    });

    it("party check runs before status check (matches original error precedence)", () => {
        // Wrong party AND wrong status → the party refusal wins.
        const r = canPerform("mark_payment_sent", SELLER, txn("completed"));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toMatch(/only the buyer/i);
    });
});

describe("commerce stateMachine — wrong status refusals", () => {
    const wrongStatus: [CommerceAction, string, TransactionStatus][] = [
        ["accept_offer", SELLER, "pending_payment"],
        ["accept_offer", SELLER, "completed"],
        ["accept_offer", SELLER, "cancelled"],
        ["decline_offer", SELLER, "funds_verified"],
        ["retract_offer", BUYER, "pending_payment"],
        ["retract_offer", BUYER, "completed"],
        ["mark_payment_sent", BUYER, "offer_made"],
        ["mark_payment_sent", BUYER, "funds_verified"],
        ["mark_payment_sent", BUYER, "cancelled"],
        ["verify_funds", SELLER, "offer_made"],
        ["verify_funds", SELLER, "funds_verified"],
        ["verify_funds", SELLER, "completed"],
        ["cancel_transaction", SELLER, "completed"],
        ["cancel_transaction", SELLER, "cancelled"],
        ["cancel_transaction", SELLER, "pending"],
        ["complete_transaction", SELLER, "offer_made"],
        ["complete_transaction", SELLER, "pending_payment"],
        ["complete_transaction", SELLER, "completed"],
        ["complete_transaction", SELLER, "cancelled"],
    ];
    it.each(wrongStatus)("%s by right party from %s refuses on status", (action, caller, status) => {
        const r = canPerform(action, caller, txn(status));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason.length).toBeGreaterThan(0);
    });

    it("preserves the exact original refusal strings", () => {
        const cases: [CommerceAction, string, TransactionStatus, string][] = [
            ["retract_offer", BUYER, "pending_payment", "Offer can only be retracted while pending."],
            ["mark_payment_sent", BUYER, "offer_made", "This transaction is not awaiting payment."],
            ["verify_funds", SELLER, "offer_made", "This transaction is not awaiting verification."],
            ["cancel_transaction", SELLER, "completed", 'Transaction cannot be cancelled in "completed" state.'],
        ];
        for (const [action, caller, status, msg] of cases) {
            const r = canPerform(action, caller, txn(status));
            expect(r).toEqual({ ok: false, reason: msg });
        }
    });

    it("preserves the exact original party refusal strings", () => {
        const cases: [CommerceAction, string, string][] = [
            ["retract_offer", SELLER, "Only the buyer can retract an offer."],
            ["mark_payment_sent", SELLER, "Only the buyer can mark payment as sent."],
            ["verify_funds", BUYER, "Only the seller can verify funds."],
            ["cancel_transaction", BUYER, "Only the seller can cancel."],
        ];
        for (const [action, caller, msg] of cases) {
            const r = canPerform(action, caller, txn("pending_payment"));
            expect(r).toEqual({ ok: false, reason: msg });
        }
    });
});

describe("commerce stateMachine — system actions", () => {
    it("system actions refuse every user caller", () => {
        for (const action of ["claim_completion", "auto_cancel_stale_offer"] as CommerceAction[]) {
            for (const caller of [SELLER, BUYER, STRANGER]) {
                const r = canPerform(action, caller, txn(COMMERCE_ACTIONS[action].from[0]));
                expect(r.ok).toBe(false);
            }
        }
    });

    it("claim_completion is funds_verified → completed", () => {
        expect(COMMERCE_ACTIONS.claim_completion.from).toEqual(["funds_verified"]);
        expect(COMMERCE_ACTIONS.claim_completion.to).toBe("completed");
    });

    it("auto_cancel_stale_offer is offer_made → cancelled", () => {
        expect(COMMERCE_ACTIONS.auto_cancel_stale_offer.from).toEqual(["offer_made"]);
        expect(COMMERCE_ACTIONS.auto_cancel_stale_offer.to).toBe("cancelled");
    });
});

describe("commerce stateMachine — requirePaidAt", () => {
    it("refuses when paid_at is null", () => {
        expect(requirePaidAt(null)).toEqual({
            ok: false,
            reason: "Buyer has not yet marked payment as sent.",
        });
    });
    it("passes when paid_at is stamped", () => {
        expect(requirePaidAt("2026-07-10T00:00:00Z")).toEqual({ ok: true });
    });
});

describe("commerce stateMachine — legalActions", () => {
    it("offer_made allows the offer-stage actions", () => {
        expect(legalActions("offer_made").sort()).toEqual(
            ["accept_offer", "auto_cancel_stale_offer", "cancel_transaction", "decline_offer", "retract_offer"].sort(),
        );
    });
    it("pending_payment allows payment-stage actions", () => {
        expect(legalActions("pending_payment").sort()).toEqual(
            ["cancel_transaction", "mark_payment_sent", "verify_funds"].sort(),
        );
    });
    it("funds_verified allows cancel, complete, and system claim", () => {
        expect(legalActions("funds_verified").sort()).toEqual(
            ["cancel_transaction", "claim_completion", "complete_transaction"].sort(),
        );
    });
    it("legacy pending only allows completion", () => {
        expect(legalActions("pending")).toEqual(["complete_transaction"]);
    });
});
