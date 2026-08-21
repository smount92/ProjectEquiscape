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

/**
 * The notification sink is `import "server-only"` and is reached by a
 * dynamic import inside the action, so it is replaced wholesale here.
 * Its return value is the number of rows actually written — 0 when the
 * recipient has muted the type, which the nudge has to report honestly
 * rather than claim a send.
 */
const { createNotificationsBulkMock } = vi.hoisted(() => ({
    createNotificationsBulkMock: vi.fn(async () => 1),
}));
vi.mock("@/lib/notifications/createNotification", () => ({
    createNotificationsBulk: createNotificationsBulkMock,
    createNotification: vi.fn(async () => undefined),
}));

import {
    findCatalogDuplicates,
    getAdminPulse,
    getEnvFlagStatus,
    getMigrationStatus,
    listLegacySuggestions,
    listOverdueShows,
    nudgeOverdueShowHost,
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

// ══════════════════════════════════════════════════════════════
// The three console additions
// ══════════════════════════════════════════════════════════════

describe("getEnvFlagStatus", () => {
    const ORIGINAL_STRIPE = process.env.STRIPE_SECRET_KEY;
    const ORIGINAL_RESEND = process.env.RESEND_API_KEY;

    afterAll(() => {
        process.env.STRIPE_SECRET_KEY = ORIGINAL_STRIPE;
        process.env.RESEND_API_KEY = ORIGINAL_RESEND;
        vi.unstubAllEnvs();
    });

    it("NEVER returns a secret value — only whether the key is set", async () => {
        process.env.STRIPE_SECRET_KEY = "sk_live_do_not_leak_me";
        delete process.env.RESEND_API_KEY;

        const result = await getEnvFlagStatus();

        expect(result.success).toBe(true);
        if (!result.success) return;
        const serialized = JSON.stringify(result.status);
        expect(serialized).not.toContain("sk_live_do_not_leak_me");
        expect(serialized).not.toContain("service-role-key");

        const byKey = Object.fromEntries(result.status.secrets.map((s) => [s.key, s]));
        expect(byKey.STRIPE_SECRET_KEY.present).toBe(true);
        expect(byKey.RESEND_API_KEY.present).toBe(false);
        expect(byKey.SUPABASE_SERVICE_ROLE_KEY.present).toBe(true);
        // No value-shaped field smuggled onto the row at all.
        expect(Object.keys(byKey.STRIPE_SECRET_KEY)).toEqual([
            "key",
            "present",
            "label",
            "impact",
        ]);
    });

    it("treats a blank key as not set — an empty string is not configuration", async () => {
        process.env.STRIPE_SECRET_KEY = "   ";
        const result = await getEnvFlagStatus();
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.status.secrets.find((s) => s.key === "STRIPE_SECRET_KEY")?.present).toBe(
            false,
        );
    });

    it("reads each flag through the app's own gate — only the literal '1' is on", async () => {
        vi.stubEnv("NEXT_PUBLIC_FORM_ENGINE", "1");
        vi.stubEnv("NEXT_PUBLIC_SHOW_STANDINGS", "true");
        vi.stubEnv("NEXT_PUBLIC_WANTED_NUDGE", "");

        const result = await getEnvFlagStatus();

        expect(result.success).toBe(true);
        if (!result.success) return;
        const byKey = Object.fromEntries(result.status.flags.map((f) => [f.key, f]));
        expect(byKey.NEXT_PUBLIC_FORM_ENGINE.on).toBe(true);
        // Set, but not to "1" — the gate is off and the value is shown so
        // the owner can see WHY.
        expect(byKey.NEXT_PUBLIC_SHOW_STANDINGS.on).toBe(false);
        expect(byKey.NEXT_PUBLIC_SHOW_STANDINGS.value).toBe("true");
        expect(byKey.NEXT_PUBLIC_WANTED_NUDGE.on).toBe(false);
        expect(byKey.NEXT_PUBLIC_WANTED_NUDGE.value).toBeNull();
    });

    it("never touches the database", async () => {
        await getEnvFlagStatus();
        expect(mockAdminClient.from).not.toHaveBeenCalled();
    });

    it("refuses a non-admin", async () => {
        authGetUser.mockResolvedValue({ data: { user: { id: "u-9", email: "x@test.com" } } });
        const result = await getEnvFlagStatus();
        expect(result.success).toBe(false);
    });
});

