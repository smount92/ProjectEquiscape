// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import QualificationCardsSection, {
    type PassportQualificationCard,
} from "@/components/shows/QualificationCardsSection";

function card(
    overrides: Partial<PassportQualificationCard> = {},
): PassportQualificationCard {
    return {
        code: "AbCd2345",
        earnedPlace: 1,
        showYear: 2026,
        status: "issued",
        showTitle: "Spring Fling Live",
        className: "Quarter Horse",
        issuedAt: "2026-07-10T12:00:00Z",
        ...overrides,
    };
}

describe("QualificationCardsSection", () => {
    it("renders nothing when the horse holds no cards", () => {
        const { container } = render(<QualificationCardsSection cards={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("shows the code prominently with place, class, show, and show-year label", () => {
        render(<QualificationCardsSection cards={[card()]} />);

        expect(screen.getByTestId("card-code-AbCd2345")).toHaveTextContent("AbCd2345");
        expect(screen.getByText(/1st — Quarter Horse/)).toBeInTheDocument();
        // May 1 → April 30 hobby year: 2026 labels as "2026–27".
        expect(screen.getByText(/Spring Fling Live · Show year 2026–27/)).toBeInTheDocument();
        expect(screen.getByText("Issued")).toBeInTheDocument();
    });

    it("links each card to its public verification page", () => {
        render(<QualificationCardsSection cards={[card()]} />);
        expect(screen.getByRole("link", { name: /verify this card/i })).toHaveAttribute(
            "href",
            "/cards/AbCd2345",
        );
    });

    it("badges each status distinctly (transferred and void)", () => {
        render(
            <QualificationCardsSection
                cards={[
                    card(),
                    card({ code: "WxYz6789", earnedPlace: 2, status: "transferred" }),
                    card({ code: "MnPq2346", status: "void" }),
                ]}
            />,
        );
        expect(screen.getByText("Transferred")).toBeInTheDocument();
        expect(screen.getByText("Void")).toBeInTheDocument();
        expect(screen.getByText(/2nd — Quarter Horse/)).toBeInTheDocument();
    });

    it("is explicit that these are platform cards, not NAMHSA/NAN cards", () => {
        render(<QualificationCardsSection cards={[card()]} />);
        expect(screen.getByText(/not namhsa\/nan cards/i)).toBeInTheDocument();
        expect(screen.getByText(/mhh qualification cards/i)).toBeInTheDocument();
    });
});
