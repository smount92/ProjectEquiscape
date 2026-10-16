import { beforeEach, describe, expect, it, vi } from "vitest";

const upserts: Record<string, unknown>[] = [];
vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => ({
        from: () => ({
            upsert: async (row: Record<string, unknown>) => {
                upserts.push(row);
                return { error: null };
            },
        }),
    })),
}));

import { cronState, withHeartbeat } from "@/lib/ops/heartbeat";
import type { NextRequest } from "next/server";

const req = {} as NextRequest;

describe("withHeartbeat", () => {
    beforeEach(() => {
        upserts.length = 0;
    });

    it("records a successful run", async () => {
        await withHeartbeat("refresh-market", req, async () => new Response("{}", { status: 200 }));
        expect(upserts[0]).toMatchObject({ job: "refresh-market" });
        expect(upserts[0].last_ok_at).toBeTruthy();
        expect(upserts[0].last_failed_at).toBeUndefined();
    });

    it("records a failed run with the error", async () => {
        await withHeartbeat("transition-shows", req, async () => new Response("db down", { status: 500 }));
        expect(upserts[0]).toMatchObject({ job: "transition-shows", last_error: "HTTP 500 db down" });
        expect(upserts[0].last_ok_at).toBeUndefined();
    });

    it("records a thrown error and still throws it", async () => {
        await expect(
            withHeartbeat("ebay-price-signals", req, async () => {
                throw new Error("boom");
            }),
        ).rejects.toThrow("boom");
        expect(upserts[0]).toMatchObject({ job: "ebay-price-signals", last_error: "boom" });
    });

    it("does not count an unauthorised poke as a run", async () => {
        await withHeartbeat("refresh-market", req, async () => new Response("no", { status: 401 }));
        expect(upserts).toEqual([]);
    });
});

describe("cronState", () => {
    const now = new Date("2026-10-16T12:00:00Z");
    it("is on time within the allowance", () => {
        expect(cronState({ last_ok_at: "2026-10-16T10:00:00Z", last_failed_at: null }, 3, now)).toBe("ok");
    });
    it("is late past the allowance", () => {
        expect(cronState({ last_ok_at: "2026-10-16T06:00:00Z", last_failed_at: null }, 3, now)).toBe("late");
    });
    it("is failing when the last run failed", () => {
        expect(cronState({ last_ok_at: "2026-10-16T10:00:00Z", last_failed_at: "2026-10-16T11:00:00Z" }, 3, now)).toBe(
            "failing",
        );
    });
    it("is unknown before any run", () => {
        expect(cronState(null, 3, now)).toBe("unknown");
    });
});
