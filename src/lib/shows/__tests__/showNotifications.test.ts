import { describe, expect, it, vi } from "vitest";

// The module under test pulls in the server-only notification sink
// and the email senders; neither is exercised here (pure builders
// only) but both must import cleanly under node.
vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import {
    buildAnnouncementPlans,
    buildCardNotificationPlans,
    buildClassChangePlans,
    buildDeadlinePlans,
    buildEntrantResults,
    buildEntryScratchedPlan,
    buildResultsNotificationPlans,
    buildStaffAddedPlan,
    buildVotingOpenPlans,
    deriveAnnouncementRecipients,
    isClosingWithin24h,
    MAX_LISTED_PLACEMENTS,
} from "../notifications";
import { announceToEntrantsSchema, scratchEntrySchema } from "../schemas";

const classNamesById = new Map([
    ["c1", "Breed Halter"],
    ["c2", "Collectibility"],
    ["c3", "Custom Halter"],
    ["c4", "Performance"],
]);
const horseNamesById = new Map([
    ["h1", "Ruffian"],
    ["h2", "Maple"],
    ["h3", "Dude"],
    ["h4", "Cinder"],
]);

function entry(id: string, ownerId: string, horseId: string, classId: string, status = "entered") {
    return { id, ownerId, horseId, classId, status };
}

describe("buildEntrantResults", () => {
    it("includes EVERY distinct live-entry owner — placed and unplaced", () => {
        const results = buildEntrantResults({
            entries: [
                entry("e1", "alice", "h1", "c1"),
                entry("e2", "bob", "h2", "c1"),
                entry("e3", "bob", "h3", "c2"),
            ],
            placings: [{ entryId: "e1", place: 1 }],
            classNamesById,
            horseNamesById,
        });
        expect(results).toHaveLength(2);
        expect(results.find((r) => r.ownerId === "alice")?.placements).toHaveLength(1);
        expect(results.find((r) => r.ownerId === "bob")?.placements).toHaveLength(0);
    });

    it("sorts an owner's placements best-first and resolves names", () => {
        const results = buildEntrantResults({
            entries: [
                entry("e1", "alice", "h1", "c1"),
                entry("e2", "alice", "h2", "c2"),
            ],
            placings: [
                { entryId: "e2", place: 4 },
                { entryId: "e1", place: 2 },
            ],
            classNamesById,
            horseNamesById,
        });
        expect(results[0].placements).toEqual([
            { horseId: "h1", horseName: "Ruffian", place: 2, className: "Breed Halter" },
            { horseId: "h2", horseName: "Maple", place: 4, className: "Collectibility" },
        ]);
    });

    it("ignores scratched entries and participation (null-place) rows", () => {
        const results = buildEntrantResults({
            entries: [
                entry("e1", "alice", "h1", "c1", "scratched"),
                entry("e2", "bob", "h2", "c1"),
            ],
            placings: [
                { entryId: "e1", place: 1 }, // scratched — never notifies
                { entryId: "e2", place: null }, // participation, not a placement
            ],
            classNamesById,
            horseNamesById,
        });
        expect(results.map((r) => r.ownerId)).toEqual(["bob"]);
        expect(results[0].placements).toHaveLength(0);
    });
});

describe("buildResultsNotificationPlans", () => {
    const base = { showId: "show-1", showTitle: "Summer Classic" };

    it("placed owners get the trophy line, linked to the show", () => {
        const [plan] = buildResultsNotificationPlans({
            ...base,
            results: [
                {
                    ownerId: "alice",
                    placements: [
                        { horseId: "h1", horseName: "Ruffian", place: 1, className: "Breed Halter" },
                    ],
                },
            ],
        });
        expect(plan).toMatchObject({
            userId: "alice",
            type: "show_result",
            actorId: null,
            linkUrl: "/shows/show-1",
        });
        expect(plan.content).toBe(
            "🏆 Ruffian placed 1st in Breed Halter at Summer Classic",
        );
    });

    it(`lists at most ${MAX_LISTED_PLACEMENTS} placements then "and N more"`, () => {
        const placements = [
            { horseId: "h1", horseName: "Ruffian", place: 1, className: "Breed Halter" },
            { horseId: "h2", horseName: "Maple", place: 2, className: "Collectibility" },
            { horseId: "h3", horseName: "Dude", place: 3, className: "Custom Halter" },
            { horseId: "h4", horseName: "Cinder", place: 4, className: "Performance" },
            { horseId: "h4", horseName: "Cinder", place: 5, className: "Breed Halter" },
        ];
        const [plan] = buildResultsNotificationPlans({
            ...base,
            results: [{ ownerId: "alice", placements }],
        });
        expect(plan.content).toContain("Ruffian placed 1st in Breed Halter");
        expect(plan.content).toContain("Dude placed 3rd in Custom Halter");
        expect(plan.content).not.toContain("Performance");
        expect(plan.content).toContain("and 2 more at Summer Classic");
    });

    it("unplaced owners get the kind results-are-up line", () => {
        const [plan] = buildResultsNotificationPlans({
            ...base,
            results: [{ ownerId: "bob", placements: [] }],
        });
        expect(plan.content).toContain("Results are up for Summer Classic");
        expect(plan.type).toBe("show_result");
    });
});

