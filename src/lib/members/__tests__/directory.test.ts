import { describe, expect, it } from "vitest";

import {
    aliasIlikePattern,
    buildMemberSearchParams,
    DEFAULT_MEMBER_SORT,
    formatLastActive,
    formatMemberSince,
    formatPublicModelCount,
    latestActivityByUser,
    MEMBERS_PAGE_SIZE,
    membersHref,
    pageSlice,
    parseMemberSearchParams,
    pickTopBadges,
    sanitizeAliasQuery,
    sortMemberRoster,
    totalPagesFor,
    type MemberRosterEntry,
} from "../directory";

describe("sanitizeAliasQuery — the search box cannot smuggle wildcards", () => {
    it("returns empty for nothing", () => {
        expect(sanitizeAliasQuery(undefined)).toBe("");
        expect(sanitizeAliasQuery("   ")).toBe("");
    });

    it("strips SQL LIKE wildcards and PostgREST's star", () => {
        // PostgREST rewrites * to % after our value is on the wire, so a
        // backslash escape would not help — these have to go.
        expect(sanitizeAliasQuery("%")).toBe("");
        expect(sanitizeAliasQuery("a_b")).toBe("a b");
        expect(sanitizeAliasQuery("*maggie*")).toBe("maggie");
        expect(sanitizeAliasQuery("back\\slash")).toBe("back slash");
    });

    it("collapses whitespace and trims", () => {
        expect(sanitizeAliasQuery("  amanda   b  ")).toBe("amanda b");
    });

    it("caps the length", () => {
        expect(sanitizeAliasQuery("x".repeat(200))).toHaveLength(60);
    });
});

describe("aliasIlikePattern", () => {
    it("matches anywhere in the alias", () => {
        expect(aliasIlikePattern("mag")).toBe("%mag%");
    });
});

describe("parseMemberSearchParams", () => {
    it("defaults to recently active, page 1, no search", () => {
        expect(parseMemberSearchParams({})).toEqual({ sort: "active", page: 1 });
        expect(DEFAULT_MEMBER_SORT).toBe("active");
    });

    it("keeps a real search but drops a one-character one", () => {
        expect(parseMemberSearchParams({ q: "am" }).q).toBe("am");
        expect(parseMemberSearchParams({ q: "a" }).q).toBeUndefined();
    });

    it("sanitizes the search before accepting it", () => {
        expect(parseMemberSearchParams({ q: "%%mag%%" }).q).toBe("mag");
    });

    it("ignores a sort outside the vocabulary", () => {
        expect(parseMemberSearchParams({ sort: "az" }).sort).toBe("az");
        expect(parseMemberSearchParams({ sort: "shoe-size" }).sort).toBe("active");
    });

    it("clamps the page", () => {
        expect(parseMemberSearchParams({ page: "0" }).page).toBe(1);
        expect(parseMemberSearchParams({ page: "-4" }).page).toBe(1);
        expect(parseMemberSearchParams({ page: "nope" }).page).toBe(1);
        expect(parseMemberSearchParams({ page: "3" }).page).toBe(3);
        expect(parseMemberSearchParams({ page: "9999999" }).page).toBe(10_000);
    });

    it("takes the first value of a repeated param", () => {
        expect(parseMemberSearchParams({ q: ["mag", "other"] }).q).toBe("mag");
    });
});

describe("buildMemberSearchParams / membersHref", () => {
    it("omits every default so /discover stays canonical", () => {
        expect(buildMemberSearchParams({ sort: "active", page: 1 }).toString()).toBe("");
        expect(membersHref({ sort: "active", page: 1 })).toBe("/discover");
    });

    it("round-trips a real browse state", () => {
        const filters = parseMemberSearchParams({ q: "mag", sort: "newest", page: "4" });
        expect(membersHref(filters)).toBe("/discover?q=mag&sort=newest&page=4");
        expect(parseMemberSearchParams({ q: "mag", sort: "newest", page: "4" })).toEqual(filters);
    });
});

describe("latestActivityByUser — the last-seen proxy", () => {
    it("keeps the newest ping per person regardless of row order", () => {
        const map = latestActivityByUser([
            { userId: "a", at: "2026-08-01T00:00:00Z" },
            { userId: "b", at: "2026-07-01T00:00:00Z" },
            { userId: "a", at: "2026-08-19T00:00:00Z" },
            { userId: "a", at: "2026-05-01T00:00:00Z" },
        ]);
        expect(map.get("a")).toBe("2026-08-19T00:00:00Z");
        expect(map.get("b")).toBe("2026-07-01T00:00:00Z");
    });

    it("skips rows missing either half", () => {
        const map = latestActivityByUser([
            { userId: null, at: "2026-08-01T00:00:00Z" },
            { userId: "a", at: null },
            { userId: undefined, at: undefined },
        ]);
        expect(map.size).toBe(0);
    });
});

