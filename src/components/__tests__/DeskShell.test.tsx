// @vitest-environment jsdom
/**
 * The Registry Desk around the editor (UI review, Release 3): tab counts
 * and a strip that wraps on a phone, History's "Done" and "Open", to-do
 * rows opening on "Needs work" with a way back, the search across every
 * entry, and the reference page's "Edit in the Desk" link, shown only to
 * moderators and decided in the browser.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const desk = vi.hoisted(() => ({ searchEntries: vi.fn(), canOpenDesk: vi.fn() }));
vi.mock("@/app/actions/registry-desk", () => desk);
vi.mock("@/app/actions/registry-desk-lists", () => ({
    undoAction: vi.fn(),
    markLooksRight: vi.fn(),
    claimTodo: vi.fn(),
    releaseTodo: vi.fn(),
    markTodoDone: vi.fn(),
}));
const session = vi.hoisted(() => ({ current: null as null | object }));
vi.mock("@/lib/supabase/client", () => ({
    createClient: () => ({ auth: { getSession: async () => ({ data: { session: session.current } }) } }),
}));
vi.mock("next/link", () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

import DeskTabs from "@/components/desk/DeskTabs";
import HistoryRow from "@/components/desk/HistoryRow";
import { openHref } from "@/components/desk/TodoListTable";
import EntrySearch from "@/components/desk/EntrySearch";
import EditInDeskLink from "@/components/desk/EditInDeskLink";
import type { HistoryEntry } from "@/app/actions/registry-desk-lists";
import type { TodoRow } from "@/app/actions/registry-desk-lists";

beforeEach(() => {
    vi.clearAllMocks();
    session.current = null;
});

describe("the Desk's tabs", () => {
    it("show how much waits on the Queue and the Rules, and wrap instead of hiding tabs", () => {
        render(<DeskTabs counts={{ queue: 3, rules: 2 }} />);
        const nav = screen.getByRole("navigation", { name: "Desk sections" });
        expect(nav.className).toMatch(/flex-wrap/);
        expect(nav.className).not.toMatch(/overflow-x-auto/);
        expect(screen.getByTestId("tab-count-queue").textContent).toBe("(3 waiting)");
        expect(screen.getByTestId("tab-count-rules").textContent).toBe("(2 proposed)");
        expect(screen.getAllByRole("link")).toHaveLength(5);
    });

    it("show no number when nothing waits", () => {
        render(<DeskTabs counts={{ queue: 0, rules: 0 }} />);
        expect(screen.queryByTestId("tab-count-queue")).toBeNull();
    });
});

describe("History", () => {
    const base: HistoryEntry = {
        id: "a1",
        kind: "edit",
        status: "applied",
        summary: "Saddlebred: Colour and markings: (empty) → Bay",
        note: null,
        itemTitle: "Saddlebred",
        catalogItemId: "r1",
        rowCount: 1,
        by: "BayLeaf",
        role: "moderator",
        mine: false,
        createdAt: "2026-10-16T12:00:00Z",
        undoUntil: "2026-11-15T12:00:00Z",
        secondLookBy: null,
        looksRightBy: null,
        undoneBy: null,
        canUndo: true,
        canMarkLooksRight: true,
    };

    it("calls a change that went through Done, and opens it in the Desk editor", () => {
        render(<HistoryRow entry={base} />);
        expect(screen.getByText("Done")).toBeTruthy();
        expect(screen.queryByText("In")).toBeNull();
        expect(screen.getByRole("link", { name: "Open" }).getAttribute("href")).toBe("/catalog/desk/mold/r1");
    });
});

describe("to-do rows", () => {
    const row: TodoRow = {
        key: "r1",
        kind: "number_in_title",
        id: "r1",
        title: "#5038 Morgan Mare",
        detail: null,
        maker: "Breyer",
        scale: null,
        moldId: "m1",
        moldTitle: "Morgan Mare",
        claim: null,
    };

    it("open the release on Needs work, with the way back to this page of the list", () => {
        const href = openHref(row, "/catalog/desk/todo/number_in_title?page=2");
        const url = new URL(href, "https://x.test");
        expect(url.pathname).toBe("/catalog/desk/mold/m1");
        expect(url.searchParams.get("release")).toBe("r1");
        expect(url.searchParams.get("filter")).toBe("needs");
        expect(url.searchParams.get("back")).toBe("/catalog/desk/todo/number_in_title?page=2");
    });

    it("open a release with no mold on its own", () => {
        const href = openHref({ ...row, moldId: null }, "/catalog/desk/todo/no_mold");
        expect(href.startsWith("/catalog/desk/mold/r1?filter=needs&back=")).toBe(true);
    });
});

describe("finding any entry", () => {
    it("lists entries by name or number, each opening in the Desk editor", async () => {
        desk.searchEntries.mockResolvedValue({
            success: true,
            entries: [
                {
                    id: "lone",
                    title: "Saddlebred keychain",
                    itemType: "plastic_release",
                    maker: "Breyer",
                    scale: null,
                    modelNumber: "711198",
                    moldTitle: null,
                    href: "/catalog/desk/mold/lone",
                },
            ],
        });
        render(<EntrySearch />);
        fireEvent.change(screen.getByLabelText(/Find any entry/), { target: { value: "711198" } });
        const link = await screen.findByRole("link", { name: /Saddlebred keychain/ }, { timeout: 2000 });
        expect(link.getAttribute("href")).toBe("/catalog/desk/mold/lone");
        expect(link.textContent).toContain("#711198");
        expect(link.textContent).toContain("no mold");
        expect(desk.searchEntries).toHaveBeenCalledWith("711198");
    });
});

describe("Edit in the Desk, on a reference page", () => {
    it("asks nothing and shows nothing to a visitor who isn't signed in", async () => {
        render(<EditInDeskLink itemId="r1" />);
        await new Promise((r) => setTimeout(r, 20));
        expect(desk.canOpenDesk).not.toHaveBeenCalled();
        expect(screen.queryByTestId("edit-in-desk")).toBeNull();
    });

    it("shows nothing to a signed-in member who isn't a moderator", async () => {
        session.current = { user: { id: "u" } };
        desk.canOpenDesk.mockResolvedValue({ success: false, error: "The Registry Desk is for Registry moderators." });
        render(<EditInDeskLink itemId="r1" />);
        await waitFor(() => expect(desk.canOpenDesk).toHaveBeenCalled());
        expect(screen.queryByTestId("edit-in-desk")).toBeNull();
    });

    it("links a moderator straight to the entry in the Desk", async () => {
        session.current = { user: { id: "u" } };
        desk.canOpenDesk.mockResolvedValue({ success: true, role: "moderator" });
        render(<EditInDeskLink itemId="r1" />);
        const link = await screen.findByTestId("edit-in-desk");
        expect(link.getAttribute("href")).toBe("/catalog/desk/mold/r1");
        expect(link.textContent).toContain("Edit in the Desk");
    });
});
