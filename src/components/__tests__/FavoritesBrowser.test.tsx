// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FavoritesBrowser from "../favorites/FavoritesBrowser";
import { ToastProvider } from "@/lib/context/ToastContext";
import type { AvailableFavorite, FavoriteEntry, UnavailableFavorite } from "@/lib/favorites/shape";

// The global setup mocks next/link to render NOTHING — the cards wrap
// their face in a Link, so render a real anchor.
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

const { toggleFavorite, loadMoreFavorites } = vi.hoisted(() => ({
    toggleFavorite: vi.fn(),
    loadMoreFavorites: vi.fn(),
}));
vi.mock("@/app/actions/social", () => ({ toggleFavorite }));
vi.mock("@/app/actions/favorites", () => ({ loadMoreFavorites }));

function available(overrides: Partial<AvailableFavorite> = {}): AvailableFavorite {
    return {
        kind: "available",
        favoriteId: "fav-1",
        horseId: "horse-1",
        favoritedAt: "2026-07-01T00:00:00Z",
        name: "Avalon",
        ownerAlias: "collector1",
        tradeStatus: "For Sale",
        listingPrice: 120,
        imagePath: null,
        thumbnailUrl: null,
        ...overrides,
    };
}

function unavailable(overrides: Partial<UnavailableFavorite> = {}): UnavailableFavorite {
    return {
        kind: "unavailable",
        favoriteId: "fav-2",
        horseId: "horse-2",
        favoritedAt: "2026-06-15T00:00:00Z",
        ...overrides,
    };
}

function renderBrowser(entries: FavoriteEntry[] = [available(), unavailable()], hasMore = false) {
    return render(
        <ToastProvider>
            <FavoritesBrowser initialEntries={entries} totalCount={entries.length} initialHasMore={hasMore} />
        </ToastProvider>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    toggleFavorite.mockResolvedValue({ success: true, isFavorited: false, count: 0 });
    loadMoreFavorites.mockResolvedValue({ success: true, entries: [], hasMore: false });
});

describe("FavoritesBrowser", () => {
    it("renders available horses as cards and unavailable rows without horse details", () => {
        renderBrowser();
        expect(screen.getByText("Avalon")).toBeInTheDocument();
        expect(screen.getByText("@collector1")).toBeInTheDocument();
        expect(screen.getByText("No longer available")).toBeInTheDocument();
        // The unavailable row must not render any horse name.
        expect(document.getElementById("favorite-unavailable-fav-2")).not.toHaveTextContent("Avalon");
    });

    it("shows the warm empty state with a Show Ring link", () => {
        renderBrowser([]);
        expect(screen.getByText("Horses you ♥ around the Show Ring land here.")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Browse the Show Ring/ })).toHaveAttribute(
            "href",
            "/community",
        );
    });

    it("optimistically removes a card on unfavorite and offers Undo", async () => {
        const user = userEvent.setup();
        renderBrowser();

        await user.click(screen.getByRole("button", { name: "Unfavorite Avalon" }));

        // Optimistic removal
        expect(screen.queryByText("Avalon")).not.toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText("Removed from your Favorites.")).toBeInTheDocument();
        });

        // Undo re-favorites and restores the card
        toggleFavorite.mockResolvedValue({ success: true, isFavorited: true, count: 1 });
        await user.click(screen.getByRole("button", { name: "Undo" }));
        await waitFor(() => {
            expect(screen.getByText("Avalon")).toBeInTheDocument();
        });
    });

    it("restores the card and shows an error toast when unfavoriting fails", async () => {
        toggleFavorite.mockResolvedValue({ success: false, error: "Network down." });
        const user = userEvent.setup();
        renderBrowser();

        await user.click(screen.getByRole("button", { name: "Unfavorite Avalon" }));

        await waitFor(() => {
            expect(screen.getByText("Network down.")).toBeInTheDocument();
        });
        expect(screen.getByText("Avalon")).toBeInTheDocument();
    });

    it("removes an unavailable row via its Remove button", async () => {
        const user = userEvent.setup();
        renderBrowser();

        await user.click(screen.getByRole("button", { name: "Remove unavailable horse from Favorites" }));

        expect(screen.queryByText("No longer available")).not.toBeInTheDocument();
        await waitFor(() => {
            expect(toggleFavorite).toHaveBeenCalledWith("horse-2");
        });
    });

    it("appends the next page via Show More", async () => {
        loadMoreFavorites.mockResolvedValue({
            success: true,
            entries: [available({ favoriteId: "fav-3", horseId: "horse-3", name: "Oberon" })],
            hasMore: false,
        });
        const user = userEvent.setup();
        renderBrowser([available(), unavailable()], true);

        await user.click(screen.getByRole("button", { name: "Show More" }));

        await waitFor(() => {
            expect(screen.getByText("Oberon")).toBeInTheDocument();
        });
        expect(loadMoreFavorites).toHaveBeenCalledWith({ offset: 2 });
        expect(screen.queryByRole("button", { name: "Show More" })).not.toBeInTheDocument();
    });
});
