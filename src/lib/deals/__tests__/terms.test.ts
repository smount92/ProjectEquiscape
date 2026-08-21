import { describe, it, expect } from "vitest";

import {
    TERM_BOX_TYPES,
    agreedPrice,
    applyAgreement,
    applyEdit,
    awaitingAgreementFrom,
    blankBox,
    boxLines,
    boxTitle,
    coerceBox,
    coerceTerms,
    emptyTerms,
    formatDate,
    formatMoney,
    formatStamp,
    isBoxEmpty,
    isFullyAgreed,
    isoDateOrNull,
    paymentPlanBox,
    withdrawAgreement,
    type DealTerms,
    type PriceBox,
    type RulesBox,
    type TermBox,
} from "../terms";

const priceBox = (amount: number | null, id = "p1"): PriceBox => ({
    id,
    type: "price",
    amount,
    currency: "USD",
    method: null,
});

const rulesBox = (text: string, id = "r1"): RulesBox => ({ id, type: "rules", text });

const termsWith = (boxes: TermBox[], patch: Partial<DealTerms> = {}): DealTerms => ({
    ...emptyTerms(),
    boxes,
    ...patch,
});

describe("contract boxes", () => {
    // ── Coercion ──

    it("reads null, junk and a missing column as empty terms rather than throwing", () => {
        for (const input of [null, undefined, 42, "nope", [], true]) {
            const terms = coerceTerms(input);
            expect(terms.boxes).toEqual([]);
            expect(terms.revision).toBe(0);
            expect(isFullyAgreed(terms)).toBe(false);
        }
    });

    it("has a blank shape for every declared box type, and every blank is empty", () => {
        for (const type of TERM_BOX_TYPES) {
            const box = blankBox(type);
            expect(box.type).toBe(type);
            expect(isBoxEmpty(box)).toBe(true);
            expect(boxTitle(box)).toBeTruthy();
        }
    });

    it("never pre-fills a blank box — the platform does not author terms", () => {
        const price = blankBox("price") as PriceBox;
        expect(price.amount).toBeNull();
        expect(price.method).toBeNull();
        const plan = blankBox("payment_plan");
        expect(JSON.stringify(plan)).not.toMatch(/50|default|recommend/i);
    });

    it("round-trips a box through the coercer", () => {
        const box = coerceBox({ id: "x", type: "price", amount: 275.5, method: "PayPal G&S" });
        expect(box).toEqual({
            id: "x",
            label: null,
            type: "price",
            amount: 275.5,
            currency: "USD",
            method: "PayPal G&S",
        });
    });

    it("drops a box type it does not recognise instead of guessing at it", () => {
        expect(coerceBox({ id: "x", type: "escrow", amount: 1 })).toBeNull();
        expect(coerceBox({ id: "x" })).toBeNull();
        expect(coerceBox(null)).toBeNull();
        const terms = coerceTerms({ boxes: [{ type: "from_the_future" }, priceBox(10)] });
        expect(terms.boxes).toHaveLength(1);
        expect(terms.boxes[0].type).toBe("price");
    });

    it("accepts snake_case keys, so a raw database row reads the same as a form payload", () => {
        const box = coerceBox({
            id: "s1",
            type: "shipping",
            paid_by: "a",
            expected_ship_date: "2026-09-01",
        });
        expect(box).toMatchObject({ paidBy: "a", expectedShipDate: "2026-09-01" });
    });

    it("rejects a negative price and a nonsense date rather than storing them", () => {
        expect(coerceBox({ id: "x", type: "price", amount: -5 })).toMatchObject({ amount: null });
        expect(coerceBox({ id: "x", type: "deadline", date: "not-a-date" })).toMatchObject({
            date: null,
        });
    });

    it("de-duplicates box ids, because a confirmation names the box it agreed to", () => {
        const terms = coerceTerms({
            boxes: [priceBox(10, "same"), rulesBox("hello", "same")],
        });
        expect(terms.boxes).toHaveLength(2);
        expect(terms.boxes[0].id).not.toBe(terms.boxes[1].id);
    });

    it("caps the number of boxes", () => {
        const many = Array.from({ length: 200 }, (_, i) => rulesBox("x", `r${i}`));
        expect(coerceTerms({ boxes: many }).boxes.length).toBeLessThanOrEqual(40);
    });

    // ── Agreement ──

    it("clears BOTH confirmations on any edit", () => {
        const agreed = termsWith([priceBox(300)], {
            agreedByAAt: "2026-08-01T00:00:00.000Z",
            agreedByBAt: null,
            revision: 3,
        });
        const result = applyEdit(agreed, [priceBox(250)], "a");
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.terms.agreedByAAt).toBeNull();
        expect(result.terms.agreedByBAt).toBeNull();
        expect(result.terms.revision).toBe(4);
        expect(result.terms.updatedBy).toBe("a");
    });

    it("refuses to edit terms both sides have agreed to", () => {
        const settled = termsWith([priceBox(300)], {
            agreedByAAt: "2026-08-01T00:00:00.000Z",
            agreedByBAt: "2026-08-02T00:00:00.000Z",
        });
        const result = applyEdit(settled, [priceBox(1)], "b");
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toMatch(/agreed by both sides/i);
    });

    it("launders an edit through the coercer, so an edit cannot smuggle a shape past a read", () => {
        const result = applyEdit(
            emptyTerms(),
            [{ id: "bad", type: "escrow" } as unknown as TermBox, priceBox(10)],
            "a",
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.terms.boxes).toHaveLength(1);
    });

    it("records one side's agreement and reports who is still to sign", () => {
        const terms = termsWith([priceBox(300)]);
        const first = applyAgreement(terms, "a");
        expect(first.ok).toBe(true);
        if (!first.ok) return;
        expect(first.terms.agreedByAAt).toBeTruthy();
        expect(isFullyAgreed(first.terms)).toBe(false);
        expect(awaitingAgreementFrom(first.terms)).toBe("b");

        const second = applyAgreement(first.terms, "b");
        expect(second.ok).toBe(true);
        if (!second.ok) return;
        expect(isFullyAgreed(second.terms)).toBe(true);
        expect(awaitingAgreementFrom(second.terms)).toBeNull();
    });

    it("is idempotent — agreeing twice does not move your timestamp", () => {
        const once = applyAgreement(termsWith([priceBox(300)]), "a");
        expect(once.ok).toBe(true);
        if (!once.ok) return;
        const twice = applyAgreement(once.terms, "a");
        expect(twice.ok).toBe(true);
        if (!twice.ok) return;
        expect(twice.terms.agreedByAAt).toBe(once.terms.agreedByAAt);
    });

    it("refuses to agree to nothing", () => {
        const empty = applyAgreement(emptyTerms(), "a");
        expect(empty.ok).toBe(false);

        const blanks = applyAgreement(termsWith([blankBox("price"), blankBox("shipping")]), "a");
        expect(blanks.ok).toBe(false);
        if (blanks.ok) return;
        expect(blanks.reason).toMatch(/fill in at least one box/i);
    });

    it("lets you withdraw while the other side is deciding, and never after they have signed", () => {
        const mine = applyAgreement(termsWith([priceBox(300)]), "a");
        expect(mine.ok).toBe(true);
        if (!mine.ok) return;
        const pulled = withdrawAgreement(mine.terms, "a");
        expect(pulled.ok).toBe(true);
        if (!pulled.ok) return;
        expect(pulled.terms.agreedByAAt).toBeNull();

        const settled = termsWith([priceBox(300)], {
            agreedByAAt: "2026-08-01T00:00:00.000Z",
            agreedByBAt: "2026-08-02T00:00:00.000Z",
        });
        expect(withdrawAgreement(settled, "a").ok).toBe(false);
    });

    // ── Reading the record ──

    it("finds the agreed price, ignoring an empty or zero price box", () => {
        expect(agreedPrice(termsWith([priceBox(275)]))).toBe(275);
        expect(agreedPrice(termsWith([priceBox(null)]))).toBeNull();
        expect(agreedPrice(termsWith([priceBox(0)]))).toBeNull();
        expect(agreedPrice(emptyTerms())).toBeNull();
    });

    it("finds the payment plan box when there is one", () => {
        expect(paymentPlanBox(emptyTerms())).toBeNull();
        const withPlan = termsWith([
            priceBox(300),
            { id: "pp", type: "payment_plan", installmentCount: 6, missedPaymentTerms: "we talk" },
        ]);
        expect(paymentPlanBox(withPlan)?.installmentCount).toBe(6);
    });

    it("prefers the parties' own box label over the type's name", () => {
        expect(boxTitle(priceBox(1))).toBe("Agreed price");
        expect(boxTitle({ ...priceBox(1), label: "What Amanda pays" })).toBe("What Amanda pays");
        expect(boxTitle({ ...priceBox(1), label: "   " })).toBe("Agreed price");
    });

    it("renders each box as label/value lines using the deal's own role names", () => {
        const lines = boxLines(
            {
                id: "s",
                type: "shipping",
                method: "USPS Priority",
                cost: 15,
                paidBy: "b",
                insured: true,
                expectedShipDate: "2026-09-01",
            },
            { a: "Seller", b: "Buyer" },
        );
        expect(lines).toContainEqual({ label: "Method", value: "USPS Priority" });
        expect(lines).toContainEqual({ label: "Cost", value: "$15" });
        expect(lines).toContainEqual({ label: "Paid by", value: "Buyer" });
        expect(lines).toContainEqual({ label: "Insured", value: "Yes" });
    });

    it("reproduces a rules box verbatim — the parties' own words are the point", () => {
        const words = "No refunds after the horse ships.\nI'll cover insurance.";
        expect(boxLines(rulesBox(words))).toEqual([{ label: "", value: words }]);
    });

    // ── Formatting ──

    it("shows whole dollars without cents, and cents when there are any", () => {
        expect(formatMoney(60)).toBe("$60");
        expect(formatMoney(60.5)).toBe("$60.50");
        expect(formatMoney(1234.56)).toBe("$1,234.56");
        expect(formatMoney(null)).toBe("—");
        expect(formatMoney(Number.NaN)).toBe("—");
    });

    it("renders dates in UTC so both parties read the same day", () => {
        expect(formatDate("2026-09-01")).toBe("Sep 1, 2026");
        expect(formatDate(null)).toBe("—");
        expect(formatDate("rubbish")).toBe("—");
        expect(formatStamp("2026-09-01T13:05:00Z")).toMatch(/Sep 1, 2026 at .*UTC/);
    });

    it("accepts only a real yyyy-mm-dd date", () => {
        expect(isoDateOrNull("2026-09-01")).toBe("2026-09-01");
        expect(isoDateOrNull("2026-09-01T12:00:00Z")).toBe("2026-09-01");
        expect(isoDateOrNull("2026-13-45")).toBeNull();
        expect(isoDateOrNull("")).toBeNull();
        expect(isoDateOrNull(null)).toBeNull();
    });
});
