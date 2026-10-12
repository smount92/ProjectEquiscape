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
    listRoadmapEvents: vi.fn(),
    addRoadmapNote: vi.fn(),
    listRecentRoadmapEvents: vi.fn(),
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
    actions.listRoadmapEvents.mockResolvedValue({ success: true, events: [], schemaReady: true });
    actions.listRecentRoadmapEvents.mockResolvedValue({ success: true, events: [] });
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
it("opens the thread under a title: history newest first, and a note is added through the action", async () => {
        actions.listRoadmapEvents.mockResolvedValue({
            success: true,
            schemaReady: true,
            events: [
                {
                    id: "e2",
                    itemId: "b",
                    kind: "change",
                    body: "",
                    changes: [{ field: "status", from: "Open", to: "In progress" }],
                    createdAt: "2026-10-12T10:00:00Z",
                },
                { id: "e1", itemId: "b", kind: "created", body: "Added to the roadmap", changes: [], createdAt: "2026-10-11T10:00:00Z" },
            ],
        });
        actions.addRoadmapNote.mockResolvedValue({
            success: true,
            event: { id: "e3", itemId: "b", kind: "comment", body: "Asked Misty", changes: [], createdAt: "2026-10-12T11:00:00Z" },
        });
        render(<AdminRoadmapTab />);
        fireEvent.click(await screen.findByText("Entries tray"));
        const thread = await screen.findByTestId("roadmap-history");
        await waitFor(() => expect(within(thread).getAllByTestId("roadmap-event")).toHaveLength(2));
        expect(within(thread).getAllByTestId("roadmap-event")[0].textContent).toContain("Status: Open → In progress");

        fireEvent.change(within(thread).getByLabelText("Note on Entries tray"), { target: { value: "Asked Misty" } });
        fireEvent.click(within(thread).getByText("Add note"));
        await waitFor(() => expect(actions.addRoadmapNote).toHaveBeenCalledWith("b", "Asked Misty"));
        await waitFor(() => expect(within(thread).getAllByTestId("roadmap-event")).toHaveLength(3));
        expect(within(thread).getAllByTestId("roadmap-event")[0].getAttribute("data-kind")).toBe("comment");
        // The activity stream refetches after a note.
        await waitFor(() => expect(actions.listRecentRoadmapEvents.mock.calls.length).toBeGreaterThanOrEqual(2));
    });

    it("shows the recent-activity stream with item titles", async () => {
        actions.listRecentRoadmapEvents.mockResolvedValue({
            success: true,
            events: [
                {
                    id: "e9",
                    itemId: "a",
                    itemTitle: "Test shows still qualifying",
                    kind: "change",
                    body: "",
                    changes: [{ field: "priority", from: "Should", to: "Must" }],
                    createdAt: "2026-10-12T10:00:00Z",
                },
            ],
        });
        render(<AdminRoadmapTab />);
        const stream = await screen.findByTestId("roadmap-activity");
        expect(stream.textContent).toContain("Test shows still qualifying");
        expect(stream.textContent).toContain("Priority: Should → Must");
    });

    it("says history is waiting on 231 inside the thread when its table is missing", async () => {
        actions.listRoadmapEvents.mockResolvedValue({
            success: true,
            events: [],
            schemaReady: false,
            notice: "Roadmap history is not in the database yet — paste supabase/migrations/231_roadmap_events.sql.",
        });
        render(<AdminRoadmapTab />);
        fireEvent.click(await screen.findByText("Entries tray"));
        const thread = await screen.findByTestId("roadmap-history");
        await waitFor(() => expect(within(thread).getByRole("status").textContent).toMatch(/231_roadmap_events/));
        expect(within(thread).queryByText("Add note")).toBeNull();
    });
});
