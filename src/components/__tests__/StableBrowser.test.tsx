// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StableBrowser from "../stable/StableBrowser";
import type { StableCard } from "@/lib/stable/types";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
    useSearchParams: () => new URLSearchParams(),
}));

const { loadMoreStable, getMatchingHorseIds, saveStableView, deleteStableView } = vi.hoisted(() => ({
    loadMoreStable: vi.fn(),
    getMatchingHorseIds: vi.fn(),
    saveStableView: vi.fn(),
    deleteStableView: vi.fn(),
}));
vi.mock("@/app/actions/stable", () => ({
    loadMoreStable,
    getMatchingHorseIds,
    saveStableView,
    deleteStableView,
}));

const { bulkUpdateHorses, bulkDeleteHorses } = vi.hoisted(() => ({
    bulkUpdateHorses: vi.fn(),
    bulkDeleteHorses: vi.fn(),
}));
vi.mock("@/app/actions/horse", () => ({
    bulkUpdateHorses,
    bulkDeleteHorses,
}));

function card(overrides: Partial<StableCard> = {}): StableCard {
    return {
        id: "h-1",
        customName: "Avalon",
        finishType: "OF",
        conditionGrade: "Mint",
        createdAt: "2026-07-01T00:00:00Z",
        refName: "Breyer Smart Chic Olena",
        thumbnailUrl: null,
        collectionName: null,
        sculptor: null,
        tradeStatus: "For Sale",
        assetCategory: "model",
        vaultValue: null,
        showRecordCount: 3,
        moldName: "Smart Chic Olena",
        ...overrides,
    };
}

function renderBrowser(props: Partial<Parameters<typeof StableBrowser>[0]> = {}) {
    return render(
        <StableBrowser
            initialCards={[card(), card({ id: "h-2", customName: "Stonewall" })]}
            totalCount={12}
            initialHasMore={true}
            herdTotal={214}
            facetOptions={{ makers: [], scales: [], finishes: [], categories: [] }}
            collections={[]}
            savedViews={[]}
            filters={{ finish: "OF", sort: "newest" }}
            {...props}
        />,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    loadMoreStable.mockResolvedValue({
        success: true,
        cards: [card({ id: "h-3", customName: "Oberon" })],
        hasMore: false,
    });
    getMatchingHorseIds.mockResolvedValue({
        success: true,
        ids: ["h-1", "h-2", "h-3"],
        totalMatching: 3,
        capped: false,
    });
    bulkUpdateHorses.mockResolvedValue({ success: true, count: 2 });
    bulkDeleteHorses.mockResolvedValue({ success: true, count: 2 });
});

describe("StableBrowser", () => {
    it("shows the 'N of TOTAL match' result line when filters are active", () => {
        renderBrowser();
        expect(screen.getByText("12 of 214")).toBeInTheDocument();
        expect(screen.getByText(/match/)).toBeInTheDocument();
    });

    it("shows the plain herd count when no filters are active", () => {
        renderBrowser({ filters: { sort: "newest" }, totalCount: 214, initialHasMore: false });
        expect(screen.getByText("214")).toBeInTheDocument();
        expect(screen.queryByText(/of 214/)).not.toBeInTheDocument();
    });

    it("pushes filter changes to the URL (single source of truth)", async () => {
        const user = userEvent.setup();
        renderBrowser();
        // Clear the finish filter via its chip ✕
        await user.click(screen.getByRole("button", { name: "Remove filter OF" }));
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });

    it("Show More appends the next page without losing the selection", async () => {
        const user = userEvent.setup();
        renderBrowser();

        // Enter select mode, select the first horse
        await user.click(screen.getByRole("button", { name: /select/i }));
        await user.click(screen.getByLabelText("Select Avalon"));
        expect(screen.getByText("1 selected")).toBeInTheDocument();

        // Show More appends
        await user.click(screen.getByRole("button", { name: /show more/i }));
        await waitFor(() => {
            expect(loadMoreStable).toHaveBeenCalledWith({ finish: "OF", sort: "newest", offset: 2 });
        });
        expect(await screen.findByLabelText("Select Oberon")).toBeInTheDocument();

        // Selection survived the append
        expect(screen.getByText("1 selected")).toBeInTheDocument();
        expect(screen.getByLabelText("Select Avalon")).toBeChecked();
    });

    it("'Select all N matching' selects across pages via the server", async () => {
        const user = userEvent.setup();
        renderBrowser();
        await user.click(screen.getByRole("button", { name: /select/i }));
        await user.click(screen.getByRole("button", { name: /select all 12 matching/i }));
        await waitFor(() => {
            expect(getMatchingHorseIds).toHaveBeenCalledWith({ finish: "OF", sort: "newest" });
        });
        expect(screen.getByText("3 selected")).toBeInTheDocument();
    });

    it("shows the over-cap notice when the match set exceeds the cap", async () => {
        getMatchingHorseIds.mockResolvedValue({
            success: true,
            ids: Array.from({ length: 500 }, (_, i) => `h-${i}`),
            totalMatching: 900,
            capped: true,
        });
        const user = userEvent.setup();
        renderBrowser();
        await user.click(screen.getByRole("button", { name: /select/i }));
        await user.click(screen.getByRole("button", { name: /select all 12 matching/i }));
        expect(await screen.findByText(/first 500 of 900 matching/i)).toBeInTheDocument();
    });

    it("bulk visibility toggle calls bulkUpdateHorses with the chosen visibility", async () => {
        const user = userEvent.setup();
        renderBrowser();
        await user.click(screen.getByRole("button", { name: /select/i }));
        await user.click(screen.getByLabelText("Select Avalon"));
        await user.click(screen.getByLabelText("Select Stonewall"));

        await user.selectOptions(screen.getByTitle("Change visibility"), "private");
        await waitFor(() => {
            expect(bulkUpdateHorses).toHaveBeenCalledWith(["h-1", "h-2"], { visibility: "private" });
        });
        expect(mockRefresh).toHaveBeenCalled();
    });

    it("surfaces bulk action errors instead of silently clearing", async () => {
        bulkUpdateHorses.mockResolvedValue({ success: false, error: "Some horses not found or not yours." });
        const user = userEvent.setup();
        renderBrowser();
        await user.click(screen.getByRole("button", { name: /select/i }));
        await user.click(screen.getByLabelText("Select Avalon"));
        await user.selectOptions(screen.getByTitle("Change visibility"), "public");
        expect(await screen.findByText(/not yours/i)).toBeInTheDocument();
        expect(mockRefresh).not.toHaveBeenCalled();
    });
});
