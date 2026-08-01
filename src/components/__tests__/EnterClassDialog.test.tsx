// @vitest-environment jsdom
/**
 * Phase D — the entry dialog. Class-first flow: the class arrives
 * as a prop, the dialog picks the horse (and, for online shows,
 * the entry photo from the horse's EXISTING photos — no uploads),
 * optional proxy handler, and surfaces every server violation
 * verbatim.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

import EnterClassDialog, { type EnterableClass } from "@/components/shows/EnterClassDialog";
import type { EntrantHorse } from "@/lib/shows/public";

const actions = vi.hoisted(() => ({
    enterClass: vi.fn(),
    findUserByAlias: vi.fn(),
}));
vi.mock("@/app/actions/shows-v2", () => actions);

// The dialog fetches the selected horse's photos client-side
// (the passport pattern) — mock the chain it uses.
const photoRows = vi.hoisted(() => [
    {
        id: "11111111-1111-4111-8111-111111111111",
        image_url: "horses/h1/primary.webp",
        angle_profile: "Primary_Thumbnail",
    },
    {
        id: "22222222-2222-4222-8222-222222222222",
        image_url: "horses/h1/left.webp",
        angle_profile: "Left_Side",
    },
]);

vi.mock("@/lib/supabase/client", () => ({
    createClient: () => ({
        from: () => ({
            select: () => ({
                eq: () => ({
                    order: () => Promise.resolve({ data: photoRows, error: null }),
                }),
            }),
        }),
    }),
}));

const CLS = { id: "33333333-3333-4333-8333-333333333333", name: "Quarter Horse", classNumber: "110" };

const HORSES: EntrantHorse[] = [
    { id: "h1", name: "Duns Blazing", thumbnailUrl: null, scale: "Traditional", finish: "OF" },
    { id: "h2", name: "Silver Aspen", thumbnailUrl: null, scale: "Classic", finish: "Custom" },
];

beforeEach(() => {
    vi.clearAllMocks();
    actions.enterClass.mockResolvedValue({ success: true, entryId: "e1", entryNumber: 1 });
    actions.findUserByAlias.mockResolvedValue({
        success: true,
        user: { id: "44444444-4444-4444-8444-444444444444", alias: "ringsteward" },
    });
});

function renderDialog(
    mode: "live" | "online",
    horses: EntrantHorse[] = HORSES,
    cls: EnterableClass = CLS,
) {
    const onClose = vi.fn();
    const onEntered = vi.fn();
    render(
        <EnterClassDialog
            showId="33333333-3333-4333-8333-333333333333"
            cls={cls}
            mode={mode}
            horses={horses}
            onClose={onClose}
            onEntered={onEntered}
        />,
    );
    return { onClose, onEntered };
}

describe("EnterClassDialog — class-first flow", () => {
    it("leads with the viewer's horses for the picked class", () => {
        renderDialog("live");
        expect(screen.getByText(/enter 110 · quarter horse/i)).toBeInTheDocument();
        expect(screen.getByTestId("horse-picker")).toBeInTheDocument();
        expect(screen.getByText("Duns Blazing")).toBeInTheDocument();
        expect(screen.getByText("Silver Aspen")).toBeInTheDocument();
    });

    it("live shows skip the photo step entirely", async () => {
        renderDialog("live");
        fireEvent.click(screen.getByText("Duns Blazing"));

        const submit = await screen.findByRole("button", { name: /enter duns blazing/i });
        expect(screen.queryByTestId("photo-picker")).not.toBeInTheDocument();
        expect(submit).toBeEnabled();

        fireEvent.click(submit);
        await waitFor(() =>
            expect(actions.enterClass).toHaveBeenCalledWith({
                classId: CLS.id,
                horseId: "h1",
                photoId: null,
                handlerId: null,
            }),
        );
    });

    it("online shows offer the horse's existing photos and submit the pick", async () => {
        renderDialog("online");
        fireEvent.click(screen.getByText("Duns Blazing"));

        // The photo picker appears with the horse's existing photos
        // (primary pre-selected — the judged object).
        const picker = await screen.findByTestId("photo-picker");
        expect(picker.querySelectorAll("button")).toHaveLength(2);

        fireEvent.click(screen.getByRole("button", { name: /enter duns blazing/i }));
        await waitFor(() =>
            expect(actions.enterClass).toHaveBeenCalledWith(
                expect.objectContaining({ photoId: photoRows[0].id }),
            ),
        );
    });

    it("displays EVERY violation from the server verbatim", async () => {
        actions.enterClass.mockResolvedValue({
            success: false,
            error: "joined",
            violations: [
                "Entries are not open for this show.",
                "This horse is already entered in a breed halter class at this show.",
            ],
        });
        const { onEntered } = renderDialog("live");
        fireEvent.click(screen.getByText("Duns Blazing"));
        fireEvent.click(await screen.findByRole("button", { name: /enter duns blazing/i }));

        const alert = await screen.findByTestId("entry-violations");
        expect(alert).toHaveTextContent("Entries are not open for this show.");
        expect(alert).toHaveTextContent("already entered in a breed halter class");
        expect(onEntered).not.toHaveBeenCalled();
    });

    it("proxy handler: alias lookup rides along as handlerId", async () => {
        renderDialog("live");
        fireEvent.click(screen.getByText("Silver Aspen"));

        fireEvent.change(await screen.findByLabelText(/handler alias/i), {
            target: { value: "ringsteward" },
        });
        fireEvent.click(screen.getByRole("button", { name: /look up/i }));
        await screen.findByText(/@ringsteward will handle/i);

        fireEvent.click(screen.getByRole("button", { name: /enter silver aspen/i }));
        await waitFor(() =>
            expect(actions.enterClass).toHaveBeenCalledWith(
                expect.objectContaining({
                    horseId: "h2",
                    handlerId: "44444444-4444-4444-8444-444444444444",
                }),
            ),
        );
    });

    it("explains when the viewer has no public horses", () => {
        renderDialog("live", []);
        expect(screen.getByText(/at least one public horse/i)).toBeInTheDocument();
    });
});

/** A 14-horse stable: even indices Traditional, odd Stablemate. */
function bigStable(n = 14): EntrantHorse[] {
    return Array.from({ length: n }, (_, i) => ({
        id: `big-${i}`,
        name: `Stable Star ${String(i).padStart(2, "0")}`,
        thumbnailUrl: null,
        scale: i % 2 === 0 ? "Traditional" : "Stablemate",
        finish: "OF",
    }));
}

