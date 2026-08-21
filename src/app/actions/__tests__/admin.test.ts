import { vi, describe, it, expect, beforeEach, afterAll, type Mock } from "vitest";

/**
 * Admin console — the legacy suggestion queue, the pulse, the ops
 * corner and member search.
 *
 * The first block is a regression test with a story: the Content tab's
 * legacy queue could not be cleared because `resolveLegacySuggestion`'s
 * ancestor wrote a `reviewed_at` column that `database_suggestions`
 * (migration 020) has never had. PostgREST answered PGRST204, the row
 * stayed 'pending' forever, and — on Approve — the catalog INSERT that
 * ran first had already succeeded, so every retry minted a duplicate.
 * These tests pin all three halves of the fix.
 */

interface MockResult {
    data?: unknown;
    error?: unknown;
    count?: number | null;
}

const CHAIN_METHODS = [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "neq",
    "in",
    "is",
    "not",
    "gte",
    "lte",
    "ilike",
    "or",
    "order",
    "limit",
    "range",
] as const;

type MockQuery = Record<string, Mock> & {
    then: (resolve: (v: MockResult) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
};

function makeQuery(result: MockResult): MockQuery {
    const q = {} as MockQuery;
    for (const method of CHAIN_METHODS) {
        (q as Record<string, unknown>)[method] = vi.fn(() => q);
    }
    q.single = vi.fn(async () => result);
    q.maybeSingle = vi.fn(async () => result);
    (q as Record<string, unknown>).then = (
        resolve: (v: MockResult) => unknown,
        reject?: (e: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject);
    return q;
}

/** Per-table FIFO of results; anything unqueued gets `fallback`. */
const tableQueues = new Map<string, MockResult[]>();
const issued: { table: string; query: MockQuery }[] = [];
let fallback: MockResult = { data: [], error: null, count: 0 };
let rpcResult: MockResult = { data: null, error: null };
let listUsersResult: unknown = { data: { users: [] } };

function queue(table: string, ...results: MockResult[]) {
    tableQueues.set(table, [...(tableQueues.get(table) ?? []), ...results]);
}

/** Every query issued against `table`, in call order. */
function queriesFor(table: string): MockQuery[] {
    return issued.filter((i) => i.table === table).map((i) => i.query);
}

const signOutMock = vi.fn(async () => ({ error: null }));
const getUserByIdMock = vi.fn(async () => ({
    data: { user: { id: "u-1", app_metadata: {} } },
    error: null,
}));
const updateUserByIdMock = vi.fn(async () => ({ error: null }));

const mockAdminClient = {
    from: vi.fn((table: string) => {
        const next = tableQueues.get(table)?.shift();
        const query = makeQuery(next ?? fallback);
        issued.push({ table, query });
        return query;
    }),
    rpc: vi.fn(async () => rpcResult),
    auth: {
        admin: {
            listUsers: vi.fn(async () => listUsersResult),
            getUserById: getUserByIdMock,
            updateUserById: updateUserByIdMock,
            signOut: signOutMock,
        },
    },
};

const authGetUser = vi.fn(async () => ({
    data: { user: { id: "admin-1", email: "admin@test.com" } },
}));

vi.mock("@supabase/supabase-js", () => ({
    createClient: vi.fn(() => mockAdminClient),
}));
vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: authGetUser } })),
}));
vi.mock("resend", () => ({ Resend: vi.fn(() => ({ emails: { send: vi.fn() } })) }));

import {
    getAdminPulse,
    getMigrationStatus,
    listLegacySuggestions,
    resolveLegacySuggestion,
    searchMembers,
} from "@/app/actions/admin";

const ORIGINAL_ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

afterAll(() => {
    process.env.ADMIN_EMAIL = ORIGINAL_ADMIN_EMAIL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_KEY;
});

beforeEach(() => {
    vi.clearAllMocks();
    tableQueues.clear();
    issued.length = 0;
    fallback = { data: [], error: null, count: 0 };
    rpcResult = { data: null, error: null };
    listUsersResult = { data: { users: [] } };
    process.env.ADMIN_EMAIL = "admin@test.com";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    authGetUser.mockResolvedValue({
        data: { user: { id: "admin-1", email: "admin@test.com" } },
    });
});

const PENDING_ROW = {
    id: "sug-1",
    suggestion_type: "mold",
    name: "Stock Horse Stallion",
    details: "Breyer, 1988 release",
    status: "pending",
};

