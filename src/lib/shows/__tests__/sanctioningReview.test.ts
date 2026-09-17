import { describe, it, expect } from "vitest";

import { buildSanctioningChecks, type SanctioningCheckInput } from "@/lib/shows/sanctioningReview";

function input(overrides: Partial<SanctioningCheckInput> = {}): SanctioningCheckInput {
    return {
        mode: "online",
        judging: "judged",
        status: "draft",
        showDate: null,
        entriesOpenAt: "2026-10-01T00:00:00Z",
        entriesCloseAt: "2026-10-15T00:00:00Z",
        judgingEndsAt: "2026-10-31T00:00:00Z",
        aboutMd: "Welcome to our show.",
        rulesMd: "One entry per class.",
        divisionCount: 2,
        classCount: 14,
        qualifyingClassCount: 12,
        judgeCount: 1,
        hostCompletedShows: 1,
        hostTotalShows: 2,
        ...overrides,
    };
}

const byKey = (checks: ReturnType<typeof buildSanctioningChecks>) =>
    Object.fromEntries(checks.map((c) => [c.key, c]));

describe("buildSanctioningChecks", () => {
    it("a complete judged online draft reads green, with the draft as information", () => {
        const c = byKey(buildSanctioningChecks(input()));
        expect(c.judging.level).toBe("ok");
        expect(c.dates.level).toBe("ok");
        expect(c.classlist.level).toBe("ok");
        expect(c.classlist.label).toBe("14 classes across 2 divisions");
        expect(c.classlist.detail).toMatch(/12 classes marked qualifying/);
        expect(c.rules.level).toBe("ok");
        expect(c.about.level).toBe("ok");
        expect(c.judge.level).toBe("ok");
        expect(c.host.level).toBe("ok");
        expect(c.status.level).toBe("info");
        expect(c.status.label).toBe("Still a draft");
    });

    it("flags what the admin should weigh: votes, missing windows, empty classlist, no rules", () => {
        const c = byKey(
            buildSanctioningChecks(
                input({
                    judging: "community_vote",
                    entriesCloseAt: null,
                    classCount: 0,
                    divisionCount: 0,
                    qualifyingClassCount: 0,
                    rulesMd: "   ",
                    aboutMd: null,
                }),
            ),
        );
        expect(c.judging.level).toBe("warn");
        expect(c.dates.level).toBe("warn");
        expect(c.dates.label).toBe("Windows incomplete");
        expect(c.classlist.level).toBe("warn");
        expect(c.rules.level).toBe("warn");
        expect(c.about.level).toBe("info");
        // A vote show has no judge line at all.
        expect(c.judge).toBeUndefined();
    });

    it("windows out of order are their own warning", () => {
        const c = byKey(
            buildSanctioningChecks(
                input({
                    entriesOpenAt: "2026-10-20T00:00:00Z",
                    entriesCloseAt: "2026-10-15T00:00:00Z",
                }),
            ),
        );
        expect(c.dates.level).toBe("warn");
        expect(c.dates.label).toBe("Windows out of order");
    });

    it("live shows check the show date instead of windows", () => {
        const missing = byKey(buildSanctioningChecks(input({ mode: "live", showDate: null })));
        expect(missing.dates.level).toBe("warn");
        const set = byKey(buildSanctioningChecks(input({ mode: "live", showDate: "2026-11-07" })));
        expect(set.dates.level).toBe("ok");
        expect(set.dates.detail).toContain("2026-11-07");
    });

    it("a first-time host is information, never a warning", () => {
        const c = byKey(
            buildSanctioningChecks(input({ hostCompletedShows: 0, hostTotalShows: 1 })),
        );
        expect(c.host.level).toBe("info");
        expect(c.host.label).toBe("First show from this host");
    });

    it("qualifying classes absent is called out on a green classlist", () => {
        const c = byKey(buildSanctioningChecks(input({ qualifyingClassCount: 0 })));
        expect(c.classlist.level).toBe("ok");
        expect(c.classlist.detail).toMatch(/no class is marked qualifying/i);
    });
});
