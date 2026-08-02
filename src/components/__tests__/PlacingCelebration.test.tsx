// @vitest-environment jsdom
/**
 * SHARE-YOUR-PLACING — the celebration page body, rendered with
 * mock data. This is the local harness for a feature whose prod
 * data doesn't exist yet (no published-results shows): every state
 * the route can produce is exercised here without a database.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import PlacingCelebration from "@/components/shows/PlacingCelebration";
import type { PublicPlacingData } from "@/lib/shows/placingShareRead";

// The global setup's next/link mock renders null — this suite
// asserts hrefs, so restore Link as a plain anchor.
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

function placing(overrides: Partial<PublicPlacingData> = {}): PublicPlacingData {
    return {
        show: {
            id: "show-1",
            title: "Summer Classic",
            mode: "online",
            status: "completed",
            resultDate: "2026-09-06",
        },
        entry: { id: "entry-1", entryNumber: 12, horseId: "horse-1" },
        place: 1,
        horseName: "Rain Dancer",
        ownerAlias: "maggie",
        photoUrl: "https://cdn.example/photo.webp",
        className: "Stock Breeds",
        classNumber: "4",
        sectionName: "Breyer",
        divisionName: "Original Finish",
        totalEntries: 9,
        ...overrides,
    };
}

const SHARE_URL = "https://modelhorsehub.com/shows/show-1/placing/entry-1";

describe("PlacingCelebration", () => {
    it("prints the headline sentence: horse — place · class at show", () => {
        render(<PlacingCelebration data={placing()} authed={false} shareUrl={SHARE_URL} />);
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Rain Dancer — 1st · Stock Breeds at Summer Classic",
            }),
        ).toBeInTheDocument();
        // The field line a non-member instantly understands.
        expect(screen.getByText(/1st of 9 entries/)).toBeInTheDocument();
    });

    it("renders the rosette, the photo, and the owner profile link", () => {
        render(<PlacingCelebration data={placing()} authed={true} shareUrl={SHARE_URL} />);
        expect(screen.getByTestId("placing-rosette")).toBeInTheDocument();
        expect(screen.getByAltText(/Rain Dancer — the placing entry photo/)).toHaveAttribute(
            "src",
            "https://cdn.example/photo.webp",
        );
        expect(screen.getByRole("link", { name: "@maggie" })).toHaveAttribute(
            "href",
            "/profile/maggie",
        );
    });

    it("falls back to the 🐴 block when the entry has no photo", () => {
        render(
            <PlacingCelebration
                data={placing({ photoUrl: null })}
                authed={true}
                shareUrl={SHARE_URL}
            />,
        );
        expect(screen.getByLabelText("No entry photo")).toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("links the permanent record (passport) and the full results anchor", () => {
        render(<PlacingCelebration data={placing()} authed={true} shareUrl={SHARE_URL} />);
        expect(
            screen.getByRole("link", { name: /Rain Dancer’s permanent record/ }),
        ).toHaveAttribute("href", "/community/horse-1");
        expect(screen.getByRole("link", { name: /See full results/ })).toHaveAttribute(
            "href",
            "/shows/show-1#results",
        );
    });

    it("pitches MHH + free account (with redirect back) to anon only", () => {
        const { rerender } = render(
            <PlacingCelebration data={placing()} authed={false} shareUrl={SHARE_URL} />,
        );
        expect(screen.getByTestId("placing-anon-cta")).toHaveTextContent(
            "What is Model Horse Hub?",
        );
        expect(screen.getByRole("link", { name: "Create free account" })).toHaveAttribute(
            "href",
            `/signup?redirectTo=${encodeURIComponent("/shows/show-1/placing/entry-1")}`,
        );

        rerender(<PlacingCelebration data={placing()} authed={true} shareUrl={SHARE_URL} />);
        expect(screen.queryByTestId("placing-anon-cta")).not.toBeInTheDocument();
    });

    it("3rd place renders the yellow rosette with ink text", () => {
        render(
            <PlacingCelebration data={placing({ place: 3 })} authed={true} shareUrl={SHARE_URL} />,
        );
        expect(
            screen.getByRole("heading", { level: 1, name: /3rd · Stock Breeds/ }),
        ).toBeInTheDocument();
        const rosette = screen.getByTestId("placing-rosette");
        expect(rosette).toHaveTextContent("3rd");
        // Ribbon convention color, never themed — inline by design
        // (jsdom may serialize the hex as rgb).
        expect(rosette.innerHTML).toMatch(/#eab308|rgb\(234,\s*179,\s*8\)/i);
    });
});
