import { describe, it, expect } from "vitest";
import {
    addClassSchema,
    addDivisionSchema,
    addSectionSchema,
    addShowStaffSchema,
    combineClassesSchema,
    createShowSchema,
    firstZodError,
    loadTemplateSchema,
    removeShowStaffSchema,
    reorderClasslistSchema,
    splitClassSchema,
    transitionShowStatusSchema,
    updateClassSchema,
    updateShowSettingsSchema,
} from "@/lib/shows/schemas";

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const UUID2 = "223e4567-e89b-42d3-a456-426614174000";

describe("schemas — createShow", () => {
    it("accepts a minimal live show and applies defaults", () => {
        const r = createShowSchema.safeParse({ title: "Spring Fling Live", mode: "live" });
        expect(r.success).toBe(true);
        if (r.success) {
            expect(r.data.judging).toBe("judged");
            expect(r.data.isMhhQualifying).toBe(true);
        }
    });

    it("accepts community_vote judging (locked decision)", () => {
        const r = createShowSchema.safeParse({
            title: "Casual Photo Show",
            mode: "online",
            judging: "community_vote",
        });
        expect(r.success).toBe(true);
    });

    it("rejects a too-short title", () => {
        const r = createShowSchema.safeParse({ title: "ab", mode: "live" });
        expect(r.success).toBe(false);
        if (!r.success) expect(firstZodError(r.error)).toMatch(/at least 3/i);
    });

    it("rejects an unknown mode", () => {
        expect(createShowSchema.safeParse({ title: "Test Show", mode: "hybrid" }).success).toBe(false);
    });

    it("rejects entries closing before they open", () => {
        const r = createShowSchema.safeParse({
            title: "Backwards Show",
            mode: "online",
            entriesOpenAt: "2026-08-01T00:00:00Z",
            entriesCloseAt: "2026-07-01T00:00:00Z",
        });
        expect(r.success).toBe(false);
        if (!r.success) expect(firstZodError(r.error)).toMatch(/open before/i);
    });

    it("rejects non-integer or non-positive capacity", () => {
        expect(createShowSchema.safeParse({ title: "Show", mode: "live", capacity: 0 }).success).toBe(false);
        expect(createShowSchema.safeParse({ title: "Show", mode: "live", capacity: 2.5 }).success).toBe(false);
        expect(createShowSchema.safeParse({ title: "Show", mode: "live", capacity: 40 }).success).toBe(true);
    });

    it("rejects a malformed show date", () => {
        expect(createShowSchema.safeParse({ title: "Show", mode: "live", showDate: "July 4th" }).success).toBe(false);
        expect(createShowSchema.safeParse({ title: "Show", mode: "live", showDate: "2026-07-04" }).success).toBe(true);
    });
});

describe("schemas — updateShowSettings / transitionShowStatus", () => {
    it("rejects an empty patch", () => {
        const r = updateShowSettingsSchema.safeParse({ showId: UUID, patch: {} });
        expect(r.success).toBe(false);
        if (!r.success) expect(firstZodError(r.error)).toMatch(/nothing to update/i);
    });

    it("accepts nulling out optional fields", () => {
        const r = updateShowSettingsSchema.safeParse({
            showId: UUID,
            patch: { capacity: null, feeInfo: null },
        });
        expect(r.success).toBe(true);
    });

    it("rejects a non-uuid show id", () => {
        expect(updateShowSettingsSchema.safeParse({ showId: "abc", patch: { title: "New Name" } }).success).toBe(false);
    });

    it("transition accepts only known statuses", () => {
        expect(transitionShowStatusSchema.safeParse({ showId: UUID, to: "published" }).success).toBe(true);
        expect(transitionShowStatusSchema.safeParse({ showId: UUID, to: "on_fire" }).success).toBe(false);
    });
});

