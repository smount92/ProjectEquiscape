import { describe, expect, it } from "vitest";

import { placingRank, rollupShowResults } from "../rollup";

const ev = (id: string, eventType: string, over: Partial<{ title: string; eventDate: string | null; metadata: Record<string, unknown> }> = {}) => ({
    id,
    eventType,
    title: over.title ?? id,
    description: null,
    eventDate: over.eventDate ?? "2024-03-23",
    metadata: over.metadata ?? {},
});

describe("Hoofprint show-result rollup", () => {
    it("ranks placings best first", () => {
        expect([ "3rd", "Champion", "1st", "HM", "Grand Champion", "Top 5" ].sort((a, b) => placingRank(a) - placingRank(b))).toEqual([
            "Grand Champion",
            "Champion",
            "1st",
            "3rd",
            "Top 5",
            "HM",
        ]);
    });

    it("folds one show's placings into one line where the first one stood, leaving the rest alone", () => {
        const events = [
            ev("acq", "acquired", { eventDate: "2024-05-01" }),
            ev("r1", "show_result", { title: "1st at Spring Fling", metadata: { show_name: "Spring Fling", placing: "1st", is_nan_qualifying: true } }),
            ev("note", "note", { eventDate: "2024-03-24" }),
            ev("r2", "show_result", { title: "3rd at Spring Fling", metadata: { show_name: "Spring Fling", placing: "3rd" } }),
            ev("r3", "show_result", { title: "Champion at Spring Fling", metadata: { show_name: "Spring Fling", placing: "Champion" } }),
            ev("r4", "show_result", { title: "2nd at Autumn Live", eventDate: "2023-10-01", metadata: { show_name: "Autumn Live", placing: "2nd" } }),
        ];
        const out = rollupShowResults(events);
        expect(out.map((e) => e.id)).toEqual(["acq", "rollup:r1", "note", "r4"]);
        expect(out[1].title).toBe("3 placings at Spring Fling");
        expect(out[1].description).toBe("Best: Champion · 1 card");
        expect(out[1].metadata.rolled_count).toBe(3);
    });

    it("keeps a lone placing as it was", () => {
        const only = ev("r1", "show_result", { title: "1st at Solo", metadata: { show_name: "Solo", placing: "1st" } });
        expect(rollupShowResults([only])).toEqual([only]);
    });
});
