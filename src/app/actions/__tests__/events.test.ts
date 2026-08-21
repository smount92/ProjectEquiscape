import { vi, describe, it, expect, beforeEach, type Mock } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";
import { AuthError } from "@/lib/auth";

const mockClient = createMockSupabaseClient();
/** Typed view of the chainable query mocks. */
const q = mockClient._mockQuery as unknown as Record<string, Mock>;

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
}));
vi.mock("next/server", () => ({
    after: vi.fn((fn: () => void) => fn()),
}));

import { createEvent, getEvents, getEventAttendees } from "@/app/actions/events";

const VALID = {
    name: "MEPSA Autumn Championship",
    eventType: "external_show",
    startsAt: "2026-10-01T15:00:00.000Z",
};

/** The row handed to .insert() on the Nth call. */
function insertedRow(call = 0): Record<string, unknown> {
    return q.insert.mock.calls[call][0] as Record<string, unknown>;
}

/** The filter string handed to the Nth .or() call. */
function orClause(call = 0): string {
    return q.or.mock.calls[call][0] as string;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockClient._setImplicitResolve({ data: null, error: null });
    mockClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-1", email: "member@test.com" } },
    });
});

describe("createEvent — events are for OUTSIDE-MHH happenings", () => {
    it("rejects unauthenticated users", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        await expect(createEvent(VALID)).rejects.toThrow(AuthError);
    });

    it.each(["live_show", "photo_show"])(
        "refuses to create a %s — shows are hosted at /shows/host",
        async (eventType) => {
            const result = await createEvent({ ...VALID, eventType });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/\/shows\/host/);
            // The critical bit: nothing was written. A live_show row here
            // would be picked up by the legacy show system and the
            // transition cron as a real show that can never award anything.
            expect(mockClient.from).not.toHaveBeenCalled();
        },
    );

    it("refuses event types that aren't on the menu", async () => {
        const result = await createEvent({ ...VALID, eventType: "not_a_type" });
        expect(result.success).toBe(false);
        expect(mockClient.from).not.toHaveBeenCalled();
    });

    it("requires a name and a start", async () => {
        expect((await createEvent({ ...VALID, name: "   " })).success).toBe(false);
        expect((await createEvent({ ...VALID, startsAt: "" })).success).toBe(false);
        expect(mockClient.from).not.toHaveBeenCalled();
    });

    it("creates an external show and auto-RSVPs the lister", async () => {
        q.single.mockResolvedValueOnce({
            data: { id: "event-1" },
            error: null,
        });

        const result = await createEvent({
            ...VALID,
            virtualUrl: "  https://example.com/mepsa  ",
            locationName: "  Village Hall  ",
        });

        expect(result).toEqual({ success: true, eventId: "event-1" });

        const row = insertedRow(0);
        expect(row.event_type).toBe("external_show");
        expect(row.name).toBe("MEPSA Autumn Championship");
        expect(row.virtual_url).toBe("https://example.com/mepsa");
        expect(row.location_name).toBe("Village Hall");
        expect(row.created_by).toBe("user-1");
        // No show machinery is seeded any more.
        expect(row).not.toHaveProperty("judging_method");
        expect(row).not.toHaveProperty("show_status");

        // Second insert is the creator's own RSVP.
        expect(insertedRow(1)).toMatchObject({
            event_id: "event-1",
            user_id: "user-1",
            status: "going",
        });
    });

    it("never seeds divisions or classes", async () => {
        q.single.mockResolvedValueOnce({
            data: { id: "event-1" },
            error: null,
        });
        await createEvent(VALID);
        const tables = (mockClient.from as unknown as Mock).mock.calls.map(
            (c: string[]) => c[0],
        );
        expect(tables).not.toContain("event_divisions");
        expect(tables).not.toContain("event_classes");
    });

    // ── Pre-migration-168 feature detection ──

    it("falls back to a legal event_type when the CHECK constraint rejects the new one", async () => {
        // First insert trips events_event_type_check (migration 168 not
        // applied yet); the retry must still produce a usable listing.
        q.single
            .mockResolvedValueOnce({ data: null, error: { code: "23514", message: "check" } })
            .mockResolvedValueOnce({ data: { id: "event-2" }, error: null });

        const result = await createEvent({ ...VALID, eventType: "external_show" });

        expect(result).toEqual({ success: true, eventId: "event-2" });
        expect(insertedRow(0).event_type).toBe("external_show");
        expect(insertedRow(1).event_type).toBe("other");
    });

    it("maps club to meetup when the constraint rejects it", async () => {
        q.single
            .mockResolvedValueOnce({ data: null, error: { code: "23514", message: "check" } })
            .mockResolvedValueOnce({ data: { id: "event-3" }, error: null });

        await createEvent({ ...VALID, eventType: "club" });
        expect(insertedRow(1).event_type).toBe("meetup");
    });

    it("does not retry types that have no fallback", async () => {
        q.single.mockResolvedValueOnce({
            data: null,
            error: { code: "23514", message: "check" },
        });

        const result = await createEvent({ ...VALID, eventType: "swap_meet" });
        expect(result.success).toBe(false);
        expect(q.insert).toHaveBeenCalledTimes(1);
    });

    it("surfaces non-constraint insert errors", async () => {
        q.single.mockResolvedValueOnce({
            data: null,
            error: { code: "42501", message: "row-level security" },
        });
        const result = await createEvent(VALID);
        expect(result).toEqual({ success: false, error: "row-level security" });
    });
});

describe("getEvents — upcoming first, past on request", () => {
    it("orders upcoming soonest-first and filters to unfinished events", async () => {
        mockClient._setImplicitResolve({ data: [], error: null });
        await getEvents({ upcoming: true });

        expect(q.order).toHaveBeenCalledWith("starts_at", {
            ascending: true,
        });
        expect(orClause()).toContain("ends_at.gte.");
        expect(orClause()).toContain("starts_at.gte.");
    });

    it("orders the archive newest-first and filters to finished events", async () => {
        mockClient._setImplicitResolve({ data: [], error: null });
        await getEvents({ past: true, limit: 20 });

        expect(q.order).toHaveBeenCalledWith("starts_at", {
            ascending: false,
        });
        expect(q.limit).toHaveBeenCalledWith(20);
        expect(orClause()).toContain("ends_at.lt.");
        expect(orClause()).toContain("starts_at.lt.");
    });
});

describe("getEventAttendees", () => {
    it("returns avatars so the page can render a face strip", async () => {
        mockClient._setImplicitResolve({
            data: [
                {
                    user_id: "u1",
                    status: "going",
                    users: { alias_name: "amanda", avatar_url: "https://cdn/a.webp" },
                },
                { user_id: "u2", status: "interested", users: null },
            ],
            error: null,
        });

        const attendees = await getEventAttendees("event-1");

        expect(attendees).toEqual([
            { userId: "u1", status: "going", alias: "amanda", avatarUrl: "https://cdn/a.webp" },
            { userId: "u2", status: "interested", alias: "Unknown", avatarUrl: null },
        ]);
    });
});
