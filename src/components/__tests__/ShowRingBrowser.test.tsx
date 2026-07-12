// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ShowRingBrowser from "../showring/ShowRingBrowser";
import type { ShowRingCard } from "@/lib/showring/types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));

// The global setup mocks next/link to render NOTHING — but the Show
// Ring card wraps its whole face in a Link, so render a real anchor.
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

const { loadMoreShowRing } = vi.hoisted(() => ({
    loadMoreShowRing: vi.fn(),
}));
vi.mock("@/app/actions/showring", () => ({
    loadMoreShowRing,
}));

// The card footer's social buttons call server actions — stub them.
vi.mock("@/app/actions/social", () => ({
    toggleFavorite: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/app/actions/wishlist", () => ({
    addToWishlist: vi.fn().mockResolvedValue({ success: true }),
}));

function card(overrides: Partial<ShowRingCard> = {}): ShowRingCard {
    return {
        id: "h-1",
        ownerId: "owner-1",
        customName: "Avalon",
        finishType: "OF",
        conditionGrade: "Mint",
        createdAt: "2026-07-01T00:00:00Z",
        refName: "Breyer Smart Chic Olena",
        ownerAlias: "collector1",
        thumbnailUrl: null,
        sculptor: null,
        tradeStatus: "Not for Sale",
        listingPrice: null,
        marketplaceNotes: null,
        moldName: "Smart Chic Olena",
        catalogId: "cat-1",
        favoriteCount: 2,
        isFavorited: false,
        scale: "Traditional",
        hoofprintCount: 0,
        assetCategory: "model",
        ...overrides,
    };
}

function renderBrowser(props: Partial<Parameters<typeof ShowRingBrowser>[0]> = {}) {
    return render(
        <ShowRingBrowser
            initialCards={[card(), card({ id: "h-2", customName: "Stonewall", catalogId: null })]}
            totalCount={30}
            initialHasMore={true}
            facetOptions={{ makers: ["Breyer"], scales: ["Traditional"], finishes: ["OF"] }}
            filters={{ finish: "OF", sort: "newest" }}
            {...props}
        />,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    loadMoreShowRing.mockResolvedValue({
        success: true,
        cards: [card({ id: "h-3", customName: "Oberon" })],
        hasMore: false,
    });
});

describe("ShowRingBrowser", () => {
    it("shows the 'N models match' result line when filters are active", () => {
        renderBrowser();
        expect(document.getElementById("showring-result-line")?.textContent).toContain(
            "30 models match",
        );
    });

    it("shows the plain public-model count when no filters are active", () => {
        renderBrowser({ filters: { sort: "newest" }, totalCount: 214, initialHasMore: false });
        expect(document.getElementById("showring-result-line")?.textContent).toContain(
            "214 public models",
        );
    });

    it("renders the true-empty state when the ring has no public horses at all", () => {
        renderBrowser({
            initialCards: [],
            totalCount: 0,
            initialHasMore: false,
            filters: { sort: "newest" },
        });
        expect(screen.getByText("The Show Ring is Empty")).toBeInTheDocument();
        expect(screen.queryByText("No Results")).not.toBeInTheDocument();
    });

    it("keeps the filter bar and shows 'No Results' when filters match nothing", () => {
        renderBrowser({
            initialCards: [],
            totalCount: 0,
            initialHasMore: false,
            filters: { maker: "Stone", sort: "newest" },
        });
        expect(screen.getByText("No Results")).toBeInTheDocument();
        expect(screen.queryByText("The Show Ring is Empty")).not.toBeInTheDocument();
        // The filter bar survives so the dead-end filter can be cleared
        expect(document.getElementById("showring-filter-bar")).not.toBeNull();
    });

    it("pushes filter changes to the URL (single source of truth)", async () => {
        const user = userEvent.setup();
        renderBrowser();
        await user.click(screen.getByRole("button", { name: "Remove filter OF" }));
        expect(mockPush).toHaveBeenCalledWith("/community");
    });

    it("serializes remaining filters into the pushed URL", async () => {
        const user = userEvent.setup();
        renderBrowser({ filters: { finish: "OF", maker: "Breyer", sort: "newest" } });
        await user.click(screen.getByRole("button", { name: "Remove filter OF" }));
        expect(mockPush).toHaveBeenCalledWith("/community?maker=Breyer");
    });

    it("Show More appends the next page with the current filters", async () => {
        const user = userEvent.setup();
        renderBrowser();
        expect(screen.getByText("Avalon")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /show more models/i }));
        await waitFor(() => {
            expect(loadMoreShowRing).toHaveBeenCalledWith({ finish: "OF", sort: "newest", offset: 2 });
        });
        // Appended below, previous cards still present
        expect(await screen.findByText("Oberon")).toBeInTheDocument();
        expect(screen.getByText("Avalon")).toBeInTheDocument();
        // hasMore false → button gone
        expect(screen.queryByRole("button", { name: /show more models/i })).not.toBeInTheDocument();
    });

    it("renders owner attribution and hides the wishlist button for unlisted molds", () => {
        renderBrowser();
        expect(screen.getAllByText("@collector1")).toHaveLength(2);
        // h-1 has a catalogId → wishlist button renders; h-2 (null) no-ops
        expect(screen.getAllByLabelText("Add to Want List")).toHaveLength(1);
    });

    it("uses the shared night-safe finish badge palette (no light-only amber)", () => {
        renderBrowser();
        const badges = screen.getAllByText("OF");
        const badge = badges.find((el) => el.className.includes("text-warning"));
        expect(badge).toBeTruthy();
        expect(badge?.className).not.toContain("amber");
    });
});
