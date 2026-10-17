// @vitest-environment jsdom
/**
 * The Financial Vault on the owner's passport. Purchase notes (241) get a
 * card of their own, both note fields make their links clickable, and a
 * vault holding only a note still counts as a vault with something in it.
 */
import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import VaultReveal from "@/components/VaultReveal";

const EMPTY = {
    purchase_price: null,
    purchase_date: null,
    estimated_current_value: null,
    insurance_notes: null,
    purchase_date_text: null,
    is_trade: false,
};

function reveal() {
    fireEvent.click(screen.getByRole("button", { name: /reveal/i }));
}

describe("VaultReveal", () => {
    it("shows purchase notes in their own card, links clickable, line breaks kept", () => {
        render(
            <VaultReveal
                vault={{
                    ...EMPTY,
                    purchase_price: 85,
                    purchase_notes: "Bought from the artist at BreyerFest.\nReceipt: https://example.com/receipt/123.",
                }}
            />,
        );
        reveal();

        const card = screen.getByTestId("vault-purchase-notes");
        expect(within(card).getByText("Purchase notes")).toBeInTheDocument();
        expect(card.textContent).toContain("Bought from the artist at BreyerFest.");

        const link = within(card).getByRole("link");
        expect(link).toHaveAttribute("href", "https://example.com/receipt/123");
        expect(link).toHaveAttribute("target", "_blank");
        expect(link.getAttribute("rel")!.split(" ").sort()).toEqual(["nofollow", "noopener", "noreferrer"]);

        // The text keeps its newline and the card shows it.
        const body = link.parentElement!;
        expect(body.textContent).toContain("BreyerFest.\nReceipt:");
        expect(body.className).toContain("whitespace-pre-line");
    });

    it("makes links in Insurance Notes clickable too", () => {
        render(<VaultReveal vault={{ ...EMPTY, insurance_notes: "Policy on www.collectinsure.com/policy/9" }} />);
        reveal();
        const card = screen.getByTestId("vault-insurance-notes");
        expect(within(card).getByText("Insurance Notes")).toBeInTheDocument();
        expect(within(card).getByRole("link")).toHaveAttribute("href", "https://www.collectinsure.com/policy/9");
    });

    it("counts a vault holding only purchase notes as having data", () => {
        render(<VaultReveal vault={{ ...EMPTY, purchase_notes: "From a friend's dispersal" }} />);
        reveal();
        expect(screen.queryByText(/No financial data recorded yet/)).toBeNull();
        expect(screen.getByTestId("vault-purchase-notes")).toBeInTheDocument();
    });

    it("treats blank notes, or none at all before 241, as empty", () => {
        const { unmount } = render(<VaultReveal vault={{ ...EMPTY, purchase_notes: "   " }} />);
        reveal();
        expect(screen.getByText(/No financial data recorded yet/)).toBeInTheDocument();
        expect(screen.queryByTestId("vault-purchase-notes")).toBeNull();
        unmount();

        // Pre-241 the select has no purchase_notes key at all.
        render(<VaultReveal vault={{ ...EMPTY }} />);
        reveal();
        expect(screen.getByText(/No financial data recorded yet/)).toBeInTheDocument();
    });

    it("never renders markup from a note", () => {
        render(<VaultReveal vault={{ ...EMPTY, purchase_notes: '<img src=x onerror="alert(1)"> <b>bold</b>' }} />);
        reveal();
        const card = screen.getByTestId("vault-purchase-notes");
        expect(card.querySelector("img")).toBeNull();
        expect(card.querySelector("b")).toBeNull();
        expect(card.textContent).toContain("<b>bold</b>");
    });

    it("keeps the hidden vault out of reach until revealed", () => {
        render(<VaultReveal vault={{ ...EMPTY, purchase_notes: "https://example.com/listing" }} />);
        const panel = document.getElementById("vault-data")!;
        expect(panel).toHaveAttribute("inert");
        reveal();
        expect(panel).not.toHaveAttribute("inert");
    });
});
