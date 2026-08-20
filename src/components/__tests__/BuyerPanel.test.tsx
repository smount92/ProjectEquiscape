// @vitest-environment jsdom
/**
 * Passport v2 — the buyer panel's honest-commerce contracts:
 *  - price is locale-formatted ("$1,250"), "Open to offers" when null
 *  - the trade-status stamp matches the status (red = For Sale)
 *  - condition pill carries the grade's gloss from conditionGrades
 *  - zero record + zero cards → the record line hides itself
 *  - cards count reads "(transfer with the horse)"
 *  - member variant COMPOSES MessageSellerButton (not a fork)
 *  - owner viewing their own listing gets no contact buttons
 *  - anon variant renders login-CTA equivalents with redirectTo
 *  - trust line anchors to the passport section ids
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import BuyerPanel, { formatAskingPrice } from "@/components/passport/BuyerPanel";

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

// Compose, don't fork: the member panel must render the REAL split
// actions component — asserted via this mock's marker + props echo.
const messageSellerSpy = vi.fn();
vi.mock("@/components/MessageSellerButton", () => ({
    default: (props: Record<string, unknown>) => {
        messageSellerSpy(props);
        return <div data-testid="message-seller-button" />;
    },
}));

const baseProps = {
    horseId: "horse-1",
    horseName: "Ledger Lines",
    tradeStatus: "For Sale" as const,
    listingPrice: 1250,
    conditionGrade: "Near Mint",
    recordSummary: { total: 4, placings: 3, championships: 1, verified: 2 },
    cardsCount: 2,
    variant: "member" as const,
    sellerId: "seller-1",
    isOwner: false,
    hoofprintHref: "#passport-hoofprint",
};

afterEach(() => {
    vi.unstubAllEnvs();
    messageSellerSpy.mockClear();
});

describe("formatAskingPrice", () => {
    it("locale-formats dollars and falls back to Open to offers", () => {
        expect(formatAskingPrice(1250)).toBe("$1,250");
        expect(formatAskingPrice(85)).toBe("$85");
        expect(formatAskingPrice(1234567)).toBe("$1,234,567");
        expect(formatAskingPrice(null)).toBe("Open to offers");
    });
});

describe("BuyerPanel — price + stamp", () => {
    it("renders the locale-formatted asking price and a red For Sale stamp", () => {
        render(<BuyerPanel {...baseProps} />);
        expect(screen.getByTestId("buyer-panel-price")).toHaveTextContent("$1,250");
        const stamp = screen.getByText("For Sale");
        expect(stamp.className).toContain("stamp-red");
    });

    it("Open to Offers: no price → 'Open to offers', un-red stamp", () => {
        render(
            <BuyerPanel {...baseProps} tradeStatus="Open to Offers" listingPrice={null} />,
        );
        expect(screen.getByTestId("buyer-panel-price")).toHaveTextContent("Open to offers");
        const stamp = screen.getByText("Open to Offers");
        expect(stamp.className).toContain("stamp");
        expect(stamp.className).not.toContain("stamp-red");
    });
});

describe("BuyerPanel — condition row", () => {
    it("shows the grade pill with its plain-English gloss", () => {
        render(<BuyerPanel {...baseProps} conditionGrade="Body Quality" />);
        const row = screen.getByTestId("buyer-panel-condition");
        expect(row).toHaveTextContent("Body Quality");
        expect(row).toHaveTextContent("Suitable for customizing");
    });

    it("hides the row when the horse has no condition grade", () => {
        render(<BuyerPanel {...baseProps} conditionGrade={null} />);
        expect(screen.queryByTestId("buyer-panel-condition")).not.toBeInTheDocument();
    });
});

describe("BuyerPanel — record line", () => {
    it("renders the record chip, verified chip and cards phrase", () => {
        render(<BuyerPanel {...baseProps} />);
        const row = screen.getByTestId("buyer-panel-record");
        expect(row).toHaveTextContent("3 placings · 1 championship");
        expect(row).toHaveTextContent("2 verified");
        expect(row).toHaveTextContent("2 qualification cards (transfer with the horse)");
    });

    it("singular card, no verified chip when none verified", () => {
        render(
            <BuyerPanel
                {...baseProps}
                recordSummary={{ total: 1, placings: 1, championships: 0, verified: 0 }}
                cardsCount={1}
            />,
        );
        const row = screen.getByTestId("buyer-panel-record");
        expect(row).toHaveTextContent("1 placing");
        expect(row).toHaveTextContent("1 qualification card (transfer with the horse)");
        expect(row).not.toHaveTextContent("verified");
    });

    it("zero record + zero cards → the whole line hides", () => {
        render(<BuyerPanel {...baseProps} recordSummary={null} cardsCount={0} />);
        expect(screen.queryByTestId("buyer-panel-record")).not.toBeInTheDocument();
    });
});

describe("BuyerPanel — contact actions", () => {
    it("member variant composes MessageSellerButton with the listing props", () => {
        render(<BuyerPanel {...baseProps} />);
        expect(screen.getByTestId("message-seller-button")).toBeInTheDocument();
        expect(messageSellerSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                sellerId: "seller-1",
                horseId: "horse-1",
                horseName: "Ledger Lines",
                tradeStatus: "For Sale",
                askingPrice: 1250,
            }),
        );
    });

    it("the owner viewing their own listing gets no contact buttons", () => {
        render(<BuyerPanel {...baseProps} isOwner />);
        expect(screen.queryByTestId("buyer-panel-actions")).not.toBeInTheDocument();
        expect(screen.queryByTestId("message-seller-button")).not.toBeInTheDocument();
    });

    it("anon variant renders login-CTA equivalents with redirectTo", () => {
        const loginHref = `/login?redirectTo=${encodeURIComponent("/community/horse-1")}`;
        render(
            <BuyerPanel
                {...baseProps}
                variant="anon"
                sellerId={null}
                loginHref={loginHref}
            />,
        );
        expect(screen.queryByTestId("message-seller-button")).not.toBeInTheDocument();
        const ask = screen.getByRole("link", { name: /Ask a question/ });
        const offer = screen.getByRole("link", { name: /Make Offer/ });
        expect(ask).toHaveAttribute("href", loginHref);
        expect(offer).toHaveAttribute("href", loginHref);
    });
});

describe("BuyerPanel — trust line", () => {
    it("anchors each phrase to its passport section", () => {
        render(<BuyerPanel {...baseProps} />);
        expect(screen.getByRole("link", { name: "Hoofprint provenance" })).toHaveAttribute(
            "href",
            "#passport-hoofprint",
        );
        expect(screen.getByRole("link", { name: "condition photos below" })).toHaveAttribute(
            "href",
            "#passport-photos",
        );
        expect(screen.getByRole("link", { name: "verified show record" })).toHaveAttribute(
            "href",
            "#passport-show-record",
        );
    });

    it("anon: the hoofprint phrase points at the public hoofprint report", () => {
        render(
            <BuyerPanel
                {...baseProps}
                variant="anon"
                loginHref="/login"
                hoofprintHref="/community/horse-1/hoofprint"
            />,
        );
        expect(screen.getByRole("link", { name: "Hoofprint provenance" })).toHaveAttribute(
            "href",
            "/community/horse-1/hoofprint",
        );
    });
});
