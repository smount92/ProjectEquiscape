import { describe, it, expect } from "vitest";
import {
    CARD_CODE_ALPHABET,
    CARD_CODE_LENGTH,
    canApplyCardAction,
    cardStatusAfter,
    generateCardCode,
    isValidCardCode,
    shouldIssueCard,
} from "@/lib/shows/cards";
import type { CardStatus } from "@/lib/shows/types";

describe("cards — issuance rules", () => {
    const base = {
        classIsQualifying: true,
        showIsMhhQualifying: true,
    };

    it("1st and 2nd in a qualifying class at a qualifying show earn cards", () => {
        expect(shouldIssueCard({ ...base, place: 1 })).toBe(true);
        expect(shouldIssueCard({ ...base, place: 2 })).toBe(true);
    });

    it("3rd through 6th and participation do not", () => {
        expect(shouldIssueCard({ ...base, place: 3 })).toBe(false);
        expect(shouldIssueCard({ ...base, place: 4 })).toBe(false);
        expect(shouldIssueCard({ ...base, place: 5 })).toBe(false);
        expect(shouldIssueCard({ ...base, place: 6 })).toBe(false);
        expect(shouldIssueCard({ ...base, place: null })).toBe(false);
    });

    it("non-qualifying class never issues", () => {
        expect(shouldIssueCard({ ...base, classIsQualifying: false, place: 1 })).toBe(false);
    });

    it("show opted out of MHH qualification never issues", () => {
        expect(shouldIssueCard({ ...base, showIsMhhQualifying: false, place: 1 })).toBe(false);
    });

    it("scratched entries never issue even if a placing row exists", () => {
        expect(shouldIssueCard({ ...base, place: 1, entryStatus: "scratched" })).toBe(false);
        expect(shouldIssueCard({ ...base, place: 1, entryStatus: "placed" })).toBe(true);
    });
});

describe("cards — short codes", () => {
    it("generates 8-char codes from the unambiguous alphabet", () => {
        for (let i = 0; i < 50; i++) {
            const code = generateCardCode();
            expect(code).toHaveLength(CARD_CODE_LENGTH);
            expect(isValidCardCode(code)).toBe(true);
            for (const ch of code) {
                expect(CARD_CODE_ALPHABET).toContain(ch);
            }
        }
    });

    it("alphabet excludes ambiguous characters (0, O, 1, I, l)", () => {
        for (const bad of ["0", "O", "1", "I", "l"]) {
            expect(CARD_CODE_ALPHABET).not.toContain(bad);
        }
    });

    it("is deterministic under an injected RNG", () => {
        const zeros = generateCardCode(() => 0);
        expect(zeros).toBe(CARD_CODE_ALPHABET[0].repeat(8));
        const highest = generateCardCode(() => 0.999999999);
        expect(highest).toBe(CARD_CODE_ALPHABET[CARD_CODE_ALPHABET.length - 1].repeat(8));
    });

    it("validates the same pattern the DB CHECK enforces", () => {
        expect(isValidCardCode("ABCD2345")).toBe(true);
        expect(isValidCardCode("ABC")).toBe(false); // too short
        expect(isValidCardCode("ABCD23456")).toBe(false); // too long
        expect(isValidCardCode("ABCD234O")).toBe(false); // ambiguous O
        expect(isValidCardCode("ABCD2340")).toBe(false); // ambiguous 0
        expect(isValidCardCode("ABCD234!")).toBe(false); // symbol
        expect(isValidCardCode("")).toBe(false);
    });
});

describe("cards — status transitions", () => {
    it("issued can transfer, redeem, or void", () => {
        expect(canApplyCardAction("issued", "transfer")).toEqual({ ok: true });
        expect(canApplyCardAction("issued", "redeem")).toEqual({ ok: true });
        expect(canApplyCardAction("issued", "void")).toEqual({ ok: true });
    });

    it("transferred cards keep travelling with the horse (re-transfer legal)", () => {
        expect(canApplyCardAction("transferred", "transfer")).toEqual({ ok: true });
        expect(canApplyCardAction("transferred", "redeem")).toEqual({ ok: true });
        expect(canApplyCardAction("transferred", "void")).toEqual({ ok: true });
    });

    it("redeemed is terminal", () => {
        for (const action of ["transfer", "redeem", "void"] as const) {
            const r = canApplyCardAction("redeemed", action);
            expect(r.ok).toBe(false);
            if (!r.ok) expect(r.reason).toMatch(/already been redeemed/i);
        }
    });

    it("void is terminal", () => {
        for (const action of ["transfer", "redeem", "void"] as const) {
            const r = canApplyCardAction("void", action);
            expect(r.ok).toBe(false);
            if (!r.ok) expect(r.reason).toMatch(/voided/i);
        }
    });

    it("cardStatusAfter maps actions to resulting statuses", () => {
        expect(cardStatusAfter("transfer")).toBe<CardStatus>("transferred");
        expect(cardStatusAfter("redeem")).toBe<CardStatus>("redeemed");
        expect(cardStatusAfter("void")).toBe<CardStatus>("void");
    });
});
