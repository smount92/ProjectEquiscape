import { describe, expect, it } from "vitest";

import type { PublicShowSummary } from "@/lib/shows/public";
import {
    buildCalendarMonths,
    buildMonthGrid,
    closesSoon,
    filterByVenue,
    fromCommunityEvent,
    fromExternalShow,
    fromMhhShow,
    isMonthKey,
    monthLabel,
    shiftMonth,
    shortDate,
    type ApprovedExternalShow,
    type CalendarEntry,
    type CommunityEventLike,
} from "@/lib/external-shows/calendar";

const TODAY = "2026-08-01";

function makeMhhShow(overrides: Partial<PublicShowSummary> = {}): PublicShowSummary {
    return {
        id: "mhh-1",
        title: "MHH Summer Classic",
        mode: "online",
        judging: "judged",
        status: "entries_open",
        hostAlias: "maggie",
        showDate: null,
        showYear: null,
        venueName: null,
        entriesOpenAt: "2026-08-01T00:00:00Z",
        entriesCloseAt: "2026-08-20T23:59:00Z",
        judgingEndsAt: null,
        isMhhQualifying: true,
        classCount: 12,
        entryCount: 40,
        createdAt: "2026-07-01T00:00:00Z",
        ...overrides,
    };
}

function makeExternal(overrides: Partial<ApprovedExternalShow> = {}): ApprovedExternalShow {
    return {
        id: "ext-1",
        title: "Prairie Live Show",
        url: "https://example.com/show",
        venue_type: "live",
        host_name: "Prairie Model Horse Club",
        platform: "facebook",
        starts_on: "2026-08-15",
        entries_close_on: null,
        location: "Lincoln, NE",
        description: "Two rings, NAN cards.",
        ...overrides,
    };
}

function makeEvent(overrides: Partial<CommunityEventLike> = {}): CommunityEventLike {
    return {
        id: "evt-1",
        name: "Twin Cities Hobby Lunch",
        description: "Bring a box, bring a friend.",
        eventType: "meetup",
        startsAt: "2026-09-12T17:00:00+00:00",
        isVirtual: false,
        locationName: "The Blue Barn",
        region: "Minnesota",
        creatorAlias: "kestrel",
        ...overrides,
    };
}

describe("fromMhhShow", () => {
    it("places an online show on its entries-close date", () => {
        const entry = fromMhhShow(makeMhhShow());
        expect(entry).not.toBeNull();
        expect(entry!.date).toBe("2026-08-20");
        expect(entry!.venue).toBe("online_photo");
        expect(entry!.href).toBe("/shows/mhh-1");
        expect(entry!.outbound).toBe(false);
        expect(entry!.platformLabel).toBe("MHH");
        expect(entry!.hostLabel).toBe("@maggie");
    });

    it("places a live show on its show date", () => {
        const entry = fromMhhShow(
            makeMhhShow({ mode: "live", showDate: "2026-09-05", entriesCloseAt: null }),
        );
        expect(entry!.date).toBe("2026-09-05");
        expect(entry!.venue).toBe("live");
    });

    it("falls back to showDate for an online show without a close date", () => {
        const entry = fromMhhShow(
            makeMhhShow({ entriesCloseAt: null, showDate: "2026-08-10" }),
        );
        expect(entry!.date).toBe("2026-08-10");
    });

    it("excludes completed shows (history, not calendar)", () => {
        expect(fromMhhShow(makeMhhShow({ status: "completed" }))).toBeNull();
    });

    it("excludes shows with no usable date", () => {
        expect(fromMhhShow(makeMhhShow({ entriesCloseAt: null, showDate: null }))).toBeNull();
    });
});

describe("fromExternalShow", () => {
    it("maps an external row to an outbound entry", () => {
        const entry = fromExternalShow(makeExternal());
        expect(entry.kind).toBe("external");
        expect(entry.date).toBe("2026-08-15");
        expect(entry.href).toBe("https://example.com/show");
        expect(entry.outbound).toBe(true);
        expect(entry.platformLabel).toBe("Facebook");
        expect(entry.hostLabel).toBe("Prairie Model Horse Club");
        expect(entry.location).toBe("Lincoln, NE");
    });

    it("labels the known platforms", () => {
        expect(fromExternalShow(makeExternal({ platform: "omhps" })).platformLabel).toBe("OMHPS");
        expect(fromExternalShow(makeExternal({ platform: "mepsa" })).platformLabel).toBe("MEPSA");
        expect(fromExternalShow(makeExternal({ platform: "website" })).platformLabel).toBe("Website");
        expect(fromExternalShow(makeExternal({ platform: "other" })).platformLabel).toBe("Community");
    });
});

