/**
 * Registry Desk lists (Package C): every action checks the role first,
 * veto and retire are the owner's, claims don't collide, a rule takes
 * effect at 3 agreements, nobody checks their own work, and the Desk
 * waits politely for updates 242 and 244.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, OK, type FakeQuery } from "@/__tests__/mocks/fakeDb";

type Role = "owner" | "moderator";
let viewer: { id: string; role: Role; alias: string } | null = null;
let refusal: Error | null = null;
vi.mock("@/lib/auth", async () => {
    const real = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
    return {
        ...real,
        requireRegistryModerator: vi.fn(async () => {
            if (refusal) throw refusal;
            if (!viewer) throw new real.AuthError("The Registry Desk is for Registry moderators.");
            return { supabase: {}, user: { id: viewer.id }, role: viewer.role, alias: viewer.alias };
        }),
    };
});
const db = fakeDb();
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: vi.fn(() => db) }));
vi.mock("@/lib/supabase/anon", () => ({ createAnonClient: vi.fn(() => db) }));
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
    unstable_cache: (fn: unknown) => fn,
}));
let rateOk = true;
vi.mock("@/lib/utils/rateLimit", () => ({ checkRateLimit: vi.fn(async () => rateOk) }));
const undoCalls: unknown[][] = [];
vi.mock("@/lib/catalog/write", () => ({
    validateChanges: vi.fn(),
    undoAction: vi.fn(async (...args: unknown[]) => {
        undoCalls.push(args);
        return { restored: 2, drifted: 1 };
    }),
}));

import { AuthError, SUSPENDED_AUTH_ERROR } from "@/lib/auth";
import { ACCOUNT_SUSPENDED, NOT_LOGGED_IN } from "@/lib/actions/result";
import * as actions from "@/app/actions/registry-desk-lists";

const RULE = "11111111-1111-4111-8111-111111111111";
const ACTION = "22222222-2222-4222-8222-222222222222";
const MISSING = { data: null, error: { code: "PGRST205", message: "table not found" } };

beforeEach(() => {
    db.reset();
    viewer = { id: "u-bay", role: "moderator", alias: "BayLeaf" };
    refusal = null;
    rateOk = true;
    undoCalls.length = 0;
    db.on("users", () => ({ data: [{ id: "u-maple", alias_name: "Maple" }], error: null }));
});

describe("every export checks the role first", () => {
    const source = readFileSync(path.join(process.cwd(), "src/app/actions/registry-desk-lists.ts"), "utf8");
    // Each export's name and the first line of its body (signatures may span lines).
    const exported = source
        .split(/^export async function /m)
        .slice(1)
        .map((chunk) => {
            const name = chunk.match(/^\w+/)![0];
            const open = chunk.search(/[)>]\s*\{\r?\n/);
            const body = chunk.slice(chunk.indexOf("{", open) + 1);
            return [chunk, name, body.trim().split(/\r?\n/)[0]] as const;
        });

    it("by reading the source: the first line of each is the role check", () => {
        expect(exported.length).toBe(Object.keys(actions).length);
        for (const [, name, first] of exported)
            expect(first, name).toMatch(/^const me = await requireRegistryModerator\(\)\.catch\(refused\);/);
    });

    it.each(Object.keys(actions))("%s refuses a member who is not a moderator", async (name) => {
        viewer = null;
        const fn = (actions as Record<string, (...a: unknown[]) => Promise<unknown>>)[name];
        const out = await fn("x", "y", "z");
        expect(out).toEqual({ success: false, error: "The Registry Desk is for Registry moderators." });
        expect(db.queries).toHaveLength(0);
    });

    it("says log in, or suspended, in the site's words", async () => {
        refusal = new AuthError();
        expect(await actions.listRules()).toEqual({ success: false, error: NOT_LOGGED_IN });
        refusal = new AuthError(SUSPENDED_AUTH_ERROR);
        expect(await actions.listRules()).toEqual({ success: false, error: ACCOUNT_SUSPENDED });
    });
});

describe("owner only", () => {
    it("a moderator can't veto or retire", async () => {
        expect(await actions.vetoRule(RULE, "No, thanks")).toEqual({
            success: false,
            error: "Only the site owner can veto a rule.",
        });
        expect(await actions.retireRule(RULE)).toEqual({
            success: false,
            error: "Only the site owner can retire a rule.",
        });
        expect(db.writes("registry_style_rules")).toHaveLength(0);
    });

    it("the owner vetoes a rule in effect, with a note", async () => {
        viewer = { id: "u-owner", role: "owner", alias: "Owner" };
        db.on("registry_style_rules", (q) =>
            q.op === "select" ? { data: { id: RULE, status: "in_effect", proposed_by: "u-maple" }, error: null } : OK,
        );
        expect(await actions.vetoRule(RULE, "Breaks the set pages")).toEqual({ success: true });
        expect(db.writes("registry_style_rules")[0].payload).toMatchObject({
            status: "vetoed",
            veto_note: "Breaks the set pages",
        });
    });
});

describe("rules", () => {
    function ruleWithVotes(status: string, votes: { voter_id: string; vote: string }[]) {
        db.on("registry_style_rules", (q) =>
            q.op === "select" ? { data: { id: RULE, status, proposed_by: "u-maple" }, error: null } : OK,
        );
        db.on("registry_rule_votes", (q) => (q.op === "select" ? { data: votes, error: null } : OK));
    }

    it("takes effect on the third agreement (the proposer's doesn't count)", async () => {
        ruleWithVotes("proposed", [
            { voter_id: "u-maple", vote: "agree" },
            { voter_id: "u-ridge", vote: "agree" },
            { voter_id: "u-fern", vote: "agree" },
            { voter_id: "u-bay", vote: "agree" },
        ]);
        const out = await actions.voteRule(RULE, "agree");
        expect(out).toEqual({ success: true, status: "in_effect", agreements: 3 });
        const move = db.writes("registry_style_rules")[0];
        expect(move.payload).toMatchObject({ status: "in_effect" });
        expect(db.filter(move, "eq", "status")).toBe("proposed");
    });

    it("two agreements stay proposed", async () => {
        ruleWithVotes("proposed", [
            { voter_id: "u-ridge", vote: "agree" },
            { voter_id: "u-bay", vote: "agree" },
        ]);
        expect(await actions.voteRule(RULE, "agree")).toEqual({ success: true, status: "proposed", agreements: 2 });
        expect(db.writes("registry_style_rules")).toHaveLength(0);
    });

    it("the proposer can't vote on their own rule", async () => {
        viewer = { id: "u-maple", role: "moderator", alias: "Maple" };
        ruleWithVotes("proposed", []);
        const out = await actions.voteRule(RULE, "agree");
        expect(out).toMatchObject({ success: false, error: expect.stringMatching(/proposed this rule/) });
        expect(db.writes("registry_rule_votes")).toHaveLength(0);
    });

    it("refuses a fix the Desk doesn't know, and holds the daily limit (owner exempt)", async () => {
        expect(
            await actions.proposeRule({ title: "Odd", body: "A rule with a made-up fix.", checkKey: "nope" }),
        ).toMatchObject({
            success: false,
        });
        rateOk = false;
        expect(await actions.proposeRule({ title: "Set titles", body: "Set pieces are titled ..." })).toMatchObject({
            success: false,
            error: expect.stringMatching(/10 rule proposals/),
        });
        viewer = { id: "u-owner", role: "owner", alias: "Owner" };
        db.on("registry_style_rules", () => ({ data: { id: RULE }, error: null }));
        expect(await actions.proposeRule({ title: "Set titles", body: "Set pieces are titled ..." })).toEqual({
            success: true,
            id: RULE,
        });
        expect(db.writes("registry_style_rules")[0].payload).toMatchObject({
            status: "proposed",
            proposed_by: "u-owner",
        });
    });

    it("says it's coming before update 244", async () => {
        db.on("registry_style_rules", () => MISSING);
        expect(await actions.listRules()).toEqual({ success: false, error: "Coming once update 244 is added." });
    });
});

describe("to-do claims", () => {
    it("refuses a claim another moderator holds", async () => {
        db.on("registry_todo_claims", (q: FakeQuery) =>
            q.op === "select"
                ? {
                      data: {
                          claimed_by: "u-maple",
                          claimed_until: new Date(Date.now() + 3600_000).toISOString(),
                          done_at: null,
                      },
                      error: null,
                  }
                : OK,
        );
        const out = await actions.claimTodo("no_colour", "row-1");
        expect(out).toEqual({ success: false, error: "@Maple is on it already. Pick another one." });
        expect(db.writes("registry_todo_claims")).toHaveLength(0);
    });

    it("takes over an expired claim, for a day", async () => {
        db.on("registry_todo_claims", (q: FakeQuery) =>
            q.op === "select"
                ? { data: { claimed_by: "u-maple", claimed_until: "2026-01-01T00:00:00Z", done_at: null }, error: null }
                : OK,
        );
        const out = await actions.claimTodo("no_colour", "row-1");
        expect(out).toMatchObject({ success: true });
        const until = Date.parse((out as { until: string }).until);
        expect(until - Date.now()).toBeGreaterThan(23 * 3600_000);
        expect(db.writes("registry_todo_claims")[0].payload).toMatchObject({ claimed_by: "u-bay", item_key: "row-1" });
    });

    it("refuses a list that doesn't exist", async () => {
        expect(await actions.claimTodo("not_a_list")).toEqual({ success: false, error: "There is no such list." });
    });

    it("says it's coming before update 244", async () => {
        db.on("registry_todo_claims", () => MISSING);
        expect(await actions.claimTodo("no_colour")).toEqual({
            success: false,
            error: "Coming once update 244 is added.",
        });
    });
});

describe("history", () => {
    it("before update 242 says when it starts, without failing", async () => {
        db.on("registry_actions", () => MISSING);
        expect(await actions.getHistory()).toMatchObject({
            success: true,
            ready: false,
            message: "History starts once update 242 is added.",
        });
    });

    it("offers Undo within 30 days, and Looks right only on someone else's work", async () => {
        const later = new Date(Date.now() + 86400_000).toISOString();
        db.on("registry_actions", () => ({
            data: [
                {
                    id: "a1",
                    kind: "edit",
                    status: "applied",
                    actor_id: "u-maple",
                    summary: "Fixed",
                    undo_until: later,
                    created_at: "",
                },
                {
                    id: "a2",
                    kind: "edit",
                    status: "applied",
                    actor_id: "u-bay",
                    summary: "Mine",
                    undo_until: later,
                    created_at: "",
                },
                {
                    id: "a3",
                    kind: "edit",
                    status: "applied",
                    actor_id: "u-maple",
                    summary: "Old",
                    undo_until: "2026-01-01T00:00:00Z",
                    created_at: "",
                },
            ],
            error: null,
        }));
        const out = await actions.getHistory({ who: "all" });
        if (!out.success) throw new Error(out.error);
        expect(out.entries.map((e) => [e.id, e.canUndo, e.canMarkLooksRight, e.by])).toEqual([
            ["a1", true, true, "Maple"],
            ["a2", true, false, "a moderator"],
            ["a3", false, true, "Maple"],
        ]);
    });

    it("never lets a moderator mark their own work as looking right", async () => {
        db.on("registry_actions", () => ({
            data: { actor_id: "u-bay", status: "applied", looks_right_by: null },
            error: null,
        }));
        expect(await actions.markLooksRight(ACTION)).toMatchObject({
            success: false,
            error: expect.stringMatching(/Someone else/),
        });
        expect(db.writes("registry_actions")).toHaveLength(0);
    });

    it("undo goes through the one writer, as this moderator", async () => {
        expect(await actions.undoAction(ACTION, "Wrong mold")).toEqual({ success: true, restored: 2, drifted: 1 });
        expect(undoCalls[0]).toEqual([{ userId: "u-bay", alias: "BayLeaf", role: "moderator" }, ACTION, "Wrong mold"]);
    });
});