describe("buildCardNotificationPlans", () => {
    it("one grouped notification per owner, linking the first horse's stable page", () => {
        const plans = buildCardNotificationPlans({
            cards: [
                { horseId: "h1", ownerId: "alice" },
                { horseId: "h2", ownerId: "alice" },
                { horseId: "h3", ownerId: "bob" },
            ],
            horseNamesById,
        });
        expect(plans).toHaveLength(2);
        const alice = plans.find((p) => p.userId === "alice");
        expect(alice).toMatchObject({
            type: "show_card",
            actorId: null,
            horseId: "h1",
            linkUrl: "/stable/h1",
        });
        expect(alice?.content).toContain("Ruffian, Maple");
        expect(alice?.content).toContain("2 MHH Qualification Cards");
        const bob = plans.find((p) => p.userId === "bob");
        expect(bob?.content).toBe("🎖️ Dude earned an MHH Qualification Card");
    });

    it("two cards on the SAME horse still read as one horse", () => {
        const [plan] = buildCardNotificationPlans({
            cards: [
                { horseId: "h1", ownerId: "alice" },
                { horseId: "h1", ownerId: "alice" },
            ],
            horseNamesById,
        });
        expect(plan.content).toBe("🎖️ Ruffian earned 2 MHH Qualification Cards");
    });
});

describe("buildStaffAddedPlan", () => {
    const base = {
        showId: "show-1",
        showTitle: "Summer Classic",
        userId: "judge-1",
        addedByUserId: "host-1",
        addedByAlias: "maggie",
    };

    it("judges deep-link to the judge queue", () => {
        const plan = buildStaffAddedPlan({ ...base, role: "judge" });
        expect(plan).toMatchObject({
            userId: "judge-1",
            type: "show_staff",
            actorId: "host-1",
            linkUrl: "/shows/host/show-1/judge",
        });
        expect(plan.content).toBe("🤝 @maggie added you as judge for Summer Classic");
    });

    it("other roles land on the console, with a human role name", () => {
        const plan = buildStaffAddedPlan({ ...base, role: "co_host" });
        expect(plan.linkUrl).toBe("/shows/host/show-1");
        expect(plan.content).toContain("added you as co-host");
    });
});

describe("buildClassChangePlans", () => {
    it("split names old → new and notifies distinct moved owners", () => {
        const plans = buildClassChangePlans({
            showId: "show-1",
            showTitle: "Summer Classic",
            kind: "split",
            oldClassNames: ["Breed Halter"],
            newClassName: "Breed Halter — Stock",
            movedEntries: [
                { ownerId: "alice", status: "entered" },
                { ownerId: "alice", status: "entered" },
                { ownerId: "bob", status: "entered" },
            ],
        });
        expect(plans).toHaveLength(2);
        expect(plans[0]).toMatchObject({ type: "show_class_change", actorId: null });
        expect(plans[0].content).toContain('"Breed Halter" was split');
        expect(plans[0].content).toContain('"Breed Halter — Stock"');
    });

    it("combine lists every source class and skips scratched entries", () => {
        const plans = buildClassChangePlans({
            showId: "show-1",
            showTitle: "Summer Classic",
            kind: "combined",
            oldClassNames: ["Foals A", "Foals B"],
            newClassName: "Foals",
            movedEntries: [
                { ownerId: "alice", status: "entered" },
                { ownerId: "bob", status: "scratched" },
            ],
        });
        expect(plans).toHaveLength(1);
        expect(plans[0].userId).toBe("alice");
        expect(plans[0].content).toContain('"Foals A" and "Foals B" were combined into "Foals"');
    });
});

describe("buildVotingOpenPlans", () => {
    it("notifies distinct live entrants that voting opened", () => {
        const plans = buildVotingOpenPlans({
            showId: "show-1",
            showTitle: "Summer Classic",
            entries: [
                { ownerId: "alice", status: "entered" },
                { ownerId: "alice", status: "entered" },
                { ownerId: "bob", status: "scratched" },
            ],
        });
        expect(plans).toHaveLength(1);
        expect(plans[0]).toMatchObject({ userId: "alice", type: "show_voting_open", actorId: null });
        expect(plans[0].content).toContain("Community voting is open");
    });
});