describe("fromCommunityEvent — the events board on the calendar", () => {
    it("maps a gathering to an internal entry on its start date", () => {
        const entry = fromCommunityEvent(makeEvent());
        expect(entry).not.toBeNull();
        expect(entry!.kind).toBe("event");
        expect(entry!.date).toBe("2026-09-12");
        expect(entry!.href).toBe("/community/events/evt-1");
        expect(entry!.outbound).toBe(false);
        expect(entry!.hostLabel).toBe("@kestrel");
        expect(entry!.location).toBe("The Blue Barn");
    });

    it("never captions a gathering as a show", () => {
        const meetup = fromCommunityEvent(makeEvent())!;
        expect(meetup.venueLabel).toBe("In-person gathering");
        expect(meetup.kindLabel).toBe("Meetup");
        expect(meetup.platformLabel).toBe("Meetup");

        const online = fromCommunityEvent(makeEvent({ isVirtual: true, eventType: "workshop" }))!;
        expect(online.venueLabel).toBe("Online gathering");
        expect(online.kindLabel).toBe("Workshop");
    });

    it("keeps show vocabulary for events that really are shows", () => {
        const external = fromCommunityEvent(makeEvent({ eventType: "external_show" }))!;
        expect(external.venueLabel).toBe("Live show");
        expect(external.kindLabel).toBe("External Show");

        const legacy = fromCommunityEvent(
            makeEvent({ eventType: "photo_show", isVirtual: true }),
        )!;
        expect(legacy.venueLabel).toBe("Online show");
    });

    it("buckets virtual events online and in-person events live for the filter", () => {
        expect(fromCommunityEvent(makeEvent({ isVirtual: true }))!.venue).toBe("online_photo");
        expect(fromCommunityEvent(makeEvent({ isVirtual: false }))!.venue).toBe("live");
    });

    it("drops the location for a virtual event and falls back to region", () => {
        expect(fromCommunityEvent(makeEvent({ isVirtual: true }))!.location).toBeNull();
        expect(
            fromCommunityEvent(makeEvent({ locationName: null }))!.location,
        ).toBe("Minnesota");
    });

    it("never wears the closes-soon stamp — events have no entry deadline", () => {
        const entry = fromCommunityEvent(makeEvent())!;
        expect(entry.entriesCloseOn).toBeNull();
        expect(closesSoon(entry, TODAY)).toBe(false);
    });

    it("returns null for an unparseable start", () => {
        expect(fromCommunityEvent(makeEvent({ startsAt: "" }))).toBeNull();
        expect(fromCommunityEvent(makeEvent({ startsAt: "sometime in fall" }))).toBeNull();
    });

    it("merges into the same shelves as shows", () => {
        const entries = [
            fromExternalShow(makeExternal({ id: "ext", starts_on: "2026-09-20" })),
            fromCommunityEvent(makeEvent({ id: "evt" }))!, // 2026-09-12
        ];
        const months = buildCalendarMonths(entries, TODAY);
        expect(months).toHaveLength(1);
        expect(months[0].entries.map((e) => e.id)).toEqual(["evt", "ext"]);
    });
});

