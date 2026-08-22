/**
 * Follow-a-show: the audience, the dedupe, and the degrade path.
 *
 * The three things this file exists to hold still:
 *   1. A member who FOLLOWS and ENTERED gets exactly ONE notification
 *      per event. Entering implicitly follows, so this is the common
 *      case, not the edge case.
 *   2. Pre-184 (show_followers missing) every path behaves EXACTLY as
 *      it did before this feature: entrants only, nothing thrown.
 *   3. A fan-out never throws — a notification failure must never be
 *      able to break a status transition.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// The module under test pulls in the server-only notification sink and
// the email senders; both must import cleanly under node.
vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const createNotificationsBulk = vi.fn().mockResolvedValue(0);
vi.mock("@/lib/notifications/createNotification", () => ({
    createNotification: vi.fn().mockResolvedValue(undefined),
    createNotificationsBulk: (...args: unknown[]) => createNotificationsBulk(...args),
    BULK_NOTIFICATION_CAP: 500,
}));
vi.mock("@/lib/email/showEmails", () => ({
    sendShowResultsEmails: vi.fn().mockResolvedValue({ sent: 0 }),
    sendEntriesClosingEmails: vi.fn().mockResolvedValue({ sent: 0 }),
}));

import { loadShowAudience, mergeAudience } from "../followers";
import {
    buildEntriesClosedPlans,
    buildJudgingStartedPlans,
    buildResultsFollowerPlans,
    runEntriesClosedFanout,
    runJudgingStartedFanout,
    runResultsFollowersFanout,
} from "../notifications";

const SHOW_ID = "show-1";

/** Postgres "relation does not exist" — the pre-184 shape. */
const MISSING_TABLE = { code: "42P01", message: 'relation "show_followers" does not exist' };

type TableResult = { data?: unknown; error?: unknown };

/**
 * A Supabase double that routes by TABLE NAME. The shared-chain mock in
 * __tests__/mocks/supabase can't express "entries succeed but
 * show_followers 42P01s", which is the exact shape every degrade test
 * here needs.
 */
function fakeClient(tables: Record<string, TableResult>) {
    const seen: string[] = [];
    const build = (result: TableResult) => {
        const settled = { data: result.data ?? null, error: result.error ?? null };
        const chain: Record<string, unknown> = {
            select: () => chain,
            eq: () => chain,
            in: () => chain,
            order: () => chain,
            limit: () => chain,
            maybeSingle: async () => settled,
            single: async () => settled,
            then: (resolve: (v: unknown) => unknown) => Promise.resolve(settled).then(resolve),
        };
        return chain;
    };
    return {
        client: {
            from: (table: string) => {
                seen.push(table);
                return build(tables[table] ?? { data: [] });
            },
        } as unknown as SupabaseClient,
        seen,
    };
}

