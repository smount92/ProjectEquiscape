import { describe, expect, it } from "vitest";

import {
    placingFieldLine,
    placingShareDescription,
    placingShareTitle,
    resolvePlacingHrefs,
    type HorseEntryClassRow,
    type ShareableRecord,
} from "../placingShare";

const facts = {
    horseName: "Rain Dancer",
    place: 1 as const,
    className: "Stock Breeds",
    showTitle: "Summer Classic",
    totalEntries: 9,
    mode: "online" as const,
};

describe("share copy", () => {
    it("titles as '{horse} placed {place} — {show}'", () => {
        expect(placingShareTitle(facts)).toBe("Rain Dancer placed 1st — Summer Classic");
    });

    it("describes the win so a non-member instantly understands", () => {
        expect(placingShareDescription(facts)).toBe(
            "Rain Dancer won 1st of 9 entries in Stock Breeds at Summer Classic, a Model Horse Hub photo show.",
        );
    });

    it("says 'live show' for live mode and drops the field when unknown", () => {
        expect(
            placingShareDescription({ ...facts, mode: "live", totalEntries: null }),
        ).toBe(
            "Rain Dancer won 1st in Stock Breeds at Summer Classic, a Model Horse Hub live show.",
        );
    });

    it("never brags 'of 1 entries' — a field of one reads as plain place", () => {
        expect(placingShareDescription({ ...facts, totalEntries: 1 })).toContain(
            "won 1st in Stock Breeds",
        );
        expect(placingFieldLine(3, 1)).toBe("3rd place");
        expect(placingFieldLine(3, 12)).toBe("3rd of 12 entries");
    });
});

describe("resolvePlacingHrefs (trophy-case record → placing page)", () => {
    const record = (overrides: Partial<ShareableRecord> = {}): ShareableRecord => ({
        id: "rec-1",
        showId: "show-1",
        className: "Stock Breeds",
        verificationTier: "platform_generated",
        ...overrides,
    });
    const entry = (overrides: Partial<HorseEntryClassRow> = {}): HorseEntryClassRow => ({
        entryId: "entry-1",
        showId: "show-1",
        className: "Stock Breeds",
        ...overrides,
    });

    it("maps a platform record to its entry by (show, class name)", () => {
        expect(resolvePlacingHrefs([record()], [entry()])).toEqual({
            "rec-1": "/shows/show-1/placing/entry-1",
        });
    });

    it("skips self-reported and legacy records — only MHH-verified rows share", () => {
        expect(
            resolvePlacingHrefs(
                [
                    record({ verificationTier: "self_reported" }),
                    record({ id: "rec-2", verificationTier: null }),
                    record({ id: "rec-3", showId: null }),
                ],
                [entry()],
            ),
        ).toEqual({});
    });

    it("resolves nothing for championship records (synthetic class names)", () => {
        expect(
            resolvePlacingHrefs([record({ className: "Grand Championship" })], [entry()]),
        ).toEqual({});
    });

    it("drops ambiguous matches instead of guessing", () => {
        // Data drift: the same horse somehow twice in one class.
        expect(
            resolvePlacingHrefs(
                [record()],
                [entry(), entry({ entryId: "entry-2" })],
            ),
        ).toEqual({});
    });

    it("keeps shows separate — same class name in two shows", () => {
        const hrefs = resolvePlacingHrefs(
            [record(), record({ id: "rec-2", showId: "show-2" })],
            [entry(), entry({ entryId: "entry-9", showId: "show-2" })],
        );
        expect(hrefs).toEqual({
            "rec-1": "/shows/show-1/placing/entry-1",
            "rec-2": "/shows/show-2/placing/entry-9",
        });
    });
});
