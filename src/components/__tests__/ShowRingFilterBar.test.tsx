// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ShowRingFilterBar from "../showring/ShowRingFilterBar";
import type { ShowRingFilters } from "@/lib/showring/filterParams";
import type { ShowRingFacetOptions } from "@/lib/showring/types";

const FACETS: ShowRingFacetOptions = {
    makers: ["Breyer", "Stone"],
    scales: ["Classic", "Traditional"],
    finishes: ["Artist Resin", "Custom", "OF"],
};

const onFiltersChange = vi.fn();

function renderBar(filters: Partial<ShowRingFilters> = {}, facets: ShowRingFacetOptions = FACETS) {
    return render(
        <ShowRingFilterBar
            filters={{ sort: "newest", ...filters }}
            facetOptions={facets}
            onFiltersChange={onFiltersChange}
        />,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("ShowRingFilterBar", () => {
    it("renders the search box and server-driven facet selects", () => {
        renderBar();
        expect(screen.getByLabelText("Search the Show Ring")).toBeInTheDocument();
        expect(screen.getByLabelText("Filter by finish")).toBeInTheDocument();
        expect(screen.getByLabelText("Filter by maker")).toBeInTheDocument();
        expect(screen.getByLabelText("Filter by scale")).toBeInTheDocument();
        expect(screen.getByLabelText("Filter by status")).toBeInTheDocument();
        expect(screen.getByLabelText("Sort the Show Ring")).toBeInTheDocument();
    });

    it("hides a facet select whose option list is empty and nothing is selected", () => {
        renderBar({}, { makers: [], scales: [], finishes: ["OF"] });
        expect(screen.queryByLabelText("Filter by maker")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Filter by scale")).not.toBeInTheDocument();
        expect(screen.getByLabelText("Filter by finish")).toBeInTheDocument();
    });

    it("keeps a facet select visible when its value is set even with no options", () => {
        renderBar({ maker: "Breyer" }, { makers: [], scales: [], finishes: [] });
        expect(screen.getByLabelText("Filter by maker")).toBeInTheDocument();
    });

    it("renders a rubber-stamp chip for every active filter", () => {
        renderBar({ q: "chic", finish: "OF", maker: "Breyer", trade: "For Sale" });
        expect(screen.getByText("“chic”")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Remove filter OF" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Remove filter Breyer" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Remove filter For Sale" })).toBeInTheDocument();
    });

    it("shows no chips or clear-all when pristine", () => {
        renderBar();
        expect(screen.queryByText("clear all")).not.toBeInTheDocument();
    });

    it("chip ✕ pushes the filters minus that one filter (URL push)", async () => {
        const user = userEvent.setup();
        renderBar({ q: "chic", maker: "Breyer" });
        await user.click(screen.getByRole("button", { name: "Remove filter Breyer" }));
        expect(onFiltersChange).toHaveBeenCalledWith({ q: "chic", sort: "newest" });
    });

    it("clear-all pushes pristine filters but keeps the sort", async () => {
        const user = userEvent.setup();
        renderBar({ q: "chic", finish: "OF", trade: "For Sale", sort: "oldest" });
        await user.click(screen.getByText("clear all"));
        expect(onFiltersChange).toHaveBeenCalledWith({ sort: "oldest" });
    });

    it("submits the whole-ring search on Enter", async () => {
        const user = userEvent.setup();
        renderBar();
        const input = screen.getByLabelText("Search the Show Ring");
        await user.type(input, "valegro{Enter}");
        expect(onFiltersChange).toHaveBeenCalledWith({ q: "valegro", sort: "newest" });
    });

    it("clearing the search box submits filters without q", async () => {
        const user = userEvent.setup();
        renderBar({ q: "chic" });
        const input = screen.getByLabelText("Search the Show Ring");
        await user.clear(input);
        await user.keyboard("{Enter}");
        expect(onFiltersChange).toHaveBeenCalledWith({ sort: "newest" });
    });
});
