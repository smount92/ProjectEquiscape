import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

/**
 * requireRegistryModerator / registryRoleOf (Registry Desk Phase 1).
 *
 * The role is read on every request from registry_moderators, so a
 * removed moderator is refused on their next action. The owner
 * (ADMIN_EMAIL) always passes; a suspended account never does; before
 * migration 242 only the owner has a role.
 */

const state: {
    user: { id: string; email?: string; app_metadata?: Record<string, unknown> } | null;
    seat: { data: unknown; error: unknown };
    alias: string | null;
} = { user: null, seat: { data: null, error: null }, alias: "Maple" };

function chain(result: () => { data: unknown; error: unknown }) {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq"]) q[m] = () => q;
    q.maybeSingle = async () => result();
    return q;
}

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: async () => ({ data: { user: state.user } }) },
    })),
}));
vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: () => ({
        from: (table: string) =>
            table === "users"
                ? chain(() => ({ data: state.alias ? { alias_name: state.alias } : null, error: null }))
                : chain(() => state.seat),
    }),
}));

import {
    requireRegistryModerator,
    registryRoleOf,
    REGISTRY_DESK_REFUSAL,
    REGISTRY_TERM_ENDED,
    SUSPENDED_AUTH_ERROR,
} from "@/lib/auth";

const ORIGINAL = process.env.ADMIN_EMAIL;
afterAll(() => {
    process.env.ADMIN_EMAIL = ORIGINAL;
});

beforeEach(() => {
    process.env.ADMIN_EMAIL = "owner@test.com";
    state.user = { id: "u-1", email: "member@test.com", app_metadata: {} };
    state.seat = { data: null, error: null };
    state.alias = "Maple";
});

describe("requireRegistryModerator", () => {
    it("lets the owner in as owner, with their real alias", async () => {
        state.user = { id: "o-1", email: "OWNER@test.com", app_metadata: {} };
        state.alias = "SiteOwner";
        const r = await requireRegistryModerator();
        expect(r.role).toBe("owner");
        expect(r.alias).toBe("SiteOwner");
    });

    it("lets an active moderator in as moderator", async () => {
        state.seat = { data: { status: "active" }, error: null };
        const r = await requireRegistryModerator();
        expect(r).toMatchObject({ role: "moderator", alias: "Maple" });
        expect(r.user.id).toBe("u-1");
    });

    it.each(["resting", "removed", "stepped_down"])("refuses a %s moderator", async (status) => {
        state.seat = { data: { status }, error: null };
        await expect(requireRegistryModerator()).rejects.toThrow(REGISTRY_DESK_REFUSAL);
    });

    it("refuses a moderator whose term has run out, in words that say so; the seat still reads active", async () => {
        state.seat = { data: { status: "active", term_ends_at: "2020-01-01T00:00:00Z" }, error: null };
        await expect(requireRegistryModerator()).rejects.toThrow(REGISTRY_TERM_ENDED);
        await expect(registryRoleOf()).resolves.toBeNull();
        state.seat = { data: { status: "active", term_ends_at: "2099-01-01T00:00:00Z" }, error: null };
        await expect(requireRegistryModerator()).resolves.toMatchObject({ role: "moderator" });
    });

    it("refuses a member with no seat", async () => {
        await expect(requireRegistryModerator()).rejects.toThrow(REGISTRY_DESK_REFUSAL);
    });

    it("refuses a suspended moderator before the role check", async () => {
        state.user = { id: "u-1", email: "member@test.com", app_metadata: { is_suspended: true } };
        state.seat = { data: { status: "active" }, error: null };
        await expect(requireRegistryModerator()).rejects.toThrow(SUSPENDED_AUTH_ERROR);
    });

    it("refuses a suspended owner too", async () => {
        state.user = { id: "o-1", email: "owner@test.com", app_metadata: { is_suspended: true } };
        await expect(requireRegistryModerator()).rejects.toThrow(SUSPENDED_AUTH_ERROR);
    });

    it("refuses someone not logged in", async () => {
        state.user = null;
        await expect(requireRegistryModerator()).rejects.toThrow("Not authenticated.");
    });

    it("before migration 242 (no table) only the owner passes", async () => {
        state.seat = { data: null, error: { code: "PGRST205", message: "missing table" } };
        await expect(requireRegistryModerator()).rejects.toThrow(REGISTRY_DESK_REFUSAL);
        state.user = { id: "o-1", email: "owner@test.com", app_metadata: {} };
        await expect(requireRegistryModerator()).resolves.toMatchObject({ role: "owner" });
    });
});

describe("registryRoleOf", () => {
    it("never throws, and answers null for a member", async () => {
        await expect(registryRoleOf()).resolves.toBeNull();
        state.user = null;
        await expect(registryRoleOf()).resolves.toBeNull();
    });

    it("answers the role for links", async () => {
        state.seat = { data: { status: "active" }, error: null };
        await expect(registryRoleOf()).resolves.toEqual({ userId: "u-1", alias: "Maple", role: "moderator" });
    });

    it("hides the Desk from a suspended moderator", async () => {
        state.user = { id: "u-1", email: "member@test.com", app_metadata: { is_suspended: true } };
        state.seat = { data: { status: "active" }, error: null };
        await expect(registryRoleOf()).resolves.toBeNull();
    });
});
