// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TrophyCase from "../TrophyCase";

const mockBadges = [
    {
        id: "badge-1",
        name: "First Ride",
        description: "Added your first horse to the stable",
        icon: "🐴",
        category: "collection",
        tier: 1,
        earnedAt: "2026-01-15T10:00:00Z",
    },
    {
        id: "badge-2",
        name: "Social Butterfly",
        description: "Made 10 posts in the community feed",
        icon: "🦋",
        category: "social",
        tier: 2,
        earnedAt: "2026-02-20T14:00:00Z",
    },
    {
        id: "badge-3",
        name: "Herd Builder",
        description: "Collected 25 horses",
        icon: "🏇",
        category: "collection",
        tier: 3,
        earnedAt: "2026-03-01T12:00:00Z",
    },
    {
        id: "badge-4",
        name: "Beta Pioneer",
        description: "Joined during beta testing phase",
        icon: "🏅",
        category: "exclusive",
        tier: 5,
        earnedAt: "2026-01-01T00:00:00Z",
    },
];

describe("TrophyCase", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders empty state when no badges", () => {
        render(<TrophyCase badges={[]} />);

        expect(screen.getByText("🏆")).toBeInTheDocument();
        expect(screen.getByText("No badges earned yet — keep collecting!")).toBeInTheDocument();
    });

    it("renders all badges grouped by category", () => {
        render(<TrophyCase badges={mockBadges} />);

        // Should show category headers
        expect(screen.getByText("🏅 Exclusive")).toBeInTheDocument();
        expect(screen.getByText("🐴 Collection")).toBeInTheDocument();
        expect(screen.getByText("🦋 Social")).toBeInTheDocument();
    });

    it("displays badge names and icons", () => {
        render(<TrophyCase badges={mockBadges} />);

        expect(screen.getByText("First Ride")).toBeInTheDocument();
        expect(screen.getByText("Social Butterfly")).toBeInTheDocument();
        expect(screen.getByText("Herd Builder")).toBeInTheDocument();
        expect(screen.getByText("Beta Pioneer")).toBeInTheDocument();
    });

    it("displays formatted earned dates", () => {
        render(<TrophyCase badges={mockBadges} />);

        expect(screen.getByText("Jan 15, 2026")).toBeInTheDocument();
        expect(screen.getByText("Feb 20, 2026")).toBeInTheDocument();
    });

    it("applies correct tier classes", () => {
        const { container } = render(<TrophyCase badges={mockBadges} />);

        expect(container.querySelector(".trophy-tier-1")).toBeInTheDocument();
        expect(container.querySelector(".trophy-tier-2")).toBeInTheDocument();
        expect(container.querySelector(".trophy-tier-3")).toBeInTheDocument();
        expect(container.querySelector(".trophy-tier-5")).toBeInTheDocument();
    });

    it("sorts categories in predefined order (exclusive first)", () => {
        const { container } = render(<TrophyCase badges={mockBadges} />);

        const headers = container.querySelectorAll(".trophy-category-header");
        expect(headers[0].textContent).toBe("🏅 Exclusive");
        expect(headers[1].textContent).toBe("🐴 Collection");
        expect(headers[2].textContent).toBe("🦋 Social");
    });

    it("shows tooltip on badge hover", async () => {
        const user = userEvent.setup();
        const { container } = render(<TrophyCase badges={mockBadges} />);

        const firstCard = container.querySelector(".trophy-card")!;
        await user.hover(firstCard);

        // Tooltip should appear with description
        const tooltip = container.querySelector(".trophy-tooltip");
        expect(tooltip).toBeInTheDocument();
    });

    it("hides tooltip on mouse leave", async () => {
        const user = userEvent.setup();
        const { container } = render(<TrophyCase badges={mockBadges} />);

        const firstCard = container.querySelector(".trophy-card")!;
        await user.hover(firstCard);
        await user.unhover(firstCard);

        const tooltip = container.querySelector(".trophy-tooltip");
        expect(tooltip).not.toBeInTheDocument();
    });

    it("handles unknown category gracefully", () => {
        const unknownBadge = [{
            ...mockBadges[0],
            id: "unknown-1",
            category: "mystery",
        }];
        render(<TrophyCase badges={unknownBadge} />);

        expect(screen.getByText("mystery")).toBeInTheDocument();
    });
});
