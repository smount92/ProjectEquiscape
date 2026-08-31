import { describe, it, expect } from "vitest";

import {
    STAGE_LABELS,
    STAGE_ORDER,
    WORK_STAGES,
    creditLabel,
    isValidMakingPath,
    makingImagePrefix,
} from "@/lib/studio/making";

describe("the making vocabulary", () => {
    it("every stage has a label and an order", () => {
        for (const s of WORK_STAGES) {
            expect(STAGE_LABELS[s]).toBeTruthy();
            expect(STAGE_ORDER[s]).toBeGreaterThanOrEqual(0);
        }
    });

    it("stages order the way work actually happens", () => {
        expect(STAGE_ORDER.blank).toBeLessThan(STAGE_ORDER.prep);
        expect(STAGE_ORDER.prep).toBeLessThan(STAGE_ORDER.base);
        expect(STAGE_ORDER.detail).toBeLessThan(STAGE_ORDER.finished);
        // catch-all floats last so real stages tell the story first
        expect(STAGE_ORDER.progress).toBeGreaterThan(STAGE_ORDER.finished);
    });
});

describe("isValidMakingPath — the D5 lesson", () => {
    const horse = "abc-123";
    it("accepts exactly our prefix", () => {
        expect(isValidMakingPath(`${makingImagePrefix(horse)}17_base_0.webp`, horse)).toBe(true);
    });
    it("rejects other horses, traversal, and absolute URLs", () => {
        expect(isValidMakingPath("horses/other/making_1.webp", horse)).toBe(false);
        expect(isValidMakingPath(`horses/${horse}/making_../../avatars/x.webp`, horse)).toBe(false);
        expect(isValidMakingPath(`https://evil.example/horses/${horse}/making_1.webp`, horse)).toBe(false);
        expect(isValidMakingPath(`horses/${horse}/extra_detail_1.webp`, horse)).toBe(false);
    });
});

describe("creditLabel — a claim is labeled a claim", () => {
    it("owner confirmation verifies any record", () => {
        expect(
            creditLabel({ recordedBy: "artist", ownerConfirmedAt: "2026-09-01", artistIsOwner: false }),
        ).toEqual({ label: "Confirmed by owner", verified: true });
    });
    it("commission-born records are born verified", () => {
        expect(
            creditLabel({ recordedBy: "commission", ownerConfirmedAt: null, artistIsOwner: false }).verified,
        ).toBe(true);
    });
    it("the artist's own horse needs no counter-signature", () => {
        expect(
            creditLabel({ recordedBy: "artist", ownerConfirmedAt: null, artistIsOwner: true }).verified,
        ).toBe(true);
    });
    it("an unconfirmed artist claim on someone else's horse stays a claim", () => {
        const c = creditLabel({ recordedBy: "artist", ownerConfirmedAt: null, artistIsOwner: false });
        expect(c.verified).toBe(false);
        expect(c.label).toMatch(/awaiting owner/i);
    });
    it("an owner naming an artist is unverified until the artist confirms", () => {
        expect(
            creditLabel({ recordedBy: "owner", ownerConfirmedAt: null, artistIsOwner: false }).verified,
        ).toBe(false);
    });
});
