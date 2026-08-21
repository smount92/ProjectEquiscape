import { describe, expect, it, vi } from "vitest";
import { entityKey, resolveEntityNames } from "@/lib/metrics/resolve";

/**
 * The leaderboard resolver. The property that matters most here is the
 * batching one: `metrics_top_objects` returns ids, and turning forty ids
 * into forty names must stay a fixed handful of reads, not forty.
 */

interface Call {
    table: string;
    column: string;
    ids: string[];
}

/**
 * A stub with just enough of the PostgREST builder shape for this module:
 * `.from(t).select(c).in(col, ids)` resolving to `{ data, error }`.
 */
function stubClient(rows: Record<string, Record<string, unknown>[]>, calls: Call[] = []) {
    return {
        calls,
        client: {
            from(table: string) {
                return {
                    select() {
                        return {
                            in(column: string, ids: string[]) {
                                calls.push({ table, column, ids });
                                return Promise.resolve({ data: rows[table] ?? [], error: null });
                            },
                        };
                    },
                };
            },
        },
    };
}

describe("resolveEntityNames", () => {
    it("issues one read per table, never one per row", async () => {
        const { client, calls } = stubClient({
            user_horses: [
                { id: "h1", custom_name: "Silver" },
                { id: "h2", custom_name: "Comet" },
                { id: "h3", custom_name: "Dusty" },
            ],
        });

        await resolveEntityNames(client, [
            { type: "horse", id: "h1" },
            { type: "horse", id: "h2" },
            { type: "horse", id: "h3" },
        ]);

        const horseCalls = calls.filter((c) => c.table === "user_horses");
        expect(horseCalls).toHaveLength(1);
        expect(horseCalls[0].ids).toEqual(["h1", "h2", "h3"]);
    });

    it("looks a horse up once even when it tops both leaderboards", async () => {
        const { client, calls } = stubClient({
            user_horses: [{ id: "h1", custom_name: "Silver" }],
        });

        const map = await resolveEntityNames(client, [
            { type: "horse", id: "h1" },
            { type: "listing", id: "h1" },
        ]);

        expect(calls.filter((c) => c.table === "user_horses")[0].ids).toEqual(["h1"]);
        expect(map[entityKey("horse", "h1")].name).toBe("Silver");
        expect(map[entityKey("listing", "h1")].name).toBe("Silver");
    });

    it("skips tables no id needs", async () => {
        const { client, calls } = stubClient({ user_horses: [{ id: "h1", custom_name: "Silver" }] });
        await resolveEntityNames(client, [{ type: "horse", id: "h1" }]);
        expect(calls.map((c) => c.table)).toEqual(["user_horses"]);
    });

    it("builds the slug-routed hrefs the id alone cannot", async () => {
        const { client } = stubClient({
            groups: [{ id: "b1", name: "Sunrise Barn", slug: "sunrise" }],
            artist_profiles: [{ user_id: "s1", studio_name: "Gilt", studio_slug: "gilt" }],
            catalog_items: [
                { id: "c1", title: "Ideal", maker: "Breyer", maker_slug: "breyer", slug: "ideal" },
            ],
            users: [{ id: "p1", alias_name: "amanda" }],
        });

        const map = await resolveEntityNames(client, [
            { type: "barn", id: "b1" },
            { type: "studio", id: "s1" },
            { type: "reference", id: "c1" },
            { type: "profile", id: "p1" },
        ]);

        expect(map[entityKey("barn", "b1")]).toEqual({
            name: "Sunrise Barn",
            href: "/community/groups/sunrise",
        });
        expect(map[entityKey("studio", "s1")]).toEqual({ name: "Gilt", href: "/studio/gilt" });
        expect(map[entityKey("reference", "c1")]).toEqual({
            name: "Breyer — Ideal",
            href: "/reference/breyer/ideal",
        });
        expect(map[entityKey("profile", "p1")]).toEqual({
            name: "@amanda",
            href: "/profile/amanda",
        });
    });

    it("prefers a v2 show over a legacy event with the same id", async () => {
        const { client } = stubClient({
            shows: [{ id: "s1", title: "Summerween" }],
            events: [{ id: "s1", name: "stale legacy row" }],
        });

        const map = await resolveEntityNames(client, [{ type: "show", id: "s1" }]);
        expect(map[entityKey("show", "s1")].name).toBe("Summerween");
    });

    it("falls back to a legacy event when there is no v2 show", async () => {
        const { client } = stubClient({
            shows: [],
            events: [{ id: "e1", name: "Old Fall Show" }],
        });

        const map = await resolveEntityNames(client, [{ type: "show", id: "e1" }]);
        expect(map[entityKey("show", "e1")]).toEqual({ name: "Old Fall Show", href: "/shows/e1" });
    });

    it("keeps the row when the object was deleted since it was viewed", async () => {
        // The view happened; the count is true. Dropping the row would make
        // the leaderboard totals disagree with the per-type totals.
        const { client } = stubClient({ user_horses: [] });
        const map = await resolveEntityNames(client, [{ type: "horse", id: "deadbeef-gone" }]);
        expect(map[entityKey("horse", "deadbeef-gone")]).toEqual({
            name: "deadbeef…",
            href: null,
        });
    });

    it("degrades to fallbacks rather than throwing when a read errors", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        const client = {
            from() {
                return {
                    select() {
                        return {
                            in() {
                                return Promise.resolve({
                                    data: null,
                                    error: { code: "42P01", message: "does not exist" },
                                });
                            },
                        };
                    },
                };
            },
        };

        const map = await resolveEntityNames(client, [{ type: "horse", id: "h1" }]);
        expect(map[entityKey("horse", "h1")].href).toBeNull();
        // A missing relation is expected pre-migration; it must not be noise.
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});
