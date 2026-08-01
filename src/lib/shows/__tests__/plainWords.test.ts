import { describe, expect, it } from "vitest";

import {
    AXIS_GLOSS,
    friendlyClassStatus,
    friendlyEntryStatus,
    friendlyShowStatus,
} from "../plainWords";
import type {
    ClassStatus,
    DivisionAxis,
    EntryStatus,
    ShowStatus,
} from "../types";

/** The full unions, spelled out — a new status must join BOTH the
 *  type and this list, so the exhaustive walk below stays honest. */
const SHOW_STATUSES: ShowStatus[] = [
    "draft",
    "published",
    "entries_open",
    "entries_closed",
    "running",
    "judging",
    "results_review",
    "completed",
    "archived",
];
const ENTRY_STATUSES: EntryStatus[] = ["entered", "scratched", "placed"];
const CLASS_STATUSES: ClassStatus[] = [
    "scheduled",
    "called",
    "judging",
    "placed",
    "combined",
    "cancelled",
];
const AXES: DivisionAxis[] = [
    "halter",
    "performance",
    "workmanship",
    "collectibility",
    "other",
];

describe("friendlyShowStatus", () => {
    it("covers every show status with a non-empty, underscore-free phrase", () => {
        for (const status of SHOW_STATUSES) {
            const words = friendlyShowStatus(status);
            expect(words, status).toBeTruthy();
            expect(words, status).not.toMatch(/_/);
        }
    });

    it("speaks shower, not database", () => {
        expect(friendlyShowStatus("results_review")).toBe("Results being finalized");
        expect(friendlyShowStatus("entries_open")).toBe("Entries open");
        expect(friendlyShowStatus("completed")).toBe("Results final");
        expect(friendlyShowStatus("running")).toBe("Show day");
    });
});

describe("friendlyEntryStatus", () => {
    it("covers every entry status with a non-empty, underscore-free phrase", () => {
        for (const status of ENTRY_STATUSES) {
            const words = friendlyEntryStatus(status);
            expect(words, status).toBeTruthy();
            expect(words, status).not.toMatch(/_/);
        }
    });

    it("stamps the words the entrant table shows", () => {
        expect(friendlyEntryStatus("entered")).toBe("Entered ✓");
        expect(friendlyEntryStatus("scratched")).toBe("Scratched (withdrawn)");
        expect(friendlyEntryStatus("placed")).toBe("Placed 🏆");
    });
});

describe("friendlyClassStatus", () => {
    it("covers every class status with a non-empty, underscore-free phrase", () => {
        for (const status of CLASS_STATUSES) {
            const words = friendlyClassStatus(status);
            expect(words, status).toBeTruthy();
            expect(words, status).not.toMatch(/_/);
        }
    });

    it("never echoes the raw judging/called machine words bare-cased", () => {
        expect(friendlyClassStatus("judging")).toBe("Being judged");
        expect(friendlyClassStatus("called")).toBe("In the ring");
    });
});

describe("AXIS_GLOSS", () => {
    it("glosses every axis with a visible one-liner naming the axis idea", () => {
        for (const axis of AXES) {
            const gloss = AXIS_GLOSS[axis];
            expect(gloss, axis).toBeTruthy();
            // A gloss explains — it must say more than the axis word.
            expect(gloss.length, axis).toBeGreaterThan(axis.length + 5);
        }
        expect(AXIS_GLOSS.halter).toMatch(/breed type/i);
        expect(AXIS_GLOSS.performance).toMatch(/tack/i);
    });
});
