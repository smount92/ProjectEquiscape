// @vitest-environment jsdom
/**
 * The Roadmap tab: four horizon columns, problems ahead of goals,
 * closed items hidden unless asked, status changes in place, and the
 * migration notice when the table is not there yet.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

import AdminRoadmapTab from "@/components/AdminRoadmapTab";
import type { RoadmapItem } from "@/lib/roadmap/model";

const actions = vi.hoisted(() => ({
    listRoadmap: vi.fn(),
    createRoadmapItem: vi.fn(),
    updateRoadmapItem: vi.fn(),
    deleteRoadmapItem: vi.fn(),
}));
vi.mock("@/app/actions/admin-roadmap", () => actions);

function item(over: Partial<RoadmapItem> & { id: string; title: string }): RoadmapItem {
    return {
        detail: "",
        kind: "goal",
        horizon: "short",
        status: "open",
        priority: 2,
        area: "",
        source: "",
        link: "",
        dueOn: null,
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: new Date().toISOString(),
        closedAt: null,
        ...over,
    };
}

const ITEMS: RoadmapItem[] = [
    item({ id: "a", title: "Test shows still qualifying", kind: "problem", horizon: "now", priority: 1 }),
    item({ id: "b", title: "Entries tray", kind: "goal", horizon: "short" }),
    item({ id: "c", title: "Old thing", kind: "chore", horizon: "short", status: "done", closedAt: "2026-10-10T00:00:00Z" }),
    item({ id: "d", title: "National numbers", kind: "goal", horizon: "long", status: "in_progress" }),
];

beforeEach(() => {
    vi.clearAllMocks();
    actions.listRoadmap.mockResolvedValue({ success: true, items: ITEMS, schemaReady: true });
});

describe("AdminRoadmapTab", () => {
    it("places items in their horizon column and hides closed ones by default", async () => {
        render(<AdminRoadmapTab />);
        await screen.findByText("Test shows still qualifying");
        expect(within(screen.getByTestId("horizon-now")).getAllByTestId("roadmap-item")).toHaveLength(1);
        expect(within(screen.getByTestId("horizon-short")).getAllByTestId("roadmap-item")).toHaveLength(1);
        expect(within(screen.getByTestId("horizon-long")).getAllByTestId("roadmap-item")).toHaveLength(1);
        expect(screen.queryByText("Old thing")).toBeNull();

        fireEvent.click(screen.getByLabelText(/include done/i));
        expect(screen.getByText("Old thing")).toBeTruthy();
    });

    it("rolls up open problems and recent dones in the stat tiles", async () => {
        render(<AdminRoadmapTab />);
        await screen.findByText("Test shows still qualifying");
        const problems = screen.getByText("Open problems").previousElementSibling;
        expect(problems?.textContent).toBe("1");
        const done = screen.getByText("Done, 30 days").previousElementSibling;
        expect(done?.textContent).toBe("1");
    });

    it("changes status in place through the action and keeps the returned row", async () => {
        actions.updateRoadmapItem.mockResolvedValue({
            success: true,
            item: item({ id: "b", title: "Entries tray", status: "blocked" }),
        });
        render(<AdminRoadmapTab />);
        await screen.findByText("Entries tray");
        fireEvent.change(screen.getByLabelText("Status of Entries tray"), { target: { value: "blocked" } });
        await waitFor(() => expect(actions.updateRoadmapItem).toHaveBeenCalledWith("b", { status: "blocked" }));
        await waitFor(() => {
            const row = screen.getByText("Entries tray").closest("[data-testid=roadmap-item]");
            expect(row?.getAttribute("data-status")).toBe("blocked");
        });
    });

    it("filters to problems only", async () => {
        render(<AdminRoadmapTab />);
        await screen.findByText("Entries tray");
        fireEvent.change(screen.getByLabelText(/^show/i), { target: { value: "problem" } });
        expect(screen.queryByText("Entries tray")).toBeNull();
        expect(screen.getByText("Test shows still qualifying")).toBeTruthy();
    });

    it("adds an item through the form and shows it at once", async () => {
        actions.createRoadmapItem.mockResolvedValue({
            success: true,
            item: item({ id: "e", title: "Barns guide", horizon: "short" }),
        });
        render(<AdminRoadmapTab />);
        await screen.findByText("Entries tray");
        fireEvent.click(screen.getByText("+ Add an item"));
        const form = screen.getByTestId("roadmap-add");
        fireEvent.change(within(form).getByLabelText("Title"), { target: { value: "Barns guide" } });
        fireEvent.click(within(form).getByText("Add"));
        await waitFor(() => expect(actions.createRoadmapItem).toHaveBeenCalled());
        expect(actions.createRoadmapItem.mock.calls[0][0]).toMatchObject({ title: "Barns guide", kind: "goal", horizon: "short" });
        await screen.findByText("Barns guide");
    });

    it("shows the migration notice and disables adding when the table is missing", async () => {
        actions.listRoadmap.mockResolvedValue({
            success: true,
            items: [],
            schemaReady: false,
            notice: "The roadmap table is not in the database yet — paste supabase/migrations/230_roadmap.sql.",
        });
        render(<AdminRoadmapTab />);
        await screen.findByRole("status");
        expect(screen.getByRole("status").textContent).toMatch(/230_roadmap\.sql/);
        expect((screen.getByText("+ Add an item") as HTMLButtonElement).disabled).toBe(true);
    });
});
