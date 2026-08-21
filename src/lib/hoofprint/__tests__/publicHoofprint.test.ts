import { describe, expect, it } from "vitest";
import { mapPublicHoofprint } from "../publicHoofprint";

/** One well-formed row as get_public_hoofprint (177) returns it. */
function row(overrides: Record<string, unknown> = {}) {
    return {
        timeline: [
            {
                source_id: "11111111-1111-1111-1111-111111111111",
                event_type: "acquired",
                title: "Added to stable",
                description: "Dandy was registered on Model Horse Hub.",
                event_date: "2026-01-04",
                metadata: { life_stage: "completed" },
                is_public: true,
                created_at: "2026-01-04T10:00:00Z",
                user_id: "22222222-2222-2222-2222-222222222222",
                user_alias: "amanda",
                source_table: "user_horses",
            },
        ],
        ownership: [
            {
                id: "33333333-3333-3333-3333-333333333333",
                owner_alias: "amanda",
                owner_id: "22222222-2222-2222-2222-222222222222",
                acquired_at: "2026-01-04T10:00:00Z",
                released_at: null,
                acquisition_type: "original",
                sale_price: null,
                is_price_public: false,
                notes: null,
            },
        ],
        life_stage: "completed",
        ...overrides,
    };
}

describe("mapPublicHoofprint", () => {
    it("maps a full row onto the member view model", () => {
        const result = mapPublicHoofprint(row());
        expect(result).not.toBeNull();
        expect(result!.lifeStage).toBe("completed");
        expect(result!.timeline).toHaveLength(1);
        expect(result!.ownershipChain).toHaveLength(1);

        const event = result!.timeline[0];
        expect(event.id).toBe("11111111-1111-1111-1111-111111111111");
        expect(event.eventType).toBe("acquired");
        expect(event.userAlias).toBe("amanda");
        expect(event.sourceTable).toBe("user_horses");
        expect(event.metadata).toEqual({ life_stage: "completed" });
    });

    it("returns null for anything that is not a row", () => {
        expect(mapPublicHoofprint(null)).toBeNull();
        expect(mapPublicHoofprint(undefined)).toBeNull();
        expect(mapPublicHoofprint("not a row")).toBeNull();
        expect(mapPublicHoofprint(42)).toBeNull();
    });

    it("survives empty and malformed arrays", () => {
        const empty = mapPublicHoofprint({ timeline: [], ownership: [], life_stage: "blank" });
        expect(empty!.timeline).toEqual([]);
        expect(empty!.ownershipChain).toEqual([]);
        expect(empty!.lifeStage).toBe("blank");

        const junk = mapPublicHoofprint({ timeline: "nope", ownership: null, life_stage: null });
        expect(junk!.timeline).toEqual([]);
        expect(junk!.ownershipChain).toEqual([]);
        // A missing life stage renders as the same default the member
        // page uses, never as an empty badge.
        expect(junk!.lifeStage).toBe("completed");
    });

    it("drops events with no id or no title rather than rendering a blank rail entry", () => {
        const result = mapPublicHoofprint(
            row({
                timeline: [
                    { source_id: "", title: "Untethered", event_type: "note" },
                    { source_id: "abc", title: "", event_type: "note" },
                    { source_id: "abc", title: "Kept", event_type: "note" },
                    null,
                    "garbage",
                ],
            }),
        );
        expect(result!.timeline).toHaveLength(1);
        expect(result!.timeline[0].title).toBe("Kept");
    });

    it("never marks an anon event private — the RPC only returns public rows", () => {
        // The "🔒 Private" marker exists for the owner's own view. If a
        // row ever arrived claiming is_public false, showing that badge
        // to a stranger would advertise the existence of hidden history.
        const result = mapPublicHoofprint(
            row({ timeline: [{ source_id: "a", title: "T", is_public: false }] }),
        );
        expect(result!.timeline[0].isPublic).toBe(true);
    });

    it("withholds a sale price the seller did not publish", () => {
        const result = mapPublicHoofprint(
            row({
                ownership: [
                    {
                        id: "a",
                        owner_alias: "buyer",
                        acquired_at: "2026-02-01T00:00:00Z",
                        acquisition_type: "purchase",
                        // A row that leaks a price despite the flag — the
                        // mapper is the second line of defence behind the
                        // RPC's own CASE.
                        sale_price: 450,
                        is_price_public: false,
                    },
                ],
            }),
        );
        expect(result!.ownershipChain[0].salePrice).toBeNull();
        expect(result!.ownershipChain[0].isPricePublic).toBe(false);
    });

    it("shows a sale price the seller did publish", () => {
        const result = mapPublicHoofprint(
            row({
                ownership: [
                    {
                        id: "a",
                        owner_alias: "buyer",
                        acquired_at: "2026-02-01T00:00:00Z",
                        acquisition_type: "purchase",
                        sale_price: 450,
                        is_price_public: true,
                    },
                ],
            }),
        );
        expect(result!.ownershipChain[0].salePrice).toBe(450);
    });

    it("keeps an off-platform owner (no owner_id) in the chain", () => {
        const result = mapPublicHoofprint(
            row({
                ownership: [
                    {
                        id: "a",
                        owner_alias: "A collector on Facebook",
                        owner_id: null,
                        acquired_at: "2025-06-01T00:00:00Z",
                        acquisition_type: "purchase",
                        is_price_public: false,
                    },
                ],
            }),
        );
        expect(result!.ownershipChain).toHaveLength(1);
        expect(result!.ownershipChain[0].ownerId).toBeNull();
    });

    it("drops an ownership row with no alias to render", () => {
        const result = mapPublicHoofprint(row({ ownership: [{ id: "a", owner_alias: "" }] }));
        expect(result!.ownershipChain).toEqual([]);
    });

    it("falls back to Unknown for an alias that did not resolve", () => {
        const result = mapPublicHoofprint(
            row({ timeline: [{ source_id: "a", title: "T", user_alias: null }] }),
        );
        expect(result!.timeline[0].userAlias).toBe("Unknown");
    });
});
