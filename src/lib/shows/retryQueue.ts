/**
 * Shows domain — the ring console's OFFLINE RETRY QUEUE.
 *
 * Barn wifi is bad; the placing recorder must not lose a slate
 * because the router blinked. When a recordPlacings call THROWS
 * (network down — server actions reject with a fetch error), the
 * slate is queued in localStorage and retried on reconnect.
 *
 * THE HONEST BOUNDARY (deliberately not offline-first sync):
 *   - Queued saves survive reloads on the SAME device/browser.
 *   - A save the server REFUSES (success:false — wrong status,
 *     illegal transition) is dropped and surfaced, never retried:
 *     retrying a domain refusal forever would wedge the queue.
 *   - No cross-device merge, no conflict resolution: replace-all
 *     recordPlacings semantics mean the LAST flushed slate for a
 *     class wins, exactly like two stewards on paper.
 *   - Reads still need the network; only placing WRITES queue.
 *
 * Pure over a Storage-like interface so vitest covers it without
 * a browser.
 */

export interface PendingPlacingSave {
    classId: string;
    placings: { entryId: string; place: number; note?: string }[];
    markDone: boolean;
    /** ISO timestamp of the (latest) queueing, for the UI. */
    queuedAt: string;
}

/** The subset of window.localStorage the queue touches. */
export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export function queueStorageKey(showId: string): string {
    return `mhh:ring-pending:${showId}`;
}

/** Load the queue; junk (corrupt JSON, wrong shape) loads as empty. */
export function loadQueue(storage: StorageLike, showId: string): PendingPlacingSave[] {
    try {
        const raw = storage.getItem(queueStorageKey(showId));
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (item): item is PendingPlacingSave =>
                typeof item === "object" &&
                item !== null &&
                typeof (item as PendingPlacingSave).classId === "string" &&
                Array.isArray((item as PendingPlacingSave).placings),
        );
    } catch {
        return [];
    }
}

function persist(storage: StorageLike, showId: string, queue: PendingPlacingSave[]): void {
    if (queue.length === 0) {
        storage.removeItem(queueStorageKey(showId));
        return;
    }
    storage.setItem(queueStorageKey(showId), JSON.stringify(queue));
}

/**
 * Queue one save. DEDUPE BY CLASS: recordPlacings is replace-all,
 * so only the latest slate per class matters — a newer save for the
 * same class replaces the queued one (keeping its queue position).
 */
export function enqueueSave(
    storage: StorageLike,
    showId: string,
    save: PendingPlacingSave,
): PendingPlacingSave[] {
    const queue = loadQueue(storage, showId);
    const at = queue.findIndex((q) => q.classId === save.classId);
    if (at >= 0) queue[at] = save;
    else queue.push(save);
    persist(storage, showId, queue);
    return queue;
}

/** Drop one class's queued save (e.g. it saved through live). */
export function removeSave(
    storage: StorageLike,
    showId: string,
    classId: string,
): PendingPlacingSave[] {
    const queue = loadQueue(storage, showId).filter((q) => q.classId !== classId);
    persist(storage, showId, queue);
    return queue;
}

export interface FlushResult {
    /** classIds that saved through. */
    flushed: string[];
    /** Saves the SERVER refused — dropped from the queue with the reason. */
    rejected: { classId: string; error: string }[];
    /** Still queued (network still down). */
    remaining: PendingPlacingSave[];
}

/**
 * Try every queued save in order.
 *   sender resolves {success:true}   → flushed, dropped from queue.
 *   sender resolves {success:false}  → domain refusal: dropped and
 *                                      reported (never retried).
 *   sender THROWS                    → network still down: keep it
 *                                      and STOP (later items would
 *                                      throw too).
 */
export async function flushQueue(
    storage: StorageLike,
    showId: string,
    sender: (
        save: PendingPlacingSave,
    ) => Promise<{ success: boolean; error?: string }>,
): Promise<FlushResult> {
    const queue = loadQueue(storage, showId);
    const flushed: string[] = [];
    const rejected: { classId: string; error: string }[] = [];
    const remaining: PendingPlacingSave[] = [];

    for (let i = 0; i < queue.length; i++) {
        const save = queue[i];
        try {
            const result = await sender(save);
            if (result.success) {
                flushed.push(save.classId);
            } else {
                rejected.push({
                    classId: save.classId,
                    error: result.error ?? "The server refused this save.",
                });
            }
        } catch {
            // Offline: keep this one and everything after it.
            remaining.push(...queue.slice(i));
            break;
        }
    }

    persist(storage, showId, remaining);
    return { flushed, rejected, remaining };
}
