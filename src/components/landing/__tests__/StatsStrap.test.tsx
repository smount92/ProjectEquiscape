// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import StatsStrap from "../StatsStrap";
import {
    NO_PUBLIC_STATS,
    statIsPresentable,
    type PublicStats,
} from "@/lib/stats/publicStatsShape";

/**
 * The landing page's contract with the owner: every number on the front
 * door is a real database read, or it is not on the page at all. These
 * tests are the guard on that — if someone ever reintroduces a fallback
 * constant, the "database is unreachable" case starts rendering and this
 * suite fails.
 */

const NOTHING: PublicStats = NO_PUBLIC_STATS;

describe("statIsPresentable", () => {
    it("accepts a positive count", () => {
        expect(statIsPresentable(11_237)).toBe(true);
        expect(statIsPresentable(1)).toBe(true);
    });

    it("rejects a failed read", () => {
        expect(statIsPresentable(null)).toBe(false);
    });

    it("rejects zero — a real answer, but not one the front door brags about", () => {
        expect(statIsPresentable(0)).toBe(false);
    });

    it("rejects nonsense that survived a bad cast", () => {
        expect(statIsPresentable(Number.NaN)).toBe(false);
        expect(statIsPresentable(Number.POSITIVE_INFINITY)).toBe(false);
    });
});

describe("StatsStrap", () => {
    it("renders nothing when every read failed", () => {
        const { container } = render(<StatsStrap stats={NOTHING} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when every count is legitimately zero", () => {
        const { container } = render(
            <StatsStrap
                stats={{
                    catalogItems: 0,
                    publicHorses: 0,
                    showsCompleted: 0,
                    listingsForSale: 0,
                }}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("prints only the stats that came back, formatted", () => {
        render(
            <StatsStrap
                stats={{
                    catalogItems: 11_237,
                    publicHorses: 486,
                    showsCompleted: null,
                    listingsForSale: 0,
                }}
            />,
        );

        expect(screen.getByText("11,237")).toBeTruthy();
        expect(screen.getByText("Reference entries")).toBeTruthy();
        expect(screen.getByText("486")).toBeTruthy();
        expect(screen.getByText("Horses on show")).toBeTruthy();

        // A failed read and a zero read both stay off the page.
        expect(screen.queryByText("Shows judged")).toBeNull();
        expect(screen.queryByText("For sale now")).toBeNull();
    });

    it("labels the strap for screen readers", () => {
        render(<StatsStrap stats={{ ...NOTHING, catalogItems: 12 }} />);
        expect(screen.getByRole("group", { name: /live counts/i })).toBeTruthy();
    });
});
