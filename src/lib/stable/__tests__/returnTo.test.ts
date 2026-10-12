import { describe, it, expect } from "vitest";
import { passportHorseId, returnToCardId } from "@/lib/stable/returnTo";

const A = "123e4567-e89b-42d3-a456-426614174000";
const B = "223e4567-e89b-42d3-a456-426614174111";
const COLLECTION = "323e4567-e89b-42d3-a456-426614174222";

describe("passportHorseId", () => {
    it("reads the horse id from a passport and its edit page", () => {
        expect(passportHorseId(`/stable/${A}`)).toBe(A);
        expect(passportHorseId(`/stable/${A}/edit`)).toBe(A);
        expect(passportHorseId(`/stable/${A}?tab=records#top`)).toBe(A);
        expect(passportHorseId(`/stable/${A.toUpperCase()}`)).toBe(A);
    });

    it("ignores every other stable page and junk", () => {
        expect(passportHorseId(`/stable/collection/${COLLECTION}`)).toBeNull();
        expect(passportHorseId("/stable/collections")).toBeNull();
        expect(passportHorseId("/stable/deleted")).toBeNull();
        expect(passportHorseId(`/stable/${A}/photos`)).toBeNull();
        expect(passportHorseId(`/community/${A}`)).toBeNull();
        expect(passportHorseId("/stable/not-a-uuid")).toBeNull();
        expect(passportHorseId(null)).toBeNull();
        expect(passportHorseId("")).toBeNull();
    });
});

describe("returnToCardId", () => {
    const ids = [B, A];

    it("returns the card the reader just came back from (Back pops the passport off the trail)", () => {
        expect(returnToCardId({ trail: ["/market", "/dashboard?page=3"], from: `/stable/${A}`, ids })).toBe(A);
    });

    it("works from the edit page too", () => {
        expect(returnToCardId({ trail: ["/dashboard?page=3"], from: `/stable/${A}/edit`, ids })).toBe(A);
    });

    it("falls back to the trail's previous entry when the source is unknown (forward navigation)", () => {
        expect(returnToCardId({ trail: [`/stable/${A}`, "/dashboard"], ids })).toBe(A);
        expect(returnToCardId({ trail: [`/stable/${A}`, "/dashboard"], from: null, ids })).toBe(A);
    });

    it("a known source that is not a passport wins over an older passport in the trail", () => {
        expect(returnToCardId({ trail: [`/stable/${A}`, "/dashboard"], from: "/market", ids })).toBeNull();
        expect(returnToCardId({ trail: [`/stable/${A}`, "/dashboard?page=2"], from: "/dashboard?page=1", ids })).toBeNull();
    });

    it("never scrolls to a horse that is not on this page", () => {
        const other = "423e4567-e89b-42d3-a456-426614174333";
        expect(returnToCardId({ trail: [], from: `/stable/${other}`, ids })).toBeNull();
        expect(returnToCardId({ trail: [], from: `/stable/${A}`, ids: [] })).toBeNull();
    });

    it("hands back the page's own spelling of the id", () => {
        expect(returnToCardId({ trail: [], from: `/stable/${A.toUpperCase()}`, ids })).toBe(A);
    });

    it("nothing to go on: null", () => {
        expect(returnToCardId({ trail: [], ids })).toBeNull();
        expect(returnToCardId({ trail: ["/dashboard"], ids })).toBeNull();
    });
});