describe("buildCalendarMonths — the merged calendar", () => {
    it("merges MHH and external entries chronologically across sources", () => {
        const entries = [
            fromExternalShow(makeExternal({ id: "e1", starts_on: "2026-08-15" })),
            fromMhhShow(makeMhhShow({ id: "m1" }))!, // 2026-08-20
            fromExternalShow(makeExternal({ id: "e2", starts_on: "2026-08-03", title: "Early Bird" })),
        ];
        const months = buildCalendarMonths(entries, TODAY);
        expect(months).toHaveLength(1);
        expect(months[0].entries.map((e) => e.id)).toEqual(["e2", "e1", "m1"]);
    });

    it("groups by month with readable labels and collapses empty months", () => {
        const entries = [
            fromExternalShow(makeExternal({ id: "aug", starts_on: "2026-08-15" })),
            fromExternalShow(makeExternal({ id: "oct", starts_on: "2026-10-02" })),
        ];
        const months = buildCalendarMonths(entries, TODAY);
        // September has nothing → it simply doesn't exist.
        expect(months.map((m) => m.key)).toEqual(["2026-08", "2026-10"]);
        expect(months.map((m) => m.label)).toEqual(["August 2026", "October 2026"]);
    });

    it("drops entries dated before today and keeps today", () => {
        const entries = [
            fromExternalShow(makeExternal({ id: "past", starts_on: "2026-07-31" })),
            fromExternalShow(makeExternal({ id: "today", starts_on: "2026-08-01" })),
        ];
        const months = buildCalendarMonths(entries, TODAY);
        expect(months).toHaveLength(1);
        expect(months[0].entries.map((e) => e.id)).toEqual(["today"]);
    });

    it("breaks same-day ties by title for a stable order", () => {
        const entries = [
            fromExternalShow(makeExternal({ id: "b", starts_on: "2026-08-15", title: "Zebra Show" })),
            fromExternalShow(makeExternal({ id: "a", starts_on: "2026-08-15", title: "Apple Show" })),
        ];
        const months = buildCalendarMonths(entries, TODAY);
        expect(months[0].entries.map((e) => e.id)).toEqual(["a", "b"]);
    });

    it("returns no months at all for an empty hobby weekend", () => {
        expect(buildCalendarMonths([], TODAY)).toEqual([]);
    });
});

describe("filterByVenue", () => {
    const entries: CalendarEntry[] = [
        fromExternalShow(makeExternal({ id: "live1", venue_type: "live" })),
        fromExternalShow(makeExternal({ id: "mail1", venue_type: "mail_in" })),
        fromMhhShow(makeMhhShow({ id: "online1" }))!,
    ];

    it("returns everything when no venue is chosen", () => {
        expect(filterByVenue(entries, undefined)).toHaveLength(3);
    });

    it("filters to a single venue type", () => {
        expect(filterByVenue(entries, "live").map((e) => e.id)).toEqual(["live1"]);
        expect(filterByVenue(entries, "mail_in").map((e) => e.id)).toEqual(["mail1"]);
        expect(filterByVenue(entries, "online_photo").map((e) => e.id)).toEqual(["online1"]);
    });
});

describe("closesSoon — the amber stamp", () => {
    function entryClosing(on: string | null): CalendarEntry {
        return fromExternalShow(makeExternal({ entries_close_on: on, starts_on: "2026-09-30" }));
    }

    it("stamps entries closing today", () => {
        expect(closesSoon(entryClosing("2026-08-01"), TODAY)).toBe(true);
    });

    it("stamps entries closing exactly 7 days out", () => {
        expect(closesSoon(entryClosing("2026-08-08"), TODAY)).toBe(true);
    });

    it("does not stamp entries closing 8 days out", () => {
        expect(closesSoon(entryClosing("2026-08-09"), TODAY)).toBe(false);
    });

    it("does not stamp already-closed entries", () => {
        expect(closesSoon(entryClosing("2026-07-31"), TODAY)).toBe(false);
    });

    it("does not stamp entries with no close date", () => {
        expect(closesSoon(entryClosing(null), TODAY)).toBe(false);
    });
});

describe("shortDate", () => {
    it("renders a compact deterministic day label", () => {
        expect(shortDate("2026-08-14")).toBe("Aug 14");
        expect(shortDate("2026-12-01")).toBe("Dec 1");
    });
});

describe("month key helpers", () => {
    it("accepts only well-formed YYYY-MM", () => {
        expect(isMonthKey("2026-08")).toBe(true);
        expect(isMonthKey("2026-12")).toBe(true);
        expect(isMonthKey("2026-13")).toBe(false);
        expect(isMonthKey("2026-00")).toBe(false);
        expect(isMonthKey("2026-8")).toBe(false);
        expect(isMonthKey("2026-08-01")).toBe(false);
        expect(isMonthKey(undefined)).toBe(false);
        expect(isMonthKey(null)).toBe(false);
    });

    it("labels a month readably", () => {
        expect(monthLabel("2026-08")).toBe("August 2026");
        expect(monthLabel("2027-01")).toBe("January 2027");
    });

    it("steps across year boundaries in both directions", () => {
        expect(shiftMonth("2026-08", 1)).toBe("2026-09");
        expect(shiftMonth("2026-12", 1)).toBe("2027-01");
        expect(shiftMonth("2026-01", -1)).toBe("2025-12");
        expect(shiftMonth("2026-06", 12)).toBe("2027-06");
        expect(shiftMonth("2026-06", -12)).toBe("2025-06");
    });
});

