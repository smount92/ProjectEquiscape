import { describe, expect, it } from "vitest";

import { deriveVotePlacings, type VoteTally } from "../deriveVotePlacings";

function tally(entryId: string, voteCount: number, createdAt: string): VoteTally {
    return { entryId, voteCount, createdAt };
}

describe("deriveVotePlacings", () => {
    it("places the top entries by vote count, 1st through 6th", () => {
        const result = deriveVotePlacings([
            tally("a", 3, "2026-07-01T00:00:00Z"),
            tally("b", 9, "2026-07-01T01:00:00Z"),
            tally("c", 5, "2026-07-01T02:00:00Z"),
        ]);
        expect(result).toEqual([
            { entryId: "b", place: 1 },
            { entryId: "c", place: 2 },
            { entryId: "a", place: 3 },
        ]);
    });

    it("caps at six places even with more voted entries", () => {
        const tallies = Array.from({ length: 9 }, (_, i) =>
            tally(`e${i}`, 100 - i, `2026-07-01T00:0${i}:00Z`),
        );
        const result = deriveVotePlacings(tallies);
        expect(result).toHaveLength(6);
        expect(result.map((r) => r.place)).toEqual([1, 2, 3, 4, 5, 6]);
        expect(result[5]).toEqual({ entryId: "e5", place: 6 });
    });

    it("breaks ties by earliest entry", () => {
        const result = deriveVotePlacings([
            tally("late", 4, "2026-07-02T00:00:00Z"),
            tally("early", 4, "2026-07-01T00:00:00Z"),
            tally("middle", 4, "2026-07-01T12:00:00Z"),
        ]);
        expect(result).toEqual([
            { entryId: "early", place: 1 },
            { entryId: "middle", place: 2 },
            { entryId: "late", place: 3 },
        ]);
    });

    it("breaks identical timestamps by entry id so the result is deterministic", () => {
        const t = "2026-07-01T00:00:00Z";
        const result = deriveVotePlacings([tally("zzz", 2, t), tally("aaa", 2, t)]);
        expect(result).toEqual([
            { entryId: "aaa", place: 1 },
            { entryId: "zzz", place: 2 },
        ]);
    });

    it("handles fewer than six entries", () => {
        const result = deriveVotePlacings([
            tally("only", 1, "2026-07-01T00:00:00Z"),
        ]);
        expect(result).toEqual([{ entryId: "only", place: 1 }]);
    });

    it("never places zero-vote entries — an unvoted class yields no placings", () => {
        expect(
            deriveVotePlacings([
                tally("a", 0, "2026-07-01T00:00:00Z"),
                tally("b", 0, "2026-07-01T01:00:00Z"),
            ]),
        ).toEqual([]);
    });

    it("skips zero-vote entries below the voted ones (no backfill to six)", () => {
        const result = deriveVotePlacings([
            tally("voted", 2, "2026-07-02T00:00:00Z"),
            tally("unvoted", 0, "2026-07-01T00:00:00Z"),
        ]);
        expect(result).toEqual([{ entryId: "voted", place: 1 }]);
    });

    it("returns an empty slate for an empty class", () => {
        expect(deriveVotePlacings([])).toEqual([]);
    });

    it("does not mutate its input", () => {
        const input = [
            tally("a", 1, "2026-07-01T00:00:00Z"),
            tally("b", 2, "2026-07-01T01:00:00Z"),
        ];
        const snapshot = JSON.parse(JSON.stringify(input));
        deriveVotePlacings(input);
        expect(input).toEqual(snapshot);
    });
});