describe("findCatalogDuplicates", () => {
    const CATALOG_ROWS = [
        {
            id: "cat-original",
            title: "Stock Horse Stallion",
            maker: "Breyer",
            item_type: "plastic_mold",
            slug: "stock-horse-stallion",
            created_at: "2026-01-01T00:00:00Z",
        },
        {
            id: "cat-retry",
            title: "stock horse stallion",
            maker: "Unknown",
            item_type: "plastic_mold",
            slug: null,
            created_at: "2026-04-02T00:00:00Z",
        },
    ];

    /** The scan, then the six reference tallies in REFERENCE_TABLES order. */
    function queueSweep(counts: Partial<Record<string, unknown[]>> = {}) {
        queue("catalog_items", { data: CATALOG_ROWS, error: null });
        queue("user_horses", { data: counts.user_horses ?? [], error: null });
        queue("user_wishlists", { data: counts.user_wishlists ?? [], error: null });
        queue("id_suggestions", { data: counts.id_suggestions ?? [], error: null });
        queue("catalog_suggestions", { data: counts.catalog_suggestions ?? [], error: null });
        queue("catalog_changelog", { data: counts.catalog_changelog ?? [], error: null });
        // Second catalog_items query — the parent_id (child mold) tally.
        queue("catalog_items", { data: counts.parents ?? [], error: null });
    }

    it("finds the retry-loop shape: same title, same type, a guessed maker", async () => {
        queueSweep({
            user_horses: [{ catalog_id: "cat-original" }, { catalog_id: "cat-original" }],
            user_wishlists: [{ catalog_id: "cat-retry" }],
        });

        const result = await findCatalogDuplicates();

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.report.groups).toHaveLength(1);
        const group = result.report.groups[0];
        expect(group.confidence).toBe("placeholder-maker");
        expect(group.members.map((m) => m.id).sort()).toEqual(["cat-original", "cat-retry"]);
        // Two horses beat one wishlist: the loaded row is the keeper.
        expect(group.members.find((m) => m.keeper)?.id).toBe("cat-original");
        expect(result.report.loadNote).toBeNull();
    });

    it("counts references with one query per table, never one per row", async () => {
        queueSweep();
        await findCatalogDuplicates();

        // 1 scan + 1 parent tally on catalog_items, 1 each elsewhere.
        expect(queriesFor("catalog_items")).toHaveLength(2);
        expect(queriesFor("user_horses")).toHaveLength(1);
        expect(queriesFor("user_wishlists")).toHaveLength(1);
        expect(queriesFor("catalog_changelog")).toHaveLength(1);
        // Every tally is a batched `in`.
        expect(queriesFor("user_horses")[0].in).toHaveBeenCalledWith("catalog_id", [
            "cat-original",
            "cat-retry",
        ]);
    });

    it("is read-only — the merge action is the only write in this flow", async () => {
        queueSweep();
        await findCatalogDuplicates();
        for (const { query } of issued) {
            expect(query.insert).not.toHaveBeenCalled();
            expect(query.update).not.toHaveBeenCalled();
            expect(query.delete).not.toHaveBeenCalled();
        }
    });

    it("says so when a reference tally is unreadable instead of showing a confident zero", async () => {
        queue("catalog_items", { data: CATALOG_ROWS, error: null });
        queue("user_horses", { data: null, error: { code: "42P01", message: "gone" } });
        queue("user_wishlists", { data: [], error: null });
        queue("id_suggestions", { data: [], error: null });
        queue("catalog_suggestions", { data: [], error: null });
        queue("catalog_changelog", { data: [], error: null });
        queue("catalog_items", { data: [], error: null });

        const result = await findCatalogDuplicates();

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.report.loadNote).toContain("user_horses");
    });

    it("skips the tallies entirely when nothing duplicates", async () => {
        queue("catalog_items", {
            data: [CATALOG_ROWS[0], { ...CATALOG_ROWS[1], title: "Totally Different" }],
            error: null,
        });

        const result = await findCatalogDuplicates();

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.report.groups).toEqual([]);
        expect(queriesFor("user_horses")).toHaveLength(0);
    });

    it("refuses a non-admin", async () => {
        authGetUser.mockResolvedValue({ data: { user: { id: "u-9", email: "x@test.com" } } });
        const result = await findCatalogDuplicates();
        expect(result.success).toBe(false);
    });
});

