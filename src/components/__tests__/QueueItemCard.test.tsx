// @vitest-environment jsdom
/**
 * A Queue item on the Registry Desk: what the member asked for next to what
 * the Registry says now, approve / fix and approve / say no with a reason,
 * nobody deciding their own, and a claim before anyone starts editing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { QueueItem } from "@/app/actions/registry-desk";

const desk = vi.hoisted(() => ({
    approveSuggestion: vi.fn(),
    claimSuggestion: vi.fn(),
    confirmMerge: vi.fn(),
    declineMerge: vi.fn(),
    rejectSuggestion: vi.fn(),
    releaseClaim: vi.fn(),
    searchMolds: vi.fn(),
}));
vi.mock("@/app/actions/registry-desk", () => desk);
const suggestions = vi.hoisted(() => ({ revertSuggestion: vi.fn() }));
vi.mock("@/app/actions/catalog-suggestions", () => suggestions);
vi.mock("next/link", () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

import QueueItemCard, { timeAgo } from "@/components/desk/QueueItemCard";

function item(over: Partial<QueueItem> = {}): QueueItem {
    return {
        id: "s1",
        tab: "corrections",
        kind: "correction",
        kindLabel: "Correction",
        title: "Saddlebred",
        itemId: "r1",
        deskHref: "/catalog/desk/mold/sb?release=r1",
        moldTitle: "Saddlebred",
        who: "@BayLeaf",
        mine: false,
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        reason: "It ran until 1988, not just 1975.",
        changes: [{ key: "release_year_end", label: "Last year", from: "1975", to: "1988" }],
        fields: { release_year_end: { from: "1975", to: "1988" } },
        claim: null,
        keep: null,
        note: null,
        canEdit: true,
        current: { title: "Saddlebred", model_number: "", release_year_end: "1975" },
        ...over,
    };
}

const onDone = vi.fn();
/** What the card showed, passed with every decision. */
const SEEN = { fieldChanges: { release_year_end: { from: "1975", to: "1988" } }, catalogItemId: "r1" };

