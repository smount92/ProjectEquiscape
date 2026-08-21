import { describe, it, expect } from "vitest";

import {
    DEAL_KINDS,
    DEAL_STAGES,
    TERMINAL_STAGES,
    dealNoun,
    inferKind,
    isTerminalStage,
    otherParty,
    partyForUser,
    payeeParty,
    payerParty,
    roleLabel,
    stageForCommission,
    stageForTransaction,
    stageIndex,
    stageLabel,
    waitingOn,
    type DealStage,
} from "../vocabulary";
import { TRANSACTION_STATUSES } from "@/lib/commerce/stateMachine";

describe("deal vocabulary", () => {
    // ── The stage ladder ──

    it("has a label for every stage", () => {
        for (const stage of DEAL_STAGES) {
            expect(stageLabel(stage)).toBeTruthy();
        }
    });

    it("orders the ladder from talking to settled", () => {
        expect(stageIndex("talking")).toBeLessThan(stageIndex("proposed"));
        expect(stageIndex("proposed")).toBeLessThan(stageIndex("agreed"));
        expect(stageIndex("agreed")).toBeLessThan(stageIndex("paying"));
        expect(stageIndex("paying")).toBeLessThan(stageIndex("fulfilling"));
        expect(stageIndex("fulfilling")).toBeLessThan(stageIndex("settled"));
    });

    it("gives a dispute no position on the ladder — it is a hold, not a step", () => {
        expect(stageIndex("disputed")).toBe(-1);
    });

    it("treats settled and closed as terminal, and nothing else", () => {
        expect([...TERMINAL_STAGES].sort()).toEqual(["closed", "settled"]);
        for (const stage of DEAL_STAGES) {
            expect(isTerminalStage(stage)).toBe(
                stage === "settled" || stage === "closed",
            );
        }
    });

    // ── Translating the two existing state machines ──

    it("maps every Safe-Trade status to a real stage", () => {
        const known = new Set<string>(DEAL_STAGES);
        for (const status of TRANSACTION_STATUSES) {
            const stage = stageForTransaction({ status });
            expect(known.has(stage)).toBe(true);
        }
    });

    it("splits pending_payment on paid_at, which is what the deal strip reads", () => {
        expect(stageForTransaction({ status: "pending_payment", paidAt: null })).toBe("agreed");
        expect(
            stageForTransaction({ status: "pending_payment", paidAt: "2026-08-01T00:00:00Z" }),
        ).toBe("paying");
    });

    it("maps the Safe-Trade ladder end to end", () => {
        expect(stageForTransaction({ status: "offer_made" })).toBe("proposed");
        expect(stageForTransaction({ status: "funds_verified" })).toBe("fulfilling");
        expect(stageForTransaction({ status: "completed" })).toBe("settled");
        expect(stageForTransaction({ status: "cancelled" })).toBe("closed");
        expect(stageForTransaction({ status: "pending" })).toBe("talking");
    });

    it("lets a dispute override any status, including a completed one", () => {
        expect(
            stageForTransaction({ status: "completed", disputedAt: "2026-08-01T00:00:00Z" }),
        ).toBe("disputed");
        expect(
            stageForTransaction({ status: "offer_made", disputedAt: "2026-08-01T00:00:00Z" }),
        ).toBe("disputed");
    });

    it("maps every commission status, legacy values included", () => {
        const known = new Set<string>(DEAL_STAGES);
        const statuses = [
            "requested", "quoted", "accepted", "in_progress",
            "awaiting_approval", "completed", "delivered",
            "declined", "cancelled",
            // legacy, read-only per migration 170
            "review", "revision", "shipping",
        ];
        for (const status of statuses) {
            expect(known.has(stageForCommission(status))).toBe(true);
        }
        expect(stageForCommission("quoted")).toBe("proposed");
        expect(stageForCommission("accepted")).toBe("agreed");
        expect(stageForCommission("delivered")).toBe("settled");
        expect(stageForCommission("declined")).toBe("closed");
    });

    it("puts a legacy commission value in the same stage as its modern equivalent", () => {
        expect(stageForCommission("review")).toBe(stageForCommission("awaiting_approval"));
        expect(stageForCommission("revision")).toBe(stageForCommission("in_progress"));
    });

    it("falls back to talking for a status nobody recognises", () => {
        expect(stageForCommission("banana")).toBe("talking");
        expect(stageForTransaction({ status: "banana" })).toBe("talking");
    });

    // ── Parties ──

    it("names both sides for every kind", () => {
        for (const kind of DEAL_KINDS) {
            expect(roleLabel(kind, "a")).toBeTruthy();
            expect(roleLabel(kind, "b")).toBeTruthy();
            expect(dealNoun(kind)).toBeTruthy();
        }
        expect(roleLabel("sale", "a")).toBe("Seller");
        expect(roleLabel("sale", "b")).toBe("Buyer");
        expect(roleLabel("commission", "a")).toBe("Artist");
        expect(roleLabel("commission", "b")).toBe("Commissioner");
    });

    it("flips parties", () => {
        expect(otherParty("a")).toBe("b");
        expect(otherParty("b")).toBe("a");
    });

    it("says party B pays in a sale and a commission, and refuses to guess for a trade", () => {
        expect(payerParty("sale")).toBe("b");
        expect(payerParty("commission")).toBe("b");
        // A horse-for-horse swap may involve no money at all, or boot
        // going either way. Only the parties' own terms can say.
        expect(payerParty("trade")).toBeNull();
        expect(payeeParty("sale")).toBe("a");
        expect(payeeParty("trade")).toBeNull();
    });

    it("identifies the viewer from the transaction's parties, not from who clicked first", () => {
        const parties = { aId: "seller-1", bId: "buyer-1" };
        expect(partyForUser("seller-1", parties)).toBe("a");
        expect(partyForUser("buyer-1", parties)).toBe("b");
        expect(partyForUser("moderator-1", parties)).toBeNull();
    });

    it("returns null rather than guessing when a party id is missing", () => {
        expect(partyForUser("someone", { aId: null, bId: null })).toBeNull();
        expect(partyForUser("someone", { aId: "someone", bId: null })).toBe("a");
    });

    // ── Whose move ──

    it("waits on the holder when an offer is on the table", () => {
        for (const kind of DEAL_KINDS) {
            expect(waitingOn("proposed", kind)).toBe("a");
        }
    });

    it("waits on the payer once terms are agreed, and on nobody for a trade", () => {
        expect(waitingOn("agreed", "sale")).toBe("b");
        expect(waitingOn("agreed", "commission")).toBe("b");
        expect(waitingOn("agreed", "trade")).toBeNull();
    });

    it("waits on nobody once a deal is over or frozen", () => {
        const done: DealStage[] = ["settled", "closed", "disputed", "talking"];
        for (const stage of done) {
            expect(waitingOn(stage, "sale")).toBeNull();
        }
    });

    // ── Inferring the kind ──

    it("infers the kind from what the thread carries", () => {
        expect(inferKind({ commissionId: "c1" })).toBe("commission");
        expect(inferKind({ horseId: "h1", offeredHorseIds: ["h2"] })).toBe("trade");
        expect(inferKind({ horseId: "h1" })).toBe("sale");
        expect(inferKind({})).toBeNull();
    });

    it("prefers a commission over a horse when a thread carries both", () => {
        expect(inferKind({ commissionId: "c1", horseId: "h1" })).toBe("commission");
    });

    it("does not call an empty trade list a trade", () => {
        expect(inferKind({ horseId: "h1", offeredHorseIds: [] })).toBe("sale");
    });
});
