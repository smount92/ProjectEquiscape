import { describe, expect, it } from "vitest";

import type { PublicShowSummary } from "@/lib/shows/public";
import {
    buildCalendarMonths,
    closesSoon,
    filterByVenue,
    fromExternalShow,
    fromMhhShow,
    shortDate,
    type ApprovedExternalShow,
    type CalendarEntry,
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