describe("listOverdueShows", () => {
    const DAY = 24 * 60 * 60 * 1000;
    const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

    const OVERDUE_JUDGING = {
        id: "show-1",
        title: "Summerween",
        host_id: "host-1",
        status: "judging",
        judging_ends_at: ago(9),
        entries_close_at: null,
        show_date: null,
        updated_at: ago(9),
    };

    /** Five predicate queries in order, then users / entries / notifications. */
    function queueQueue(options: {
        judgingOverdue?: unknown[];
        judgingNoDeadline?: unknown[];
        entriesClosed?: unknown[];
        running?: unknown[];
        resultsReview?: unknown[];
        hosts?: unknown[];
        entries?: unknown[];
        nudges?: unknown[];
    }) {
        queue(
            "shows",
            { data: options.judgingOverdue ?? [], error: null },
            { data: options.judgingNoDeadline ?? [], error: null },
            { data: options.entriesClosed ?? [], error: null },
            { data: options.running ?? [], error: null },
            { data: options.resultsReview ?? [], error: null },
        );
        queue("users", { data: options.hosts ?? [], error: null });
        queue("show_class_entries", { data: options.entries ?? [], error: null });
        queue("notifications", { data: options.nudges ?? [], error: null });
    }

    it("lists an overdue judging show with its host, entry count and age", async () => {
        queueQueue({
            judgingOverdue: [OVERDUE_JUDGING],
            hosts: [{ id: "host-1", alias_name: "amanda" }],
            entries: [
                { show_id: "show-1", status: "entered" },
                { show_id: "show-1", status: "entered" },
                // Scratched entries are history — they never count.
                { show_id: "show-1", status: "scratched" },
            ],
        });

        const result = await listOverdueShows();

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.report.rows).toHaveLength(1);
        expect(result.report.rows[0]).toMatchObject({
            showId: "show-1",
            title: "Summerween",
            hostAlias: "amanda",
            reason: "judging_overdue",
            overdueDays: 9,
            entryCount: 2,
            nudgedAt: null,
            nudgeOnCooldown: false,
            hostConsoleUrl: "/shows/host/show-1",
        });
    });

    it("never proposes a status flip — nothing in this action writes", async () => {
        queueQueue({ judgingOverdue: [OVERDUE_JUDGING] });
        await listOverdueShows();
        for (const { query } of issued) {
            expect(query.insert).not.toHaveBeenCalled();
            expect(query.update).not.toHaveBeenCalled();
            expect(query.delete).not.toHaveBeenCalled();
        }
    });

    it("re-checks the broad `or` queries through the classifier", async () => {
        // The running predicate's `or` also matches a show edited today
        // whose show_date is in the future — that is NOT stalled.
        queueQueue({
            running: [
                {
                    id: "show-2",
                    title: "Fresh live show",
                    host_id: "host-2",
                    status: "running",
                    judging_ends_at: null,
                    entries_close_at: null,
                    show_date: new Date(Date.now() + 5 * DAY).toISOString().slice(0, 10),
                    updated_at: ago(0),
                },
            ],
        });

        const result = await listOverdueShows();

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.report.rows).toEqual([]);
    });

    it("surfaces a prior nudge and holds the cooldown", async () => {
        queueQueue({
            judgingOverdue: [OVERDUE_JUDGING],
            hosts: [{ id: "host-1", alias_name: "amanda" }],
            nudges: [
                {
                    user_id: "host-1",
                    link_url: "/shows/host/show-1#judging-overdue",
                    created_at: ago(1),
                },
            ],
        });

        const result = await listOverdueShows();

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.report.rows[0].nudgeOnCooldown).toBe(true);
    });

    it("keeps the queue alive when one predicate errors", async () => {
        queue(
            "shows",
            { data: [OVERDUE_JUDGING], error: null },
            { data: null, error: { code: "42703", message: "no column" } },
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
        );
        queue("users", { data: [], error: null });
        queue("show_class_entries", { data: [], error: null });
        queue("notifications", { data: [], error: null });

        const result = await listOverdueShows();

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.report.rows).toHaveLength(1);
    });

    it("refuses a non-admin", async () => {
        authGetUser.mockResolvedValue({ data: { user: { id: "u-9", email: "x@test.com" } } });
        const result = await listOverdueShows();
        expect(result.success).toBe(false);
    });
});

