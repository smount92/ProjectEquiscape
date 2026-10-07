/**
 * Guard for the root-layout cache window.
 *
 * AnnouncementSlot renders inside the root layout, and Next adopts the
 * SHORTEST `revalidate` of any cached read in a render as that route's
 * own revalidate. A 60-second window here therefore re-rendered every
 * static page on the site about once per request (Vercel ISR writes,
 * October 2026). Freshness comes from the tag the admin actions clear;
 * the window is only the backstop and must stay long.
 */
import { describe, it, expect, vi } from "vitest";

const captured: { keys: unknown; options: unknown }[] = [];

vi.mock("next/cache", () => ({
    unstable_cache: (fn: unknown, keys: unknown, options: unknown) => {
        captured.push({ keys, options });
        return fn;
    },
}));

vi.mock("@/lib/supabase/anon", () => ({ createAnonClient: () => ({ from: () => ({}) }) }));

describe("AnnouncementSlot cache window", () => {
    it("is tag-driven with an hour-long backstop, never a short window", async () => {
        await import("@/components/AnnouncementSlot");
        const { ANNOUNCEMENTS_CACHE_SECONDS, ANNOUNCEMENTS_CACHE_TAG } = await import("@/lib/announcements");

        expect(captured).toHaveLength(1);
        const options = captured[0].options as { revalidate?: number; tags?: string[] };
        expect(options.revalidate).toBe(ANNOUNCEMENTS_CACHE_SECONDS);
        expect(options.revalidate).toBeGreaterThanOrEqual(3600);
        expect(options.tags).toEqual([ANNOUNCEMENTS_CACHE_TAG]);
    });
});
