import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──
vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { insertMock, prefsInMock, fromMock } = vi.hoisted(() => {
    const insertMock = vi.fn();
    const prefsInMock = vi.fn();
    const fromMock = vi.fn((table: string) => {
        if (table === "users") {
            return { select: vi.fn(() => ({ in: prefsInMock })) };
        }
        return { insert: insertMock };
    });
    return { insertMock, prefsInMock, fromMock };
});

vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => ({ from: fromMock })),
}));

import {
    BULK_NOTIFICATION_CAP,
    createNotification,
    createNotificationsBulk,
} from "../createNotification";

/** Prefs rows the users-table query returns. */
function stubPrefs(rows: { id: string; notification_prefs: Record<string, boolean> | null }[]) {
    prefsInMock.mockResolvedValue({ data: rows, error: null });
}

beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockResolvedValue({ error: null });
    stubPrefs([]);
});

describe("createNotification — self-guard regression (the dropped-results bug)", () => {
    it("delivers a system event to its recipient when actorId is null", async () => {
        await createNotification({
            userId: "u1",
            type: "show_result",
            actorId: null,
            content: "🏆 You placed!",
        });
        expect(insertMock).toHaveBeenCalledTimes(1);
        expect(insertMock.mock.calls[0][0]).toMatchObject({
            user_id: "u1",
            actor_id: null,
            type: "show_result",
        });
    });

    it("delivers a system event when actorId is omitted entirely", async () => {
        await createNotification({ userId: "u1", type: "achievement", content: "🏆" });
        expect(insertMock).toHaveBeenCalledTimes(1);
        expect(insertMock.mock.calls[0][0]).toMatchObject({ actor_id: null });
    });

    it("still suppresses a genuine self-notification (actor === recipient)", async () => {
        await createNotification({
            userId: "u1",
            type: "comment",
            actorId: "u1",
            content: "you commented on your own horse",
        });
        expect(insertMock).not.toHaveBeenCalled();
    });

    it("delivers when the actor is a different user", async () => {
        await createNotification({
            userId: "u1",
            type: "comment",
            actorId: "u2",
            content: "hi",
        });
        expect(insertMock).toHaveBeenCalledTimes(1);
        expect(insertMock.mock.calls[0][0]).toMatchObject({ actor_id: "u2" });
    });
});

describe("createNotification — notification_prefs are honored", () => {
    it("skips a type the recipient disabled", async () => {
        stubPrefs([{ id: "u1", notification_prefs: { show_results: false } }]);
        await createNotification({
            userId: "u1",
            type: "show_result",
            actorId: null,
            content: "🏆",
        });
        expect(insertMock).not.toHaveBeenCalled();
    });

    it("delivers when the pref key is missing (defaults ON)", async () => {
        stubPrefs([{ id: "u1", notification_prefs: { messages: false } }]);
        await createNotification({
            userId: "u1",
            type: "show_result",
            actorId: null,
            content: "🏆",
        });
        expect(insertMock).toHaveBeenCalledTimes(1);
    });

    it("delivers when the user has no prefs row at all", async () => {
        stubPrefs([]);
        await createNotification({
            userId: "u1",
            type: "show_result",
            actorId: null,
            content: "🏆",
        });
        expect(insertMock).toHaveBeenCalledTimes(1);
    });

    it("never throws into the caller when the insert fails", async () => {
        insertMock.mockRejectedValue(new Error("boom"));
        await expect(
            createNotification({ userId: "u1", type: "show_result", actorId: null, content: "x" }),
        ).resolves.toBeUndefined();
    });
});

describe("createNotificationsBulk", () => {
    it("filters self rows, prefs-disabled rows, and inserts the rest in ONE call", async () => {
        stubPrefs([
            { id: "u1", notification_prefs: { show_results: false } },
            { id: "u2", notification_prefs: { show_results: true } },
            { id: "u3", notification_prefs: null },
        ]);
        const inserted = await createNotificationsBulk([
            { userId: "u1", type: "show_result", actorId: null, content: "muted" },
            { userId: "u2", type: "show_result", actorId: null, content: "delivered" },
            { userId: "u3", type: "show_result", actorId: null, content: "no prefs → on" },
            { userId: "u4", type: "show_result", actorId: "u4", content: "self → dropped" },
        ]);
        expect(inserted).toBe(2);
        expect(insertMock).toHaveBeenCalledTimes(1);
        const rows = insertMock.mock.calls[0][0] as { user_id: string }[];
        expect(rows.map((r) => r.user_id)).toEqual(["u2", "u3"]);
    });

    it("returns 0 and skips the insert when nothing survives filtering", async () => {
        stubPrefs([{ id: "u1", notification_prefs: { show_results: false } }]);
        const inserted = await createNotificationsBulk([
            { userId: "u1", type: "show_result", actorId: null, content: "muted" },
        ]);
        expect(inserted).toBe(0);
        expect(insertMock).not.toHaveBeenCalled();
    });

    it("caps a runaway fan-out at BULK_NOTIFICATION_CAP rows", async () => {
        const rows = Array.from({ length: BULK_NOTIFICATION_CAP + 50 }, (_, i) => ({
            userId: `u${i}`,
            type: "show_result",
            actorId: null,
            content: "x",
        }));
        stubPrefs([]);
        const inserted = await createNotificationsBulk(rows);
        expect(inserted).toBe(BULK_NOTIFICATION_CAP);
        const insertedRows = insertMock.mock.calls[0][0] as unknown[];
        expect(insertedRows).toHaveLength(BULK_NOTIFICATION_CAP);
    });

    it("returns 0 (never throws) when the insert fails", async () => {
        insertMock.mockResolvedValue({ error: { message: "insert denied" } });
        stubPrefs([]);
        const inserted = await createNotificationsBulk([
            { userId: "u1", type: "show_result", actorId: null, content: "x" },
        ]);
        expect(inserted).toBe(0);
    });

    it("loads prefs once for all recipients (single users query)", async () => {
        stubPrefs([]);
        await createNotificationsBulk([
            { userId: "u1", type: "show_result", actorId: null, content: "a" },
            { userId: "u2", type: "show_result", actorId: null, content: "b" },
            { userId: "u3", type: "show_deadline", actorId: null, content: "c" },
        ]);
        expect(prefsInMock).toHaveBeenCalledTimes(1);
        expect(prefsInMock.mock.calls[0][1]).toEqual(["u1", "u2", "u3"]);
    });
});