describe("nudgeOverdueShowHost", () => {
    const DAY = 24 * 60 * 60 * 1000;
    const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

    const SHOW = {
        id: "show-1",
        title: "Summerween",
        host_id: "host-1",
        status: "judging",
        judging_ends_at: ago(9),
        entries_close_at: null,
        show_date: null,
        updated_at: ago(9),
    };

    it("sends one notification on the cron's own type and link", async () => {
        queue("shows", { data: SHOW, error: null });
        queue("notifications", { data: [], error: null });

        const result = await nudgeOverdueShowHost("show-1");

        expect(result).toMatchObject({ success: true, sent: true });
        expect(createNotificationsBulkMock).toHaveBeenCalledTimes(1);
        const rows = createNotificationsBulkMock.mock.calls[0][0] as {
            userId: string;
            type: string;
            actorId: string | null;
            content: string;
            linkUrl: string;
        }[];
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            userId: "host-1",
            type: "show_deadline",
            // System event: the self-guard must not eat this if the admin
            // happens to host the show.
            actorId: null,
            linkUrl: "/shows/host/show-1#judging-overdue",
        });
        expect(rows[0].content).toContain("Summerween");
    });

    it("refuses inside the cooldown instead of spamming on repeated clicks", async () => {
        queue("shows", { data: SHOW, error: null });
        queue("notifications", { data: [{ created_at: ago(1) }], error: null });

        const result = await nudgeOverdueShowHost("show-1");

        expect(result.success).toBe(true);
        expect(result.sent).toBe(false);
        expect(result.note).toContain("Already nudged");
        expect(createNotificationsBulkMock).not.toHaveBeenCalled();
    });

    it("sends again once the cooldown has run out", async () => {
        queue("shows", { data: SHOW, error: null });
        queue("notifications", { data: [{ created_at: ago(30) }], error: null });

        const result = await nudgeOverdueShowHost("show-1");
        expect(result.sent).toBe(true);
    });

    it("says nothing was sent when the host has the type muted", async () => {
        createNotificationsBulkMock.mockResolvedValueOnce(0);
        queue("shows", { data: SHOW, error: null });
        queue("notifications", { data: [], error: null });

        const result = await nudgeOverdueShowHost("show-1");

        expect(result.success).toBe(true);
        expect(result.sent).toBe(false);
        expect(result.note).toContain("muted");
    });

    it("declines a show that is no longer overdue", async () => {
        queue("shows", {
            data: { ...SHOW, status: "completed" },
            error: null,
        });

        const result = await nudgeOverdueShowHost("show-1");

        expect(result.success).toBe(true);
        expect(result.sent).toBe(false);
        expect(result.note).toContain("no longer overdue");
        expect(createNotificationsBulkMock).not.toHaveBeenCalled();
    });

    it("never writes to shows — the state machine owns the lifecycle", async () => {
        queue("shows", { data: SHOW, error: null });
        queue("notifications", { data: [], error: null });

        await nudgeOverdueShowHost("show-1");

        for (const { table, query } of issued) {
            if (table !== "shows") continue;
            expect(query.update).not.toHaveBeenCalled();
            expect(query.delete).not.toHaveBeenCalled();
        }
    });

    it("refuses a non-admin", async () => {
        authGetUser.mockResolvedValue({ data: { user: { id: "u-9", email: "x@test.com" } } });
        const result = await nudgeOverdueShowHost("show-1");
        expect(result.success).toBe(false);
        expect(createNotificationsBulkMock).not.toHaveBeenCalled();
    });
});
