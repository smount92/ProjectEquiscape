// @vitest-environment jsdom
/**
 * Passport v2 masthead — the passport leads with the horse:
 *  - exactly one h1 and it is the HORSE'S NAME (not "Show Ring")
 *  - eyebrow "Public Passport · Model Horse Hub"
 *  - "Owned by @alias · {reference}": owner → profile, reference →
 *    catalog page when linked, plain text when not
 *  - back-breadcrumb to the Show Ring
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import PassportMasthead from "@/components/passport/PassportMasthead";

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

describe("PassportMasthead", () => {
    it("makes the horse's name the one and only h1", () => {
        render(
            <PassportMasthead
                horseName="Ledger Lines"
                ownerAlias="maggie"
                referenceName="Breyer — Weather Girl"
                referenceHref="/reference/breyer/weather-girl"
            />,
        );
        const h1s = screen.getAllByRole("heading", { level: 1 });
        expect(h1s).toHaveLength(1);
        expect(h1s[0]).toHaveTextContent("Ledger Lines");
        expect(screen.queryByText("Show Ring", { selector: "h1" })).not.toBeInTheDocument();
    });

    it("carries the eyebrow, owner link and linked reference", () => {
        render(
            <PassportMasthead
                horseName="Ledger Lines"
                ownerAlias="maggie"
                referenceName="Breyer — Weather Girl"
                referenceHref="/reference/breyer/weather-girl"
            />,
        );
        expect(screen.getByText("Public Passport · Model Horse Hub")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "@maggie" })).toHaveAttribute(
            "href",
            "/profile/maggie",
        );
        expect(screen.getByRole("link", { name: "Breyer — Weather Girl" })).toHaveAttribute(
            "href",
            "/reference/breyer/weather-girl",
        );
    });

    it("unlinked reference renders as plain text; none at all → owner only", () => {
        const { rerender } = render(
            <PassportMasthead
                horseName="Ledger Lines"
                ownerAlias="maggie"
                referenceName="Breyer — Weather Girl"
                referenceHref={null}
            />,
        );
        expect(screen.getByText("Breyer — Weather Girl")).toBeInTheDocument();
        expect(
            screen.queryByRole("link", { name: "Breyer — Weather Girl" }),
        ).not.toBeInTheDocument();

        rerender(
            <PassportMasthead horseName="Ledger Lines" ownerAlias="maggie" referenceName={null} />,
        );
        expect(screen.queryByText(/Breyer/)).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: "@maggie" })).toBeInTheDocument();
    });

    it("keeps the back-breadcrumb to the Show Ring", () => {
        render(<PassportMasthead horseName="Ledger Lines" ownerAlias="maggie" />);
        expect(screen.getByRole("link", { name: /Show Ring/ })).toHaveAttribute(
            "href",
            "/community",
        );
    });

    // Favorites = public likes (owner ruling): the tally rides the
    // masthead on BOTH passport surfaces, but a horse with no likes
    // must not announce a zero.
    describe("favorite tally", () => {
        it("shows the count when the horse has likes", () => {
            render(
                <PassportMasthead horseName="Ledger Lines" ownerAlias="maggie" favoriteCount={12} />,
            );
            expect(screen.getByTestId("passport-favorite-count")).toHaveTextContent("12 favorites");
        });

        it("says 'favorite' singular at one", () => {
            render(
                <PassportMasthead horseName="Ledger Lines" ownerAlias="maggie" favoriteCount={1} />,
            );
            expect(screen.getByTestId("passport-favorite-count")).toHaveTextContent("1 favorite");
        });

        it("renders nothing at zero, null, or omitted", () => {
            const { rerender } = render(
                <PassportMasthead horseName="Ledger Lines" ownerAlias="maggie" favoriteCount={0} />,
            );
            expect(screen.queryByTestId("passport-favorite-count")).not.toBeInTheDocument();

            rerender(
                <PassportMasthead
                    horseName="Ledger Lines"
                    ownerAlias="maggie"
                    favoriteCount={null}
                />,
            );
            expect(screen.queryByTestId("passport-favorite-count")).not.toBeInTheDocument();

            rerender(<PassportMasthead horseName="Ledger Lines" ownerAlias="maggie" />);
            expect(screen.queryByTestId("passport-favorite-count")).not.toBeInTheDocument();
        });

        it("still leaves exactly one h1 — the horse's name", () => {
            render(
                <PassportMasthead horseName="Ledger Lines" ownerAlias="maggie" favoriteCount={4} />,
            );
            const h1s = screen.getAllByRole("heading", { level: 1 });
            expect(h1s).toHaveLength(1);
            expect(h1s[0]).toHaveTextContent("Ledger Lines");
        });
    });
});