describe("resolveLegacySuggestion — the Content tab jam", () => {
    it("never writes reviewed_at: the column does not exist on database_suggestions", async () => {
        queue("database_suggestions", { data: PENDING_ROW, error: null });
        queue("catalog_items", { data: [{ id: "cat-1" }], error: null });

        const result = await resolveLegacySuggestion("sug-1", "approve");

        expect(result.success).toBe(true);
        const updateCall = queriesFor("database_suggestions").find((q) =>
            q.update.mock.calls.length > 0,
        );
        expect(updateCall).toBeDefined();
        const payload = updateCall!.update.mock.calls[0][0] as Record<string, unknown>;
        expect(payload).not.toHaveProperty("reviewed_at");
        expect(payload.status).toBe("approved");
    });

    it("approve skips the catalog insert when an identical entry already exists", async () => {
        // The broken version minted one of these on every failed retry.
        queue("database_suggestions", { data: PENDING_ROW, error: null });
        queue("catalog_items", { data: [{ id: "cat-existing" }], error: null });

        const result = await resolveLegacySuggestion("sug-1", "approve");

        expect(result.success).toBe(true);
        const inserted = queriesFor("catalog_items").some((q) => q.insert.mock.calls.length > 0);
        expect(inserted).toBe(false);
    });

    it("approve mints the catalog entry when nothing matches", async () => {
        queue("database_suggestions", { data: PENDING_ROW, error: null });
        queue("catalog_items", { data: [], error: null }, { data: null, error: null });

        const result = await resolveLegacySuggestion("sug-1", "approve");

        expect(result.success).toBe(true);
        const insertCall = queriesFor("catalog_items").find((q) => q.insert.mock.calls.length > 0);
        expect(insertCall).toBeDefined();
        expect(insertCall!.insert.mock.calls[0][0]).toMatchObject({
            item_type: "plastic_mold",
            title: "Stock Horse Stallion",
            maker: "Breyer",
        });
    });

    it("dismiss clears the row with no catalog write at all", async () => {
        queue("database_suggestions", { data: PENDING_ROW, error: null });

        const result = await resolveLegacySuggestion("sug-1", "dismiss");

        expect(result.success).toBe(true);
        expect(queriesFor("catalog_items")).toHaveLength(0);
    });

    it("dismiss falls back to 'rejected' when 020's status CHECK refuses 'dismissed'", async () => {
        queue(
            "database_suggestions",
            { data: PENDING_ROW, error: null },
            // The 'dismissed' UPDATE — check_violation.
            { data: null, error: { code: "23514", message: "check constraint" } },
            // The fallback 'rejected' UPDATE.
            { data: null, error: null },
        );

        const result = await resolveLegacySuggestion("sug-1", "dismiss");

        expect(result.success).toBe(true);
        const updates = queriesFor("database_suggestions")
            .flatMap((q) => q.update.mock.calls)
            .map((call) => call[0] as Record<string, unknown>);
        expect(updates[0].status).toBe("dismissed");
        expect(updates[1].status).toBe("rejected");
        expect(String(updates[1].admin_notes)).toContain("[dismissed]");
    });

    it("surfaces a failure instead of reporting success", async () => {
        queue(
            "database_suggestions",
            { data: PENDING_ROW, error: null },
            { data: null, error: { code: "PGRST204", message: "Could not find the column" } },
        );

        const result = await resolveLegacySuggestion("sug-1", "reject");

        expect(result.success).toBe(false);
        expect(result.error).toContain("Could not find the column");
    });

    it("refuses a non-admin", async () => {
        authGetUser.mockResolvedValue({
            data: { user: { id: "u-9", email: "member@test.com" } },
        });
        const result = await resolveLegacySuggestion("sug-1", "dismiss");
        expect(result.success).toBe(false);
        expect(result.error).toBe("Unauthorized");
    });
});

describe("listLegacySuggestions", () => {
    it("reads through the service role and names the submitter", async () => {
        queue("database_suggestions", {
            data: [
                {
                    id: "sug-1",
                    suggestion_type: "resin",
                    name: "Brumby",
                    details: null,
                    created_at: "2026-01-02T00:00:00Z",
                    submitted_by: "u-7",
                },
            ],
            error: null,
        });
        queue("users", { data: [{ id: "u-7", alias_name: "amanda" }], error: null });

        const result = await listLegacySuggestions();

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.suggestions).toHaveLength(1);
        expect(result.suggestions[0].submitterAlias).toBe("amanda");
        expect(queriesFor("database_suggestions")[0].eq).toHaveBeenCalledWith("status", "pending");
    });

    it("degrades to an empty queue rather than throwing if the table is gone", async () => {
        queue("database_suggestions", {
            data: null,
            error: { code: "42P01", message: "relation does not exist" },
        });

        const result = await listLegacySuggestions();

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.suggestions).toEqual([]);
    });
});

