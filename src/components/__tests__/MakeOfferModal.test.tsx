// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MakeOfferModal from "../MakeOfferModal";

// Mock createPortal to render inline
vi.mock("react-dom", async () => {
    const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
    return {
        ...actual,
        createPortal: (node: React.ReactNode) => node,
    };
});

// Mock server action
vi.mock("@/app/actions/transactions", () => ({
    makeOffer: vi.fn().mockResolvedValue({ success: true, conversationId: "conv-123" }),
}));

// Mock safety module
vi.mock("@/lib/safety", () => ({
    RISKY_PAYMENT_REGEX: /paypal|venmo|zelle|cash\s*app/i,
    RISKY_PAYMENT_WARNING: "⚠️ We recommend using Model Horse Hub's built-in Safe Trade system.",
}));

const defaultProps = {
    horseId: "horse-1",
    horseName: "Bay Roan Alborozo",
    sellerId: "seller-1",
    askingPrice: 150,
    onClose: vi.fn(),
};

describe("MakeOfferModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders modal with horse name", () => {
        render(<MakeOfferModal {...defaultProps} />);

        expect(screen.getByText("💰 Make an Offer")).toBeInTheDocument();
        expect(screen.getByText("Bay Roan Alborozo")).toBeInTheDocument();
    });

    it("pre-fills amount from asking price", () => {
        render(<MakeOfferModal {...defaultProps} />);

        const amountInput = screen.getByPlaceholderText("0.00");
        expect(amountInput).toHaveValue(150);
    });

    it("shows asking price hint", () => {
        render(<MakeOfferModal {...defaultProps} />);

        expect(screen.getByText(/Asking price: \$150/)).toBeInTheDocument();
    });

    it("calls onClose when Close button is clicked", async () => {
        const user = userEvent.setup();
        render(<MakeOfferModal {...defaultProps} />);

        await user.click(screen.getByLabelText("Close"));
        expect(defaultProps.onClose).toHaveBeenCalledOnce();
    });

    it("calls onClose when Cancel is clicked", async () => {
        const user = userEvent.setup();
        render(<MakeOfferModal {...defaultProps} />);

        await user.click(screen.getByText("Cancel"));
        expect(defaultProps.onClose).toHaveBeenCalledOnce();
    });

    it("does not call makeOffer with empty amount (HTML5 validation)", async () => {
        const user = userEvent.setup();
        const { makeOffer } = await import("@/app/actions/transactions");
        render(<MakeOfferModal {...defaultProps} askingPrice={null} />);

        // Submit with empty amount — blocked by HTML5 required
        await user.click(screen.getByText("Submit Offer"));

        expect(makeOffer).not.toHaveBeenCalled();
    });

    it("shows payment safety warning for risky terms", async () => {
        const user = userEvent.setup();
        render(<MakeOfferModal {...defaultProps} />);

        const messageField = screen.getByPlaceholderText(/Tell the seller/);
        await user.type(messageField, "Can I pay via PayPal?");

        expect(screen.getByText(/We recommend using Model Horse Hub/)).toBeInTheDocument();
    });

    it("does not show warning for safe messages", async () => {
        const user = userEvent.setup();
        render(<MakeOfferModal {...defaultProps} />);

        const messageField = screen.getByPlaceholderText(/Tell the seller/);
        await user.type(messageField, "Beautiful horse, I love the paintwork!");

        expect(screen.queryByText(/We recommend using Model Horse Hub/)).not.toBeInTheDocument();
    });

    it("submits offer successfully", async () => {
        const user = userEvent.setup();
        const { makeOffer } = await import("@/app/actions/transactions");
        render(<MakeOfferModal {...defaultProps} />);

        await user.click(screen.getByText("Submit Offer"));

        expect(makeOffer).toHaveBeenCalledWith({
            horseId: "horse-1",
            sellerId: "seller-1",
            amount: 150,
            message: undefined,
            isBundle: false,
        });
    });

    it("has bundle checkbox", () => {
        render(<MakeOfferModal {...defaultProps} />);

        expect(screen.getByText(/bundle\/lot sale/)).toBeInTheDocument();
    });

    it("renders message textarea with maxLength", () => {
        render(<MakeOfferModal {...defaultProps} />);

        const textarea = screen.getByPlaceholderText(/Tell the seller/);
        expect(textarea).toHaveAttribute("maxLength", "500");
    });
});
