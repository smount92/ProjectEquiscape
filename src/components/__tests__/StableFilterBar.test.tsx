// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StableFilterBar from "../stable/StableFilterBar";
import type { StableFilters } from "@/lib/stable/filterParams";
import type { SavedView, StableFacetOptions } from "@/lib/stable/types";

const { saveStableView, deleteStableView } = vi.hoisted(() => ({
    saveStableView: vi.fn(),
    deleteStableView: vi.fn(),
}));
vi.mock("@/app/actions/stable", () => ({
    saveStableView,
    deleteStableView,
}));

const COLLECTION_ID = "123e4567-e89b-42d3-a456-426614174000";
const VIEW_ID = "223e4567-e89b-42d3-a456-426614174000";

const FACETS: StableFacetOptions = {
    makers: ["Breyer", "Stone"],
    scales: ["Traditional"],
    finishes: ["OF", "Custom"],
    categories: ["model"],
};

// Radix Popover positions via floating-ui, which needs ResizeObserver —
// jsdom doesn't ship one.
beforeAll(() => {
    if (!globalThis.ResizeObserver) {
        globalThis.ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        } as unknown as typeof ResizeObserver;
    }
});

const onFiltersChange = vi.fn();
const onViewChange = vi.fn();

function renderBar(filters: Partial<StableFilters> = {}, savedViews: SavedView[] = []) {
    return render(
        <StableFilterBar
            filters={{ sort: "newest", ...filters }}
            facetOptions={FACETS}
            collections={[{ id: COLLECTION_ID, name: "Vintage Herd" }]}
            initialSavedViews={savedViews}
            view="grid"
            onViewChange={onViewChange}
            onFiltersChange={onFiltersChange}
        />,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    saveStableView.mockResolvedValue({
        success: true,
        view: { id: VIEW_ID, name: "My View", params: { finish: "OF" }, createdAt: "2026-07-10" },
    });
    deleteStableView.mockResolvedValue({ success: true });
});

describe("StableFilterBar", () => {
    it("renders a rubber-stamp chip for every active filter", () => {
        renderBar({ q: "chic", finish: "OF", collection: COLLECTION_ID, hasRecords: true });
        // Each chip carries its ✕ button ("OF"/"Vintage Herd" also appear
        // in the facet triggers, so assert via the remove buttons).
        expect(screen.getByText("“chic”")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Remove filter OF" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Remove filter Vintage Herd" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Remove filter Has show records" })).toBeInTheDocument();
    });

    it("shows no chips or clear-all when pristine", () => {
        renderBar();
        expect(screen.queryByText("clear all")).not.toBeInTheDocument();
    });

    it("chip ✕ pushes the filters minus that one filter (URL push)", async () => {
        const user = userEvent.setup();
        renderBar({ q: "chic", finish: "OF" });
        await user.click(screen.getByRole("button", { name: "Remove filter OF" }));
        expect(onFiltersChange).toHaveBeenCalledWith({ q: "chic", sort: "newest" });
    });

    it("clear-all pushes pristine filters but keeps the sort", async () => {
        const user = userEvent.setup();
        renderBar({ q: "chic", finish: "OF", hasRecords: true, sort: "name-az" });
        await user.click(screen.getByText("clear all"));
        expect(onFiltersChange).toHaveBeenCalledWith({ sort: "name-az" });
    });

    it("submits the whole-collection search on Enter", async () => {
        const user = userEvent.setup();
        renderBar();
        const input = screen.getByLabelText("Search your stable");
        await user.type(input, "valegro{Enter}");
        expect(onFiltersChange).toHaveBeenCalledWith({ q: "valegro", sort: "newest" });
    });

    it("toggles the brass has-show-records pill", async () => {
        const user = userEvent.setup();
        renderBar();
        await user.click(screen.getByRole("button", { name: /has show records/i }));
        expect(onFiltersChange).toHaveBeenCalledWith({ sort: "newest", hasRecords: true });
    });

    it("saves the current filters as a named view", async () => {
        const user = userEvent.setup();
        renderBar({ finish: "OF" });
        await user.click(screen.getByRole("button", { name: /views/i }));
        await user.type(screen.getByPlaceholderText("View name…"), "My View");
        await user.click(screen.getByRole("button", { name: "Save" }));
        await waitFor(() => {
            expect(saveStableView).toHaveBeenCalledWith({ name: "My View", params: { finish: "OF" } });
        });
        // The saved view appears in the list
        expect(await screen.findByText("My View")).toBeInTheDocument();
    });

    it("loads a saved view by pushing its filters", async () => {
        const user = userEvent.setup();
        renderBar({}, [
            { id: VIEW_ID, name: "OF Breyers", params: { finish: "OF", maker: "Breyer" }, createdAt: "2026-07-10" },
        ]);
        await user.click(screen.getByRole("button", { name: /views/i }));
        await user.click(await screen.findByText("OF Breyers"));
        expect(onFiltersChange).toHaveBeenCalledWith({ finish: "OF", maker: "Breyer", sort: "newest" });
    });

    it("deletes a saved view", async () => {
        const user = userEvent.setup();
        renderBar({}, [
            { id: VIEW_ID, name: "OF Breyers", params: { finish: "OF" }, createdAt: "2026-07-10" },
        ]);
        await user.click(screen.getByRole("button", { name: /views/i }));
        await user.click(await screen.findByRole("button", { name: "Delete view OF Breyers" }));
        await waitFor(() => {
            expect(deleteStableView).toHaveBeenCalledWith({ id: VIEW_ID });
        });
        expect(screen.queryByText("OF Breyers")).not.toBeInTheDocument();
    });

    it("keeps the Gallery/Ledger toggle wired", async () => {
        const user = userEvent.setup();
        renderBar();
        await user.click(screen.getByRole("button", { name: /ledger/i }));
        expect(onViewChange).toHaveBeenCalledWith("ledger");
    });
});