beforeEach(() => {
    vi.clearAllMocks();
    desk.approveSuggestion.mockResolvedValue({ success: true, status: "applied" });
    desk.rejectSuggestion.mockResolvedValue({ success: true });
    desk.claimSuggestion.mockResolvedValue({
        success: true,
        claimed: true,
        until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    desk.releaseClaim.mockResolvedValue({ success: true });
    desk.confirmMerge.mockResolvedValue({ success: true });
});

describe("QueueItemCard", () => {
    it("shows now and suggested side by side, who asked, when, and why", () => {
        render(<QueueItemCard item={item()} role="moderator" onDone={onDone} />);
        expect(screen.getByText("Correction")).toBeTruthy();
        expect(screen.getByText(/@BayLeaf · 1 h ago/)).toBeTruthy();
        expect(screen.getByText("“1975”")).toBeTruthy();
        expect(screen.getByText("“1988”")).toBeTruthy();
        expect(screen.getByText("“It ran until 1988, not just 1975.”")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Open it in the Mold view" }).getAttribute("href")).toBe(
            "/catalog/desk/mold/sb?release=r1",
        );
    });

    it("approves in one click and tells the moderator the member heard", async () => {
        render(<QueueItemCard item={item()} role="moderator" onDone={onDone} />);
        fireEvent.click(screen.getByRole("button", { name: "Approve" }));
        await waitFor(() => expect(onDone).toHaveBeenCalledWith("s1", "Approved. @BayLeaf has been told."));
        expect(desk.approveSuggestion).toHaveBeenCalledWith("s1", null, null, SEEN);
    });

    it("claims before editing, then approves the moderator's fixed copy keeping the member's original", async () => {
        render(<QueueItemCard item={item()} role="moderator" onDone={onDone} />);
        fireEvent.click(screen.getByRole("button", { name: "Edit, then approve" }));
        await waitFor(() => expect(desk.claimSuggestion).toHaveBeenCalledWith("s1"));
        const box = (await screen.findByLabelText(/^Last year/)) as HTMLInputElement;
        expect(box.value).toBe("1988");
        expect(screen.getByTestId("claim-line").textContent).toMatch(/^You have this one until/);
        fireEvent.change(box, { target: { value: "1987" } });
        fireEvent.change(screen.getByLabelText(/A note for the member/), { target: { value: "JAH 1988 says 1987." } });
        fireEvent.click(screen.getByRole("button", { name: "Approve as fixed" }));
        await waitFor(() =>
            expect(desk.approveSuggestion).toHaveBeenCalledWith(
                "s1",
                { release_year_end: { from: "1975", to: "1987" } },
                "JAH 1988 says 1987.",
                SEEN,
            ),
        );
        expect(onDone).toHaveBeenCalledWith("s1", expect.stringMatching(/^Approved as fixed/));
    });

    it("does not open the editor when someone else picked it up, and says who", async () => {
        desk.claimSuggestion.mockResolvedValue({
            success: false,
            error: "@Ridgeline is looking at this one until 4:05 PM.",
        });
        render(<QueueItemCard item={item()} role="moderator" onDone={onDone} />);
        fireEvent.click(screen.getByRole("button", { name: "Edit, then approve" }));
        expect((await screen.findByRole("alert")).textContent).toMatch(/@Ridgeline/);
        expect(screen.queryByLabelText(/^Last year/)).toBeNull();
    });

    it("lets go of the claim on Cancel", async () => {
        render(<QueueItemCard item={item()} role="moderator" onDone={onDone} />);
        fireEvent.click(screen.getByRole("button", { name: "Edit, then approve" }));
        fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
        await waitFor(() => expect(desk.releaseClaim).toHaveBeenCalledWith("s1"));
    });

    it("needs a reason of five letters or more to say no", async () => {
        render(<QueueItemCard item={item()} role="moderator" onDone={onDone} />);
        fireEvent.click(screen.getByRole("button", { name: /Say no, with a reason/ }));
        const send = screen.getByRole("button", { name: "Say no" }) as HTMLButtonElement;
        fireEvent.change(screen.getByLabelText(/the member reads it/), { target: { value: "no" } });
        expect(send.disabled).toBe(true);
        fireEvent.change(screen.getByLabelText(/the member reads it/), {
            target: { value: "The 1998 one is a different horse." },
        });
        expect(send.disabled).toBe(false);
        fireEvent.click(send);
        await waitFor(() =>
            expect(desk.rejectSuggestion).toHaveBeenCalledWith("s1", "The 1998 one is a different horse.", SEEN),
        );
    });

    it("never offers a moderator their own suggestion to decide", () => {
        render(<QueueItemCard item={item({ mine: true })} role="moderator" onDone={onDone} />);
        expect(screen.getByText("Your own suggestion: another moderator decides it.")).toBeTruthy();
        for (const name of ["Approve", "Edit, then approve", /Say no/]) {
            expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
        }
    });

    it("holds back while another moderator has it", () => {
        const until = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        render(
            <QueueItemCard
                item={item({ claim: { by: "@Ridgeline", mine: false, until } })}
                role="moderator"
                onDone={onDone}
            />,
        );
        expect(screen.getByTestId("claim-line").textContent).toMatch(/^@Ridgeline is looking at this one until/);
        expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("says a moderator's duplicate approval waits for a second look; the owner's does not", () => {
        const dup = item({
            tab: "duplicates",
            kind: "duplicate",
            kindLabel: "Duplicate",
            title: "Pinto Saddlebred",
            keep: { id: "r1", title: "Saddlebred" },
            canEdit: false,
            changes: [],
        });
        const { unmount } = render(<QueueItemCard item={dup} role="moderator" onDone={onDone} />);
        expect(screen.getByRole("button", { name: "Approve (needs a second look)" })).toBeTruthy();
        expect(screen.getByText("Merge “Pinto Saddlebred” into “Saddlebred”")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Edit, then approve" })).toBeNull();
        unmount();
        render(<QueueItemCard item={dup} role="owner" onDone={onDone} />);
        expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    });

    it("lets another moderator confirm a merge, never the one who asked", async () => {
        const look = item({ tab: "second_looks", kind: "merge", kindLabel: "Merge", changes: [], canEdit: false });
        const { unmount } = render(<QueueItemCard item={{ ...look, mine: true }} role="moderator" onDone={onDone} />);
        expect(screen.queryByRole("button", { name: "Confirm the merge" })).toBeNull();
        unmount();
        render(<QueueItemCard item={look} role="moderator" onDone={onDone} />);
        fireEvent.click(screen.getByRole("button", { name: "Confirm the merge" }));
        await waitFor(() => expect(desk.confirmMerge).toHaveBeenCalledWith("s1"));
    });

    it("puts a curator's applied change back, with a reason", async () => {
        suggestions.revertSuggestion.mockResolvedValue({ success: true });
        render(<QueueItemCard item={item({ tab: "auto_applied", canEdit: false })} role="moderator" onDone={onDone} />);
        fireEvent.click(screen.getByRole("button", { name: "Put it back ..." }));
        fireEvent.change(screen.getByLabelText(/the member reads it/), { target: { value: "Wrong year, see JAH." } });
        fireEvent.click(screen.getByRole("button", { name: "Put it back" }));
        await waitFor(() =>
            expect(suggestions.revertSuggestion).toHaveBeenCalledWith({
                suggestionId: "s1",
                reason: "Wrong year, see JAH.",
            }),
        );
    });

    it("lets the site owner decide their own suggestion, and says so", () => {
        render(<QueueItemCard item={item({ mine: true })} role="owner" onDone={onDone} />);
        expect(screen.getByText("Your own suggestion: as site owner you can decide it.")).toBeTruthy();
        for (const name of ["Approve", "Edit, then approve", /Say no/]) {
            expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(false);
        }
    });

    it("puts focus in the reason box when saying no, and in the first box when editing", async () => {
        render(<QueueItemCard item={item()} role="moderator" onDone={onDone} />);
        fireEvent.click(screen.getByRole("button", { name: /Say no, with a reason/ }));
        expect(document.activeElement).toBe(screen.getByLabelText(/the member reads it/));
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        fireEvent.click(screen.getByRole("button", { name: "Edit, then approve" }));
        const first = await screen.findByLabelText(/^Last year/);
        await waitFor(() => expect(document.activeElement).toBe(first));
    });

    it("moves “#5038” out of a new entry's name into an empty Model number box", async () => {
        const added = item({
            tab: "additions",
            kind: "addition",
            kindLabel: "New entry",
            title: "#5038 Morgan Mare",
            itemId: null,
            changes: [
                { key: "title", label: "Name", from: "", to: "#5038 Morgan Mare" },
                { key: "year", label: "First year", from: "", to: "1975" },
            ],
            fields: { title: "#5038 Morgan Mare", year: "1975", maker: "Breyer" },
            current: null,
        });
        render(<QueueItemCard item={added} role="moderator" onDone={onDone} />);
        fireEvent.click(screen.getByRole("button", { name: "Edit, then approve" }));
        fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: "Morgan Mare" } });
        const picker = screen.getByTestId("eta-add-field") as HTMLSelectElement;
        // The year is already there (as the new entry's own key), so it isn't offered twice.
        expect([...picker.options].map((o) => o.textContent)).not.toContain("First year");
        fireEvent.change(picker, { target: { value: "model_number" } });
        fireEvent.change(screen.getByLabelText(/^Model number/), { target: { value: "5038" } });
        fireEvent.click(screen.getByRole("button", { name: "Approve as fixed" }));
        await waitFor(() =>
            expect(desk.approveSuggestion).toHaveBeenCalledWith(
                "s1",
                { title: "Morgan Mare", year: "1975", maker: "Breyer", model_number: "5038" },
                null,
                { fieldChanges: added.fields, catalogItemId: null },
            ),
        );
    });

    it("adds a field the member didn't touch to a correction, starting from what the entry says", async () => {
        render(<QueueItemCard item={item()} role="moderator" onDone={onDone} />);
        fireEvent.click(screen.getByRole("button", { name: "Edit, then approve" }));
        fireEvent.change(await screen.findByTestId("eta-add-field"), { target: { value: "title" } });
        const name = screen.getByLabelText(/^Name/) as HTMLInputElement;
        expect(name.value).toBe("Saddlebred");
        fireEvent.change(name, { target: { value: "Saddlebred (G1)" } });
        fireEvent.click(screen.getByRole("button", { name: "Approve as fixed" }));
        await waitFor(() =>
            expect(desk.approveSuggestion).toHaveBeenCalledWith(
                "s1",
                {
                    release_year_end: { from: "1975", to: "1988" },
                    title: { from: "Saddlebred", to: "Saddlebred (G1)" },
                },
                null,
                SEEN,
            ),
        );
    });

    it("shows the values the Registry left out before moving on", async () => {
        desk.approveSuggestion.mockResolvedValue({
            success: true,
            status: "applied",
            dropped: [{ key: "run_type", value: "Store Special", error: "not a run type the Registry knows." }],
        });
        render(<QueueItemCard item={item()} role="moderator" onDone={onDone} />);
        fireEvent.click(screen.getByRole("button", { name: "Approve" }));
        const box = await screen.findByTestId("dropped");
        expect(box.textContent).toContain("Run type “Store Special”: not a run type the Registry knows.");
        expect(onDone).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Got it" }));
        expect(onDone).toHaveBeenCalledWith("s1", "Approved. @BayLeaf has been told.");
    });

    it("decides nothing when the member changed it meanwhile, and offers a reload", async () => {
        desk.approveSuggestion.mockResolvedValue({
            success: false,
            changed: true,
            error: "The member changed this suggestion while you were looking at it.",
        });
        render(<QueueItemCard item={item()} role="moderator" onDone={onDone} />);
        fireEvent.click(screen.getByRole("button", { name: "Approve" }));
        expect((await screen.findByRole("alert")).textContent).toMatch(/changed this suggestion/);
        expect(screen.getByRole("button", { name: "Reload the Queue" })).toBeTruthy();
        expect(onDone).not.toHaveBeenCalled();
    });

    it("words the time plainly", () => {
        const now = Date.parse("2026-10-16T12:00:00Z");
        expect(timeAgo("2026-10-16T11:48:00Z", now)).toBe("12 min ago");
        expect(timeAgo("2026-10-16T09:00:00Z", now)).toBe("3 h ago");
        expect(timeAgo("2026-10-15T12:00:00Z", now)).toBe("1 day ago");
    });
});
