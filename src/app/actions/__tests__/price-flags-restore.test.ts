/**
 * Hidden eBay prices (MHH-022): the owner can show a model's price again
 * when the "wrong model" reports were mistaken. Every active report on the
 * model is resolved (one left open would keep the price hidden) and each
 * member who reported it is told.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
    requireAdmin: vi.fn(async () => ({ user: { id: "owner-1" } })),
    requireAuth: vi.fn(),
    AuthError: class extends Error {},
}));
let updateResult: { data: unknown; error: unknown } = { data: null, error: null };
let titleResult: { data: unknown; error: unknown } = { data: null, error: null };
const updates: Record<string, unknown>[] = [];
const filters: [string, unknown][] = [];
const builder = {
    update: vi.fn((row: Record<string, unknown>) => {
        updates.push(row);
        return builder;
    }),
    select: vi.fn(() => builder),
    eq: vi.fn((col: string, val: unknown) => {
        filters.push([col, val]);
        return builder;
    }),
    maybeSingle: vi.fn(async () => titleResult),
    then: (resolve: (v: unknown) => void) => Promise.resolve(updateResult).then(resolve),
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
        filters.length = 0;
        notified.length = 0;
        deferred.length = 0;
    });

    it("resolves every report on the model and tells each member who flagged it", async () => {
        updateResult = {
            data: [{ reporter_id: "member-1" }, { reporter_id: "member-2" }, { reporter_id: "member-1" }],
            error: null,
        };
        titleResult = { data: { title: "Silky Sullivan" }, error: null };
        const r = await restoreHiddenPrice("item-1");
        expect(r.success).toBe(true);
        expect(updates[0]).toMatchObject({ status: "resolved" });
        expect(filters).toContainEqual(["catalog_item_id", "item-1"]);
        expect(filters).toContainEqual(["status", "active"]);
        for (const run of deferred) await run();
        expect(notified.map((n) => n.userId)).toEqual(["member-1", "member-2"]);
        expect(notified[0].content).toContain("Silky Sullivan");
        expect(notified[0].content).toContain("showing again");
    });

    it("says so when the reports were already handled", async () => {
        updateResult = { data: [], error: null };
        const r = await restoreHiddenPrice("item-1");
        expect(r).toEqual({ success: false, error: "Those reports were already handled." });
    });
});
