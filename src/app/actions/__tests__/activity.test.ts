import { vi, describe, it, expect, beforeEach } from "vitest";
import { fakeDb } from "@/__tests__/mocks/fakeDb";

/**
 * createActivityEvent is an exported "use server" action, so anyone signed
 * in can call it directly. It used to take any event type and any metadata,
 * which let a member write Paddock `text_post`s that have no Report button
 * and can't be taken down. It now writes only the events the app itself
 * creates, for the caller, with their own metadata.
 */

const adminDb = fakeDb();
const { requireAuth } = vi.hoisted(() => ({ requireAuth: vi.fn() }));

vi.mock("@/lib/auth", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/auth")>()),
    requireAuth,
}));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => adminDb }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { AuthError } from "@/lib/auth";
import { createActivityEvent } from "@/app/actions/activity";

const ME = "11111111-1111-4111-8111-111111111111";
const HORSE = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
    adminDb.reset();
    requireAuth.mockResolvedValue({ supabase: {}, user: { id: ME } });
});

const written = () => adminDb.writes("activity_events").map((q) => q.payload as Record<string, unknown>);

describe("createActivityEvent", () => {
    it("writes each event the app creates, for the caller", async () => {
        await createActivityEvent({
            actorId: ME,
            eventType: "follow",
            targetId: OTHER,
            metadata: { targetAlias: "Ash" },
        });
        await createActivityEvent({
            actorId: ME,
            eventType: "new_horse",
            horseId: HORSE,
            metadata: { horseName: "Bramble", finishType: "OF" },
        });
        await createActivityEvent({
            actorId: ME,
            eventType: "show_record",
            horseId: HORSE,
            metadata: { showName: "Autumn Gold", placing: null },
        });
        await createActivityEvent({ actorId: ME, eventType: "rating", metadata: { stars: 5, targetAlias: "Ash" } });
        expect(written().map((w) => w.event_type)).toEqual(["follow", "new_horse", "show_record", "rating"]);
        expect(written()[1]).toEqual({
            actor_id: ME,
            event_type: "new_horse",
            horse_id: HORSE,
            target_id: null,
            metadata: { horseName: "Bramble", finishType: "OF" },
        });
    });

    it("refuses a text post, or any kind the app doesn't write", async () => {
        for (const eventType of ["text_post", "announcement", "constructor", ""]) {
            await createActivityEvent({ actorId: ME, eventType, metadata: { text: "Buy my stuff at scam.example" } });
        }
        expect(written()).toEqual([]);
    });

    it("refuses metadata that isn't the event's own (extra keys, wrong types, overlong text)", async () => {
        await createActivityEvent({
            actorId: ME,
            eventType: "follow",
            metadata: { targetAlias: "Ash", text: "smuggled words" },
        });
        await createActivityEvent({ actorId: ME, eventType: "rating", metadata: { stars: 500, targetAlias: "Ash" } });
        await createActivityEvent({
            actorId: ME,
            eventType: "new_horse",
            metadata: { horseName: "x".repeat(5000), finishType: "OF" },
        });
        await createActivityEvent({
            actorId: ME,
            eventType: "new_horse",
            horseId: "not-an-id",
            metadata: { horseName: "Bramble", finishType: "OF" },
        });
        expect(written()).toEqual([]);
    });

    it("writes nothing for someone else, or for a visitor or suspended account", async () => {
        await createActivityEvent({ actorId: OTHER, eventType: "follow", metadata: { targetAlias: "Ash" } });
        requireAuth.mockRejectedValueOnce(new AuthError());
        await createActivityEvent({ actorId: ME, eventType: "follow", metadata: { targetAlias: "Ash" } });
        requireAuth.mockRejectedValueOnce(new AuthError("This account is suspended."));
        await createActivityEvent({ actorId: ME, eventType: "follow", metadata: { targetAlias: "Ash" } });
        expect(written()).toEqual([]);
    });
});
