// @vitest-environment jsdom
/**
 * Wave 4b — the sticky CTA's entry path, end-to-end to the EXISTING
 * EnterClassDialog (and no further — entering stays the server's
 * business): brass CTA → "Pick your class" (program accordion with
 * per-class Enter buttons) → EnterClassDialog for that class.
 * Anon gets the 4a sign-in-with-redirect pattern instead.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import AlbumCtaRow from "@/components/shows/AlbumCtaRow";
import type { ConsoleDivision } from "@/lib/shows/console";
import type { EntrantHorse } from "@/lib/shows/public";

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

const actions = vi.hoisted(() => ({
    enterClass: vi.fn(),
    findUserByAlias: vi.fn(),
}));
vi.mock("@/app/actions/shows-v2", () => actions);
vi.mock("@/app/actions/show-readiness", () => ({
    listMyEntrantHorses: vi.fn().mockResolvedValue({ success: true, horses: [] }),
}));

// EnterClassDialog fetches the picked horse's photos client-side.
vi.mock("@/lib/supabase/client", () => ({
    createClient: () => ({
        from: () => ({
            select: () => ({
                eq: () => ({
                    order: () => Promise.resolve({ data: [], error: null }),
                }),
            }),
        }),
    }),
}));

const DIVISIONS: ConsoleDivision[] = [
    {
        id: "d1",
        name: "OF Plastic Halter",
        axis: "halter",
        sortOrder: 0,
        sections: [
            {
                id: "s1",
                name: "Stock",
                sortOrder: 0,
                classes: [
                    {
                        id: "c1",
                        name: "Quarter Horse",
                        classNumber: "110",
                        status: "scheduled",
                        maxPerEntrant: null,
                        allowedScales: null,
                        allowedFinishes: null,
                        isQualifying: false,
                        sortOrder: 0,
                        entryCount: 3,
                    },
                ],
            },
        ],
    },
];

const HORSES: EntrantHorse[] = [
    { id: "h1", name: "Duns Blazing", thumbnailUrl: null, scale: "Traditional", finish: "OF" },
];

function renderRow(overrides: Partial<React.ComponentProps<typeof AlbumCtaRow>> = {}) {
    return render(
        <AlbumCtaRow
            showId="show-1"
            showTitle="Summerween"
            mode="online"
            status="entries_open"
            authed
            divisions={DIVISIONS}
            horses={HORSES}
            myEntryCount={0}
            {...overrides}
        />,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("AlbumCtaRow — the entry path", () => {
    it("brass CTA → Pick your class → the existing EnterClassDialog", async () => {
        renderRow();

        // 1. The brass CTA opens the class picker.
        fireEvent.click(screen.getByTestId("album-enter-cta"));
        expect(await screen.findByText("Pick your class")).toBeInTheDocument();

        // The program accordion is inside, with the division line and
        // the SAME class row the classlist renders (counts included).
        expect(screen.getByTestId("program-division")).toBeInTheDocument();
        expect(screen.getByText("OF Plastic Halter")).toBeInTheDocument();
        expect(screen.getByText("Quarter Horse")).toBeInTheDocument();
        expect(screen.getByText("3 entered")).toBeInTheDocument();

        // 2. Enter on the class row hands off to EnterClassDialog —
        //    and we STOP there (no entry is submitted).
        fireEvent.click(screen.getByRole("button", { name: "Enter" }));
        expect(await screen.findByText(/enter 110 · quarter horse/i)).toBeInTheDocument();
        expect(screen.getByTestId("horse-picker")).toBeInTheDocument();
        expect(screen.getByText("Duns Blazing")).toBeInTheDocument();
        expect(actions.enterClass).not.toHaveBeenCalled();
    });

    it("anon gets Sign in to enter with the redirect back to the show", () => {
        renderRow({ authed: false });
        const cta = screen.getByTestId("album-enter-cta");
        expect(cta).toHaveTextContent("Sign in to enter");
        expect(cta).toHaveAttribute(
            "href",
            `/login?redirectTo=${encodeURIComponent("/shows/show-1")}`,
        );
    });

    it("hides the enter CTA once entries close; the pill still jumps to #entries", () => {
        renderRow({ status: "judging", myEntryCount: 2 });
        expect(screen.queryByTestId("album-enter-cta")).not.toBeInTheDocument();
        const pill = screen.getByTestId("album-my-entries-pill");
        expect(pill).toHaveTextContent("Your entries: 2");
        expect(pill).toHaveAttribute("href", "#entries");
    });

    it("authed with no enterable horses: the picker opens with the readiness pointer, no Enter buttons", async () => {
        renderRow({ horses: [] });
        fireEvent.click(screen.getByTestId("album-enter-cta"));
        expect(await screen.findByText("Pick your class")).toBeInTheDocument();
        expect(screen.getByText(/you need a public horse/i)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Enter" })).not.toBeInTheDocument();
    });
});
