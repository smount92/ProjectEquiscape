import { describe, it, expect } from "vitest";
import {
    isChampionshipRecord,
    isVerifiedTier,
    recordChipLabel,
    recordRank,
    sortRecordsBestFirst,
    summarizeShowRecords,
    verifiedChipLabel,
    type RecordSummaryInputRow,
} from "@/lib/market/recordSummary";

function row(overrides: Partial<RecordSummaryInputRow> = {}): RecordSummaryInputRow {
    return {
        horse_id: "h-1",
        placing: "1st",
        ribbon_color: "Blue",
        verification_tier: "self_reported",
        ...overrides,
    };
}

describe("isChampionshipRecord", () => {
    it("detects championships in the placing text at any scope", () => {
        expect(isChampionshipRecord("Grand Champion", null)).toBe(true);
        expect(isChampionshipRecord("Reserve Grand Champion", null)).toBe(true);
        expect(isChampionshipRecord("Section Champion", "Purple")).toBe(true);
        expect(isChampionshipRecord("Division Reserve Champion", null)).toBe(true);
    });

    it("detects legacy rows that carry the champion signal in ribbon_color", () => {
        expect(isChampionshipRecord("1st", "Grand Champion")).toBe(true);
        expect(isChampionshipRecord(null, "Reserve Champion")).toBe(true);
    });

    it("does not flag ordinary placings or empty rows", () => {
        expect(isChampionshipRecord("1st", "Blue")).toBe(false);
        expect(isChampionshipRecord("Top Ten", null)).toBe(false);
        expect(isChampionshipRecord(null, null)).toBe(false);
    });
});

describe("isVerifiedTier", () => {
    it("counts only platform and host verification", () => {
        expect(isVerifiedTier("platform_generated")).toBe(true);
        expect(isVerifiedTier("host_verified")).toBe(true);
        expect(isVerifiedTier("self_reported")).toBe(false);
        expect(isVerifiedTier(null)).toBe(false);
    });
});

describe("summarizeShowRecords", () => {
    it("aggregates one batched row set into per-horse summaries", () => {
        const map = summarizeShowRecords([
            row(),
            row({ placing: "3rd", ribbon_color: "Yellow", verification_tier: "platform_generated" }),
            row({ placing: "Grand Champion", ribbon_color: "Purple", verification_tier: "platform_generated" }),
            row({ horse_id: "h-2", placing: "2nd", ribbon_color: "Red", verification_tier: "host_verified" }),
        ]);

        expect(map.get("h-1")).toEqual({ total: 3, placings: 2, championships: 1, verified: 2 });
        expect(map.get("h-2")).toEqual({ total: 1, placings: 1, championships: 0, verified: 1 });
    });

    it("omits horses with no rows entirely (empty-state honesty)", () => {
        const map = summarizeShowRecords([row()]);
        expect(map.has("h-99")).toBe(false);
    });

    it("counts participation rows in total but not as placings", () => {
        const map = summarizeShowRecords([
            row({ placing: null, ribbon_color: null }),
            row({ placing: "  ", ribbon_color: null }),
        ]);
        expect(map.get("h-1")).toEqual({ total: 2, placings: 0, championships: 0, verified: 0 });
    });

    it("a championship row is never double-counted as a placing", () => {
        const map = summarizeShowRecords([row({ placing: "Champion", ribbon_color: "Purple" })]);
        expect(map.get("h-1")).toEqual({ total: 1, placings: 0, championships: 1, verified: 0 });
    });

    it("skips rows with no horse_id instead of throwing", () => {
        const map = summarizeShowRecords([row({ horse_id: null })]);
        expect(map.size).toBe(0);
    });
});

