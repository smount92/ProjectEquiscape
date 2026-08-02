// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FavoriteButton from "../FavoriteButton";
import { ToastProvider } from "@/lib/context/ToastContext";

// The global setup mocks next/link to render NOTHING — the toast's
// "View your Favorites →" action is a Link, so render a real anchor.
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

const { toggleFavorite } = vi.hoisted(() => ({
    toggleFavorite: vi.fn(),
}));
vi.mock("@/app/actions/social", () => ({
    toggleFavorite,
}));

function renderButton(props: Partial<Parameters<typeof FavoriteButton>[0]> = {}) {
    return render(
        <ToastProvider>
            <FavoriteButton horseId="h-1" initialIsFavorited={false} initialCount={0} {...props} />
        </ToastProvider>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    toggleFavorite.mockResolvedValue({ success: true, isFavorited: true, count: 1 });
});

describe("FavoriteButton", () => {
    it("shows a visible label in the default (labeled) variant", () => {
        renderButton();
        expect(screen.getByRole("button", { name: "Favorite" })).toHaveTextContent("Favorite");
    });

    it("shows Favorited when already favorited", () => {
        renderButton({ initialIsFavorited: true, initialCount: 3 });
        expect(screen.getByRole("button", { name: "Unfavorite" })).toHaveTextContent("Favorited");
    });

    it("is icon-only in the compact variant but keeps the aria-label", () => {
        renderButton({ variant: "compact" });
        const btn = screen.getByRole("button", { name: "Favorite" });
        expect(btn).not.toHaveTextContent("Favorite");
        expect(btn).toHaveAttribute("aria-label", "Favorite");
    });

    it("favoriting toasts with a View your Favorites link", async () => {
        const user = userEvent.setup();
        renderButton();

        await user.click(screen.getByRole("button", { name: "Favorite" }));

        await waitFor(() => {
            expect(screen.getByText("Added to your Favorites.")).toBeInTheDocument();
        });
        const link = screen.getByRole("link", { name: "View your Favorites →" });
        expect(link).toHaveAttribute("href", "/favorites");
        expect(screen.getByRole("button", { name: "Unfavorite" })).toBeInTheDocument();
    });

    it("unfavoriting toasts a removal message", async () => {
        toggleFavorite.mockResolvedValue({ success: true, isFavorited: false, count: 0 });
        const user = userEvent.setup();
        renderButton({ initialIsFavorited: true, initialCount: 1 });

        await user.click(screen.getByRole("button", { name: "Unfavorite" }));

        await waitFor(() => {
            expect(screen.getByText("Removed from your Favorites.")).toBeInTheDocument();
        });
        expect(screen.getByRole("button", { name: "Favorite" })).toBeInTheDocument();
    });

    it("reverts AND surfaces a visible error message on failure (no more silent revert)", async () => {
        toggleFavorite.mockResolvedValue({ success: false, error: "Not authenticated." });
        const user = userEvent.setup();
        renderButton();

        await user.click(screen.getByRole("button", { name: "Favorite" }));

        await waitFor(() => {
            expect(screen.getByText("Not authenticated.")).toBeInTheDocument();
        });
        // Reverted to unfavorited
        expect(screen.getByRole("button", { name: "Favorite" })).toBeInTheDocument();
    });
});
