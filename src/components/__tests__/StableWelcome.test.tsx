// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StableWelcome from "../stable/StableWelcome";

// Override the global null-rendering Link mock so the CTA anchor is
// actually in the tree for this component's tests.
vi.mock("next/link", () => ({
    default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

describe("StableWelcome", () => {
    it("renders the 3-step onboarding copy", () => {
        render(<StableWelcome />);
        expect(screen.getByRole("heading", { name: "Welcome to Model Horse Hub!" })).toBeInTheDocument();
        expect(screen.getByText(/adding your first model to your digital stable/i)).toBeInTheDocument();
        expect(screen.getByText("Add your first horse with photos")).toBeInTheDocument();
        expect(screen.getByText("Make it public for the Show Ring")).toBeInTheDocument();
        expect(screen.getByText("Discover and follow other collectors")).toBeInTheDocument();
    });

    it("has the Add Your First Horse CTA linking to /add-horse", () => {
        render(<StableWelcome />);
        const cta = screen.getByRole("link", { name: /add your first horse/i });
        expect(cta).toHaveAttribute("href", "/add-horse");
        expect(cta).toHaveAttribute("id", "add-first-horse");
    });

    it("uses house materials, never light-only palette literals", () => {
        const { container } = render(<StableWelcome className="mb-8" />);
        const card = screen.getByTestId("stable-welcome");
        // Ledger-paper surface + caller-supplied spacing
        expect(card.className).toContain("ledger-paper");
        expect(card.className).toContain("mb-8");
        // Night/Simple-safe by construction: no emerald/indigo/stone literals anywhere
        expect(container.innerHTML).not.toMatch(/emerald|indigo|stone-/);
        // Step badges use the success token wash
        expect(container.querySelectorAll(".bg-success\\/10")).toHaveLength(3);
    });
});
