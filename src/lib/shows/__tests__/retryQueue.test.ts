/**
 * Phase E2 — the ring console's offline retry queue: queue/flush/
 * dedupe semantics and the honest failure boundary (server
 * refusals drop; network failures keep and stop).
 */

import { describe, expect, it, vi } from "vitest";

import {
    enqueueSave,
    flushQueue,
    loadQueue,
    queueStorageKey,
    removeSave,
    type PendingPlacingSave,
    type StorageLike,
} from "../retryQueue";

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
    const store = new Map(Object.entries(initial));
    return {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => void store.set(k, v),
        removeItem: (k) => void store.delete(k),
    };
}

function save(classId: string, markDone = true): PendingPlacingSave {
    return {
        classId,
        placings: [{ entryId: `entry-${classId}`, place: 1 }],
        markDone,
        queuedAt: "2026-07-10T09:00:00.000Z",
    };
}

describe("retryQueue — load/enqueue/dedupe", () => {
    it("loads empty for missing or corrupt storage", () => {
        expect(loadQueue(memoryStorage(), "show-1")).toEqual([]);
        expect(
            loadQueue(memoryStorage({ [queueStorageKey("show-1")]: "{not json" }), "show-1"),
        ).toEqual([]);
        expect(
            loadQueue(
                memoryStorage({ [queueStorageKey("show-1")]: '{"an":"object"}' }),
                "show-1",
            ),
        ).toEqual([]);
        // Wrong-shaped items are filtered, valid ones survive.
        expect(
            loadQueue(
                memoryStorage({
                    [queueStorageKey("show-1")]: JSON.stringify([save("c1"), { junk: true }]),
                }),
                "show-1",
            ),
        ).toEqual([save("c1")]);
    });

    it("queues per show and survives a reload round-trip", () => {
        const storage = memoryStorage();
        enqueueSave(storage, "show-1", save("c1"));
        enqueueSave(storage, "show-2", save("c9"));
        expect(loadQueue(storage, "show-1")).toEqual([save("c1")]);
        expect(loadQueue(storage, "show-2")).toEqual([save("c9")]);
    });

    it("dedupes by class — the latest slate replaces, keeping position", () => {
        const storage = memoryStorage();
        enqueueSave(storage, "show-1", save("c1"));
        enqueueSave(storage, "show-1", save("c2"));
        const replacement: PendingPlacingSave = {
            classId: "c1",
            placings: [
                { entryId: "entry-x", place: 1 },
                { entryId: "entry-y", place: 2 },
            ],
            markDone: false,
            queuedAt: "2026-07-10T09:05:00.000Z",
        };
        const queue = enqueueSave(storage, "show-1", replacement);
        expect(queue).toEqual([replacement, save("c2")]);
    });

    it("removeSave drops one class and clears storage when empty", () => {
        const storage = memoryStorage();
        enqueueSave(storage, "show-1", save("c1"));
        expect(removeSave(storage, "show-1", "c1")).toEqual([]);
        expect(storage.getItem(queueStorageKey("show-1"))).toBeNull();
    });
});

describe("retryQueue — flushQueue", () => {
    it("flushes successful saves and empties the queue", async () => {
        const storage = memoryStorage();
        enqueueSave(storage, "show-1", save("c1"));
        enqueueSave(storage, "show-1", save("c2"));
        const sender = vi.fn().mockResolvedValue({ success: true });

        const result = await flushQueue(storage, "show-1", sender);
        expect(result.flushed).toEqual(["c1", "c2"]);
        expect(result.remaining).toEqual([]);
        expect(loadQueue(storage, "show-1")).toEqual([]);
        expect(sender).toHaveBeenCalledTimes(2);
    });

    it("DROPS server refusals (never retried) and reports them", async () => {
        const storage = memoryStorage();
        enqueueSave(storage, "show-1", save("c1"));
        enqueueSave(storage, "show-1", save("c2"));
        const sender = vi
            .fn()
            .mockResolvedValueOnce({ success: false, error: "Class is combined." })
            .mockResolvedValueOnce({ success: true });

        const result = await flushQueue(storage, "show-1", sender);
        expect(result.rejected).toEqual([{ classId: "c1", error: "Class is combined." }]);
        expect(result.flushed).toEqual(["c2"]);
        expect(loadQueue(storage, "show-1")).toEqual([]);
    });

    it("KEEPS everything from the first network failure on and stops", async () => {
        const storage = memoryStorage();
        enqueueSave(storage, "show-1", save("c1"));
        enqueueSave(storage, "show-1", save("c2"));
        enqueueSave(storage, "show-1", save("c3"));
        const sender = vi
            .fn()
            .mockResolvedValueOnce({ success: true })
            .mockRejectedValueOnce(new TypeError("fetch failed"));

        const result = await flushQueue(storage, "show-1", sender);
        expect(result.flushed).toEqual(["c1"]);
        expect(result.remaining.map((s) => s.classId)).toEqual(["c2", "c3"]);
        // c3 was never attempted — the network is down.
        expect(sender).toHaveBeenCalledTimes(2);
        expect(loadQueue(storage, "show-1").map((s) => s.classId)).toEqual(["c2", "c3"]);
    });
});
