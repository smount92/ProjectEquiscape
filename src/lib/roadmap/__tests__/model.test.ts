import { describe, expect, it } from "vitest";
import {
    closedAtFor,
    groupByHorizon,
    isOverdue,
    isStale,
    sortItems,
    summarize,
    type RoadmapItem,
} from "@/lib/roadmap/model";

const TODAY = new Date("2026-10-12T12:00:00Z");

function item(over: Partial<RoadmapItem> & { id: string }): RoadmapItem {
    return {
        title: over.id,
        detail: "",
        kind: "goal",
        horizon: "short",
        status: "open",
        priority: 2,
        area: "",
        source: "",
        link: "",
        dueOn: null,
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-10T00:00:00Z",
        closedAt: null,
        ...over,
    };
}

describe("roadmap model", () => {
    it("an item is overdue only while open and past its due date", () => {
        expect(isOverdue(item({ id: "a", dueOn: "2026-10-11" }), TODAY)).toBe(true);
        expect(isOverdue(item({ id: "b", dueOn: "2026-10-12" }), TODAY)).toBe(false);
        expect(isOverdue(item({ id: "c", dueOn: "2026-10-01", status: "done" }), TODAY)).toBe(false);
        expect(isOverdue(item({ id: "d" }), TODAY)).toBe(false);
    });

    it("an open item untouched for over 30 days is stale; a closed one never is", () => {
        expect(isStale(item({ id: "a", updatedAt: "2026-09-01T00:00:00Z" }), TODAY)).toBe(true);
        expect(isStale(item({ id: "b", updatedAt: "2026-10-01T00:00:00Z" }), TODAY)).toBe(false);
        expect(isStale(item({ id: "c", updatedAt: "2026-01-01T00:00:00Z", status: "dropped" }), TODAY)).toBe(false);
    });

    it("sorts blocked and in-progress ahead of open, then by priority, due date, newest", () => {
        const sorted = sortItems([
            item({ id: "open-3", priority: 3 }),
            item({ id: "open-1-late", priority: 1, dueOn: "2026-11-01" }),
            item({ id: "open-1-soon", priority: 1, dueOn: "2026-10-20" }),
            item({ id: "open-1-nodue", priority: 1 }),
            item({ id: "progress", status: "in_progress", priority: 3 }),
            item({ id: "blocked", status: "blocked", priority: 3 }),
            item({ id: "done", status: "done", priority: 1 }),
        ]);
        expect(sorted.map((i) => i.id)).toEqual([
            "blocked",
            "progress",
            "open-1-soon",
            "open-1-late",
            "open-1-nodue",
            "open-3",
            "done",
        ]);
    });

    it("summarises open counts per horizon, problems, overdue, stale and recent dones", () => {
        const s = summarize(
            [
                item({ id: "a", horizon: "now", kind: "problem", dueOn: "2026-10-01" }),
                item({ id: "b", horizon: "now", status: "in_progress" }),
                item({ id: "c", horizon: "long", status: "blocked", updatedAt: "2026-08-01T00:00:00Z" }),
                item({ id: "d", horizon: "short", status: "done", closedAt: "2026-10-05T00:00:00Z" }),
                item({ id: "e", horizon: "short", status: "done", closedAt: "2026-07-05T00:00:00Z" }),
                item({ id: "f", horizon: "someday", status: "dropped", closedAt: "2026-10-05T00:00:00Z" }),
            ],
            TODAY,
        );
        expect(s.openByHorizon).toEqual({ now: 2, short: 0, long: 1, someday: 0 });
        expect(s.openProblems).toBe(1);
        expect(s.inProgress).toBe(1);
        expect(s.blocked).toBe(1);
        expect(s.overdue).toBe(1);
        expect(s.stale).toBe(1);
        expect(s.doneRecently).toBe(1);
        expect(s.total).toBe(6);
    });

    it("groups by horizon and hides closed items unless asked", () => {
        const items = [
            item({ id: "a", horizon: "now" }),
            item({ id: "b", horizon: "now", status: "done" }),
            item({ id: "c", horizon: "someday" }),
        ];
        expect(groupByHorizon(items).now.map((i) => i.id)).toEqual(["a"]);
        expect(groupByHorizon(items, true).now.map((i) => i.id)).toEqual(["a", "b"]);
        expect(groupByHorizon(items).someday).toHaveLength(1);
        expect(groupByHorizon(items).short).toEqual([]);
    });

    it("closing stamps closed_at once and reopening clears it", () => {
        const now = new Date("2026-10-12T00:00:00Z");
        expect(closedAtFor("done", null, now)).toBe(now.toISOString());
        expect(closedAtFor("dropped", "2026-10-01T00:00:00Z", now)).toBe("2026-10-01T00:00:00Z");
        expect(closedAtFor("open", "2026-10-01T00:00:00Z", now)).toBeNull();
        expect(closedAtFor("in_progress", null, now)).toBeNull();
    });
});