describe("recordChipLabel", () => {
    it("renders placings and championships with correct plurals", () => {
        expect(recordChipLabel({ total: 4, placings: 3, championships: 1, verified: 0 })).toBe(
            "3 placings · 1 championship",
        );
        expect(recordChipLabel({ total: 1, placings: 1, championships: 0, verified: 0 })).toBe(
            "1 placing",
        );
        expect(recordChipLabel({ total: 2, placings: 0, championships: 2, verified: 0 })).toBe(
            "2 championships",
        );
    });

    it("falls back to an honest record count when nothing placed", () => {
        expect(recordChipLabel({ total: 2, placings: 0, championships: 0, verified: 0 })).toBe(
            "2 show records",
        );
        expect(recordChipLabel({ total: 1, placings: 0, championships: 0, verified: 0 })).toBe(
            "1 show record",
        );
    });

    it("returns null when there is nothing to say — never '0 placings'", () => {
        expect(recordChipLabel(null)).toBeNull();
        expect(recordChipLabel(undefined)).toBeNull();
        expect(recordChipLabel({ total: 0, placings: 0, championships: 0, verified: 0 })).toBeNull();
    });
});

describe("verifiedChipLabel", () => {
    it("says 'verified' only when every record is verified", () => {
        expect(verifiedChipLabel({ total: 3, placings: 3, championships: 0, verified: 3 })).toBe(
            "verified",
        );
    });

    it("counts a partial mix explicitly", () => {
        expect(verifiedChipLabel({ total: 3, placings: 3, championships: 0, verified: 2 })).toBe(
            "2 verified",
        );
    });

    it("claims nothing when no record is verified", () => {
        expect(verifiedChipLabel({ total: 3, placings: 3, championships: 0, verified: 0 })).toBeNull();
        expect(verifiedChipLabel(null)).toBeNull();
    });
});

describe("recordRank", () => {
    it("orders champion tiers above every numeric placing", () => {
        expect(recordRank("Grand Champion")).toBeLessThan(recordRank("Reserve Grand Champion"));
        expect(recordRank("Reserve Grand Champion")).toBeLessThan(recordRank("Section Champion"));
        expect(recordRank("Section Champion")).toBeLessThan(recordRank("Reserve Champion"));
        expect(recordRank("Reserve Champion")).toBeLessThan(recordRank("1st"));
    });

    it("orders numeric placings ascending, even legacy ones past 6th", () => {
        expect(recordRank("1st")).toBeLessThan(recordRank("2nd"));
        expect(recordRank("6th")).toBeLessThan(recordRank("7th"));
        expect(recordRank("2")).toBe(recordRank("2nd"));
    });

    it("puts unparseable placed text after numbers, and blanks last", () => {
        expect(recordRank("7th")).toBeLessThan(recordRank("Top Ten"));
        expect(recordRank("Top Ten")).toBeLessThan(recordRank(null));
        expect(recordRank("")).toBe(recordRank(null));
    });
});

describe("sortRecordsBestFirst", () => {
    it("sorts best result first with recency as the tiebreak", () => {
        const sorted = sortRecordsBestFirst([
            { placing: "3rd", showDate: "2026-05-01" },
            { placing: "1st", showDate: "2025-01-01" },
            { placing: "1st", showDate: "2026-06-01" },
            { placing: "Grand Champion", showDate: "2024-01-01" },
            { placing: null, showDate: "2026-07-01" },
        ]);
        expect(sorted.map((r) => `${r.placing ?? "—"}@${r.showDate}`)).toEqual([
            "Grand Champion@2024-01-01",
            "1st@2026-06-01",
            "1st@2025-01-01",
            "3rd@2026-05-01",
            "—@2026-07-01",
        ]);
    });

    it("puts undated rows after dated rows of the same rank", () => {
        const sorted = sortRecordsBestFirst([
            { placing: "1st", showDate: null },
            { placing: "1st", showDate: "2026-01-01" },
        ]);
        expect(sorted[0].showDate).toBe("2026-01-01");
    });

    it("does not mutate the input array", () => {
        const input = [
            { placing: "2nd", showDate: null },
            { placing: "1st", showDate: null },
        ];
        const copy = [...input];
        sortRecordsBestFirst(input);
        expect(input).toEqual(copy);
    });
});