describe("buildMonthGrid — the shape of a month", () => {
    // August 2026 starts on a Saturday and has 31 days, so the grid
    // needs six leading blanks and spills into a sixth week.
    it("squares the month off into rows of exactly seven, Sunday-first", () => {
        const grid = buildMonthGrid([], "2026-08", TODAY);
        expect(grid.weeks.every((w) => w.length === 7)).toBe(true);
        expect(grid.weeks[0][0].date).toBe("2026-07-26");
        expect(grid.weeks[0][6].date).toBe("2026-08-01");
        expect(grid.weeks[0].filter((d) => d.inMonth)).toHaveLength(1);
        const last = grid.weeks[grid.weeks.length - 1];
        expect(last[last.length - 1].date).toBe("2026-09-05");
    });

    it("labels itself and knows its neighbours", () => {
        const grid = buildMonthGrid([], "2026-12", TODAY);
        expect(grid.label).toBe("December 2026");
        expect(grid.prevKey).toBe("2026-11");
        expect(grid.nextKey).toBe("2027-01");
    });

    it("files each entry onto its own day and counts the month", () => {
        const entries = [
            fromExternalShow(makeExternal({ id: "a", starts_on: "2026-08-15" })),
            fromExternalShow(makeExternal({ id: "b", starts_on: "2026-08-15", title: "Apple" })),
            fromExternalShow(makeExternal({ id: "c", starts_on: "2026-09-02" })),
        ];
        const grid = buildMonthGrid(entries, "2026-08", TODAY);
        const days = grid.weeks.flat();
        const aug15 = days.find((d) => d.date === "2026-08-15")!;
        // Same-day entries keep the list's stable title-then-id order.
        expect(aug15.entries.map((e) => e.id)).toEqual(["b", "a"]);
        // The September entry lands on a borrowed square, so it shows
        // but does not count towards the month.
        expect(grid.count).toBe(2);
        const sep2 = days.find((d) => d.date === "2026-09-02")!;
        expect(sep2.inMonth).toBe(false);
        expect(sep2.entries.map((e) => e.id)).toEqual(["c"]);
    });

    it("shows entries on borrowed squares from the neighbouring month", () => {
        const entries = [
            fromExternalShow(makeExternal({ id: "spill", starts_on: "2026-09-05" })),
        ];
        const grid = buildMonthGrid(entries, "2026-08", TODAY);
        const sep5 = grid.weeks.flat().find((d) => d.date === "2026-09-05")!;
        expect(sep5.inMonth).toBe(false);
        expect(sep5.entries.map((e) => e.id)).toEqual(["spill"]);
        expect(grid.count).toBe(0);
    });

    it("keeps the past — a grid is a picture of the month, not a queue", () => {
        const entries = [
            fromExternalShow(makeExternal({ id: "gone", starts_on: "2026-08-03" })),
        ];
        const grid = buildMonthGrid(entries, "2026-08", "2026-08-20");
        const aug3 = grid.weeks.flat().find((d) => d.date === "2026-08-03")!;
        expect(aug3.entries.map((e) => e.id)).toEqual(["gone"]);
        expect(aug3.isPast).toBe(true);
        expect(aug3.isToday).toBe(false);
        const aug20 = grid.weeks.flat().find((d) => d.date === "2026-08-20")!;
        expect(aug20.isToday).toBe(true);
        expect(aug20.isPast).toBe(false);
    });

    it("handles a leap February without a stray week", () => {
        const grid = buildMonthGrid([], "2028-02", TODAY);
        const inMonth = grid.weeks.flat().filter((d) => d.inMonth);
        expect(inMonth).toHaveLength(29);
        // 2028-02-01 is a Tuesday: 2 blanks + 29 days = 31 → 5 rows.
        expect(grid.weeks).toHaveLength(5);
    });

    it("mixes all three sources onto one month", () => {
        const entries = [
            fromMhhShow(makeMhhShow({ id: "m1" }))!, // 2026-08-20
            fromExternalShow(makeExternal({ id: "e1", starts_on: "2026-08-20", title: "AAA" })),
            fromCommunityEvent(makeEvent({ id: "v1", startsAt: "2026-08-20T18:00:00+00:00", name: "BBB" }))!,
        ];
        const grid = buildMonthGrid(entries, "2026-08", TODAY);
        const aug20 = grid.weeks.flat().find((d) => d.date === "2026-08-20")!;
        expect(aug20.entries.map((e) => e.kind)).toEqual(["external", "event", "mhh"]);
        expect(grid.count).toBe(3);
    });
});