describe("schemas — classlist structure", () => {
    it("addDivision defaults axis to other", () => {
        const r = addDivisionSchema.safeParse({ showId: UUID, name: "OF Plastic Halter" });
        expect(r.success).toBe(true);
        if (r.success) expect(r.data.axis).toBe("other");
    });

    it("addDivision accepts every axis", () => {
        for (const axis of ["halter", "performance", "workmanship", "collectibility", "other"]) {
            expect(addDivisionSchema.safeParse({ showId: UUID, name: "D", axis }).success).toBe(true);
        }
        expect(addDivisionSchema.safeParse({ showId: UUID, name: "D", axis: "jumping" }).success).toBe(false);
    });

    it("addSection requires a name", () => {
        expect(addSectionSchema.safeParse({ divisionId: UUID, name: "" }).success).toBe(false);
        expect(addSectionSchema.safeParse({ divisionId: UUID, name: "Stock" }).success).toBe(true);
    });

    it("addClass bounds maxPerEntrant", () => {
        expect(addClassSchema.safeParse({ sectionId: UUID, name: "QH", maxPerEntrant: 0 }).success).toBe(false);
        expect(addClassSchema.safeParse({ sectionId: UUID, name: "QH", maxPerEntrant: 3 }).success).toBe(true);
        expect(addClassSchema.safeParse({ sectionId: UUID, name: "QH", maxPerEntrant: null }).success).toBe(true);
    });

    it("updateClass rejects an empty patch and unknown status", () => {
        expect(updateClassSchema.safeParse({ classId: UUID, patch: {} }).success).toBe(false);
        expect(updateClassSchema.safeParse({ classId: UUID, patch: { status: "exploded" } }).success).toBe(false);
        expect(updateClassSchema.safeParse({ classId: UUID, patch: { status: "called" } }).success).toBe(true);
    });

    it("reorder requires at least one item and valid kinds", () => {
        expect(reorderClasslistSchema.safeParse({ showId: UUID, kind: "class", items: [] }).success).toBe(false);
        expect(reorderClasslistSchema.safeParse({
            showId: UUID,
            kind: "row",
            items: [{ id: UUID, sortOrder: 0 }],
        }).success).toBe(false);
        expect(reorderClasslistSchema.safeParse({
            showId: UUID,
            kind: "section",
            items: [{ id: UUID, sortOrder: 2 }, { id: UUID2, sortOrder: 1 }],
        }).success).toBe(true);
    });
});

describe("schemas — split/combine", () => {
    it("split requires at least one entry to move", () => {
        expect(splitClassSchema.safeParse({
            classId: UUID, newClassName: "QH Split B", entryIdsToMove: [],
        }).success).toBe(false);
        expect(splitClassSchema.safeParse({
            classId: UUID, newClassName: "QH Split B", entryIdsToMove: [UUID2],
        }).success).toBe(true);
    });

    it("combine requires two+ distinct classes", () => {
        expect(combineClassesSchema.safeParse({
            classIds: [UUID], newClassName: "Combined",
        }).success).toBe(false);
        const dup = combineClassesSchema.safeParse({
            classIds: [UUID, UUID], newClassName: "Combined",
        });
        expect(dup.success).toBe(false);
        if (!dup.success) expect(firstZodError(dup.error)).toMatch(/duplicate/i);
        expect(combineClassesSchema.safeParse({
            classIds: [UUID, UUID2], newClassName: "Combined",
        }).success).toBe(true);
    });
});

describe("schemas — template + staff", () => {
    it("loadTemplate defaults to namhsa_core", () => {
        const r = loadTemplateSchema.safeParse({ showId: UUID });
        expect(r.success).toBe(true);
        if (r.success) expect(r.data.templateKey).toBe("namhsa_core");
    });

    it("staff roles are limited to grantable ones — host is not grantable", () => {
        expect(addShowStaffSchema.safeParse({ showId: UUID, userId: UUID2, role: "co_host" }).success).toBe(true);
        expect(addShowStaffSchema.safeParse({ showId: UUID, userId: UUID2, role: "steward" }).success).toBe(true);
        expect(addShowStaffSchema.safeParse({ showId: UUID, userId: UUID2, role: "judge" }).success).toBe(true);
        expect(addShowStaffSchema.safeParse({ showId: UUID, userId: UUID2, role: "host" }).success).toBe(false);
    });

    it("addShowStaff defaults coiFlag false", () => {
        const r = addShowStaffSchema.safeParse({ showId: UUID, userId: UUID2, role: "judge" });
        if (r.success) expect(r.data.coiFlag).toBe(false);
    });

    it("removeShowStaff requires uuids", () => {
        expect(removeShowStaffSchema.safeParse({ showId: UUID, userId: "someone" }).success).toBe(false);
        expect(removeShowStaffSchema.safeParse({ showId: UUID, userId: UUID2 }).success).toBe(true);
    });
});
