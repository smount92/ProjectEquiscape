/**
 * Hidden eBay prices (MHH-022): the owner can show a price again when a
 * "wrong model" report was mistaken, and the reporter is told.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
    requireAdmin: vi.fn(async () => ({ user: { id: "owner-1" } })),
    requireAuth: vi.fn(),
    AuthError: class extends Error {},
}));
let updateResult: { data: unknown; error: unknown } = { data: null, error: null };
const updates: Record<string, unknown>[] = [];
const builder = {
    update: vi.fn((row: Record<string, unknown>) => {
        updates.push(row);
        return builder;
    }),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => updateResult),
};
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: vi.fn(() => ({ from: vi.fn(() => builder) })) }));
const deferred: (() => Promise<void>)[] = [];
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => deferred.push(fn) }));
const notified: { userId: string; content: string }[] = [];
vi.mock("@/lib/notifications/createNotification", () => ({
    createNotification: vi.fn(async (n: { userId: string; content: string }) => notified.push(n)),
}));

import { restoreHiddenPrice } from "@/app/actions/priceSignals";

describe("restoreHiddenPrice", () => {
    beforeEach(() => {
        updates.length = 0;
        notified.length = 0;
        deferred.length = 0;
    });

    it("resolves the report and tells the member who flagged it", async () => {
        updateResult = { data: { catalog_item_id: "item-1", reporter_id: "member-1" }, error: null };
        const r = await restoreHiddenPrice("flag-1");
        expect(r.success).toBe(true);
        expect(updates[0]).toMatchObject({ status: "resolved" });
        updateResult = { data: { title: "Silky Sullivan" }, error: null };
        for (const run of deferred) await run();
        expect(notified[0]).toMatchObject({ userId: "member-1" });
        expect(notified[0].content).toMatch(/Silky Sullivan.*showing again/);
    });

    it("says so when the report was already handled", async () => {
        updateResult = { data: null, error: null };
        const r = await restoreHiddenPrice("flag-1");
        expect(r).toEqual({ success: false, error: "That report was already handled." });
    });
});