describe("getMigrationStatus", () => {
    it("reports a present column as applied and a missing one as not pasted", async () => {
        // Column probes run in PENDING_MIGRATIONS order: 166 posts.kind,
        // 167 groups.is_private, 170 artist_profiles.services,
        // 171 users.profile_customization, 173 messages.kind.
        queue("posts", { data: [], error: null });
        queue("groups", { data: null, error: { code: "42703", message: "no column" } });
        rpcResult = { data: null, error: { code: "PGRST202", message: "not found" } };

        const result = await getMigrationStatus();

        expect(result.success).toBe(true);
        if (!result.success) return;
        const byId = Object.fromEntries(result.migrations.map((m) => [m.id, m]));
        expect(byId["166"].applied).toBe(true);
        expect(byId["167"].applied).toBe(false);
        expect(byId["169"].applied).toBe(false);
    });

    it("says 'can't tell' — with a reason — for CHECK-only migrations", async () => {
        const result = await getMigrationStatus();

        expect(result.success).toBe(true);
        if (!result.success) return;
        const byId = Object.fromEntries(result.migrations.map((m) => [m.id, m]));
        expect(byId["168"].applied).toBeNull();
        expect(byId["168"].note).toContain("CHECK");
        expect(byId["172"].applied).toBeNull();
    });

    it("never writes", async () => {
        await getMigrationStatus();
        for (const { query } of issued) {
            expect(query.insert).not.toHaveBeenCalled();
            expect(query.update).not.toHaveBeenCalled();
            expect(query.delete).not.toHaveBeenCalled();
        }
    });

    it("refuses a non-admin", async () => {
        authGetUser.mockResolvedValue({ data: { user: { id: "u-9", email: "x@test.com" } } });
        const result = await getMigrationStatus();
        expect(result.success).toBe(false);
    });
});

describe("getAdminPulse", () => {
    it("answers null — never a confident zero — when a table is not there yet", async () => {
        // `posts` predates the feed work on some databases; a missing
        // table must read as "—", not "0 posts this week".
        queue("posts", { count: null, error: { code: "42P01", message: "relation missing" } });
        listUsersResult = { data: { users: [{ id: "a" }, { id: "b" }] } };

        const result = await getAdminPulse();

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.pulse.posts7d).toBeNull();
        expect(result.pulse.totalMembers).toBe(2);
    });

    it("counts open-show entries only for shows that are actually open", async () => {
        queue(
            "shows",
            { data: [{ id: "show-1" }, { id: "show-2" }], error: null },
            { count: 4, error: null },
        );
        queue("show_class_entries", { count: 37, error: null });

        const result = await getAdminPulse();

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.pulse.openShows).toBe(2);
        expect(result.pulse.openShowEntries).toBe(37);
        expect(result.pulse.pending.sanctioning).toBe(4);

        const statusFilter = queriesFor("shows")[0].in.mock.calls[0];
        expect(statusFilter[0]).toBe("status");
        expect(statusFilter[1]).toContain("entries_open");
        expect(statusFilter[1]).not.toContain("draft");
    });

    it("refuses a non-admin", async () => {
        authGetUser.mockResolvedValue({ data: { user: { id: "u-9", email: "x@test.com" } } });
        const result = await getAdminPulse();
        expect(result.success).toBe(false);
    });
});

describe("searchMembers", () => {
    it("returns is_suspended, which no client key is allowed to read", async () => {
        queue("users", {
            data: [
                {
                    id: "u-3",
                    alias_name: "sloptrough",
                    email: "s@test.com",
                    created_at: "2026-08-01T00:00:00Z",
                    is_suspended: true,
                    suspended_at: "2026-08-14T00:00:00Z",
                    suspended_reason: "troll entries",
                    is_supporter: false,
                },
            ],
            error: null,
        });
        queue("user_horses", { data: [{ owner_id: "u-3" }, { owner_id: "u-3" }], error: null });

        const result = await searchMembers("slop");

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.members[0]).toMatchObject({
            alias: "sloptrough",
            isSuspended: true,
            suspendedReason: "troll entries",
            horseCount: 2,
        });
        expect(queriesFor("users")[0].ilike).toHaveBeenCalledWith("alias_name", "%slop%");
    });

    it("lists the newest members for an empty query instead of filtering on nothing", async () => {
        queue("users", { data: [], error: null });

        const result = await searchMembers("   ");

        expect(result.success).toBe(true);
        expect(queriesFor("users")[0].ilike).not.toHaveBeenCalled();
    });

    it("refuses a non-admin", async () => {
        authGetUser.mockResolvedValue({ data: { user: { id: "u-9", email: "x@test.com" } } });
        const result = await searchMembers("a");
        expect(result.success).toBe(false);
    });
});
