// @vitest-environment jsdom
/**
 * Wave 4b — the sticky CTA's entry path: the brass CTA is a plain
 * link to the entry page (/shows/[id]/enter, the single owner of
 * entering). Anon gets the 4a sign-in-with-redirect pattern instead,
 * landing back on the entry page.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import AlbumCtaRow from "@/components/shows/AlbumCtaRow";

vi.mock("next/link", () => ({
    default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

function renderRow(overrides: Partial<React.ComponentProps<typeof AlbumCtaRow>> = {}) {
    return render(
        <AlbumCtaRow
            showId="show-1"
            showTitle="Summerween"
            mode="online"
            status="entries_open"
            authed
            myEntryCount={0}
            {...overrides}
        />,
    );
}

describe("AlbumCtaRow — the entry path", () => {
    it("brass CTA links to the entry page", () => {
        renderRow();
        const cta = screen.getByTestId("album-enter-cta");
        expect(cta).toHaveTextContent("Enter this show");
        expect(cta).toHaveAttribute("href", "/shows/show-1/enter");
        expect(cta).toHaveClass("btn-brass");
        // No class-picker dialog any more.
        expect(screen.queryByText("Pick your class")).not.toBeInTheDocument();
    });

    it("anon gets Sign in to enter with the redirect to the entry page", () => {
        renderRow({ authed: false });
        const cta = screen.getByTestId("album-enter-cta");
        expect(cta).toHaveTextContent("Sign in to enter");
        expect(cta).toHaveAttribute("href", `/login?redirectTo=${encodeURIComponent("/shows/show-1/enter")}`);
    });

    it("hides the enter CTA once entries close; the pill still jumps to #entries", () => {
        renderRow({ status: "judging", myEntryCount: 2 });
        expect(screen.queryByTestId("album-enter-cta")).not.toBeInTheDocument();
        const pill = screen.getByTestId("album-my-entries-pill");
        expect(pill).toHaveTextContent("Your entries: 2");
        expect(pill).toHaveAttribute("href", "#entries");
    });
});
