import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";
import { getPublicImageUrl } from "@/lib/utils/storage";

/**
 * getPublicShowResults — the legacy public results page.
 *
 * This action used to be a nested N+1: divisions → per-division classes
 * → per-class entries + horses + thumbnails, all sequential. A
 * 10-division × 8-class show was ~250 queries on an unauthenticated,
 * crawlable page. It is now 5 batched reads grouped in JS, behind an
 * unstable_cache keyed by eventId.
 *
 * These tests pin BOTH halves of that: the query count (so the fan-out
 * cannot creep back) and the assembled shape (so the flattening is
 * proven to produce what the per-class build produced).
 */

// ── A table-routing admin mock. The shared helper hands every table
//    the same query object, which cannot express a six-table read. ──

interface TableResult {
    data?: unknown;
    count?: number | null;
    error?: unknown;
}

const fromCalls: string[] = [];
/** Queued results per table; the last entry repeats once exhausted. */
let tableResults: Record<string, TableResult[]> = {};

function nextResult(table: string): TableResult {
    const queue = tableResults[table];
    if (!queue || queue.length === 0) return { data: [], count: 0, error: null };
    return queue.length > 1 ? (queue.shift() as TableResult) : queue[0];
}

const mockAdmin = {
    from: vi.fn((table: string) => {
        fromCalls.push(table);
        const spec = nextResult(table);
        const settled = {
            data: spec.data ?? null,
            count: spec.count ?? null,
            error: spec.error ?? null,
        };
        const q: Record<string, unknown> = {};
        for (const method of ["select", "eq", "in", "is", "not", "order", "limit"]) {
            q[method] = vi.fn(() => q);
        }
        q.single = vi.fn(() => Promise.resolve(settled));
        q.maybeSingle = vi.fn(() => Promise.resolve(settled));
        q.then = (resolve: (v: unknown) => void) => Promise.resolve(settled).then(resolve);
        return q;
    }),
};

