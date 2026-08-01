// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from"vitest";
import { render, screen, fireEvent } from"@testing-library/react";
import userEvent from"@testing-library/user-event";
import TrophyCase from"../TrophyCase";

const mockBadges = [
 {
 id:"badge-1",
 name:"First Ride",
 description:"Added your first horse to the stable",
 icon:"🐴",
 category:"collection",
 tier: 1,
 earnedAt:"2026-01-15T10:00:00Z",
 },
 {
 id:"badge-2",
 name:"Social Butterfly",
 description:"Made 10 posts in the community feed",
 icon:"🦋",
 category:"social",
 tier: 2,
 earnedAt:"2026-02-20T14:00:00Z",
 },
 {
 id:"badge-3",
 name:"Herd Builder",
 description:"Collected 25 horses",
 icon:"🏇",
 category:"collection",
 tier: 3,
 earnedAt:"2026-03-01T12:00:00Z",
 },
 {
 id:"badge-4",
 name:"Beta Pioneer",
 description:"Joined during beta testing phase",
 icon:"🏅",
 category:"exclusive",
 tier: 5,
 earnedAt:"2026-01-01T00:00:00Z",
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

 it("applies correct tier border colors", () => {
 const { container } = render(<TrophyCase badges={mockBadges} />);

 // Tier-specific border colors are now Tailwind classes
 expect(container.innerHTML).toContain("border-tier-bronze"); // tier 1
 expect(container.innerHTML).toContain("border-tier-silver"); // tier 2
 expect(container.innerHTML).toContain("border-tier-gold"); // tier 3
 expect(container.innerHTML).toContain("border-forest"); // tier 5
 });

 it("sorts categories in predefined order (exclusive first)", () => {
 render(<TrophyCase badges={mockBadges} />);

 const headers = screen.getAllByRole("heading", { level: 4 });
 expect(headers[0].textContent).toBe("🏅 Exclusive");
 expect(headers[1].textContent).toBe("🐴 Collection");
 expect(headers[2].textContent).toBe("🦋 Social");
 });

 // Wave 5a-C: badge meanings are click/tap/keyboard-toggled buttons now
 // (the old hover-only tooltip was unreachable on touch and hidden <480px).
 it("shows the badge meaning when the badge button is clicked", async () => {
 const user = userEvent.setup();
 render(<TrophyCase badges={mockBadges} />);

 const badgeButton = screen.getByRole("button", { name: /Beta Pioneer/ }); // exclusive = first category
 await user.click(badgeButton);

 expect(screen.getByText("Joined during beta testing phase")).toBeInTheDocument();
 expect(badgeButton).toHaveAttribute("aria-expanded","true");
 });

 it("hides the meaning on a second click", async () => {
 const user = userEvent.setup();
 render(<TrophyCase badges={mockBadges} />);

 const badgeButton = screen.getByRole("button", { name: /Beta Pioneer/ });
 await user.click(badgeButton);
 await user.click(badgeButton);

 expect(screen.queryByText("Joined during beta testing phase")).not.toBeInTheDocument();
 expect(badgeButton).toHaveAttribute("aria-expanded","false");
 });

 it("is keyboard-operable (Enter toggles the meaning)", async () => {
 const user = userEvent.setup();
 render(<TrophyCase badges={mockBadges} />);

 const badgeButton = screen.getByRole("button", { name: /Beta Pioneer/ });
 badgeButton.focus();
 await user.keyboard("{Enter}");

 expect(screen.getByText("Joined during beta testing phase")).toBeInTheDocument();
 });

 it("shows only one badge meaning at a time", async () => {
 const user = userEvent.setup();
 render(<TrophyCase badges={mockBadges} />);

 await user.click(screen.getByRole("button", { name: /Beta Pioneer/ }));
 await user.click(screen.getByRole("button", { name: /First Ride/ }));

 expect(screen.queryByText("Joined during beta testing phase")).not.toBeInTheDocument();
 expect(screen.getByText("Added your first horse to the stable")).toBeInTheDocument();
 });

 it("handles unknown category gracefully", () => {
 const unknownBadge = [
 {
 ...mockBadges[0],
 id:"unknown-1",
 category:"mystery",
 },
 ];
 render(<TrophyCase badges={unknownBadge} />);

 expect(screen.getByText("mystery")).toBeInTheDocument();
 });
});