describe("EnterClassDialog — big-stable horse picker (search-first list)", () => {
    it("small stables keep the card grid — no search box", () => {
        renderDialog("live");
        expect(screen.getByTestId("horse-picker")).toBeInTheDocument();
        expect(screen.queryByLabelText(/search your horses/i)).not.toBeInTheDocument();
        expect(screen.queryByTestId("horse-picker-list")).not.toBeInTheDocument();
    });

    it(">12 horses switches to the compact list with search and a count", () => {
        renderDialog("live", bigStable());
        expect(screen.getByLabelText(/search your horses/i)).toBeInTheDocument();
        expect(screen.getByTestId("horse-picker-list")).toBeInTheDocument();
        expect(screen.getByTestId("horse-picker-count")).toHaveTextContent("All 14 horses");
        // Every horse is listed — nothing hidden.
        expect(
            within(screen.getByTestId("horse-picker-list")).getAllByRole("listitem"),
        ).toHaveLength(14);
    });

    it("typing filters by name and updates the N-of-M count", () => {
        renderDialog("live", bigStable());
        fireEvent.change(screen.getByLabelText(/search your horses/i), {
            target: { value: "star 0" },
        });
        // Stable Star 00–09
        expect(screen.getByTestId("horse-picker-count")).toHaveTextContent("10 of 14 horses");
        fireEvent.change(screen.getByLabelText(/search your horses/i), {
            target: { value: "star 07" },
        });
        expect(screen.getByTestId("horse-picker-count")).toHaveTextContent("1 of 14 horses");
        expect(screen.getByText("Stable Star 07")).toBeInTheDocument();
        expect(screen.queryByText("Stable Star 03")).not.toBeInTheDocument();
    });

    it("Enter on an exactly-one match picks that horse (picking ≠ submitting)", async () => {
        renderDialog("live", bigStable());
        const search = screen.getByLabelText(/search your horses/i);
        fireEvent.change(search, { target: { value: "star 07" } });
        fireEvent.keyDown(search, { key: "Enter" });
        // Advanced to the confirm step — but no entry was submitted.
        await screen.findByRole("button", { name: /enter stable star 07/i });
        expect(actions.enterClass).not.toHaveBeenCalled();
    });

    it("soft-orders likely fits first and hints mismatches WITHOUT blocking them", async () => {
        const restricted: EnterableClass = { ...CLS, allowedScales: ["Traditional"] };
        renderDialog("live", bigStable(), restricted);

        const items = within(screen.getByTestId("horse-picker-list")).getAllByRole("listitem");
        // Evens (Traditional) float up in server order; odds trail with a hint.
        expect(items[0]).toHaveTextContent("Stable Star 00");
        expect(items[6]).toHaveTextContent("Stable Star 12");
        expect(items[7]).toHaveTextContent("Stable Star 01");
        expect(items[7]).toHaveTextContent(/may not fit/i);
        expect(items[0]).not.toHaveTextContent(/may not fit/i);
        expect(
            within(screen.getByTestId("horse-picker-list")).getAllByText(/may not fit/i),
        ).toHaveLength(7);
        // …and the soft-ordering legend explains why, below the list.
        expect(screen.getByText(/the host.s rules decide/i)).toBeInTheDocument();

        // SOFT: a mismatching horse is still fully selectable — the
        // server is the only authority on eligibility.
        fireEvent.click(screen.getByText("Stable Star 01"));
        expect(
            await screen.findByRole("button", { name: /enter stable star 01/i }),
        ).toBeEnabled();
    });

    it("no matches offers Clear search instead of a dead end", () => {
        renderDialog("live", bigStable());
        fireEvent.change(screen.getByLabelText(/search your horses/i), {
            target: { value: "zanzibar" },
        });
        expect(screen.getByText(/no horses named/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /clear search/i }));
        expect(screen.getByTestId("horse-picker-count")).toHaveTextContent("All 14 horses");
    });

    it("the search survives picking and coming back to choose again", async () => {
        renderDialog("live", bigStable());
        fireEvent.change(screen.getByLabelText(/search your horses/i), {
            target: { value: "star 07" },
        });
        fireEvent.click(screen.getByText("Stable Star 07"));
        fireEvent.click(await screen.findByRole("button", { name: /choose a different horse/i }));

        expect(screen.getByLabelText(/search your horses/i)).toHaveValue("star 07");
        expect(screen.getByTestId("horse-picker-count")).toHaveTextContent("1 of 14 horses");
    });
});
