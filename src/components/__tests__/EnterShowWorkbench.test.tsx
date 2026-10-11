// @vitest-environment jsdom
/**
 * The entry page (/shows/[id]/enter) — the single owner of entering a
 * show. Classes in program order, your horses pre-filtered by the
 * entrant ledger (applicable vs the "Other horses" fold), a selection
 * committed with one "Enter class" press through enterClassBatch, and
 * the auto-advance to the next class with room.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

import EnterShowWorkbench from "@/components/shows/EnterShowWorkbench";
import type { ConsoleClass, ConsoleDivision } from "@/lib/shows/console";
import type { EntrantHorse, MyShowEntry } from "@/lib/shows/public";

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
    enterClassBatch: vi.fn(),
    findUserByAlias: vi.fn(),
}));
vi.mock("@/app/actions/shows-v2", () => actions);
vi.mock("@/app/actions/entry-photo", () => ({ addShowPhotoToHorse: vi.fn() }));
vi.mock("@/app/actions/settings", () => ({ getProfile: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

// Online shows read the picked horse's photos client-side.
const photoRows = vi.hoisted(() => [
    { id: "p-left", image_url: "horses/h1/left.webp", angle_profile: "Left_Side" },
    { id: "p-primary", image_url: "horses/h1/primary.webp", angle_profile: "Primary_Thumbnail" },
]);
vi.mock("@/lib/supabase/client", () => ({
    createClient: () => ({
        from: (table: string) => ({
            select: () => ({
                eq: () => ({
                    order: () =>
                        Promise.resolve({ data: table === "horse_images" ? photoRows : [], error: null }),
                }),
            }),
        }),
    }),
}));

function cls(overrides: Partial<ConsoleClass> & Pick<ConsoleClass, "id" | "name">): ConsoleClass {
    return {
        classNumber: null,
        status: "scheduled",
        maxPerEntrant: null,
        allowedScales: null,
        allowedFinishes: null,
        isQualifying: false,
        sortOrder: 0,
        entryCount: 0,
        exhibitorCount: 0,
        ...overrides,
    };
}

// Input order deliberately NOT program order (sortOrder decides).
const DIVISIONS: ConsoleDivision[] = [
    {
        id: "d2",
        name: "OF Performance",
        axis: "performance",
        sortOrder: 1,
        sections: [
            {
                id: "s2",
                name: "Western",
                sortOrder: 0,
                classes: [cls({ id: "c3", name: "Western Pleasure", classNumber: "201" })],
            },
        ],
    },
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
                    cls({ id: "c2", name: "Paint", classNumber: "111", sortOrder: 1, status: "cancelled" }),
                    cls({
                        id: "c1",
                        name: "Quarter Horse",
                        classNumber: "110",
                        sortOrder: 0,
                        maxPerEntrant: 3,
                        allowedScales: ["Traditional"],
                    }),
                ],
            },
        ],
    },
];

function horse(id: string, name: string, overrides: Partial<EntrantHorse> = {}): EntrantHorse {
    return {
        id,
        name,
        thumbnailUrl: null,
        scale: "Traditional",
        finish: "OF",
        breed: "Arabian",
        gender: "Mare",
        ...overrides,
    };
}

const HORSES: EntrantHorse[] = [
    horse("h2", "Star"),
    horse("h1", "Duns Blazing", { breed: "Quarter Horse" }),
    horse("h3", "Tiny", { scale: "Classic" }),
    horse("h4", "Already In"),
];

function entry(classId: string, horseId: string, horseName: string): MyShowEntry {
    return {
        id: `e-${classId}-${horseId}`,
        classId,
        horseId,
        horseName,
        entryNumber: 1,
        status: "entered",
        handlerAlias: null,
        photoId: null,
        place: null,
    };
}

const MY_ENTRIES = [entry("c1", "h4", "Already In")];

function renderBench(overrides: Partial<React.ComponentProps<typeof EnterShowWorkbench>> = {}) {
    return render(
        <EnterShowWorkbench
            show={{ id: "show-1", title: "Summerween", mode: "live" }}
            divisions={DIVISIONS}
            myEntries={MY_ENTRIES}
            horses={HORSES}
            {...overrides}
        />,
    );
}

const cardButton = (horseId: string) =>
    within(screen.getByTestId(`horse-card-${horseId}`)).getAllByRole("button")[0];

beforeEach(() => {
    vi.clearAllMocks();
});

describe("EnterShowWorkbench", () => {
    it("lists every class in program order with the first open class selected", () => {
        renderBench();
        const rail = screen.getByTestId("class-rail");
        const labels = within(rail)
            .getAllByRole("button")
            .map((b) => b.textContent);
        // Cancelled 111 is not a stop on the rail (it is not on the public program either).
        expect(labels[0]).toMatch(/^110 · Quarter Horse/);
        expect(labels[1]).toMatch(/^201 · Western Pleasure/);
        expect(labels.some((l) => /111 · Paint/.test(l ?? ""))).toBe(false);
        expect(within(rail).getAllByRole("button")[0]).toHaveAttribute("aria-current", "true");
        expect(screen.getByRole("heading", { level: 2, name: "110 · Quarter Horse" })).toBeInTheDocument();
        expect(screen.getByTestId("class-limits")).toHaveTextContent(
            "Up to 3 of your horses · Traditional (1:9) only",
        );
        // Your entry already in the class is a chip, and the rail marks the cap.
        expect(screen.getByText("✓ Already In")).toBeInTheDocument();
        expect(within(rail).getByText("✓ You: 1 of 3")).toBeInTheDocument();
    });

    it("shows three tiers: lines up, maybe, and can't enter — each with its reason", () => {
        renderBench();
        // 110 · Quarter Horse names a breed, so only the Quarter Horse is a clean fit.
        const fits = screen.getByTestId("fits-horses");
        expect(within(fits).getAllByRole("button", { pressed: false }).map((b) => b.textContent ?? "")[0]).toMatch(/Duns Blazing/);
        expect(within(fits).getByText("likely fit")).toBeInTheDocument();

        const maybe = screen.getByTestId("maybe-horses");
        expect(within(maybe).getByText(/Star/)).toBeInTheDocument();
        expect(within(maybe).getByText(/this horse is Classic/)).toBeInTheDocument();

        const blocked = screen.getByTestId("blocked-horses");
        expect(within(blocked).getByText("Already entered in this class")).toBeInTheDocument();
        // The horse already in the class is listed beside the selection, not in the centre.
        expect(within(screen.getByTestId("entered-in-class")).getByText("✓ Already In")).toBeInTheDocument();
    });

    it("a blocked horse in Other is not selectable; a soft mismatch is", () => {
        renderBench();
        expect(cardButton("h4")).toBeDisabled();
        fireEvent.click(cardButton("h4"));
        expect(screen.getByTestId("selection-count")).toHaveTextContent("0 of 2");

        expect(cardButton("h3")).not.toBeDisabled();
        fireEvent.click(cardButton("h3"));
        expect(cardButton("h3")).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByTestId("selection-count")).toHaveTextContent("1 of 2");
    });

    it("selecting two horses enables Enter class", () => {
        renderBench();
        const enter = screen.getByTestId("enter-class-button");
        expect(enter).toBeDisabled();
        fireEvent.click(cardButton("h1"));
        fireEvent.click(cardButton("h2"));
        expect(cardButton("h1")).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByTestId("selection-count")).toHaveTextContent("2 of 2");
        expect(enter).toBeEnabled();
        // A third would exceed the cap.
        fireEvent.click(cardButton("h3"));
        expect(enter).toBeDisabled();
        expect(screen.getByText("Only 2 more of your horses fit this class.")).toBeInTheDocument();
    });

    it("submits the selection through enterClassBatch and advances to the next class with room", async () => {
        actions.enterClassBatch.mockResolvedValueOnce({
            success: true,
            results: [
                { horseId: "h1", success: true, entryId: "e1", entryNumber: 2, documentationNote: null },
                { horseId: "h2", success: true, entryId: "e2", entryNumber: 3, documentationNote: null },
            ],
            myEntries: [...MY_ENTRIES, entry("c1", "h1", "Duns Blazing"), entry("c1", "h2", "Star")],
        });
        renderBench();
        fireEvent.click(cardButton("h1"));
        fireEvent.click(cardButton("h2"));
        fireEvent.click(screen.getByTestId("enter-class-button"));

        await waitFor(() =>
            expect(screen.getByRole("heading", { level: 2, name: "201 · Western Pleasure" })).toBeInTheDocument(),
        );
        expect(actions.enterClassBatch).toHaveBeenCalledWith({
            showId: "show-1",
            classId: "c1",
            entries: [
                { horseId: "h1", photoId: null, handlerId: null, documentation: undefined },
                { horseId: "h2", photoId: null, handlerId: null, documentation: undefined },
            ],
        });
        // Cancelled 111 was skipped; the verdicts stay on screen; selection cleared.
        const verdicts = screen.getByTestId("batch-verdicts");
        expect(within(verdicts).getByText(/Duns Blazing — entered/)).toBeInTheDocument();
        expect(screen.getByTestId("selection-count")).toHaveTextContent("0 of ∞");
        expect(screen.getByTestId("enter-progress")).toHaveTextContent("3 entries in 1 class");
        // Focus moved to the new class heading.
        expect(document.activeElement).toHaveTextContent("201 · Western Pleasure");
    });

    it("a refused horse stays selected with the server's reason; no advance", async () => {
        actions.enterClassBatch.mockResolvedValueOnce({
            success: true,
            results: [
                { horseId: "h1", success: true, entryId: "e1", entryNumber: 2, documentationNote: null },
                { horseId: "h2", success: false, error: "Entries for this show are not open." },
            ],
            myEntries: [...MY_ENTRIES, entry("c1", "h1", "Duns Blazing")],
        });
        renderBench();
        fireEvent.click(cardButton("h1"));
        fireEvent.click(cardButton("h2"));
        fireEvent.click(screen.getByTestId("enter-class-button"));

        await waitFor(() => expect(screen.getByTestId("selected-h2")).toBeInTheDocument());
        expect(screen.queryByTestId("selected-h1")).not.toBeInTheDocument();
        expect(
            within(screen.getByTestId("selected-h2")).getByText("✗ Entries for this show are not open."),
        ).toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 2, name: "110 · Quarter Horse" })).toBeInTheDocument();
    });

    it("online shows default each picked horse to its primary photo", async () => {
        renderBench({ show: { id: "show-1", title: "Summerween", mode: "online" } });
        fireEvent.click(cardButton("h1"));
        await waitFor(() => expect(screen.getByTestId("enter-class-button")).toBeEnabled());
        actions.enterClassBatch.mockResolvedValueOnce({ success: false, error: "nope" });
        fireEvent.click(screen.getByTestId("enter-class-button"));
        await waitFor(() => expect(actions.enterClassBatch).toHaveBeenCalled());
        expect(actions.enterClassBatch.mock.calls[0][0].entries[0].photoId).toBe("p-primary");
        expect(await screen.findByText("nope")).toBeInTheDocument();
    });

    it("preselects ?class and ?horse", () => {
        renderBench({ initialClassId: "c3", initialHorseId: "h3" });
        expect(screen.getByRole("heading", { level: 2, name: "201 · Western Pleasure" })).toBeInTheDocument();
        expect(cardButton("h3")).toHaveAttribute("aria-pressed", "true");
    });
});
