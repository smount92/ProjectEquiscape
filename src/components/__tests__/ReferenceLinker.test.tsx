// @vitest-environment jsdom
/**
 * The new reference linker: molds grouped with an identity line, release
 * rows led by what the horse looks like, missing facts named in the row,
 * "mine isn't here" filing under the mold, and the switch that lets a
 * member try it and go back.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

import ReferenceLinker from "@/components/linker/ReferenceLinker";
import ReferenceLinkerSwitch from "@/components/linker/ReferenceLinkerSwitch";
import type { LinkerResult } from "@/lib/linker/model";

const linker = vi.hoisted(() => ({
    searchLinker: vi.fn(),
    fileReleaseUnderMold: vi.fn(),
    fileReleaseFact: vi.fn(),
}));
vi.mock("@/app/actions/linker", () => linker);

const reference = vi.hoisted(() => ({
    getCatalogItem: vi.fn(),
    searchCatalogAction: vi.fn(),
    getReleasesForMold: vi.fn(),
}));
vi.mock("@/app/actions/reference", () => reference);
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/app/actions/catalog-suggestions", () => ({ createSuggestion: vi.fn() }));
vi.mock("@/lib/context/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/SuggestNewEntryForm", () => ({
    default: (p: { initialTitle?: string; onSubmitted?: (t: string) => void }) => (
        <div data-testid="suggest-form">
            {p.initialTitle}
            <button type="button" onClick={() => p.onSubmitted?.("Pinto Pony")}>file</button>
        </div>
    ),
}));

const SM = {
    id: "sm", title: "Silky Sullivan", maker: "Breyer", scale: "Stablemate (1:32)", generation: null, sculptor: null, year: 1976, owners: 4, ambiguous: false, href: "/reference/breyer/silky-sullivan-2",
    releases: [
        { id: "r5022", title: "#5022 Silky Sullivan", model: "5022", look: "Dark chestnut, various socks", from: null, to: null, run: "Regular Run", setName: null, isSetPiece: false, photo: null, scale: "Stablemate (1:32)" },
        { id: "rset", title: "12-Piece Stablemates Set With Arabian Mare, Silky Sullivan", model: "711096", look: null, from: 1996, to: null, run: null, setName: "12-Piece Stablemates Set", isSetPiece: true, photo: null, scale: "Stablemate (1:32)" },
    ],
};
const RESULT: LinkerResult = {
    term: "Silky Sullivan", kind: "text", scale: "Stablemate (1:32)",
    molds: [SM],
    otherScales: [{ id: "cl", title: "Silky Sullivan", maker: "Breyer", scale: "Classic (1:12)", generation: null, year: 1975, releaseCount: 14, href: "/reference/breyer/silky-sullivan-4" }],
    others: [],
    numberHits: [],
};

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    linker.searchLinker.mockResolvedValue(RESULT);
    reference.getCatalogItem.mockImplementation(async (id: string) => ({ id, itemType: id === "sm" ? "plastic_mold" : "plastic_release", parentId: null, title: "x", maker: "Breyer", scale: null, attributes: {} }));
});

describe("ReferenceLinker", () => {
    it("groups under the mold with an identity line, names missing facts, and keeps the Classic one under other scales", async () => {
        render(<ReferenceLinker selectedCatalogId={null} onCatalogSelect={vi.fn()} />);
        fireEvent.change(screen.getByLabelText("Find the model"), { target: { value: "Silky Sullivan" } });
        const mold = await screen.findByTestId("linker-mold", {}, { timeout: 3000 });
        expect(within(mold).getByTestId("linker-identity").textContent).toBe("Breyer · Stablemate · 1976");
        const rows = within(mold).getAllByTestId("linker-release");
        expect(rows).toHaveLength(2);
        expect(rows[0].textContent).toContain("#5022 · Dark chestnut, various socks");
        expect(rows[0].textContent).toContain("year not recorded");
        expect(rows[1].textContent).toContain("colour not recorded");
        expect(rows[1].textContent).toContain("from the 12-Piece Stablemates Set");
        expect(screen.getByTestId("linker-other-scales").textContent).toContain("Classic");
        expect(linker.searchLinker).toHaveBeenCalledWith("Silky Sullivan", null);
    });

    it("links a release through the real catalog item and shows the banner", async () => {
        const onSelect = vi.fn();
        render(<ReferenceLinker selectedCatalogId={null} onCatalogSelect={onSelect} />);
        fireEvent.change(screen.getByLabelText("Find the model"), { target: { value: "Silky Sullivan" } });
        const mold = await screen.findByTestId("linker-mold", {}, { timeout: 3000 });
        fireEvent.click(within(mold).getAllByTestId("linker-pick")[0]);
        await waitFor(() => expect(onSelect).toHaveBeenCalledWith("r5022", expect.objectContaining({ id: "r5022" })));
        expect(screen.getByTestId("linker-banner").textContent).toContain("Silky Sullivan (Stablemate) · #5022 · Dark chestnut");
    });

    it("links the mold only, and files an added release under the mold", async () => {
        const onSelect = vi.fn();
        linker.fileReleaseUnderMold.mockResolvedValue({ success: true, autoApproved: false });
        render(<ReferenceLinker selectedCatalogId={null} onCatalogSelect={onSelect} />);
        fireEvent.change(screen.getByLabelText("Find the model"), { target: { value: "Silky Sullivan" } });
        const mold = await screen.findByTestId("linker-mold", {}, { timeout: 3000 });
        fireEvent.click(within(mold).getByTestId("linker-add-open"));
        const form = within(mold).getByTestId("linker-add");
        fireEvent.change(within(form).getByPlaceholderText("5022"), { target: { value: "5177" } });
        fireEvent.change(within(form).getByPlaceholderText("dark chestnut, various socks"), { target: { value: "Black, no white" } });
        fireEvent.click(within(form).getByText("Add it under this mold"));
        await waitFor(() => expect(linker.fileReleaseUnderMold).toHaveBeenCalledWith(expect.objectContaining({ moldId: "sm", modelNumber: "5177", look: "Black, no white" })));
        await waitFor(() => expect(onSelect).toHaveBeenCalledWith("sm", expect.objectContaining({ id: "sm" })));
        expect(screen.getByTestId("linker-banner").textContent).toContain("mold only");
    });

    it("searches a model number and lands on the release", async () => {
        linker.searchLinker.mockResolvedValue({ term: "5022", kind: "number", scale: null, molds: [], otherScales: [], others: [], numberHits: [{ mold: { id: "sm", title: "Silky Sullivan", maker: "Breyer", scale: "Stablemate (1:32)", generation: null, year: 1976, releaseCount: 2, href: "/x" }, release: SM.releases[0] }] });
        render(<ReferenceLinker selectedCatalogId={null} onCatalogSelect={vi.fn()} />);
        fireEvent.change(screen.getByLabelText("Find the model"), { target: { value: "5022" } });
        const block = await screen.findByTestId("linker-number", {}, { timeout: 3000 });
        expect(block.textContent).toContain("Model number 5022");
        expect(within(block).getAllByTestId("linker-release")).toHaveLength(1);
    });

    it("says so when a mold has no releases, and keeps both paths", async () => {
        linker.searchLinker.mockResolvedValue({ ...RESULT, molds: [{ ...SM, releases: [] }] });
        render(<ReferenceLinker selectedCatalogId={null} onCatalogSelect={vi.fn()} />);
        fireEvent.change(screen.getByLabelText("Find the model"), { target: { value: "Silky Sullivan" } });
        const mold = await screen.findByTestId("linker-mold", {}, { timeout: 3000 });
        expect(within(mold).getByTestId("linker-no-releases")).toBeTruthy();
        expect(within(mold).getByTestId("linker-add-open")).toBeTruthy();
        expect(within(mold).getByTestId("linker-pick-mold")).toBeTruthy();
    });

    it("opens Suggest an entry with the typed term and hands the filed title to the host", async () => {
        const onCustom = vi.fn();
        render(<ReferenceLinker selectedCatalogId={null} onCatalogSelect={vi.fn()} onCustomEntry={onCustom} />);
        fireEvent.change(screen.getByLabelText("Find the model"), { target: { value: "Pinto Pony" } });
        fireEvent.click(screen.getByTestId("linker-suggest-open"));
        const form = await screen.findByTestId("suggest-form");
        expect(form.textContent).toContain("Pinto Pony");
        fireEvent.click(within(form).getByText("file"));
        await waitFor(() => expect(onCustom).toHaveBeenCalledWith("Pinto Pony"));
        expect(screen.queryByTestId("suggest-form")).toBeNull();
        expect(screen.getByRole("status").textContent).toMatch(/Suggested for the Registry/);
    });

    it("the switch starts on the old picker, remembers 'new', and goes back", async () => {
        reference.searchCatalogAction.mockResolvedValue([]);
        const { container } = render(<ReferenceLinkerSwitch selectedCatalogId={null} onCatalogSelect={vi.fn()} />);
        await waitFor(() => expect(container.querySelector("[data-linker]")?.getAttribute("data-linker")).toBe("old"));
        fireEvent.click(screen.getByTestId("linker-try-new"));
        expect(container.querySelector("[data-linker]")?.getAttribute("data-linker")).toBe("new");
        expect(localStorage.getItem("mhh:linker")).toBe("new");
        expect(screen.getByTestId("reference-linker")).toBeTruthy();
        fireEvent.click(screen.getByTestId("linker-return-old"));
        expect(localStorage.getItem("mhh:linker")).toBe("old");
        expect(screen.queryByTestId("reference-linker")).toBeNull();
    });
});
