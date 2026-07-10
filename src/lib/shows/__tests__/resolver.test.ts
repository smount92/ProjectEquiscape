/**
 * Phase E2 — the /shows/[id] route resolver: v2 ids render the v2
 * page, legacy/junk ids fall through to the legacy page, and junk
 * never touches the database.
 */

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { looksLikeUuid, resolveShowRoute } from "../resolver";

const V2_ID = "123e4567-e89b-42d3-a456-426614174000";
const LEGACY_ID = "999e4567-e89b-42d3-a456-426614174999";

/** Minimal query stub: maybeSingle resolves per the known-ids set. */
function stubClient(knownIds: string[], calls: string[] = []) {
    const client = {
        from: (table: string) => {
            calls.push(table);
            let queried: string | null = null;
            const chain = {
                select: () => chain,
                eq: (_col: string, value: string) => {
                    queried = value;
                    return chain;
                },
                maybeSingle: async () =>
                    knownIds.includes(queried ?? "")
                        ? { data: { id: queried }, error: null }
                        : { data: null, error: null },
            };
            return chain;
        },
    };
    return client as unknown as SupabaseClient;
}

describe("resolver — looksLikeUuid", () => {
    it("accepts uuids of any case, rejects junk", () => {
        expect(looksLikeUuid(V2_ID)).toBe(true);
        expect(looksLikeUuid(V2_ID.toUpperCase())).toBe(true);
        expect(looksLikeUuid("not-a-show")).toBe(false);
        expect(looksLikeUuid("")).toBe(false);
        expect(looksLikeUuid("123e4567e89b42d3a456426614174000")).toBe(false);
    });
});

describe("resolver — resolveShowRoute", () => {
    it("routes a v2 show id to the v2 page", async () => {
        expect(await resolveShowRoute(stubClient([V2_ID]), V2_ID, true)).toBe("v2");
    });

    it("falls through to legacy for ids the shows table doesn't know", async () => {
        expect(await resolveShowRoute(stubClient([V2_ID]), LEGACY_ID, true)).toBe("legacy");
    });

    it("junk ids go legacy WITHOUT querying the database", async () => {
        const calls: string[] = [];
        expect(await resolveShowRoute(stubClient([], calls), "junk-id", true)).toBe(
            "legacy",
        );
        expect(calls).toEqual([]);
    });

    it("flag off → always legacy, no query", async () => {
        const calls: string[] = [];
        expect(await resolveShowRoute(stubClient([V2_ID], calls), V2_ID, false)).toBe(
            "legacy",
        );
        expect(calls).toEqual([]);
    });

    it("a DB error fails safe to legacy", async () => {
        const client = {
            from: () => ({
                select: () => ({
                    eq: () => ({
                        maybeSingle: async () => ({
                            data: null,
                            error: { message: "boom" },
                        }),
                    }),
                }),
            }),
        } as unknown as SupabaseClient;
        expect(await resolveShowRoute(client, V2_ID, true)).toBe("legacy");
    });
});