/** A show row + entries + followers, in the shape the loaders read. */
function audienceClient(input: {
    entries?: { owner_id: string; status?: string }[];
    followers?: { user_id: string }[];
    followersError?: unknown;
    entriesError?: unknown;
    title?: string | null;
}) {
    return fakeClient({
        shows:
            input.title === null
                ? { data: null }
                : { data: { id: SHOW_ID, title: input.title ?? "Summerween" } },
        show_class_entries: input.entriesError
            ? { error: input.entriesError }
            : {
                  data: (input.entries ?? []).map((e) => ({
                      owner_id: e.owner_id,
                      status: e.status ?? "entered",
                  })),
              },
        show_followers: input.followersError
            ? { error: input.followersError }
            : { data: input.followers ?? [] },
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    createNotificationsBulk.mockResolvedValue(0);
});

// ══════════════════════════════════════════════════════════════
// The dedupe — pure
// ══════════════════════════════════════════════════════════════

describe("mergeAudience", () => {
    it("counts a member who FOLLOWS and ENTERED exactly once", () => {
        const merged = mergeAudience({
            entrantIds: ["alice", "bob"],
            followerIds: ["alice", "carol"],
        });
        // alice is in both sets and appears ONCE in the send list.
        expect(merged.audienceIds).toEqual(["alice", "bob", "carol"]);
        expect(merged.audienceIds.filter((id) => id === "alice")).toHaveLength(1);
        // ...and never in the follower-only list, which is what keeps
        // her from being told "results are up" on top of her placings.
        expect(merged.followerOnlyIds).toEqual(["carol"]);
    });

    it("collapses an entrant who entered several classes", () => {
        const merged = mergeAudience({
            entrantIds: ["alice", "alice", "alice", "bob"],
            followerIds: [],
        });
        expect(merged.entrantIds).toEqual(["alice", "bob"]);
        expect(merged.audienceIds).toEqual(["alice", "bob"]);
    });

    it("collapses duplicate follower rows and drops empty ids", () => {
        const merged = mergeAudience({
            entrantIds: ["", "alice"],
            followerIds: ["carol", "carol", ""],
        });
        expect(merged.entrantIds).toEqual(["alice"]);
        expect(merged.followerIds).toEqual(["carol"]);
        expect(merged.audienceIds).toEqual(["alice", "carol"]);
    });

    it("orders entrants first, then followers who did not enter", () => {
        const merged = mergeAudience({
            entrantIds: ["bob", "alice"],
            followerIds: ["zoe", "bob"],
        });
        expect(merged.audienceIds).toEqual(["bob", "alice", "zoe"]);
    });

    it("returns an empty audience for a show nobody entered or follows", () => {
        const merged = mergeAudience({ entrantIds: [], followerIds: [] });
        expect(merged.audienceIds).toEqual([]);
        expect(merged.followerOnlyIds).toEqual([]);
    });
});

// ══════════════════════════════════════════════════════════════
// The loader — union, scratches, and the pre-184 degrade
// ══════════════════════════════════════════════════════════════

describe("loadShowAudience", () => {
    it("unions entrants and followers, deduped", async () => {
        const { client } = audienceClient({
            entries: [{ owner_id: "alice" }, { owner_id: "bob" }],
            followers: [{ user_id: "alice" }, { user_id: "carol" }],
        });
        const audience = await loadShowAudience(client, SHOW_ID);
        expect(audience.followSupported).toBe(true);
        expect(audience.audienceIds).toEqual(["alice", "bob", "carol"]);
        expect(audience.followerOnlyIds).toEqual(["carol"]);
    });

    it("excludes SCRATCHED entries from the entrant half", async () => {
        const { client } = audienceClient({
            entries: [
                { owner_id: "alice", status: "scratched" },
                { owner_id: "bob" },
            ],
            followers: [],
        });
        const audience = await loadShowAudience(client, SHOW_ID);
        expect(audience.entrantIds).toEqual(["bob"]);
    });

    it("degrades to ENTRANTS ONLY when 184 is unapplied", async () => {
        const { client } = audienceClient({
            entries: [{ owner_id: "alice" }, { owner_id: "bob" }],
            followersError: MISSING_TABLE,
        });
        const audience = await loadShowAudience(client, SHOW_ID);
        // Exactly today's behaviour: the follower half is empty and the
        // audience is precisely the entrant list. Nothing throws.
        expect(audience.followSupported).toBe(false);
        expect(audience.followerIds).toEqual([]);
        expect(audience.audienceIds).toEqual(["alice", "bob"]);
        expect(audience.followerOnlyIds).toEqual([]);
    });

    it("returns an empty audience — never throws — if entries fail to load", async () => {
        const { client } = audienceClient({
            entriesError: { code: "500", message: "boom" },
        });
        const audience = await loadShowAudience(client, SHOW_ID);
        expect(audience.audienceIds).toEqual([]);
    });

    it("survives a client that throws outright", async () => {
        const exploding = {
            from: () => {
                throw new Error("connection lost");
            },
        } as unknown as SupabaseClient;
        await expect(loadShowAudience(exploding, SHOW_ID)).resolves.toEqual(
            expect.objectContaining({ audienceIds: [] }),
        );
    });
});

// ══════════════════════════════════════════════════════════════
// The plan builders
// ══════════════════════════════════════════════════════════════

describe("lifecycle plan builders", () => {
    it("names the show and deep-links each event", () => {
        const args = { showId: SHOW_ID, showTitle: "Summerween", recipientIds: ["alice"] };

        const closed = buildEntriesClosedPlans(args)[0];
        expect(closed.type).toBe("show_entries_closed");
        expect(closed.content).toContain("Summerween");
        expect(closed.linkUrl).toBe(`/shows/${SHOW_ID}#entries`);

        const judging = buildJudgingStartedPlans(args)[0];
        expect(judging.type).toBe("show_judging_started");
        expect(judging.content).toMatch(/judging has begun/i);
        expect(judging.linkUrl).toBe(`/shows/${SHOW_ID}`);

        const results = buildResultsFollowerPlans(args)[0];
        expect(results.type).toBe("show_results_posted");
        expect(results.linkUrl).toBe(`/shows/${SHOW_ID}#results`);
    });

    it("emits system rows (no actor) so nobody is self-guarded out", () => {
        // A fan-out carrying an actorId would drop that person's own
        // row in createNotification's self-guard — including the host.
        const plans = buildEntriesClosedPlans({
            showId: SHOW_ID,
            showTitle: "Summerween",
            recipientIds: ["alice", "bob"],
        });
        expect(plans.every((p) => p.actorId === null)).toBe(true);
    });

    it("builds exactly one plan per recipient", () => {
        const plans = buildJudgingStartedPlans({
            showId: SHOW_ID,
            showTitle: "Summerween",
            recipientIds: ["a", "b", "c"],
        });
        expect(plans).toHaveLength(3);
    });
});

// ══════════════════════════════════════════════════════════════
// The fan-outs — one notification each, one batched call, no throws
// ══════════════════════════════════════════════════════════════

describe("lifecycle fan-outs", () => {
    it("sends ONE notification to a member who both follows and entered", async () => {
        const { client } = audienceClient({
            entries: [{ owner_id: "alice" }],
            followers: [{ user_id: "alice" }],
        });
        await runEntriesClosedFanout(client, SHOW_ID);

        expect(createNotificationsBulk).toHaveBeenCalledTimes(1);
        const rows = createNotificationsBulk.mock.calls[0][0] as { userId: string }[];
        expect(rows).toHaveLength(1);
        expect(rows[0].userId).toBe("alice");
    });

    it("BATCHES a 200-follower show into a single bulk call", async () => {
        const followers = Array.from({ length: 200 }, (_, i) => ({ user_id: `f${i}` }));
        const { client } = audienceClient({
            entries: [{ owner_id: "alice" }],
            followers,
        });
        await runEntriesClosedFanout(client, SHOW_ID);

        // One call, 201 rows — not a 201-iteration serial loop.
        expect(createNotificationsBulk).toHaveBeenCalledTimes(1);
        expect(createNotificationsBulk.mock.calls[0][0]).toHaveLength(201);
    });

    it("results fan-out reaches ONLY followers who did not enter", async () => {
        const { client } = audienceClient({
            entries: [{ owner_id: "alice" }],
            followers: [{ user_id: "alice" }, { user_id: "carol" }],
        });
        await runResultsFollowersFanout(client, SHOW_ID);

        const rows = createNotificationsBulk.mock.calls[0][0] as { userId: string }[];
        // alice entered — she gets her placings from the results
        // fan-out and must NOT also be told "results are up".
        expect(rows.map((r) => r.userId)).toEqual(["carol"]);
    });

    it("judging fan-out excludes entrants on a COMMUNITY-VOTE show", async () => {
        const { client } = audienceClient({
            entries: [{ owner_id: "alice" }],
            followers: [{ user_id: "carol" }],
        });
        await runJudgingStartedFanout(client, SHOW_ID, { excludeEntrants: true });

        // alice just received "voting is open — your entries are on the
        // ring"; only carol needs to hear the show is moving.
        const rows = createNotificationsBulk.mock.calls[0][0] as { userId: string }[];
        expect(rows.map((r) => r.userId)).toEqual(["carol"]);
    });

    it("judging fan-out reaches the whole audience on a JUDGED show", async () => {
        const { client } = audienceClient({
            entries: [{ owner_id: "alice" }],
            followers: [{ user_id: "carol" }],
        });
        await runJudgingStartedFanout(client, SHOW_ID);

        const rows = createNotificationsBulk.mock.calls[0][0] as { userId: string }[];
        expect(rows.map((r) => r.userId)).toEqual(["alice", "carol"]);
    });

    it("sends NOTHING when the audience is empty", async () => {
        const { client } = audienceClient({ entries: [], followers: [] });
        await runEntriesClosedFanout(client, SHOW_ID);
        expect(createNotificationsBulk).not.toHaveBeenCalled();
    });

    it("still reaches entrants when 184 is unapplied", async () => {
        const { client } = audienceClient({
            entries: [{ owner_id: "alice" }],
            followersError: MISSING_TABLE,
        });
        await runEntriesClosedFanout(client, SHOW_ID);

        const rows = createNotificationsBulk.mock.calls[0][0] as { userId: string }[];
        expect(rows.map((r) => r.userId)).toEqual(["alice"]);
    });

    it("sends nothing — and does not throw — when the show is gone", async () => {
        const { client } = audienceClient({ title: null, entries: [{ owner_id: "a" }] });
        await expect(runEntriesClosedFanout(client, SHOW_ID)).resolves.toBeUndefined();
        expect(createNotificationsBulk).not.toHaveBeenCalled();
    });

    it("SWALLOWS a notification sink failure", async () => {
        // The single most important constraint: a host must never be
        // blocked from running their show because a notify call failed.
        createNotificationsBulk.mockRejectedValueOnce(new Error("sink down"));
        const { client } = audienceClient({
            entries: [{ owner_id: "alice" }],
            followers: [],
        });
        await expect(runEntriesClosedFanout(client, SHOW_ID)).resolves.toBeUndefined();
    });
});
