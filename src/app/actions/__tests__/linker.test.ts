/**
 * The linker's two writes, as a member uses them (MHH-077): a year typed as
 * a range files both years, and "Add my release" no longer drops the end.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const suggestions = vi.hoisted(() => ({ createSuggestion: vi.fn() }));
vi.mock("@/app/actions/catalog-suggestions", () => suggestions);

const db = vi.hoisted(() => ({ row: null as Record<string, unknown> | null }));
vi.mock("@/lib/supabase/server", () => {
    const chain: Record<string, unknown> = {};
    for (const k of ["select", "eq", "neq", "ilike", "in", "or", "limit", "order"]) chain[k] = () => chain;
    chain.maybeSingle = async () => ({ data: db.row, error: null });
    return { createClient: async () => ({ from: () => chain, rpc: async () => ({ data: [], error: null }) }) };
});

import { fileReleaseFact, fileReleaseUnderMold } from "@/app/actions/linker";

beforeEach(() => {
    vi.clearAllMocks();
    suggestions.createSuggestion.mockResolvedValue({ success: true, id: "s1" });
});

describe("fileReleaseFact: the year", () => {
    it("files a range as the first and the last year, with what the Registry holds as `from`", async () => {
        db.row = { attributes: { release_year_start: 1994 } };
        const r = await fileReleaseFact({ catalogId: "c1", fact: "year", value: "1995–97" });
        expect(r).toEqual({ success: true, autoApproved: false });
        expect(suggestions.createSuggestion).toHaveBeenCalledWith(
            expect.objectContaining({
                catalogItemId: "c1",
                suggestionType: "correction",
                fieldChanges: {
                    release_year_start: { from: "1994", to: "1995" },
                    release_year_end: { from: "", to: "1997" },
                },
            }),
        );
    });

    it("refuses an end before the start, in words, and files nothing", async () => {
        const r = await fileReleaseFact({ catalogId: "c1", fact: "year", value: "1997-1995" });
        expect(r).toMatchObject({ success: false, error: expect.stringMatching(/before/) });
        expect(suggestions.createSuggestion).not.toHaveBeenCalled();
    });

    it("still files a colour and a model number as one field", async () => {
        db.row = { attributes: { model_number: null } };
        await fileReleaseFact({ catalogId: "c1", fact: "model number", value: "#5002" });
        expect(suggestions.createSuggestion).toHaveBeenCalledWith(
            expect.objectContaining({ fieldChanges: { model_number: { from: "", to: "5002" } } }),
        );
    });
});

describe("fileReleaseUnderMold: the years", () => {
    const mold = {
        id: "sb",
        item_type: "plastic_mold",
        parent_id: null,
        title: "Saddlebred",
        maker: "Breyer",
        scale: "Stablemate (1:32)",
        attributes: {},
    };

    it("files 1995-1997 as year and year_end (parseInt kept only 1995)", async () => {
        db.row = mold;
        await fileReleaseUnderMold({ moldId: "sb", look: "Light chestnut pinto", yearFrom: "1995-1997" });
        expect(suggestions.createSuggestion).toHaveBeenCalledWith(
            expect.objectContaining({
                fieldChanges: expect.objectContaining({ year: 1995, year_end: 1997, parent_catalog_id: "sb" }),
            }),
        );
    });

    it("takes a model number off the name and asks when it disagrees with the box (MHH-079)", async () => {
        db.row = mold;
        await fileReleaseUnderMold({
            moldId: "sb",
            name: "#5002 Pinto Saddlebred",
            modelNumber: "5002",
            look: "Pinto",
        });
        expect(suggestions.createSuggestion).toHaveBeenCalledWith(
            expect.objectContaining({
                fieldChanges: expect.objectContaining({ title: "Pinto Saddlebred", model_number: "5002" }),
            }),
        );
        suggestions.createSuggestion.mockClear();
        await fileReleaseUnderMold({ moldId: "sb", name: "#5002 Pinto Saddlebred", look: "Pinto" });
        expect(suggestions.createSuggestion).toHaveBeenCalledWith(
            expect.objectContaining({
                fieldChanges: expect.objectContaining({ title: "Pinto Saddlebred", model_number: "5002" }),
            }),
        );
        // A bare number with an empty box may be part of the name ("101 Dalmatians"):
        // the form asks the member; the server never moves it silently.
        suggestions.createSuggestion.mockClear();
        await fileReleaseUnderMold({ moldId: "sb", name: "101 Dalmatians", look: "Spotted" });
        const sent = suggestions.createSuggestion.mock.calls[0][0] as { fieldChanges: Record<string, unknown> };
        expect(sent.fieldChanges.title).toBe("101 Dalmatians");
        expect(sent.fieldChanges.model_number).toBeUndefined();
        suggestions.createSuggestion.mockClear();
        const r = await fileReleaseUnderMold({
            moldId: "sb",
            name: "#5002 Pinto Saddlebred",
            modelNumber: "5003",
            look: "Pinto",
        });
        expect(r).toMatchObject({ success: false, error: expect.stringMatching(/#5002.*5003/) });
        expect(suggestions.createSuggestion).not.toHaveBeenCalled();
    });

    it("says why a year it cannot read is refused", async () => {
        db.row = mold;
        const r = await fileReleaseUnderMold({ moldId: "sb", look: "Bay", yearFrom: "late 90s" });
        expect(r).toMatchObject({ success: false, error: expect.stringMatching(/1995-1997/) });
        expect(suggestions.createSuggestion).not.toHaveBeenCalled();
    });
});