describe("buildEntryScratchedPlan", () => {
    it("carries the reason and the staff actor", () => {
        const plan = buildEntryScratchedPlan({
            showId: "show-1",
            showTitle: "Summer Classic",
            ownerId: "alice",
            horseName: "Ruffian",
            className: "Breed Halter",
            scratchedByUserId: "host-1",
            reason: "Wrong class — host will re-enter",
        });
        expect(plan).toMatchObject({
            userId: "alice",
            type: "show_entry_scratched",
            actorId: "host-1",
            linkUrl: "/shows/show-1",
        });
        expect(plan.content).toContain("Ruffian");
        expect(plan.content).toContain("Reason: Wrong class — host will re-enter");
    });

    it("omits the reason clause when none was given", () => {
        const plan = buildEntryScratchedPlan({
            showId: "show-1",
            showTitle: "Summer Classic",
            ownerId: "alice",
            horseName: "Ruffian",
            className: "Breed Halter",
            scratchedByUserId: "host-1",
            reason: null,
        });
        expect(plan.content).not.toContain("Reason:");
    });
});

describe("deriveAnnouncementRecipients", () => {
    it("distinct owners of live entries, first-entry order, scratched dropped", () => {
        expect(
            deriveAnnouncementRecipients([
                { ownerId: "bob", status: "entered" },
                { ownerId: "alice", status: "entered" },
                { ownerId: "bob", status: "placed" },
                { ownerId: "carol", status: "scratched" },
            ]),
        ).toEqual(["bob", "alice"]);
    });

    it("is empty for a show with no live entries", () => {
        expect(
            deriveAnnouncementRecipients([{ ownerId: "carol", status: "scratched" }]),
        ).toEqual([]);
    });
});

describe("buildAnnouncementPlans", () => {
    it("stamps the host as actor so the self-guard drops their own row", () => {
        const plans = buildAnnouncementPlans({
            showId: "show-1",
            showTitle: "Summer Classic",
            hostUserId: "host-1",
            hostAlias: "maggie",
            message: "Ring 2 starts at noon.",
            recipientIds: ["alice", "host-1"],
        });
        expect(plans).toHaveLength(2);
        expect(plans[0]).toMatchObject({
            type: "show_announcement",
            actorId: "host-1",
            linkUrl: "/shows/show-1",
        });
        expect(plans[0].content).toBe("📣 @maggie (Summer Classic): Ring 2 starts at noon.");
    });
});

describe("buildDeadlinePlans / isClosingWithin24h", () => {
    it("builds a system nudge per recipient", () => {
        const plans = buildDeadlinePlans({
            showId: "show-1",
            showTitle: "Summer Classic",
            recipientIds: ["alice", "bob"],
        });
        expect(plans).toHaveLength(2);
        expect(plans[0]).toMatchObject({
            type: "show_deadline",
            actorId: null,
            linkUrl: "/shows/show-1",
        });
        expect(plans[0].content).toContain("close in less than 24 hours");
    });

    it("windows the reminder to (now, now+24h]", () => {
        const now = new Date("2026-08-01T12:00:00Z");
        expect(isClosingWithin24h("2026-08-01T13:00:00Z", now)).toBe(true);
        expect(isClosingWithin24h("2026-08-02T12:00:00Z", now)).toBe(true); // exactly 24h
        expect(isClosingWithin24h("2026-08-02T12:00:01Z", now)).toBe(false); // beyond
        expect(isClosingWithin24h("2026-08-01T11:59:59Z", now)).toBe(false); // already closed
        expect(isClosingWithin24h(null, now)).toBe(false);
        expect(isClosingWithin24h("not-a-date", now)).toBe(false);
    });
});

describe("Batch 2 schema additions", () => {
    it("scratchEntrySchema accepts an optional short reason and rejects a long one", () => {
        const entryId = "6b2e0d3c-2222-4444-8888-aaaaaaaaaaaa";
        expect(scratchEntrySchema.safeParse({ entryId }).success).toBe(true);
        expect(
            scratchEntrySchema.safeParse({ entryId, reason: "double-entered" }).success,
        ).toBe(true);
        expect(
            scratchEntrySchema.safeParse({ entryId, reason: "x".repeat(201) }).success,
        ).toBe(false);
    });

    it("announceToEntrantsSchema bounds the message to 1–1000 chars", () => {
        const showId = "6b2e0d3c-2222-4444-8888-aaaaaaaaaaaa";
        expect(
            announceToEntrantsSchema.safeParse({ showId, message: "Ring 2 at noon." }).success,
        ).toBe(true);
        expect(announceToEntrantsSchema.safeParse({ showId, message: "  " }).success).toBe(false);
        expect(
            announceToEntrantsSchema.safeParse({ showId, message: "x".repeat(1001) }).success,
        ).toBe(false);
    });
});
