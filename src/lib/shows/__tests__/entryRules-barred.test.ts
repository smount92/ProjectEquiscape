import { describe, expect, it } from "vitest";

import { validateEntry, type ValidateEntryInput } from "../entryRules";

/** Minimal valid input — each test flips one thing. */
function baseInput(): ValidateEntryInput {
    return {
        candidate: { horseId: "h1", ownerId: "u1", handlerId: null, photoId: null },
        horse: { id: "h1", ownerId: "u1", scale: null, finish: null },
        show: { id: "s1", mode: "online", status: "entries_open", entriesCloseAt: null },
        targetClass: {
            id: "c1",
            status: "scheduled",
            maxPerEntrant: null,
            allowedScales: null,
            allowedFinishes: null,
            divisionAxis: "halter",
        },
        existingEntries: [],
    };
}

describe("validateEntry — barred entrant (v4 sticky scratch)", () => {
    it("rejects a barred entrant even when everything else is valid", () => {
        const result = validateEntry({ ...baseInput(), isBarred: true });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errors.some((e) => e.includes("not able to enter this show"))).toBe(true);
        }
    });

    it("barred stacks with other violations (all surfaced)", () => {
        const input = { ...baseInput(), isBarred: true };
        input.show.status = "entries_closed";
        const result = validateEntry(input);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it("absent/false isBarred changes nothing", () => {
        expect(validateEntry(baseInput()).ok).toBe(true);
        expect(validateEntry({ ...baseInput(), isBarred: false }).ok).toBe(true);
    });
});
