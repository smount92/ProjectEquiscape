import { describe, it, expect } from "vitest";

import {
    isQualifierExpired,
    qualifierChip,
    qualifierFromRow,
    qualifierTitle,
    validateQualifier,
} from "@/lib/records/qualifiers";

const NOW = new Date("2026-09-17T12:00:00Z");

describe("validateQualifier", () => {
    it("no program means no card, whatever else was typed", () => {
        expect(validateQualifier({ program: "", card: "blue", year: 2026, cardId: "x" }, NOW)).toEqual({
            ok: true,
            value: null,
        });
        expect(validateQualifier({ program: null, card: null, year: null, cardId: null }, NOW)).toEqual({
            ok: true,
            value: null,
        });
    });

    it("a card colour must belong to its program", () => {
        const wrong = validateQualifier({ program: "omeq", card: "green", year: 2026, cardId: "" }, NOW);
        expect(wrong.ok).toBe(false);
        if (!wrong.ok) expect(wrong.error).toMatch(/OMEQ card colour/);
        const right = validateQualifier({ program: "omeq", card: "blue", year: 2026, cardId: "" }, NOW);
        expect(right).toEqual({ ok: true, value: { program: "omeq", card: "blue", year: 2026, cardId: null } });
    });

    it("years come as strings from forms and must be plausible", () => {
        expect(validateQualifier({ program: "nan", card: "green", year: "2024", cardId: null }, NOW)).toEqual({
            ok: true,
            value: { program: "nan", card: "green", year: 2024, cardId: null },
        });
        expect(validateQualifier({ program: "nan", card: "green", year: 1980, cardId: null }, NOW).ok).toBe(false);
        expect(validateQualifier({ program: "nan", card: "green", year: 2028, cardId: null }, NOW).ok).toBe(false);
        expect(validateQualifier({ program: "nan", card: "green", year: "soon", cardId: null }, NOW).ok).toBe(false);
    });

    it("trims the card ID and caps its length", () => {
        expect(validateQualifier({ program: "omeq", card: "purple", year: 2026, cardId: "  OMEQ-0042 " }, NOW)).toEqual({
            ok: true,
            value: { program: "omeq", card: "purple", year: 2026, cardId: "OMEQ-0042" },
        });
        expect(validateQualifier({ program: "omeq", card: "purple", year: 2026, cardId: "x".repeat(41) }, NOW).ok).toBe(
            false,
        );
    });

    it("rejects a program it doesn't know", () => {
        expect(validateQualifier({ program: "mepsa", card: "blue", year: 2026, cardId: null }, NOW).ok).toBe(false);
    });
});

describe("isQualifierExpired", () => {
    it("NAN cards live three years past the earning year", () => {
        expect(isQualifierExpired("nan", 2023, NOW)).toBe(false);
        expect(isQualifierExpired("nan", 2022, NOW)).toBe(true);
    });

    it("OMEQ cards count for two championships", () => {
        expect(isQualifierExpired("omeq", 2026, NOW)).toBe(false);
        expect(isQualifierExpired("omeq", 2025, NOW)).toBe(false);
        expect(isQualifierExpired("omeq", 2024, NOW)).toBe(true);
    });
});

describe("chip wording", () => {
    it("reads colour glyph, program and year; the title carries the meaning and ID", () => {
        expect(qualifierChip("omeq", "blue", 2026)).toBe("🔵 OMEQ card · 2026");
        expect(qualifierChip("nan", "pink", null)).toBe("🩷 NAN card");
        expect(qualifierChip("nan", "mystery", 2025)).toBe("🎫 NAN card · 2025");
        expect(qualifierTitle("omeq", "orange", "OMEQ-7")).toBe(
            "Orange · collectibility / workmanship · #OMEQ-7 · OMEQ cards count for two championships — the year they're earned and the next.",
        );
    });
});

describe("qualifierFromRow", () => {
    it("prefers the 210 columns", () => {
        expect(
            qualifierFromRow({
                qualifier_program: "omeq",
                qualifier_card: "blue",
                qualifier_year: 2026,
                qualifier_card_id: "OMEQ-1",
                is_nan_qualifying: true,
                nan_card_type: "green",
                nan_year: 2024,
            }),
        ).toEqual({ program: "omeq", card: "blue", year: 2026, cardId: "OMEQ-1" });
    });

    it("falls back to the 030 NAN columns before the paste / backfill", () => {
        expect(qualifierFromRow({ is_nan_qualifying: true, nan_card_type: "yellow", nan_year: 2025 })).toEqual({
            program: "nan",
            card: "yellow",
            year: 2025,
            cardId: null,
        });
        expect(qualifierFromRow({ is_nan_qualifying: false })).toEqual({
            program: null,
            card: null,
            year: null,
            cardId: null,
        });
    });
});
