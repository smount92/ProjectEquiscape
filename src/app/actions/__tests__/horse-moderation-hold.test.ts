import { vi, describe, it, expect, beforeEach } from "vitest";
import { fakeDb, OK, type FakeQuery } from "@/__tests__/mocks/fakeDb";

/**
 * A horse made private by a moderator stays private (migration 235). The
 * owner used to undo a take-down by setting the horse Public or For Sale
 * again; now the edit form and the bulk toolbar say why they can't, in
 * plain words, before the database guard has to refuse it.
 */

const memberDb = fakeDb();
const adminDb = fakeDb();
const member = Object.assign(memberDb, {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "owner-1", email: "o@test.com" } } })) },
});

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => member) }));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => adminDb }));
vi.mock("@/lib/auth", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/auth")>()),
    requireAuth: vi.fn(async () => ({ supabase: member, user: { id: "owner-1" } })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/app/actions/activity", () => ({ createActivityEvent: vi.fn() }));

import { bulkUpdateHorses, updateHorseAction } from "@/app/actions/horse";
import { MODERATION_HOLD_MESSAGE, isModerationHoldError, liftsModerationHold } from "@/lib/moderation/horseHold";

const HORSE = "h1";

/** The hold check: user_horses where moderation_hidden_at is not null. */
const isHoldCheck = (q: FakeQuery) =>
    q.op === "select" && q.filters.some((f) => f[0] === "not" && f[1] === "moderation_hidden_at");

function held(ids: string[]) {
    memberDb.on("user_horses", (q) =>
        isHoldCheck(q)
            ? { data: ids.map((id) => ({ id, moderation_hidden_at: "2026-10-15T00:00:00Z" })), error: null }
            : q.op === "select"
              ? { data: [{ id: "h1" }, { id: "h2" }], error: null }
              : OK,
    );
}

const edit = (horseUpdate: Record<string, unknown>) =>
    updateHorseAction(HORSE, {
        horseUpdate,
        vaultData: null,
        hasExistingVault: false,
        deleteVault: false,
        conditionChange: null,
    });

beforeEach(() => {
    memberDb.reset();
    adminDb.reset();
});

describe("what lifts the hold", () => {
    it("is showing the horse or listing it, nothing else", () => {
        expect(liftsModerationHold({ visibility: "public" })).toBe(true);
        expect(liftsModerationHold({ visibility: "unlisted" })).toBe(true);
        expect(liftsModerationHold({ is_public: true })).toBe(true);
        expect(liftsModerationHold({ trade_status: "For Sale" })).toBe(true);
        expect(liftsModerationHold({ trade_status: "Open to Offers" })).toBe(true);
        expect(liftsModerationHold({ visibility: "private", trade_status: "Not for Sale", custom_name: "x" })).toBe(
            false,
        );
        expect(liftsModerationHold(null)).toBe(false);
    });

    it("recognises the database guard's refusal", () => {
        expect(isModerationHoldError(`P0001: ${MODERATION_HOLD_MESSAGE}`)).toBe(true);
        expect(isModerationHoldError("duplicate key")).toBe(false);
    });
});

describe("updateHorseAction on a held horse", () => {
    it("refuses to make it public, in plain words, and writes nothing", async () => {
        held([HORSE]);
        expect(await edit({ visibility: "public" })).toEqual({ success: false, error: MODERATION_HOLD_MESSAGE });
        expect(await edit({ trade_status: "For Sale" })).toEqual({ success: false, error: MODERATION_HOLD_MESSAGE });
        expect(memberDb.writes("user_horses")).toEqual([]);
    });

    it("still saves everything else (the form sends private / not for sale back unchanged)", async () => {
        held([HORSE]);
        const result = await edit({ custom_name: "Renamed", visibility: "private", trade_status: "Not for Sale" });
        expect(result).toEqual({ success: true });
        expect(memberDb.writes("user_horses")[0].payload).toMatchObject({ custom_name: "Renamed" });
        // Nothing to lift, so no need to ask.
        expect(memberDb.queries.some(isHoldCheck)).toBe(false);
    });

    it("leaves a horse without the stamp alone", async () => {
        held([]);
        expect(await edit({ visibility: "public" })).toEqual({ success: true });
    });

    it("treats a missing stamp column (before 235) as no hold", async () => {
        memberDb.on("user_horses", (q) =>
            isHoldCheck(q) ? { data: null, error: { code: "42703", message: "column does not exist" } } : OK,
        );
        expect(await edit({ visibility: "public" })).toEqual({ success: true });
    });
});

describe("bulkUpdateHorses with a held horse in the batch", () => {
    it("refuses to show or list the batch", async () => {
        held(["h2"]);
        const result = await bulkUpdateHorses(["h1", "h2"], { visibility: "public" });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/made private by a moderator/);
        expect(memberDb.writes("user_horses")).toEqual([]);
    });

    it("still lets the batch go private or change folder", async () => {
        held(["h2"]);
        expect((await bulkUpdateHorses(["h1", "h2"], { visibility: "private" })).success).toBe(true);
    });
});
