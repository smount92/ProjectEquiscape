/**
 * Purchase notes ship before migration 241 is pasted. Until then a save
 * must keep every other vault field, and say so only when it cost the
 * member a note they actually typed.
 */
import { describe, expect, it, vi } from "vitest";

import {
    PURCHASE_NOTES_MAX,
    hasPurchaseNote,
    isMissingPurchaseNotes,
    selectWithPurchaseNotes,
    withoutPurchaseNotes,
    writeVaultRow,
} from "@/lib/vault/purchaseNotes";

const MISSING_PG = { code: "42703", message: 'column "purchase_notes" of relation "financial_vault" does not exist' };
const MISSING_REST = {
    code: "PGRST204",
    message: "Could not find the 'purchase_notes' column of 'financial_vault' in the schema cache",
};

describe("isMissingPurchaseNotes", () => {
    it("recognises both ways the database says the column isn't there", () => {
        expect(isMissingPurchaseNotes(MISSING_PG)).toBe(true);
        expect(isMissingPurchaseNotes(MISSING_REST)).toBe(true);
    });

    it("ignores other errors, other columns, and no error", () => {
        expect(isMissingPurchaseNotes(null)).toBe(false);
        expect(isMissingPurchaseNotes({ code: "42703", message: 'column "purchase_group_id" does not exist' })).toBe(
            false,
        );
        expect(isMissingPurchaseNotes({ code: "23514", message: "purchase_notes too long" })).toBe(false);
    });
});

describe("hasPurchaseNote / withoutPurchaseNotes", () => {
    it("treats blank text as no note", () => {
        expect(hasPurchaseNote("Bought at BreyerFest")).toBe(true);
        expect(hasPurchaseNote("   ")).toBe(false);
        expect(hasPurchaseNote(null)).toBe(false);
        expect(hasPurchaseNote(undefined)).toBe(false);
    });

    it("drops only the notes column", () => {
        const row = { horse_id: "h1", purchase_price: 40, purchase_notes: "eBay" };
        expect(withoutPurchaseNotes(row)).toEqual({ horse_id: "h1", purchase_price: 40 });
        expect(row.purchase_notes).toBe("eBay");
    });

    it("matches the 2,000-character cap in migration 241", () => {
        expect(PURCHASE_NOTES_MAX).toBe(2000);
    });
});

describe("writeVaultRow", () => {
    it("writes once when the column exists (after 241)", async () => {
        const write = vi.fn().mockResolvedValue({ error: null });
        const row = { horse_id: "h1", purchase_price: 40, purchase_notes: "From the artist" };
        const out = await writeVaultRow(write, row);
        expect(write).toHaveBeenCalledTimes(1);
        expect(write).toHaveBeenCalledWith(row);
        expect(out).toEqual({ error: null, notesDropped: false });
    });

    it("before 241: saves the rest of the vault and reports the lost note", async () => {
        const write = vi.fn().mockResolvedValueOnce({ error: MISSING_REST }).mockResolvedValueOnce({ error: null });
        const out = await writeVaultRow(write, { horse_id: "h1", purchase_price: 40, purchase_notes: "eBay listing" });
        expect(write).toHaveBeenCalledTimes(2);
        expect(write.mock.calls[1][0]).toEqual({ horse_id: "h1", purchase_price: 40 });
        expect(out).toEqual({ error: null, notesDropped: true });
    });

    it("before 241: an empty note is not news", async () => {
        const write = vi.fn().mockResolvedValueOnce({ error: MISSING_PG }).mockResolvedValueOnce({ error: null });
        const out = await writeVaultRow(write, { horse_id: "h1", purchase_price: 40, purchase_notes: null });
        expect(write).toHaveBeenCalledTimes(2);
        expect(out.notesDropped).toBe(false);
    });

    it("passes any other error through without retrying", async () => {
        const other = { code: "23505", message: "duplicate key" };
        const write = vi.fn().mockResolvedValue({ error: other });
        const out = await writeVaultRow(write, { horse_id: "h1", purchase_notes: "x" });
        expect(write).toHaveBeenCalledTimes(1);
        expect(out).toEqual({ error: other, notesDropped: false });
    });

    it("does not claim a lost note when the retry itself fails", async () => {
        const other = { code: "42501", message: "permission denied" };
        const write = vi.fn().mockResolvedValueOnce({ error: MISSING_PG }).mockResolvedValueOnce({ error: other });
        const out = await writeVaultRow(write, { horse_id: "h1", purchase_notes: "x" });
        expect(out).toEqual({ error: other, notesDropped: false });
    });
});

describe("selectWithPurchaseNotes", () => {
    it("asks for purchase_notes alongside the base columns", async () => {
        const build = vi.fn().mockResolvedValue({ data: { purchase_notes: "x" }, error: null });
        const out = await selectWithPurchaseNotes(build, "purchase_price, insurance_notes");
        expect(build).toHaveBeenCalledWith("purchase_price, insurance_notes, purchase_notes");
        expect(out.data).toEqual({ purchase_notes: "x" });
    });

    it("before 241: reads the rest of the vault without it", async () => {
        const build = vi
            .fn()
            .mockResolvedValueOnce({ data: null, error: MISSING_PG })
            .mockResolvedValueOnce({ data: { purchase_price: 40 }, error: null });
        const out = await selectWithPurchaseNotes(build, "purchase_price");
        expect(build).toHaveBeenLastCalledWith("purchase_price");
        expect(out).toEqual({ data: { purchase_price: 40 }, error: null });
    });
});
