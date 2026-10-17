// @vitest-environment jsdom
/**
 * The Mold view after the UI review (Release 3): the bar outside the
 * editor (focus stays, a spoken position), leaving with unsaved edits
 * asks first (links and Back), every field can be added, a refused value
 * is marked in its box, a year stored as text can be fixed, "Needs work"
 * keeps your place, keys rest while a dialog is open, merges and removals
 * say plainly what update 243 changes, and Undo rides on the toasts.
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
const lists = vi.hoisted(() => ({ undoAction: vi.fn() }));
vi.mock("@/app/actions/registry-desk-lists", () => lists);
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/lib/context/ToastContext", () => ({ useToast: () => ({ toast }) }));
const router = vi.hoisted(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
}));
vi.mock("next/navigation", () => ({
    useRouter: () => router,
    usePathname: () => "/catalog/desk/mold/sb",
    useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

import Link from "next/link";
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

const flag = (key: string, label: string) => ({ key, label });
const MOLD = entry(row({ id: "sb", item_type: "plastic_mold", parent_id: null, title: "Saddlebred" }));
const BAY = entry(row({ id: "r-bay", title: "Saddlebred", attributes: { model_number: "5002" } }), { horses: 3 });
const SET = entry(row({ id: "r-set", title: "Sears Holiday Catalog", attributes: { model_number: "711096" } }), {
    flags: [flag("shop_or_sale_title", "Shop or sale as the title")],
});
const PINTO = entry(row({ id: "r-pinto", title: "Pinto Saddlebred", attributes: { model_number: "5002" } }), {
    flags: [flag("colour_in_title", "Colour in the title")],
});
const TEXT_YEAR = entry(
    row({ id: "r-year", title: "Raleigh", attributes: { release_year_start: "2018", model_number: "712248" } }),
    {
        flags: [flag("year_as_text", "Years stored as text")],
        fixes: [{ rule: "Store years as numbers", changes: { release_year_start: "2018" } }],
    },
);

const KEYS = ["cast_medium", "edition_size", "materials", "model_number", "set_name"];

function renderView(opts: { initial?: string | null; releases?: DeskRelease[]; role?: "owner" | "moderator" } = {}) {
    return render(
        <>
            <Link href="/catalog/desk/todo">To-do</Link>
            <a href="https://example.org/elsewhere">Elsewhere</a>
            <MoldView
                mold={MOLD}
                releases={opts.releases ?? [BAY, SET, PINTO]}
                initialReleaseId={opts.initial === undefined ? "r-bay" : opts.initial}
                role={opts.role ?? "moderator"}
                fieldKeys={KEYS}
            />
        </>,
    );
}

const editor = () => screen.getByRole("region", { name: /^Edit the/ });
const editorTitle = () => within(editor()).getByRole("heading");
const colourBox = () => screen.getByLabelText(/^Colour and markings/) as HTMLInputElement;
const savedOk = (r: DeskSource, over: Partial<DeskRelease> = {}, actionId: string | null = null) => ({
    success: true,
    item: r,
    entry: entry(r, over),
    actionId,
});

beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/catalog/desk/mold/sb");
    actions.getItemForEdit.mockResolvedValue({ success: false, error: "skip" });
    Object.defineProperty(window.navigator, "platform", { value: "Win32", configurable: true });
});

describe("the bar under the editor", () => {
    it("keeps focus on Next and Prev while the release changes, and says where you are", () => {
        renderView();
        const next = screen.getByRole("button", { name: "Next release" });
        next.focus();
        fireEvent.click(next);
        expect(editorTitle().textContent).toBe("Sears Holiday Catalog");
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next release" }));
        expect(screen.getByTestId("editor-position").textContent).toBe("Release 2 of 3: Sears Holiday Catalog");
        expect(screen.getByTestId("editor-position").getAttribute("aria-live")).toBe("polite");
        fireEvent.click(screen.getByRole("button", { name: "Previous release" }));
        expect(screen.getByTestId("editor-position").textContent).toBe("Release 1 of 3: Saddlebred");
    });

    it("sits outside the editor, with labelled buttons that fit a phone", () => {
        renderView();
        const bar = screen.getByTestId("editor-bar");
        expect(editor().contains(bar)).toBe(false);
        expect(bar.className).toMatch(/flex-wrap/);
        for (const name of ["Previous release", "Next release"]) {
            expect(within(bar).getByRole("button", { name })).toBeTruthy();
        }
    });
});

describe("leaving with unsaved edits", () => {
    it("stops a link in the app, asks, and stays", () => {
        renderView();
        fireEvent.change(colourBox(), { target: { value: "Bay, solid face" } });
        fireEvent.click(screen.getByText("To-do"));
        const dialog = screen.getByRole("dialog");
        expect(dialog.textContent).toMatch(/Leave without saving 1 release\?/);
        fireEvent.click(within(dialog).getByRole("button", { name: "Stay" }));
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(router.push).not.toHaveBeenCalled();
        expect(colourBox().value).toBe("Bay, solid face");
    });

    it("leaves without saving on request", () => {
        renderView();
        fireEvent.change(colourBox(), { target: { value: "Bay, solid face" } });
        fireEvent.click(screen.getByText("To-do"));
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave without saving" }));
        expect(router.push).toHaveBeenCalledWith("/catalog/desk/todo");
        expect(actions.saveItem).not.toHaveBeenCalled();
    });

    it("saves every unsaved release, then leaves", async () => {
        actions.saveItem.mockImplementation(async (input: { id: string }) =>
            savedOk(row({ id: input.id, title: input.id === "r-bay" ? "Saddlebred" : "Sears Holiday Catalog" })),
        );
        renderView();
        fireEvent.change(colourBox(), { target: { value: "Bay, solid face" } });
        fireEvent.click(screen.getByRole("button", { name: "Next release" }));
        fireEvent.change(colourBox(), { target: { value: "Dapple grey" } });
        fireEvent.click(screen.getByText("To-do"));
        const dialog = screen.getByRole("dialog");
        expect(dialog.textContent).toMatch(/Leave without saving 2 releases\?/);
        await act(async () => {
            fireEvent.click(within(dialog).getByRole("button", { name: "Save all and leave" }));
        });
        await waitFor(() => expect(router.push).toHaveBeenCalledWith("/catalog/desk/todo"));
        expect(actions.saveItem).toHaveBeenCalledTimes(2);
    });

    it("stays on the release that couldn't save", async () => {
        actions.saveItem.mockResolvedValue({
            success: false,
            error: "That colour is too long.",
            field: "color_description",
        });
        renderView();
        fireEvent.change(colourBox(), { target: { value: "x" } });
        fireEvent.click(screen.getByText("To-do"));
        await act(async () => {
            fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save all and leave" }));
        });
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        expect(router.push).not.toHaveBeenCalled();
        expect(editorTitle().textContent).toBe("Saddlebred");
    });

    it("lets other sites, new tabs and clean pages go by without asking", () => {
        renderView();
        fireEvent.click(screen.getByText("To-do"));
        expect(screen.queryByRole("dialog")).toBeNull();
        fireEvent.change(colourBox(), { target: { value: "Bay" } });
        fireEvent.click(screen.getByText("Elsewhere"));
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("asks on Back, putting this page back first", () => {
        renderView();
        fireEvent.change(colourBox(), { target: { value: "Bay, solid face" } });
        const push = vi.spyOn(window.history, "pushState");
        act(() => {
            window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
        });
        expect(push).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("dialog").textContent).toMatch(/Leave without saving 1 release\?/);
        const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave without saving" }));
        expect(back).toHaveBeenCalled();
        push.mockRestore();
        back.mockRestore();
    });
});

describe("every field", () => {
    it("adds any field the Registry keeps, in words, focused and ready to save", async () => {
        actions.saveItem.mockResolvedValue(savedOk(BAY.row));
        renderView();
        const picker = screen.getByTestId("add-field") as HTMLSelectElement;
        const offered = [...picker.options].map((o) => o.textContent);
        expect(offered).toContain("Cast in");
        expect(offered).toContain("Materials");
        // Already shown, so not offered again.
        expect(offered).not.toContain("Model number");
        expect(offered).not.toContain("Set");
        fireEvent.change(picker, { target: { value: "materials" } });
        const box = screen.getByLabelText(/^Materials/) as HTMLInputElement;
        fireEvent.change(box, { target: { value: "Leather, Brass" } });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        await waitFor(() =>
            expect(actions.saveItem).toHaveBeenCalledWith({
                id: "r-bay",
                updatedAt: "2026-10-01T00:00:00Z",
                changes: { materials: ["Leather", "Brass"] },
            }),
        );
    });

    it("marks a refused value in its own box, says why there, and puts focus on it", async () => {
        actions.saveItem.mockResolvedValue({
            success: false,
            error: "Pieces made is a whole number.",
            field: "run_count",
        });
        renderView();
        fireEvent.change(screen.getByLabelText(/^Pieces made/), { target: { value: "lots" } });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Save" }));
        });
        const box = screen.getByLabelText(/^Pieces made/);
        expect(box.getAttribute("aria-invalid")).toBe("true");
        expect(screen.getByTestId("field-error").textContent).toBe("Pieces made is a whole number.");
        expect(box.getAttribute("aria-describedby")).toContain(screen.getByTestId("field-error").id);
        expect(document.activeElement).toBe(box);
        expect(toast).not.toHaveBeenCalledWith("Pieces made is a whole number.", "error");
        // Typing into it again clears the mark.
        fireEvent.change(box, { target: { value: "500" } });
        expect(box.getAttribute("aria-invalid")).toBeNull();
    });

    it("lets “Use this” fix a year stored as text, so Save works", async () => {
        actions.saveItem.mockResolvedValue(savedOk(TEXT_YEAR.row));
        renderView({ initial: "r-year", releases: [BAY, TEXT_YEAR] });
        const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
        expect(save.disabled).toBe(true);
        fireEvent.click(within(screen.getByTestId("suggested-fix")).getByRole("button", { name: "Use this" }));
        expect(save.disabled).toBe(false);
        fireEvent.click(save);
        await waitFor(() =>
            expect(actions.saveItem).toHaveBeenCalledWith(
                expect.objectContaining({ id: "r-year", changes: { release_year_start: "2018" } }),
            ),
        );
    });

    it("asks before taking a release off its mold", () => {
        renderView();
        fireEvent.click(screen.getByRole("button", { name: "Take it off this mold ..." }));
        const ask = screen.getByRole("group", { name: "Take it off this mold?" });
        fireEvent.click(within(ask).getByRole("button", { name: "Keep it on this mold" }));
        expect(screen.queryByText(/unsaved change/)).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Take it off this mold ..." }));
        fireEvent.click(
            within(screen.getByRole("group", { name: "Take it off this mold?" })).getByRole("button", {
                name: "Take it off",
            }),
        );
        expect(screen.getByText("1 unsaved change")).toBeTruthy();
    });
});

describe("Needs work keeps your place", () => {
    it("keeps a saved release in view until you move on, and Next carries on from it", async () => {
        // Saving fixes the shop title: its flags clear.
        actions.saveItem.mockResolvedValue(savedOk(row({ id: "r-set", title: "Saddlebred" })));
        renderView({ initial: "r-set" });
        fireEvent.click(screen.getByRole("button", { name: /^Needs work/ }));
        fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Saddlebred" } });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Save" }));
        });
        const rail = screen.getByTestId("release-rail");
        expect(
            within(rail)
                .getAllByTestId("rail-row")
                .map((r) => r.getAttribute("aria-current")),
        ).toEqual([null, "true", null]);
        expect(screen.getByTestId("editor-position").textContent).toBe("Release 1 of 2: Saddlebred");
        fireEvent.click(screen.getByRole("button", { name: "Next release" }));
        expect(editorTitle().textContent).toBe("Pinto Saddlebred");
        // Once you have moved on, the fixed one leaves the list.
        expect(within(rail).queryAllByTestId("rail-row")).toHaveLength(2);
    });

    it("needs no second read after a save: the fresh flags come with it", async () => {
        actions.saveItem.mockResolvedValue(savedOk(row({ id: "r-set", title: "Saddlebred" })));
        renderView({ initial: "r-set" });
        fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Saddlebred" } });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Save" }));
        });
        expect(actions.getItemForEdit).not.toHaveBeenCalled();
        expect(within(editor()).queryByText("Shop or sale as the title")).toBeNull();
    });
});

describe("keys and words", () => {
    it("rests J, K and Ctrl+S while a dialog is open", async () => {
        actions.previewRemove.mockResolvedValue({ success: true, ready: false, message: "Removing opens later." });
        renderView();
        fireEvent.click(screen.getByRole("button", { name: /Remove this release/ }));
        await screen.findByRole("dialog");
        fireEvent.keyDown(window, { key: "j" });
        // The page behind the dialog is hidden from assistive tech while it is open.
        expect(document.querySelector('section[aria-label="Edit the release"] h2')?.textContent).toBe("Saddlebred");
        const ev = fireEvent.keyDown(window, { key: "s", ctrlKey: true });
        expect(ev).toBe(false);
        expect(actions.saveItem).not.toHaveBeenCalled();
    });

    it("shows ⌘S on a Mac and Ctrl+S elsewhere", () => {
        const { unmount } = renderView();
        expect(screen.getByTestId("key-hint").textContent).toMatch(/Ctrl\+S saves/);
        unmount();
        Object.defineProperty(window.navigator, "platform", { value: "MacIntel", configurable: true });
        renderView();
        expect(screen.getByTestId("key-hint").textContent).toMatch(/⌘S saves/);
    });
});

describe("merging and removing", () => {
    const none = { horses: 0, wishlists: 0, children: 0, total: 0 };

    it("tells the owner first, before 243, that the merge can't be undone, and says so in the button", async () => {
        actions.previewMerge.mockResolvedValue({
            success: true,
            keep: { row: BAY.row, links: none },
            remove: { row: PINTO.row, links: { ...none, horses: 2, total: 2 } },
            undoReady: false,
        });
        actions.requestMerge.mockResolvedValue({
            success: true,
            actionId: null,
            status: "applied",
            summary: "x",
            legacy: true,
        });
        renderView({ role: "owner" });
        fireEvent.click(screen.getByRole("checkbox", { name: "Tick Saddlebred" }));
        fireEvent.click(screen.getByRole("checkbox", { name: "Tick Pinto Saddlebred" }));
        fireEvent.click(screen.getByRole("button", { name: "Merge ..." }));
        const note = await screen.findByTestId("merge-note");
        expect(note.textContent).toBe(
            "Update 243 isn't added yet, so this merge can't be undone. Add it in Admin › Ops first, or merge only if you're sure.",
        );
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Merge for good" }));
        });
        expect(toast).toHaveBeenCalledWith(expect.stringMatching(/^Merged for good into “Saddlebred”/), "success");
    });

    it("keeps a moderator from merging before 243, and says why", async () => {
        actions.previewMerge.mockResolvedValue({
            success: true,
            keep: { row: BAY.row, links: none },
            remove: { row: PINTO.row, links: none },
            undoReady: false,
        });
        renderView();
        fireEvent.click(screen.getByRole("checkbox", { name: "Tick Saddlebred" }));
        fireEvent.click(screen.getByRole("checkbox", { name: "Tick Pinto Saddlebred" }));
        fireEvent.click(screen.getByRole("button", { name: "Merge ..." }));
        expect((await screen.findByTestId("merge-note")).textContent).toMatch(/once the site owner adds update 243/);
        expect((screen.getByRole("button", { name: "Ask for a second look" }) as HTMLButtonElement).disabled).toBe(
            true,
        );
    });

    it("merges this mold into another mold, picked by name", async () => {
        actions.searchMolds.mockResolvedValue({
            success: true,
            molds: [{ id: "g1", title: "Saddlebred (G1)", maker: "Breyer", scale: "Stablemate (1:32)", releases: 4 }],
        });
        actions.previewMerge.mockResolvedValue({
            success: true,
            keep: { row: row({ id: "g1", item_type: "plastic_mold", title: "Saddlebred (G1)" }), links: none },
            remove: { row: MOLD.row, links: { ...none, children: 3, total: 3 } },
            undoReady: true,
        });
        actions.requestMerge.mockResolvedValue({
            success: true,
            actionId: "a1",
            status: "applied",
            summary: "x",
            legacy: false,
        });
        renderView({ role: "owner" });
        fireEvent.click(screen.getByRole("button", { name: "Merge this mold into ..." }));
        const dialog = screen.getByRole("dialog");
        fireEvent.change(within(dialog).getByLabelText(/Find the mold/), { target: { value: "Saddlebred G1" } });
        fireEvent.click(await within(dialog).findByRole("button", { name: /Saddlebred \(G1\)/ }, { timeout: 2000 }));
        expect(await within(dialog).findByText(/3 releases filed under it/)).toBeTruthy();
        await act(async () => {
            fireEvent.click(within(dialog).getByRole("button", { name: "Merge" }));
        });
        expect(actions.requestMerge).toHaveBeenCalledWith("g1", "sb", "");
        expect(router.push).toHaveBeenCalledWith("/catalog/desk/mold/g1");
    });

    it("says before 243 that removing waits, with no reason box, and starts fresh for the next release", async () => {
        actions.previewRemove.mockResolvedValueOnce({
            success: true,
            ready: false,
            message: "Removing opens once you add update 243 (Admin › Ops). Until then nothing can be removed.",
        });
        renderView({ role: "owner" });
        fireEvent.click(screen.getByRole("button", { name: /Remove this release/ }));
        expect((await screen.findByTestId("remove-wait")).textContent).toMatch(
            /once you add update 243 \(Admin › Ops\)/,
        );
        expect(screen.queryByLabelText(/Why it goes/)).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "OK" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

        actions.previewRemove.mockResolvedValueOnce({
            success: true,
            ready: true,
            row: SET.row,
            links: none,
            canRemove: true,
        });
        fireEvent.click(screen.getByRole("button", { name: "Next release" }));
        fireEvent.click(screen.getByRole("button", { name: /Remove this release/ }));
        const why = (await screen.findByLabelText(/Why it goes/)) as HTMLInputElement;
        expect(why.value).toBe("");
        expect(screen.queryByTestId("remove-wait")).toBeNull();
    });

    it("offers Undo on the remove and save toasts when History has the entry", async () => {
        actions.saveItem.mockResolvedValue(savedOk(BAY.row, {}, "act-save"));
        lists.undoAction.mockResolvedValue({ success: true, restored: 1, drifted: [] });
        renderView();
        fireEvent.change(colourBox(), { target: { value: "Bay" } });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Save" }));
        });
        const saved = toast.mock.calls.find(([m]) => /^Saved/.test(String(m)))!;
        expect(saved[3]).toMatchObject({ label: "Undo" });
        await act(async () => {
            saved[3].onClick();
        });
        expect(lists.undoAction).toHaveBeenCalledWith("act-save", expect.any(String));

        actions.previewRemove.mockResolvedValue({
            success: true,
            ready: true,
            row: BAY.row,
            links: none,
            canRemove: true,
        });
        actions.removeItem.mockResolvedValue({ success: true, actionId: "act-rm" });
        fireEvent.click(screen.getByRole("button", { name: /Remove this release/ }));
        fireEvent.change(await screen.findByLabelText(/Why it goes/), { target: { value: "Test entry" } });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Remove it" }));
        });
        const removed = toast.mock.calls.find(([m]) => /^Removed/.test(String(m)))!;
        expect(removed[3]).toMatchObject({ label: "Undo" });
    });
});

describe("phones and entries on their own", () => {
    it("can tick releases for a merge from the phone list", () => {
        renderView();
        fireEvent.click(screen.getByTestId("mobile-tick"));
        fireEvent.change(screen.getByTestId("release-select"), { target: { value: "r-pinto" } });
        fireEvent.click(screen.getByTestId("mobile-tick"));
        expect(screen.getByText("2 releases ticked")).toBeTruthy();
        expect(screen.getByTestId("release-select").textContent).toContain("✓ Saddlebred");
    });

    it("asks for a mold only for a plastic release", () => {
        const resin = entry(row({ id: "res", item_type: "artist_resin", parent_id: null, title: "Little Bit" }));
        const { unmount } = render(<MoldView mold={null} releases={[resin]} initialReleaseId="res" role="moderator" />);
        expect(screen.queryByText(/not filed under a mold/)).toBeNull();
        // Its own kind's fields are there, ready to fill.
        expect(screen.getByLabelText(/^Cast in/)).toBeTruthy();
        unmount();
        const lone = entry(row({ id: "lone", parent_id: null, title: "Keychain" }));
        render(<MoldView mold={null} releases={[lone]} initialReleaseId="lone" role="moderator" />);
        expect(screen.getByText(/This release is not filed under a mold/)).toBeTruthy();
    });
});

// ══════════════════════════════════════════════════════════════
// Late review of the Desk UI fixes (r3-final)
// ══════════════════════════════════════════════════════════════

function deferred<T>() {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
}

describe("keys are not stopped by panels that aren't the Desk's dialogs", () => {
    it("J, K and Ctrl+S work while the cookie banner (role=dialog) is showing", async () => {
        const banner = document.createElement("div");
        banner.setAttribute("role", "dialog");
        banner.textContent = "We use cookies";
        document.body.appendChild(banner);
        try {
            actions.saveItem.mockResolvedValue(savedOk(SET.row));
            renderView();
            fireEvent.keyDown(window, { key: "j" });
            expect(editorTitle().textContent).toBe("Sears Holiday Catalog");
            fireEvent.keyDown(window, { key: "k" });
            expect(editorTitle().textContent).toBe("Saddlebred");
            fireEvent.change(colourBox(), { target: { value: "Bay, solid face" } });
            await act(async () => {
                fireEvent.keyDown(window, { key: "s", ctrlKey: true });
            });
            expect(actions.saveItem).toHaveBeenCalledTimes(1);
        } finally {
            banner.remove();
        }
    });
});

describe("a save still in flight", () => {
    it("keeps what was typed while it saved", async () => {
        const pending = deferred<unknown>();
        actions.saveItem.mockReturnValue(pending.promise);
        renderView();
        fireEvent.change(colourBox(), { target: { value: "Bay, solid face" } });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        // Typed while the save is out: a new field, and the same box again.
        fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Saddlebred Weanling" } });
        await act(async () => {
            pending.resolve(savedOk(row({ id: "r-bay", attributes: { color_description: "Bay, solid face" } })));
        });
        expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe("Saddlebred Weanling");
        expect(colourBox().value).toBe("Bay, solid face");
        expect(screen.getByText("1 unsaved change")).toBeTruthy();
    });

    it("keeps a box changed again while it saved", async () => {
        const pending = deferred<unknown>();
        actions.saveItem.mockReturnValue(pending.promise);
        renderView();
        fireEvent.change(colourBox(), { target: { value: "Bay" } });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        fireEvent.change(colourBox(), { target: { value: "Bay, star" } });
        await act(async () => {
            pending.resolve(savedOk(row({ id: "r-bay", attributes: { color_description: "Bay" } })));
        });
        expect(colourBox().value).toBe("Bay, star");
    });

    it("doesn't pin the saved release in view when you have already moved on", async () => {
        const pending = deferred<unknown>();
        actions.saveItem.mockReturnValue(pending.promise);
        renderView({ initial: "r-set" });
        fireEvent.click(screen.getByRole("button", { name: /^Needs work/ }));
        fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Saddlebred" } });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        fireEvent.click(screen.getByRole("button", { name: "Next release" }));
        expect(editorTitle().textContent).toBe("Pinto Saddlebred");
        await act(async () => {
            pending.resolve(savedOk(row({ id: "r-set", title: "Saddlebred" })));
        });
        // The fixed one no longer needs work and you are elsewhere: it leaves the list.
        expect(within(screen.getByTestId("release-rail")).getAllByTestId("rail-row")).toHaveLength(2);
        expect(editorTitle().textContent).toBe("Pinto Saddlebred");
    });

    it("says so when the mold saved but its releases did not all follow", async () => {
        actions.saveItem.mockResolvedValue({
            ...savedOk(row({ id: "r-bay", attributes: { color_description: "Bay" } })),
            warning: "The mold is saved, but the releases filed under it could not all be moved.",
        });
        renderView();
        fireEvent.change(colourBox(), { target: { value: "Bay" } });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Save" }));
        });
        expect(toast).toHaveBeenCalledWith(
            expect.stringMatching(/could not all be moved/),
            "error",
            expect.any(Number),
            undefined,
        );
    });
});

describe("the leave guard on Back and Forward", () => {
    const stampHere = () => Number((window.history.state as Record<string, unknown> | null)?.mhhDeskStamp);

    it("undoes a Forward move without cutting off forward history, and Leave goes forward again", () => {
        renderView();
        fireEvent.change(colourBox(), { target: { value: "Bay, solid face" } });
        const here = stampHere();
        expect(Number.isFinite(here)).toBe(true);
        const push = vi.spyOn(window.history, "pushState");
        const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
        act(() => {
            window.dispatchEvent(new PopStateEvent("popstate", { state: { mhhDeskStamp: here + 5 } }));
        });
        expect(push).not.toHaveBeenCalled();
        expect(go).toHaveBeenCalledWith(-1);
        expect(screen.getByRole("dialog").textContent).toMatch(/Leave without saving 1 release\?/);
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave without saving" }));
        expect(go).toHaveBeenLastCalledWith(1);
        push.mockRestore();
        go.mockRestore();
    });

    it("undoes a Back move to a page it knows the same way, and Leave goes back", () => {
        renderView();
        fireEvent.change(colourBox(), { target: { value: "Bay, solid face" } });
        const here = stampHere();
        const push = vi.spyOn(window.history, "pushState");
        const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
        act(() => {
            window.dispatchEvent(new PopStateEvent("popstate", { state: { mhhDeskStamp: here - 5 } }));
        });
        expect(push).not.toHaveBeenCalled();
        expect(go).toHaveBeenCalledWith(1);
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave without saving" }));
        expect(go).toHaveBeenLastCalledWith(-1);
        push.mockRestore();
        go.mockRestore();
    });

    it("lets the move back onto this page through quietly, without asking twice", () => {
        renderView();
        fireEvent.change(colourBox(), { target: { value: "Bay, solid face" } });
        const here = stampHere();
        const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
        act(() => {
            window.dispatchEvent(new PopStateEvent("popstate", { state: { mhhDeskStamp: here + 5 } }));
        });
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Stay" }));
        // The browser arrives back here from history.go(-1).
        act(() => {
            window.dispatchEvent(new PopStateEvent("popstate", { state: { mhhDeskStamp: here } }));
        });
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(go).toHaveBeenCalledTimes(1);
        go.mockRestore();
    });
});

describe("a merge check that fails is not 'update 243 is missing'", () => {
    const none = { horses: 0, wishlists: 0, children: 0, total: 0 };
    const ok = {
        success: true,
        keep: { row: BAY.row, links: none },
        remove: { row: PINTO.row, links: none },
        undoReady: true,
    };

    it("releases: says the check failed, keeps the button off, and tries again on request", async () => {
        actions.previewMerge.mockResolvedValueOnce({ success: false, error: "Something went wrong." });
        renderView();
        fireEvent.click(screen.getByRole("checkbox", { name: "Tick Saddlebred" }));
        fireEvent.click(screen.getByRole("checkbox", { name: "Tick Pinto Saddlebred" }));
        fireEvent.click(screen.getByRole("button", { name: "Merge ..." }));
        expect(await screen.findByTestId("merge-check-failed")).toBeTruthy();
        expect(screen.queryByTestId("merge-note")).toBeNull();
        expect(screen.queryByText(/update 243/)).toBeNull();
        expect((screen.getByRole("button", { name: "Ask for a second look" }) as HTMLButtonElement).disabled).toBe(
            true,
        );
        actions.previewMerge.mockResolvedValue(ok);
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        });
        expect((await screen.findByTestId("merge-note")).textContent).toMatch(/second look/);
        expect(screen.queryByTestId("merge-check-failed")).toBeNull();
        expect((screen.getByRole("button", { name: "Ask for a second look" }) as HTMLButtonElement).disabled).toBe(
            false,
        );
    });

    it("molds: the same", async () => {
        actions.searchMolds.mockResolvedValue({
            success: true,
            molds: [{ id: "g1", title: "Saddlebred (G1)", maker: "Breyer", scale: "Stablemate (1:32)", releases: 4 }],
        });
        actions.previewMerge.mockResolvedValueOnce({ success: false, error: "Something went wrong." });
        renderView({ role: "owner" });
        fireEvent.click(screen.getByRole("button", { name: "Merge this mold into ..." }));
        const dialog = screen.getByRole("dialog");
        fireEvent.change(within(dialog).getByLabelText(/Find the mold/), { target: { value: "Saddlebred G1" } });
        fireEvent.click(await within(dialog).findByRole("button", { name: /Saddlebred \(G1\)/ }, { timeout: 2000 }));
        expect(await within(dialog).findByTestId("merge-check-failed")).toBeTruthy();
        expect(within(dialog).queryByText(/update 243/)).toBeNull();
        expect((within(dialog).getByRole("button", { name: "Merge" }) as HTMLButtonElement).disabled).toBe(true);
        actions.previewMerge.mockResolvedValue({
            ...ok,
            keep: { row: row({ id: "g1", item_type: "plastic_mold", title: "Saddlebred (G1)" }), links: none },
            remove: { row: MOLD.row, links: none },
        });
        await act(async () => {
            fireEvent.click(within(dialog).getByRole("button", { name: "Try again" }));
        });
        expect(await within(dialog).findByTestId("merge-note")).toBeTruthy();
        expect((within(dialog).getByRole("button", { name: "Merge" }) as HTMLButtonElement).disabled).toBe(false);
    });
});
