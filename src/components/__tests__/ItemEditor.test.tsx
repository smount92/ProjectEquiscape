// @vitest-environment jsdom
/**
 * The Registry Desk editor, as a moderator works through a mold (owner,
 * 2026-10-16: "select the mold, then I can click through each release and
 * it auto pulls up the info below that I can just edit and save").
 *
 * J/K move (never while typing), Ctrl/Cmd+S saves, unsaved changes are
 * kept per release with a dot on the rail, leaving with unsaved changes
 * asks first, a save that lost a race shows the other version, and a
 * suggested fix fills the box without saving.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { DeskRelease } from "@/app/actions/registry-desk";
import type { DeskSource } from "@/lib/catalog/editableFields";

const actions = vi.hoisted(() => ({
    saveItem: vi.fn(),
    getItemForEdit: vi.fn(),
    addItem: vi.fn(),
    previewMerge: vi.fn(),
    requestMerge: vi.fn(),
    previewRemove: vi.fn(),
    removeItem: vi.fn(),
    searchMolds: vi.fn(),
}));
vi.mock("@/app/actions/registry-desk", () => actions);
vi.mock("@/app/actions/registry-desk-lists", () => ({ undoAction: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/lib/context/ToastContext", () => ({ useToast: () => ({ toast }) }));

import MoldView from "@/components/desk/MoldView";

function row(over: Partial<DeskSource>): DeskSource {
    return {
        id: "x",
        item_type: "plastic_release",
        parent_id: "sb",
        title: "Saddlebred",
        maker: "Breyer",
        maker_slug: "breyer",
        slug: null,
        scale: "Stablemate (1:32)",
        artist: null,
        manufacturer: "Breyer",
        attributes: {},
        created_at: "2026-03-01T00:00:00Z",
        updated_at: "2026-10-01T00:00:00Z",
        ...over,
    };
}

const entry = (r: DeskSource, over: Partial<DeskRelease> = {}): DeskRelease => ({
    row: r,
    flags: [],
    fixes: [],
    horses: 0,
    wantLists: 0,
    ...over,
});

const MOLD = entry(row({ id: "sb", item_type: "plastic_mold", parent_id: null, title: "Saddlebred" }));
const BAY = entry(
    row({ id: "r-bay", title: "Saddlebred", attributes: { model_number: "5002", color_description: "Bay" } }),
    { horses: 3 },
);
const SET = entry(
    row({
        id: "r-set",
        title: "12-Piece Stablemates Set With Arabian Mare, Citation, Saddlebred",
        attributes: { model_number: "711096" },
    }),
    {
        flags: [{ key: "roster_in_title", label: "Whole set in the title" }],
        fixes: [{ rule: "Set piece titles", changes: { title: "12-Piece Stablemates Set (Saddlebred)" } }],
    },
);
const PINTO = entry(row({ id: "r-pinto", title: "Pinto Saddlebred", attributes: { model_number: "5002" } }));

function renderView(initial: string | null = "r-bay") {
    return render(<MoldView mold={MOLD} releases={[BAY, SET, PINTO]} initialReleaseId={initial} role="moderator" />);
}

const editorTitle = () => within(screen.getByRole("region", { name: "Edit the release" })).getByRole("heading");
const nameBox = () => screen.getByLabelText(/^Name/) as HTMLInputElement;

beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/catalog/desk/mold/sb");
    actions.getItemForEdit.mockResolvedValue({ success: false, error: "skip" });
});

describe("the Mold view editor", () => {
    it("opens the picked release with every field, not just a few", () => {
        renderView();
        expect(editorTitle().textContent).toBe("Saddlebred");
        for (const label of [
            /^Name/,
            /^Type/,
            /^Maker/,
            /^Artist/,
            /^Manufacturer/,
            /^Scale/,
            /^Model number/,
            /^Colour and markings/,
            /^First year/,
            /^Last year/,
            /^Run type/,
            /^Run details/,
            /^Pieces made/,
            /^Original retail price/,
            /^Set/,
            /^Mold$/,
            /^Material/,
            /^Sculptor/,
            /^Breed/,
            /^Gender/,
            /^Registry notes/,
        ]) {
            expect(screen.getAllByLabelText(label).length, String(label)).toBeGreaterThan(0);
        }
        expect(screen.getByText("Filed under mold")).toBeTruthy();
        expect(screen.getByText("Import details")).toBeTruthy();
        expect(screen.getByText("The record")).toBeTruthy();
        expect((screen.getByLabelText(/^Model number/) as HTMLInputElement).value).toBe("5002");
    });

    it("moves with J and K, and with Prev and Next, keeping ?release= in the address", () => {
        renderView();
        fireEvent.keyDown(window, { key: "j" });
        expect(editorTitle().textContent).toMatch(/^12-Piece/);
        expect(window.location.search).toBe("?release=r-set");
        fireEvent.keyDown(window, { key: "J" });
        expect(editorTitle().textContent).toBe("Pinto Saddlebred");
        fireEvent.keyDown(window, { key: "k" });
        expect(editorTitle().textContent).toMatch(/^12-Piece/);
        fireEvent.click(screen.getByRole("button", { name: /Prev/ }));
        expect(editorTitle().textContent).toBe("Saddlebred");
        fireEvent.click(screen.getByRole("button", { name: /Next/ }));
        expect(window.location.search).toBe("?release=r-set");
    });

    it("ignores J and K while typing in a box", () => {
        renderView();
        const colour = screen.getByLabelText(/^Colour and markings/);
        colour.focus();
        fireEvent.keyDown(colour, { key: "j" });
        fireEvent.keyDown(colour, { key: "k" });
        expect(editorTitle().textContent).toBe("Saddlebred");
        expect(window.location.search).toBe("");
    });

    it("saves with Ctrl+S or Cmd+S, even from inside a box, sending only what changed", async () => {
        actions.saveItem.mockResolvedValue({ success: true, item: { ...BAY.row, title: "Saddlebred (G1)" } });
        renderView();
        fireEvent.change(nameBox(), { target: { value: "Saddlebred (G1)" } });
        const ev = fireEvent.keyDown(nameBox(), { key: "s", ctrlKey: true });
        expect(ev).toBe(false); // the browser's Save Page was stopped
        await waitFor(() =>
            expect(actions.saveItem).toHaveBeenCalledWith({
                id: "r-bay",
                updatedAt: "2026-10-01T00:00:00Z",
                changes: { title: "Saddlebred (G1)" },
            }),
        );
        await waitFor(() =>
            expect(toast.mock.calls.some(([m, v]) => /^Saved/.test(String(m)) && v === "success")).toBe(true),
        );

        fireEvent.change(screen.getByLabelText(/^Run details/), { target: { value: "Sears Holiday Catalog" } });
        fireEvent.keyDown(window, { key: "s", metaKey: true });
        await waitFor(() => expect(actions.saveItem).toHaveBeenCalledTimes(2));
        expect(actions.saveItem.mock.calls[1][0].changes).toEqual({ run_detail: "Sears Holiday Catalog" });
    });

    it("keeps an unsaved change while moving to another release and back, with a dot on the rail", () => {
        renderView();
        fireEvent.change(screen.getByLabelText(/^Colour and markings/), { target: { value: "Bay, solid face" } });
        expect(screen.getByText("1 unsaved change")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: /Next/ }));
        expect(editorTitle().textContent).toMatch(/^12-Piece/);
        const rail = screen.getByTestId("release-rail");
        const bayRow = within(rail)
            .getAllByTestId("rail-row")
            .find((r) => r.textContent?.includes("5002") && !r.textContent.includes("Pinto"))!;
        expect(within(bayRow).getByTestId("unsaved-dot")).toBeTruthy();
        // The phone list marks it too.
        expect(screen.getByTestId("release-select").textContent).toContain("• Saddlebred");
        fireEvent.click(screen.getByRole("button", { name: /Prev/ }));
        expect((screen.getByLabelText(/^Colour and markings/) as HTMLInputElement).value).toBe("Bay, solid face");
    });

    it("asks before leaving the page with unsaved changes, and not otherwise", () => {
        renderView();
        const clean = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(clean);
        expect(clean.defaultPrevented).toBe(false);
        fireEvent.change(nameBox(), { target: { value: "Saddlebred (G1)" } });
        const dirty = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(dirty);
        expect(dirty.defaultPrevented).toBe(true);
    });

    it("shows the other version when someone saved first, and can take theirs", async () => {
        const theirs = { ...BAY.row, title: "Saddlebred (G1)", updated_at: "2026-10-16T12:00:00Z" };
        actions.saveItem.mockResolvedValue({
            success: false,
            error: "Someone saved this since you opened it.",
            conflict: theirs,
        });
        renderView();
        fireEvent.change(nameBox(), { target: { value: "Saddlebred G1" } });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        const alert = await screen.findByRole("alert");
        expect(alert.textContent).toMatch(/Someone saved this while you were editing it/);
        expect(alert.textContent).toContain("theirs “Saddlebred (G1)”, yours “Saddlebred G1”");
        expect(nameBox().value).toBe("Saddlebred G1");
        fireEvent.click(within(alert).getByRole("button", { name: /Use theirs/ }));
        expect(nameBox().value).toBe("Saddlebred (G1)");
        expect(screen.queryByRole("alert")).toBeNull();
    });

    it("saves over theirs on request, against their version", async () => {
        const theirs = { ...BAY.row, title: "Saddlebred (G1)", updated_at: "2026-10-16T12:00:00Z" };
        actions.saveItem
            .mockResolvedValueOnce({ success: false, error: "x", conflict: theirs })
            .mockResolvedValueOnce({ success: true, item: { ...theirs, title: "Saddlebred G1" } });
        renderView();
        fireEvent.change(nameBox(), { target: { value: "Saddlebred G1" } });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        const alert = await screen.findByRole("alert");
        await act(async () => {
            fireEvent.click(within(alert).getByRole("button", { name: /Keep mine/ }));
        });
        await waitFor(() => expect(actions.saveItem).toHaveBeenCalledTimes(2));
        expect(actions.saveItem.mock.calls[1][0]).toEqual({
            id: "r-bay",
            updatedAt: "2026-10-16T12:00:00Z",
            changes: { title: "Saddlebred G1" },
        });
    });

    it("fills the box from a suggested fix with “Use this” and marks it unsaved, saving nothing", () => {
        renderView("r-set");
        const fix = screen.getByTestId("suggested-fix");
        expect(fix.textContent).toContain("Set piece titles");
        fireEvent.click(within(fix).getByRole("button", { name: "Use this" }));
        expect(nameBox().value).toBe("12-Piece Stablemates Set (Saddlebred)");
        expect(screen.getByText("1 unsaved change")).toBeTruthy();
        expect(actions.saveItem).not.toHaveBeenCalled();
    });

    it("lets the mold itself be edited from the same view", () => {
        renderView();
        fireEvent.click(screen.getByRole("button", { name: "Edit the mold itself" }));
        const editor = screen.getByRole("region", { name: "Edit the mold" });
        expect(within(editor).getByText(/The mold itself/)).toBeTruthy();
        expect(within(editor).queryByLabelText(/^Model number/)).toBeNull();
        expect(within(editor).getByLabelText(/^First made/)).toBeTruthy();
        expect(window.location.search).toBe("");
    });

    it("only offers the releases that need work when asked, keeping the one in view until you move on", () => {
        renderView("r-set");
        fireEvent.click(screen.getByRole("button", { name: "Edit the mold itself" }));
        fireEvent.click(screen.getByRole("button", { name: "Needs work 1" }));
        const rows = within(screen.getByTestId("release-rail")).getAllByTestId("rail-row");
        expect(rows.map((r) => r.textContent?.slice(0, 20))).toEqual([
            expect.stringMatching(/^The mold: Saddlebred/),
            expect.stringMatching(/^12-Piece/),
        ]);
    });
});