const mockClient = createMockSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));
vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => mockAdmin),
}));
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
    // Pass-through: the cache wrapper is Next's job, not this suite's.
    unstable_cache: <T>(fn: T) => fn,
}));
vi.mock("next/server", () => ({
    after: vi.fn((fn: () => void) => fn()),
}));
vi.mock("@/lib/notifications/createNotification", () => ({
    createNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/app/actions/achievements", () => ({
    evaluateAchievements: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getPublicShowResults } from "@/app/actions/shows";

const CLOSED_EVENT = {
    id: "event-1",
    name: "Autumn Gold Live",
    event_type: "live_show",
    show_status: "closed",
    starts_at: "2026-09-12T00:00:00.000Z",
    ends_at: null,
    created_by: "host-1",
    sanctioning_body: "namhsa",
    users: { alias_name: "AutumnGoldCrew" },
};

beforeEach(() => {
    vi.clearAllMocks();
    fromCalls.length = 0;
    tableResults = {};
});

describe("getPublicShowResults — the flattened public results build", () => {
    it("returns null for a show that has not closed, and never runs the heavy load", async () => {
        tableResults = {
            events: [{ data: { ...CLOSED_EVENT, show_status: "judging" } }],
        };

        expect(await getPublicShowResults("event-1")).toBeNull();
        // The status gate is the ONLY query on this path.
        expect(fromCalls).toEqual(["events"]);
    });

    it("returns null when the event row is missing", async () => {
        tableResults = { events: [{ data: null }] };
        expect(await getPublicShowResults("nope")).toBeNull();
        expect(fromCalls).toEqual(["events"]);
    });

    it("assembles divisions → classes → placing-sorted results in a fixed number of batched reads", async () => {
        // A 2-division × 2-class show. The old build issued
        // 1 (event) + 1 (divisions) + 2 (classes) + 4×3 (entries, horses,
        // thumbs per class) + 1 (count) = 17 sequential queries for this
        // fixture; the shape scaled at ~3 per class.
        tableResults = {
            events: [{ data: CLOSED_EVENT }],
            event_divisions: [
                {
                    data: [
                        { id: "div-1", name: "Original Finish", sort_order: 0 },
                        { id: "div-2", name: "Custom Glaze", sort_order: 1 },
                    ],
                },
            ],
            event_classes: [
                {
                    data: [
                        { id: "cls-1", name: "Stock Breeds", class_number: "1", division_id: "div-1", sort_order: 0 },
                        { id: "cls-2", name: "Sport Horse", class_number: "2", division_id: "div-1", sort_order: 1 },
                        { id: "cls-3", name: "Glaze Champion", class_number: "3", division_id: "div-2", sort_order: 0 },
                        { id: "cls-4", name: "Empty Class", class_number: "4", division_id: "div-2", sort_order: 1 },
                    ],
                },
            ],
            event_entries: [
                // 1. the placed-entry batch — deliberately NOT in place order
                {
                    data: [
                        { id: "e1", horse_id: "horse-a", class_id: "cls-1", user_id: "u1", placing: "2nd", users: { alias_name: "Ann" } },
                        { id: "e2", horse_id: "horse-b", class_id: "cls-1", user_id: "u2", placing: "Champion", users: [{ alias_name: "Bea" }] },
                        { id: "e3", horse_id: "horse-c", class_id: "cls-2", user_id: "u3", placing: "1st", users: null },
                        // horse-d went private after competing
                        { id: "e4", horse_id: "horse-d", class_id: "cls-3", user_id: "u4", placing: "HM", users: { alias_name: "Dot" } },
                        // an entry whose class was deleted — no class_id
                        { id: "e5", horse_id: "horse-a", class_id: null, user_id: "u1", placing: "1st", users: { alias_name: "Ann" } },
                    ],
                },
                // 2. the totalEntries head-count
                { data: null, count: 12 },
            ],
            user_horses: [
                {
                    data: [
                        { id: "horse-a", custom_name: "Amber" },
                        { id: "horse-b", custom_name: "Basil" },
                        { id: "horse-c", custom_name: "Cedar" },
                        // horse-d filtered out by the visibility/deleted_at guard
                    ],
                },
            ],
            horse_images: [
                {
                    data: [
                        { horse_id: "horse-a", image_url: "horse-images/a-side.webp", angle_profile: "Left_Side" },
                        { horse_id: "horse-a", image_url: "horse-images/a-thumb.webp", angle_profile: "Primary_Thumbnail" },
                        { horse_id: "horse-c", image_url: "horse-images/c-only.webp", angle_profile: "Right_Side" },
                    ],
                },
            ],
        };

        const result = await getPublicShowResults("event-1");
        expect(result).not.toBeNull();
        if (!result) return;

        // ── The query budget: six tables, seven reads, no per-class fan-out.
        expect(fromCalls).toHaveLength(7);
        expect(fromCalls.filter((t) => t === "event_entries")).toHaveLength(2);
        expect(fromCalls.filter((t) => t === "event_classes")).toHaveLength(1);
        expect(fromCalls.filter((t) => t === "user_horses")).toHaveLength(1);
        expect(fromCalls.filter((t) => t === "horse_images")).toHaveLength(1);

        // ── The event header is unchanged.
        expect(result.event).toEqual({
            id: "event-1",
            name: "Autumn Gold Live",
            date: new Date(CLOSED_EVENT.starts_at).toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric",
            }),
            host: "AutumnGoldCrew",
            type: "live_show",
            isSanctioned: true,
            sanctioningBody: "namhsa",
            status: "closed",
        });

        // ── Every class is counted, including the one with no entries.
        expect(result.totalClasses).toBe(4);
        expect(result.totalEntries).toBe(12);

        expect(result.divisions).toEqual([
            {
                name: "Original Finish",
                classes: [
                    {
                        name: "Stock Breeds",
                        classNumber: "1",
                        results: [
                            // Champion outranks 2nd regardless of row order
                            {
                                placement: "Champion",
                                horseName: "Basil",
                                ownerAlias: "Bea",
                                thumbnailUrl: null,
                            },
                            {
                                placement: "2nd",
                                horseName: "Amber",
                                ownerAlias: "Ann",
                                // Primary_Thumbnail wins over the other angle
                                thumbnailUrl: getPublicImageUrl("horse-images/a-thumb.webp"),
                            },
                        ],
                    },
                    {
                        name: "Sport Horse",
                        classNumber: "2",
                        results: [
                            {
                                placement: "1st",
                                horseName: "Cedar",
                                // a null embed still reads "Unknown"
                                ownerAlias: "Unknown",
                                // only image on the horse, so it is the thumb
                                thumbnailUrl: getPublicImageUrl("horse-images/c-only.webp"),
                            },
                        ],
                    },
                ],
            },
            {
                name: "Custom Glaze",
                classes: [
                    {
                        name: "Glaze Champion",
                        classNumber: "3",
                        results: [
                            {
                                placement: "HM",
                                // horse-d went private: name and photo must NOT leak
                                horseName: "Unknown",
                                ownerAlias: "Dot",
                                thumbnailUrl: null,
                            },
                        ],
                    },
                    { name: "Empty Class", classNumber: "4", results: [] },
                ],
            },
        ]);
    });

    it("falls back to one General/Overall bucket, without thumbnails, when the show has no divisions", async () => {
        tableResults = {
            events: [{ data: CLOSED_EVENT }],
            event_divisions: [{ data: [] }],
            event_entries: [
                {
                    data: [
                        { id: "e1", horse_id: "horse-a", class_id: null, user_id: "u1", placing: "3rd", users: { alias_name: "Ann" } },
                        { id: "e2", horse_id: "horse-b", class_id: null, user_id: "u2", placing: "Grand Champion", users: { alias_name: "Bea" } },
                    ],
                },
                { data: null, count: 2 },
            ],
            user_horses: [
                { data: [{ id: "horse-a", custom_name: "Amber" }, { id: "horse-b", custom_name: "Basil" }] },
            ],
            horse_images: [
                { data: [{ horse_id: "horse-a", image_url: "horse-images/a-thumb.webp", angle_profile: "Primary_Thumbnail" }] },
            ],
        };

        const result = await getPublicShowResults("event-1");
        expect(result).not.toBeNull();
        if (!result) return;

        // No divisions → no event_classes read at all.
        expect(fromCalls).not.toContain("event_classes");
        expect(result.totalClasses).toBe(1);
        expect(result.divisions).toEqual([
            {
                name: "General",
                classes: [
                    {
                        name: "Overall",
                        classNumber: null,
                        results: [
                            { placement: "Grand Champion", horseName: "Basil", ownerAlias: "Bea", thumbnailUrl: null },
                            // this branch never rendered thumbnails, even
                            // when the horse has one
                            { placement: "3rd", horseName: "Amber", ownerAlias: "Ann", thumbnailUrl: null },
                        ],
                    },
                ],
            },
        ]);
    });

    it("returns an empty ledger, not a crash, when a closed show has no placed entries", async () => {
        tableResults = {
            events: [{ data: CLOSED_EVENT }],
            event_divisions: [{ data: [] }],
            event_entries: [{ data: [] }, { data: null, count: 0 }],
        };

        const result = await getPublicShowResults("event-1");
        expect(result).not.toBeNull();
        if (!result) return;
        expect(result.divisions).toEqual([]);
        expect(result.totalClasses).toBe(0);
        expect(result.totalEntries).toBe(0);
        // Nothing to look up → no horse or image read is issued.
        expect(fromCalls).not.toContain("user_horses");
        expect(fromCalls).not.toContain("horse_images");
    });
});
