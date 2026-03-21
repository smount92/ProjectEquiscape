// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MarketFilters from "../MarketFilters";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush }),
    useSearchParams: () => new URLSearchParams(),
}));

describe("MarketFilters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders search input", () => {
        render(<MarketFilters />);

        const searchInput = screen.getByPlaceholderText(/Search by mold/);
        expect(searchInput).toBeInTheDocument();
        expect(searchInput).toHaveAttribute("type", "search");
    });

    it("renders all item type filter chips", () => {
        render(<MarketFilters />);

        expect(screen.getByText("All Types")).toBeInTheDocument();
        expect(screen.getByText("Plastic Molds")).toBeInTheDocument();
        expect(screen.getByText("Plastic Releases")).toBeInTheDocument();
        expect(screen.getByText("Artist Resins")).toBeInTheDocument();
        expect(screen.getByText("Tack")).toBeInTheDocument();
        expect(screen.getByText("Props")).toBeInTheDocument();
    });

    it("renders finish type dropdown", () => {
        render(<MarketFilters />);

        const finishSelect = screen.getByDisplayValue("All Finishes");
        expect(finishSelect).toBeInTheDocument();
    });

    it("renders life stage dropdown", () => {
        render(<MarketFilters />);

        const stageSelect = screen.getByDisplayValue("All Stages");
        expect(stageSelect).toBeInTheDocument();
    });

    it("renders sort dropdown with default 'Most Traded'", () => {
        render(<MarketFilters />);

        const sortSelect = screen.getByDisplayValue("Most Traded");
        expect(sortSelect).toBeInTheDocument();
    });

    it("pushes correct params when type chip is clicked", async () => {
        const user = userEvent.setup();
        render(<MarketFilters />);

        await user.click(screen.getByText("Plastic Molds"));

        expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("type=plastic_mold"));
    });

    it("removes type param when 'All Types' is clicked", async () => {
        const user = userEvent.setup();
        render(<MarketFilters />);

        await user.click(screen.getByText("All Types"));

        expect(mockPush).toHaveBeenCalledWith("/market?");
    });

    it("changes finish filter via dropdown", async () => {
        const user = userEvent.setup();
        render(<MarketFilters />);

        const finishSelect = screen.getByDisplayValue("All Finishes");
        await user.selectOptions(finishSelect, "Custom");

        expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("finish=Custom"));
    });

    it("changes sort via dropdown", async () => {
        const user = userEvent.setup();
        render(<MarketFilters />);

        const sortSelect = screen.getByDisplayValue("Most Traded");
        await user.selectOptions(sortSelect, "average_price:desc");

        expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("sort=average_price"));
    });

    it("has correct accessibility IDs on controls", () => {
        render(<MarketFilters />);

        expect(document.getElementById("market-search")).toBeInTheDocument();
        expect(document.getElementById("market-finish")).toBeInTheDocument();
        expect(document.getElementById("market-stage")).toBeInTheDocument();
        expect(document.getElementById("market-sort")).toBeInTheDocument();
    });
});
