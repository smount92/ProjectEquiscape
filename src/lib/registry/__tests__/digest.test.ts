/**
 * The owner's daily Registry digest (Package C): it lists every removal
 * and every merge, it goes out once a day, it is the bell only, and it
 * waits quietly for updates 242 and 244.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, OK, type FakeQuery } from "@/__tests__/mocks/fakeDb";

const sent: { userId: string; type: string; content: string; linkUrl?: string }[][] = [];
vi.mock("@/lib/notifications/createNotification", () => ({
    createNotificationsBulk: vi.fn(async (rows: { userId: string; type: string; content: string }[]) => {
        sent.push(rows);
        return rows.length;
    }),
}));
vi.mock("@/lib/notifications/adminTargets", () => ({ adminNotificationTargets: vi.fn(async () => ["owner-1"]) }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/supabase/anon", () => ({ createAnonClient: vi.fn() }));

import { digestText, sendRegistryDigest, type RegistryDigest } from "@/lib/registry/digest";

const NOW = new Date("2026-10-17T06:00:00Z");
const action = (id: string, kind: string, summary: string, status = "applied", actor = "u-bay") => ({
    id,
    kind,
    status,
    actor_id: actor,
    item_title: summary,
    summary,
    created_at: "2026-10-16T12:00:00Z",
});

function setup(opts: {
    digests?: { day: string; sent_at: string }[];
    actions?: ReturnType<typeof action>[];
    insertReturns?: unknown[];
    missing?: "registry_digests" | "registry_actions";
}) {
    const db = fakeDb();
    const missing = { data: null, error: { code: "PGRST205", message: "table not found" } };
    db.on("registry_digests", (q: FakeQuery) => {
        if (opts.missing === "registry_digests") return missing;
        if (q.op === "upsert") return { data: opts.insertReturns ?? [{ day: "2026-10-17" }], error: null };
        return { data: opts.digests ?? [], error: null };
    });
    db.on("registry_actions", (q: FakeQuery) => {
        if (opts.missing === "registry_actions") return missing;
        if (q.filters.some((f) => f[0] === "eq" && f[1] === "status"))
            return { data: null, error: null, count: 1 } as never;
        return { data: opts.actions ?? [], error: null };
    });
    db.on("registry_style_rules", () => ({ data: [], error: null }));
    db.on("users", () => ({
        data: [
            { id: "u-bay", alias_name: "BayLeaf" },
            { id: "u-maple", alias_name: "Maple" },
        ],
        error: null,
    }));
    return db;
}

describe("sendRegistryDigest", () => {
    beforeEach(() => {
        sent.length = 0;
    });

    it("lists every removal and every merge, by name and by who", async () => {
        const actions = [
            action("a1", "edit", "Fixed colour on Saddlebred"),
            action("a2", "remove", "Removed “Sears Holiday Catalog” (nothing linked)"),
            action("a3", "remove", "Removed “Test Row”", "applied", "u-maple"),
            action("a4", "merge", "Merged “Morgan Stallion (G1)” into “Morgan Stallion”"),
            action("a5", "merge", "Merged “Pinto Saddlebred” into “Saddlebred”", "awaiting_second_look", "u-maple"),
            ...Array.from({ length: 30 }, (_, i) => action(`e${i}`, "edit", `Edit ${i}`)),
        ];
        const db = setup({ actions });
        const out = await sendRegistryDigest(db as never, NOW);
        expect(out).toMatchObject({ sent: true, recipients: 1, total: 35 });
        expect(sent).toHaveLength(1);
        const [note] = sent[0];
        expect(note).toMatchObject({ userId: "owner-1", type: "registry_digest", linkUrl: "/catalog/desk/history" });
        for (const a of actions.filter((x) => x.kind === "remove" || x.kind === "merge"))
            expect(note.content).toContain(a.summary);
        expect(note.content).toContain("@Maple");
        expect(note.content).toContain("waiting for a second look");
        expect(note.content).toMatch(/31 edits, 2 merges, 2 removals/);
    });

    it("goes out once a day: the day's row is inserted first, and only the run that inserted it rings", async () => {
        const db = setup({ actions: [action("a1", "remove", "Removed X")], insertReturns: [] });
        expect(await sendRegistryDigest(db as never, NOW)).toMatchObject({ sent: false, reason: "already_sent" });
        expect(sent).toHaveLength(0);
        const upsert = db.writes("registry_digests")[0];
        expect(upsert.op).toBe("upsert");
        expect(upsert.payload).toMatchObject({ day: "2026-10-17" });
    });

    it("doesn't build again once today's digest is recorded", async () => {
        const db = setup({ digests: [{ day: "2026-10-17", sent_at: "2026-10-17T06:00:01Z" }] });
        expect(await sendRegistryDigest(db as never, NOW)).toMatchObject({ sent: false, reason: "already_sent" });
        expect(db.writes("registry_digests")).toHaveLength(0);
        expect(sent).toHaveLength(0);
    });

    it("covers everything since the last digest", async () => {
        const db = setup({ digests: [{ day: "2026-10-15", sent_at: "2026-10-15T06:00:00Z" }] });
        await sendRegistryDigest(db as never, NOW);
        const read = db.queries.find((q) => q.table === "registry_actions" && q.filters.some((f) => f[0] === "gte"));
        expect(db.filter(read!, "gte", "created_at")).toBe("2026-10-15T06:00:00Z");
    });

    it("records a quiet day but rings nothing", async () => {
        const db = setup({ actions: [] });
        db.on("registry_actions", (q: FakeQuery) =>
            q.filters.some((f) => f[0] === "eq") ? ({ data: null, error: null, count: 0 } as never) : OK,
        );
        expect(await sendRegistryDigest(db as never, NOW)).toMatchObject({ sent: false, reason: "quiet" });
        expect(db.writes("registry_digests")).toHaveLength(1);
        expect(sent).toHaveLength(0);
    });

    it("is not quiet while members' suggestions wait in the Queue", async () => {
        const db = setup({ actions: [] });
        db.on("registry_actions", (q: FakeQuery) =>
            q.filters.some((f) => f[0] === "eq") ? ({ data: null, error: null, count: 0 } as never) : OK,
        );
        db.on("catalog_suggestions", () => ({ data: null, error: null, count: 3 }) as never);
        expect(await sendRegistryDigest(db as never, NOW)).toMatchObject({ sent: true });
        expect(sent[0][0].content).toContain("3 member suggestions waiting in the Queue.");
    });

    it("waits for update 244, then for 242", async () => {
        expect(await sendRegistryDigest(setup({ missing: "registry_digests" }) as never, NOW)).toMatchObject({
            sent: false,
            reason: "pending_244",
        });
        const db = setup({ missing: "registry_actions" });
        expect(await sendRegistryDigest(db as never, NOW)).toMatchObject({ sent: false, reason: "pending_242" });
        expect(db.writes("registry_digests")).toHaveLength(0);
        expect(sent).toHaveLength(0);
    });
});

describe("digestText", () => {
    const base: RegistryDigest = {
        since: "",
        until: "",
        total: 0,
        byKind: {},
        removals: [],
        merges: [],
        undos: 0,
        secondLooksWaiting: 0,
        suggestionsWaiting: 0,
        rulesProposed: 0,
        rulesInEffect: 0,
    };

    it("counts members' suggestions waiting in the Queue (where the per-suggestion pings went)", () => {
        expect(digestText({ ...base, suggestionsWaiting: 1 })).toMatch(/1 member suggestion waiting in the Queue\./);
        expect(digestText({ ...base, suggestionsWaiting: 4 })).toMatch(/4 member suggestions waiting/);
        expect(digestText(base)).not.toMatch(/suggestion/);
    });

    it("says one and many in words", () => {
        expect(digestText({ ...base, total: 2, byKind: { edit: 1, add: 1 } })).toBe(
            "Registry Desk, last 24 hours: 1 edit, 1 new entry.",
        );
    });

    it("reminds the owner a rule can be vetoed", () => {
        expect(digestText({ ...base, rulesProposed: 1 })).toMatch(/veto/);
    });
});
