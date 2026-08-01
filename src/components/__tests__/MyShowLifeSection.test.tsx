// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import MyShowLifeSection from "@/components/shows/MyShowLifeSection";
import type { MyShowLife } from "@/lib/shows/showLife";

// Override the global null-rendering Link mock so hrefs are testable.
vi.mock("next/link", () => ({
    default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

// 3 days + 1 hour out, so the render-time clock can't tick the floor
// down to "2 days" mid-test.
const FUTURE = new Date(Date.now() + (3 * 24 + 1) * 3_600_000).toISOString();

function life(overrides: Partial<MyShowLife> = {}): MyShowLife {
    return {
        activeEntries: [
            {
                showId: "s1",
                showTitle: "Autumn Classic Online",
                showStatus: "entries_open",
                entriesCloseAt: FUTURE,
                myEntryCount: 5,
                myClasses: ["Breed Halter", "Collectibility", "Performance"],
            },
        ],
        recentResults: [
            {
                showId: "s2",
                showTitle: "Spring Fling",
                placings: [
                    { horseName: "Ruffian", place: 1, className: "Breed Halter" },
                    { horseName: "Maple", place: 4, className: "Performance" },
                ],
            },
        ],
        ...overrides,
    };
}

describe("MyShowLifeSection", () => {
    it("renders nothing at zero data — members who don't show are never nagged", () => {
        const { container } = render(
            <MyShowLifeSection life={{ activeEntries: [], recentResults: [] }} />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("lists active shows with deadline, entry count, classes, and +N overflow", () => {
        render(<MyShowLifeSection life={life()} />);
        expect(screen.getByText("My show life")).toBeInTheDocument();
        expect(screen.getByText("Autumn Classic Online")).toBeInTheDocument();
        expect(screen.getByText(/entries close in 3 days/i)).toBeInTheDocument();
        expect(
            screen.getByText(/5 entries · Breed Halter, Collectibility, Performance \+2 more/),
        ).toBeInTheDocument();
        expect(document.getElementById("show-life-s1")).toHaveAttribute("href", "/shows/s1");
    });

    it("lists recent results best-first with place labels and show links", () => {
        render(<MyShowLifeSection life={life()} />);
        expect(screen.getByText("Recent results")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Spring Fling" })).toHaveAttribute(
            "href",
            "/shows/s2",
        );
        expect(screen.getByText("1st")).toBeInTheDocument();
        expect(screen.getByText(/— Breed Halter · Ruffian/)).toBeInTheDocument();
        expect(screen.getByText("4th")).toBeInTheDocument();
    });

    it("renders results alone when there are no active entries", () => {
        render(<MyShowLifeSection life={life({ activeEntries: [] })} />);
        expect(screen.getByText("My show life")).toBeInTheDocument();
        expect(screen.getByText("Recent results")).toBeInTheDocument();
        expect(screen.queryByText("Autumn Classic Online")).not.toBeInTheDocument();
    });
});
