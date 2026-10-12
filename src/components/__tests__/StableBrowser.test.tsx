// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StableBrowser from "../stable/StableBrowser";
import type { StableCard } from "@/lib/stable/types";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
    useSearchParams: () => new URLSearchParams(),
}));

// The shared setup mocks Link to render nothing; the cards here must be
// real anchors so ReturnToCard can find them by id.
vi.mock("next/link", () => ({
    default: ({
        children,
        href,
        ...props
    }: {
        children: React.ReactNode;
        href: string;
        [key: string]: unknown;
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

const { getMatchingHorseIds, saveStableView, deleteStableView } = vi.hoisted(() => ({
    getMatchingHorseIds: vi.fn(),
    saveStableView: vi.fn(),
    deleteStableView: vi.fn(),
}));
vi.mock("@/app/actions/stable", () => ({
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
            cards={[card(), card({ id: "h-2", customName: "Stonewall" })]}
            totalCount={12}
            page={1}
            per={48}
            pageCount={1}
            herdTotal={214}
            facetOptions={{ makers: [], scales: [], finishes: [], categories: [] }}
            collections={[]}
            savedViews={[]}
            filters={{ finish: "OF", sort: "newest" }}
            {...props}
        />,
    );
}

/** 48 cards for page `page` of a 412-horse filtered result. */
function pageOfCards(page: number, per = 48, total = 412): StableCard[] {
    const from = (page - 1) * per;
    const n = Math.max(0, Math.min(per, total - from));
    return Array.from({ length: n }, (_, i) => card({ id: `h-${from + i + 1}`, customName: `Horse ${from + i + 1}` }));
}

beforeEach(() => {
    vi.clearAllMocks();
    try {
        window.sessionStorage.clear();
    } catch {
        // jsdom always has it; belt and braces
    }
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
    it("renders the onboarding welcome instead of the filter bar when the stable is truly empty", () => {
        renderBrowser({
            cards: [],
            totalCount: 0,
            herdTotal: 0,
            filters: { sort: "newest" },
        });
        expect(screen.getByTestId("stable-welcome")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Welcome to Model Horse Hub!" })).toBeInTheDocument();
        // No filter bar, result line, or "No Results" state for a 0-horse stable
        expect(screen.queryByText(/no results/i)).not.toBeInTheDocument();
        expect(document.getElementById("stable-result-line")).toBeNull();
        expect(screen.queryByRole("button", { name: /select/i })).not.toBeInTheDocument();
    });

    it("keeps the filter bar and shows 'No Results' when filters match nothing (not the welcome)", () => {
        renderBrowser({
            cards: [],
            totalCount: 0,
            herdTotal: 214,
            filters: { finish: "CM", sort: "newest" },
        });
        expect(screen.queryByTestId("stable-welcome")).not.toBeInTheDocument();
        expect(screen.getByText("No Results")).toBeInTheDocument();
        expect(screen.getByText(/loosen one, or clear all/i)).toBeInTheDocument();
        // The filter bar survives so the dead-end filter can be cleared
        expect(document.getElementById("stable-result-line")).not.toBeNull();
        expect(screen.getByText("0 of 214")).toBeInTheDocument();
    });

    it("shows the 'N of TOTAL match' result line when filters are active", () => {
        renderBrowser();
        expect(screen.getByText("12 of 214")).toBeInTheDocument();
        expect(screen.getByText(/match/)).toBeInTheDocument();
    });

    it("shows the plain herd count when no filters are active", () => {
        renderBrowser({ filters: { sort: "newest" }, totalCount: 214 });
        const line = within(document.getElementById("stable-result-line")!);
        expect(line.getByText("214")).toBeInTheDocument();
        expect(line.queryByText(/of 214/)).not.toBeInTheDocument();
    });

    it("pushes filter changes to the URL (single source of truth)", async () => {
        const user = userEvent.setup();
        renderBrowser();
        // Clear the finish filter via its chip ✕
        await user.click(screen.getByRole("button", { name: "Remove filter OF" }));
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });

    it("has no Show More button — one way to page", () => {
        renderBrowser({ cards: pageOfCards(1), totalCount: 412, pageCount: 9 });
        expect(screen.queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
    });

    it("renders page controls top and bottom with the range line", () => {
        renderBrowser({ cards: pageOfCards(3), totalCount: 412, page: 3, pageCount: 9 });
        const top = screen.getByTestId("stable-pagination-top");
        const bottom = screen.getByTestId("stable-pagination-bottom");
        for (const nav of [top, bottom]) {
            expect(within(nav).getByText(/Showing/).textContent).toBe("Showing 97–144 of 412");
            expect(within(nav).getByRole("button", { name: "Previous page" })).toBeEnabled();
            expect(within(nav).getByRole("button", { name: "Next page" })).toBeEnabled();
            expect(within(nav).getByRole("button", { name: "Page 3" })).toHaveAttribute("aria-current", "page");
            expect(within(nav).getByLabelText("Models per page")).toHaveValue("48");
        }
        // first, current ±2, last
        const pages = within(top)
            .getAllByRole("button", { name: /^Page \d+$/ })
            .map((b) => b.textContent);
        expect(pages).toEqual(["1", "2", "3", "4", "5", "9"]);
    });

    it("disables Previous on the first page and Next on the last", () => {
        const { unmount } = renderBrowser({ cards: pageOfCards(1), totalCount: 412, page: 1, pageCount: 9 });
        expect(screen.getAllByRole("button", { name: "Previous page" })[0]).toBeDisabled();
        expect(screen.getAllByRole("button", { name: "Next page" })[0]).toBeEnabled();
        unmount();
        renderBrowser({ cards: pageOfCards(9), totalCount: 412, page: 9, pageCount: 9 });
        expect(screen.getAllByRole("button", { name: "Next page" })[0]).toBeDisabled();
        expect(screen.getAllByText(/Showing/)[0].textContent).toBe("Showing 385–412 of 412");
    });

    it("Next pushes the next page's URL with the filters kept", async () => {
        const user = userEvent.setup();
        renderBrowser({ cards: pageOfCards(3), totalCount: 412, page: 3, pageCount: 9 });
        await user.click(screen.getAllByRole("button", { name: "Next page" })[0]);
        expect(mockPush).toHaveBeenCalledWith("/dashboard?finish=OF&page=4");
        await user.click(screen.getAllByRole("button", { name: "Page 1" })[0]);
        expect(mockPush).toHaveBeenLastCalledWith("/dashboard?finish=OF");
    });

    it("changing the page size pushes per and keeps the first horse in view", async () => {
        const user = userEvent.setup();
        renderBrowser({ cards: pageOfCards(3), totalCount: 412, page: 3, pageCount: 9 });
        await user.selectOptions(screen.getAllByLabelText("Models per page")[0], "96");
        // 97–144 at 48 → page 2 at 96 (97–192)
        expect(mockPush).toHaveBeenCalledWith("/dashboard?finish=OF&page=2&per=96");
    });

    it("a filter change goes back to page 1 and keeps the page size", async () => {
        const user = userEvent.setup();
        renderBrowser({
            cards: pageOfCards(3, 96),
            totalCount: 412,
            page: 3,
            per: 96,
            pageCount: 5,
            filters: { finish: "OF", sort: "newest", page: 3, per: 96 },
        });
        await user.click(screen.getByRole("button", { name: "Remove filter OF" }));
        expect(mockPush).toHaveBeenCalledWith("/dashboard?per=96");
    });

    it("clears the selection when the page changes", async () => {
        const user = userEvent.setup();
        const { rerender } = renderBrowser({ cards: pageOfCards(1), totalCount: 412, page: 1, pageCount: 9 });
        await user.click(screen.getByRole("button", { name: /select/i }));
        await user.click(screen.getByLabelText("Select Horse 1"));
        expect(screen.getByText("1 selected")).toBeInTheDocument();

        rerender(
            <StableBrowser
                cards={pageOfCards(2)}
                totalCount={412}
                page={2}
                per={48}
                pageCount={9}
                herdTotal={214}
                facetOptions={{ makers: [], scales: [], finishes: [], categories: [], molds: [] }}
                collections={[]}
                savedViews={[]}
                filters={{ finish: "OF", sort: "newest", page: 2 }}
            />,
        );
        expect(screen.getByText("0 selected")).toBeInTheDocument();
    });

    it("brings the card the member just opened back into view", async () => {
        const id = "123e4567-e89b-42d3-a456-426614174000";
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        window.sessionStorage.setItem("mhh:nav-trail", JSON.stringify(["/dashboard?finish=OF"]));
        window.sessionStorage.setItem("mhh:nav-trail-from", `/stable/${id}`);

        renderBrowser({ cards: [card(), card({ id, customName: "Oberon" })] });
        await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" }));
        const el = document.getElementById(`horse-${id}`);
        expect(el).not.toBeNull();
        expect(scrollIntoView.mock.contexts[0]).toBe(el);
        expect(el?.className).toContain("ring-forest/60");
    });

    it("does not scroll when the horse left is not on this page", async () => {
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        window.sessionStorage.setItem("mhh:nav-trail-from", "/stable/923e4567-e89b-42d3-a456-426614174999");
        renderBrowser();
        await new Promise((r) => setTimeout(r, 50));
        expect(scrollIntoView).not.toHaveBeenCalled();
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
