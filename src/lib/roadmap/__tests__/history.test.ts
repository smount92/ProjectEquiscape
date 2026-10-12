import { describe, expect, it } from "vitest";
import { describeChange, describeEvent, diffItem, type RoadmapEvent, type RoadmapItem } from "@/lib/roadmap/model";

const base: RoadmapItem = {
    id: "a",
    title: "Entries tray",
    detail: "",
    kind: "goal",
    horizon: "short",
    status: "open",
    priority: 2,
    area: "shows",
    source: "",
    link: "",
    dueOn: null,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    closedAt: null,
};

describe("roadmap history", () => {
    it("records only the tracked fields that changed, in display words", () => {
        const changes = diffItem(base, {
            ...base,
            status: "blocked",
            horizon: "long",
            priority: 1,
            dueOn: "2026-11-01",
            detail: "now has detail",
            updatedAt: "2026-10-12T00:00:00Z",
        });
        expect(changes).toEqual([
            { field: "detail", from: null, to: null },
            { field: "horizon", from: "Short term", to: "Long term" },
            { field: "status", from: "Open", to: "Blocked" },
            { field: "priority", from: "Should", to: "Must" },
            { field: "dueOn", from: null, to: "2026-11-01" },
        ]);
        expect(diffItem(base, { ...base, updatedAt: "x" })).toEqual([]);
    });

    it("describes a change as one readable line", () => {
        expect(describeChange({ field: "status", from: "Open", to: "Done" })).toBe("Status: Open → Done");
        expect(describeChange({ field: "dueOn", from: null, to: "2026-11-01" })).toBe("Due set to 2026-11-01");
        expect(describeChange({ field: "link", from: "https://x", to: null })).toBe("Link cleared (was https://x)");
        expect(describeChange({ field: "detail", from: null, to: null })).toBe("Detail edited");
    });

    it("describes an event by its kind", () => {
        const ev = (over: Partial<RoadmapEvent>): RoadmapEvent => ({
            id: "e",
            itemId: "a",
            kind: "comment",
            body: "",
            changes: [],
            createdAt: "2026-10-12T00:00:00Z",
            ...over,
        });
        expect(describeEvent(ev({ kind: "comment", body: "Asked Misty for the show id" }))).toBe("Asked Misty for the show id");
        expect(describeEvent(ev({ kind: "created" }))).toBe("Added to the roadmap");
        expect(
            describeEvent(
                ev({
                    kind: "change",
                    changes: [
                        { field: "status", from: "Open", to: "In progress" },
                        { field: "priority", from: "Should", to: "Must" },
                    ],
                }),
            ),
        ).toBe("Status: Open → In progress · Priority: Should → Must");
        expect(describeEvent(ev({ kind: "change" }))).toBe("Edited");
    });
});
