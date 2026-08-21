import { describe, it, expect } from "vitest";

import {
    EVIDENCE_DISCLAIMER,
    buildEvidencePack,
    evidencePackToText,
    type EvidenceInput,
} from "../evidence";
import { emptyTerms, type DealTerms } from "../terms";
import type { Installment } from "../ledger";

const AGREED: DealTerms = {
    boxes: [
        { id: "p", type: "price", amount: 400, currency: "USD", method: "PayPal Goods & Services" },
        { id: "pp", type: "payment_plan", installmentCount: 4, missedPaymentTerms: "We talk first." },
        {
            id: "s",
            type: "shipping",
            method: "USPS Priority",
            cost: 25,
            paidBy: "b",
            insured: true,
            expectedShipDate: "2026-12-01",
        },
        { id: "r", type: "rules", text: "No refunds once it ships." },
    ],
    agreedByAAt: "2026-08-01T10:00:00Z",
    agreedByBAt: "2026-08-01T11:30:00Z",
    revision: 2,
    updatedAt: "2026-08-01T09:00:00Z",
    updatedBy: "a",
};

const LEDGER: Installment[] = [
    {
        id: "i1",
        seq: 1,
        amount: 100,
        dueDate: "2026-08-15",
        markedSentAt: "2026-08-14T09:00:00Z",
        confirmedAt: "2026-08-15T09:00:00Z",
        note: null,
    },
    {
        id: "i2",
        seq: 2,
        amount: 100,
        dueDate: "2026-09-15",
        markedSentAt: "2026-09-16T09:00:00Z",
        confirmedAt: null,
        note: null,
    },
    { id: "i3", seq: 3, amount: 100, dueDate: "2026-10-15", markedSentAt: null, confirmedAt: null, note: null },
    { id: "i4", seq: 4, amount: 100, dueDate: "2026-11-15", markedSentAt: null, confirmedAt: null, note: null },
];

const input = (patch: Partial<EvidenceInput> = {}): EvidenceInput => ({
    conversationId: "conv-1",
    kind: "sale",
    stage: "paying",
    partyA: {
        userId: "seller-1",
        alias: "amanda",
        memberSince: "2024-03-01T00:00:00Z",
        completedTransfers: 12,
    },
    partyB: {
        userId: "buyer-1",
        alias: "sam",
        memberSince: "2025-06-01T00:00:00Z",
        completedTransfers: 3,
    },
    subject: { title: "Salinero", reference: "Breyer — Salinero", horseId: "horse-1" },
    terms: AGREED,
    installments: LEDGER,
    messages: [
        {
            id: "m1",
            senderId: "buyer-1",
            kind: "chat",
            payload: {},
            content: "Is he still available?",
            createdAt: "2026-07-30T12:00:00Z",
        },
        {
            id: "m2",
            senderId: "buyer-1",
            kind: "offer",
            payload: { amount: 400 },
            content: "@sam offered $400",
            createdAt: "2026-07-30T12:05:00Z",
        },
        {
            id: "m3",
            senderId: "seller-1",
            kind: "chat",
            payload: {},
            content: "Here he is",
            createdAt: "2026-07-30T12:10:00Z",
            attachmentCount: 3,
        },
    ],
    transaction: {
        id: "txn-1",
        status: "pending_payment",
        offerAmount: 400,
        createdAt: "2026-07-30T12:05:00Z",
        acceptedAt: "2026-07-31T08:00:00Z",
        paidAt: "2026-08-14T09:00:00Z",
        verifiedAt: null,
        completedAt: null,
    },
    generatedAt: "2026-09-20T12:00:00Z",
    generatedForAlias: "sam",
    ...patch,
});

const section = (pack: ReturnType<typeof buildEvidencePack>, id: string) =>
    pack.sections.find((s) => s.id === id);