describe("sortMemberRoster", () => {
    const roster: MemberRosterEntry[] = [
        { id: "1", aliasName: "Zoe", createdAt: "2024-01-01T00:00:00Z" },
        { id: "2", aliasName: "amanda", createdAt: "2026-01-01T00:00:00Z" },
        { id: "3", aliasName: "Maggie", createdAt: "2025-01-01T00:00:00Z" },
    ];

    it("does not mutate its input", () => {
        const copy = [...roster];
        sortMemberRoster(roster, "az");
        expect(roster).toEqual(copy);
    });

    it("sorts A–Z case-insensitively", () => {
        expect(sortMemberRoster(roster, "az").map((e) => e.aliasName)).toEqual([
            "amanda",
            "Maggie",
            "Zoe",
        ]);
    });

    it("sorts newest-signup first", () => {
        expect(sortMemberRoster(roster, "newest").map((e) => e.id)).toEqual(["2", "3", "1"]);
    });

    it("puts recently active people first, then the quiet ones by join date", () => {
        const lastActive = new Map([
            ["1", "2026-08-18T00:00:00Z"],
            ["3", "2026-08-19T00:00:00Z"],
        ]);
        // 3 pinged most recently, then 1; 2 has no ping so it falls to the
        // tail — but it is still IN the list, so paging reaches everyone.
        expect(sortMemberRoster(roster, "active", lastActive).map((e) => e.id)).toEqual([
            "3",
            "1",
            "2",
        ]);
    });

    it("degrades to newest-first when nobody has pinged", () => {
        expect(sortMemberRoster(roster, "active", new Map()).map((e) => e.id)).toEqual([
            "2",
            "3",
            "1",
        ]);
        expect(sortMemberRoster(roster, "active").map((e) => e.id)).toEqual(["2", "3", "1"]);
    });

    it("breaks ties deterministically so nobody straddles two pages", () => {
        const tied: MemberRosterEntry[] = [
            { id: "b", aliasName: "Same", createdAt: "2026-01-01T00:00:00Z" },
            { id: "a", aliasName: "Same", createdAt: "2026-01-01T00:00:00Z" },
        ];
        expect(sortMemberRoster(tied, "az").map((e) => e.id)).toEqual(["a", "b"]);
        expect(sortMemberRoster(tied, "newest").map((e) => e.id)).toEqual(["a", "b"]);
        const sameActive = new Map([
            ["a", "2026-08-01T00:00:00Z"],
            ["b", "2026-08-01T00:00:00Z"],
        ]);
        expect(sortMemberRoster(tied, "active", sameActive).map((e) => e.id)).toEqual(["a", "b"]);
    });
});

describe("pageSlice / totalPagesFor", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);

    it("slices the requested page", () => {
        expect(pageSlice(items, 1, 24)).toHaveLength(24);
        expect(pageSlice(items, 3, 24)).toEqual([48, 49]);
        expect(pageSlice(items, 9, 24)).toEqual([]);
    });

    it("treats a bad page as the first one", () => {
        expect(pageSlice(items, 0, 24)[0]).toBe(0);
    });

    it("never reports zero pages", () => {
        expect(totalPagesFor(0)).toBe(1);
        expect(totalPagesFor(-5)).toBe(1);
        expect(totalPagesFor(24)).toBe(1);
        expect(totalPagesFor(25)).toBe(2);
        expect(MEMBERS_PAGE_SIZE).toBe(24);
    });
});

describe("card copy", () => {
    it("formats member-since", () => {
        expect(formatMemberSince("2024-03-15T00:00:00Z")).toBe("Member since Mar 2024");
        expect(formatMemberSince(null)).toBeNull();
        expect(formatMemberSince("not a date")).toBeNull();
    });

    it("formats last-active relative to now", () => {
        const now = new Date("2026-08-20T12:00:00Z");
        expect(formatLastActive("2026-08-20T09:00:00Z", now)).toBe("Active today");
        expect(formatLastActive("2026-08-19T09:00:00Z", now)).toBe("Active yesterday");
        expect(formatLastActive("2026-08-17T09:00:00Z", now)).toBe("Active 3 days ago");
        expect(formatLastActive("2026-08-12T09:00:00Z", now)).toBe("Active last week");
        expect(formatLastActive("2026-08-01T09:00:00Z", now)).toBe("Active 2 weeks ago");
        expect(formatLastActive("2026-06-01T09:00:00Z", now)).toBe("Active in Jun 2026");
    });

    it("says nothing when there is no ping", () => {
        expect(formatLastActive(null)).toBeNull();
        expect(formatLastActive("garbage")).toBeNull();
    });

    it("counts public models, and admits when there are none", () => {
        expect(formatPublicModelCount(0)).toBe("No public models yet");
        expect(formatPublicModelCount(1)).toBe("1 public model");
        expect(formatPublicModelCount(1200)).toBe("1,200 public models");
        expect(formatPublicModelCount(Number.NaN)).toBe("No public models yet");
    });
});

describe("pickTopBadges", () => {
    const badges = [
        { id: "a", name: "Herd Builder", icon: "🐴", tier: 1 },
        { id: "b", name: "Shutterbug", icon: "📷", tier: 3 },
        { id: "c", name: "First Sale", icon: "💰", tier: 2 },
        { id: "d", name: "Show Debut", icon: "🏆", tier: 3 },
    ];

    it("shows the rarest first, ties broken by name", () => {
        // b and d are both tier 3; "Show Debut" sorts before "Shutterbug".
        expect(pickTopBadges(badges).map((b) => b.id)).toEqual(["d", "b", "c"]);
    });

    it("respects the limit and does not mutate", () => {
        const copy = [...badges];
        expect(pickTopBadges(badges, 1)).toHaveLength(1);
        expect(badges).toEqual(copy);
    });

    it("treats a null tier as the lowest", () => {
        const withNull = [
            { id: "n", name: "Mystery", icon: "❓", tier: null },
            { id: "t", name: "Tiered", icon: "⭐", tier: 1 },
        ];
        expect(pickTopBadges(withNull).map((b) => b.id)).toEqual(["t", "n"]);
    });

    it("handles an empty case", () => {
        expect(pickTopBadges([])).toEqual([]);
    });
});