describe("evidence pack", () => {
    it("leads with the disclaimer, which is load-bearing rather than boilerplate", () => {
        const pack = buildEvidencePack(input());
        expect(pack.disclaimer).toBe(EVIDENCE_DISCLAIMER);
        expect(pack.disclaimer).toMatch(/not a payment processor/i);
        expect(pack.disclaimer).toMatch(/not an arbitrator/i);
        expect(pack.disclaimer).toMatch(/never hold funds/i);
    });

    it("reaches no conclusion about who is right", () => {
        const text = evidencePackToText(buildEvidencePack(input()));
        expect(text).not.toMatch(/\b(fault|liable|guilty|scam|fraud|we believe|we find)\b/i);
    });

    it("names both parties with their platform history", () => {
        const parties = section(buildEvidencePack(input()), "parties");
        expect(parties?.rows?.[0]).toMatchObject({ label: "Seller" });
        expect(parties?.rows?.[0].value).toMatch(/@amanda/);
        expect(parties?.rows?.[0].value).toMatch(/12 completed transfers/);
        expect(parties?.rows?.[1]).toMatchObject({ label: "Buyer" });
        expect(parties?.rows?.[1].value).toMatch(/3 completed transfers/);
    });

    it("uses the right role words for a commission", () => {
        const pack = buildEvidencePack(input({ kind: "commission" }));
        expect(section(pack, "parties")?.rows?.map((r) => r.label)).toEqual([
            "Artist",
            "Commissioner",
            "Record id",
        ]);
        expect(pack.subtitle).toMatch(/Commission between/);
    });

    it("reproduces the agreed terms box by box, with both confirmations", () => {
        const terms = section(buildEvidencePack(input()), "terms");
        const flat = terms!.rows!.map((r) => `${r.label}|${r.value}`).join("\n");
        expect(flat).toMatch(/Agreed price/);
        expect(flat).toMatch(/\$400/);
        expect(flat).toMatch(/PayPal Goods & Services/);
        expect(flat).toMatch(/No refunds once it ships\./);
        expect(flat).toMatch(/We talk first\./);
        expect(flat).toMatch(/Confirmed by Seller\|Aug 1, 2026/);
        expect(flat).toMatch(/Confirmed by Buyer\|Aug 1, 2026/);
        expect(terms!.note).toMatch(/Both parties confirmed/);
        expect(terms!.note).toMatch(/revision 2/);
    });

    it("says plainly when terms were written but never both-confirmed", () => {
        const halfSigned = { ...AGREED, agreedByBAt: null };
        const terms = section(buildEvidencePack(input({ terms: halfSigned })), "terms");
        expect(terms!.note).toMatch(/NOT confirmed by both parties/);
        expect(terms!.rows).toContainEqual({ label: "Confirmed by Buyer", value: "Not confirmed" });
    });

    it("omits the terms section entirely when nothing was written down", () => {
        const pack = buildEvidencePack(input({ terms: emptyTerms() }));
        expect(section(pack, "terms")).toBeUndefined();
    });

    it("tables the ledger with both dated statements per row", () => {
        const ledger = section(buildEvidencePack(input()), "ledger");
        expect(ledger!.table!.headers).toEqual([
            "#",
            "Amount",
            "Due",
            "Marked sent",
            "Confirmed received",
            "State",
        ]);
        expect(ledger!.table!.rows).toHaveLength(4);
        expect(ledger!.table!.rows[0][5]).toBe("Received");
        expect(ledger!.table!.rows[1][5]).toBe("Marked sent");
        expect(ledger!.table!.rows[3][3]).toBe("—");
        expect(ledger!.note).toMatch(/did not handle any of this money/i);
    });

    it("totals what is confirmed, what is only claimed, and what is outstanding", () => {
        const ledger = section(buildEvidencePack(input()), "ledger");
        expect(ledger!.rows).toContainEqual({ label: "Plan total", value: "$400" });
        expect(ledger!.rows).toContainEqual({ label: "Confirmed received", value: "$100" });
        expect(ledger!.rows).toContainEqual({
            label: "Marked sent, unconfirmed",
            value: "$100",
        });
        expect(ledger!.rows).toContainEqual({
            label: "Outstanding on this record",
            value: "$300",
        });
    });

    it("drops the ledger section when there was no payment plan", () => {
        expect(section(buildEvidencePack(input({ installments: [] })), "ledger")).toBeUndefined();
    });

    it("lists the platform's own timestamps and says they are not party-editable", () => {
        const steps = section(buildEvidencePack(input()), "safe-trade");
        expect(steps!.note).toMatch(/not editable by either party/i);
        const flat = steps!.rows!.map((r) => r.label).join("|");
        expect(flat).toMatch(/Offer made/);
        expect(flat).toMatch(/Offer accepted/);
        expect(flat).toMatch(/Buyer declared payment sent/);
        // Nothing invented: verification never happened, so it is absent.
        expect(flat).not.toMatch(/confirmed funds received/i);
    });

    it("separates the machine-written event log from the human conversation", () => {
        const pack = buildEvidencePack(input());
        const events = section(pack, "events")!;
        const transcript = section(pack, "transcript")!;
        expect(events.lines).toHaveLength(1);
        expect(events.lines![0]).toMatch(/@sam offered \$400/);
        expect(transcript.lines).toHaveLength(2);
        expect(transcript.lines![0]).toMatch(/@sam: Is he still available\?/);
    });

    it("notes attached photos without pretending to print them", () => {
        const transcript = section(buildEvidencePack(input()), "transcript")!;
        expect(transcript.lines![1]).toMatch(/\[3 photos attached\]/);
    });

    it("attributes a server-written entry to the platform, not to a person", () => {
        const pack = buildEvidencePack(
            input({
                messages: [
                    {
                        id: "m9",
                        senderId: null,
                        kind: "system",
                        payload: {},
                        content: "The offer expired after 7 days",
                        createdAt: "2026-08-06T00:00:00Z",
                    },
                ],
            }),
        );
        expect(section(pack, "events")!.lines![0]).toMatch(/The offer expired/);
    });

    it("says so when a thread has no messages, rather than showing an empty section", () => {
        const transcript = section(buildEvidencePack(input({ messages: [] })), "transcript")!;
        expect(transcript.note).toMatch(/No messages were exchanged/);
        expect(transcript.lines).toEqual([]);
    });

    it("names who prepared the pack, so a record is attributable", () => {
        const pack = buildEvidencePack(input());
        expect(pack.title).toBe("Deal record — Salinero");
        expect(pack.subtitle).toMatch(/prepared for @sam/);
        expect(pack.subtitle).toMatch(/Sep 20, 2026/);
    });

    it("flattens to plain text for a dispute form that takes nothing else", () => {
        const text = evidencePackToText(buildEvidencePack(input()));
        expect(text.startsWith("Deal record — Salinero")).toBe(true);
        expect(text).toMatch(/== THE PARTIES ==/);
        expect(text).toMatch(/== PAYMENT LEDGER ==/);
        expect(text).toMatch(/# \| Amount \| Due \| Marked sent \| Confirmed received \| State/);
        expect(text).toMatch(/== THE CONVERSATION ==/);
        expect(text.length).toBeGreaterThan(500);
    });

    it("builds a pack for a thread with nothing in it at all without throwing", () => {
        const bare = buildEvidencePack(
            input({
                subject: null,
                terms: emptyTerms(),
                installments: [],
                messages: [],
                transaction: null,
                stage: "talking",
            }),
        );
        expect(bare.title).toBe("Deal record");
        expect(bare.sections.map((s) => s.id)).toEqual(["parties", "transcript"]);
    });
});
