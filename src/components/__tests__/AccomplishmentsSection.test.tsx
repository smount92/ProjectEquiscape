// @vitest-environment jsdom
/**
 * Other accomplishments (214): visitors see the ledger and nothing
 * when it is empty; the owner gets an add form that refuses a blank
 * title, saves through the action, and can attach a paper to a row.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import AccomplishmentsSection from "@/components/passport/AccomplishmentsSection";
import type { AccomplishmentView } from "@/app/actions/accomplishments";
import type { PaperView } from "@/app/actions/papers";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), refresh }),
}));

const actions = vi.hoisted(() => ({
    createAccomplishment: vi.fn(),
    updateAccomplishment: vi.fn(),
    deleteAccomplishment: vi.fn(),
}));
vi.mock("@/app/actions/accomplishments", () => actions);

vi.mock("@/components/PhotoLightbox", () => ({
    default: () => <div data-testid="lightbox" />,
}));
vi.mock("@/lib/supabase/client", () => ({
    createClient: () => ({
        auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
        storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    }),
}));

const HORSE = "22222222-2222-4222-8222-222222222222";
const ITEMS: AccomplishmentView[] = [
    {
        id: "a1",
        horseId: HORSE,
        kind: "racing",
        organization: "Express",
        title: "Autumn Classic (6 furlongs)",
        result: "2nd of 9",
        happenedOn: "2024-05-18",
        dateText: null,
        detail: "Chart at https://example.org/charts/autumn-classic",
        linkUrl: "https://example.org/results",
        isPublic: true,
        createdAt: "2026-09-19T00:00:00Z",
    },
    {
        id: "a2",
        horseId: HORSE,
        kind: "award",
        organization: "FTRA",
        title: "Year-end high point",
        result: null,
        happenedOn: null,
        dateText: "2023 season",
        detail: null,
        linkUrl: null,
        isPublic: false,
        createdAt: "2026-09-19T00:00:00Z",
    },
];
const PAPERS: PaperView[] = [
    {
        id: "p9",
        horseId: HORSE,
        kind: "award",
        title: "Race chart",
        issuedBy: null,
        issuedOn: null,
        notes: null,
        mime: "image/webp",
        url: "https://signed.example/p9.webp",
        byteSize: 1000,
        isPublic: true,
        createdAt: "2026-09-19T00:00:00Z",
        showRecordId: null,
        accomplishmentId: "a1",
    },
];

beforeEach(() => {
    vi.clearAllMocks();
});

describe("AccomplishmentsSection", () => {
    it("renders nothing for a visitor when the ledger is empty", () => {
        const { container } = render(<AccomplishmentsSection horseId={HORSE} horseName="Brooksong" items={[]} isOwner={false} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("shows the ledger with live links and attached papers, no controls for a visitor", () => {
        render(<AccomplishmentsSection horseId={HORSE} horseName="Brooksong" items={ITEMS} papers={PAPERS} isOwner={false} />);
        expect(screen.getByText("Autumn Classic (6 furlongs)")).toBeInTheDocument();
        expect(screen.getByText("Express · 2nd of 9 · May 18, 2024")).toBeInTheDocument();
        // A link typed into the detail is clickable.
        const chart = screen.getByRole("link", { name: /example.org\/charts/ });
        expect(chart).toHaveAttribute("href", "https://example.org/charts/autumn-classic");
        // The outbound link shows its host.
        expect(screen.getByRole("link", { name: /example.org ↗/ })).toHaveAttribute("href", "https://example.org/results");
        // The race chart is framed under its row.
        expect(screen.getByTestId("paper-thumbs")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Attach/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "+ Add" })).not.toBeInTheDocument();
    });

    it("owner: the add form saves through the action and refreshes", async () => {
        actions.createAccomplishment.mockResolvedValue({ success: true, id: "a3" });
        render(<AccomplishmentsSection horseId={HORSE} horseName="Brooksong" items={[]} isOwner />);
        fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
        fireEvent.click(screen.getByRole("radio", { name: /Award/ }));
        fireEvent.change(screen.getByLabelText("Organization"), { target: { value: "FTRA" } });
        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Year-end high point" } });
        fireEvent.change(screen.getByLabelText("When"), { target: { value: "2023 season" } });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        await waitFor(() => expect(actions.createAccomplishment).toHaveBeenCalledTimes(1));
        expect(actions.createAccomplishment.mock.calls[0][0]).toMatchObject({
            horseId: HORSE,
            kind: "award",
            organization: "FTRA",
            title: "Year-end high point",
            when: "2023 season",
            isPublic: true,
        });
        await waitFor(() => expect(refresh).toHaveBeenCalled());
    });

    it("owner: a refused save shows the action's reason", async () => {
        actions.createAccomplishment.mockResolvedValue({ success: false, error: "Give it a title." });
        render(<AccomplishmentsSection horseId={HORSE} horseName="Brooksong" items={[]} isOwner />);
        fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Give it a title.");
        expect(refresh).not.toHaveBeenCalled();
    });

    it("owner: attach opens the paper dialog aimed at that row", () => {
        render(<AccomplishmentsSection horseId={HORSE} horseName="Brooksong" items={ITEMS} isOwner />);
        expect(screen.getByText(/only you/)).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole("button", { name: /Attach a paper/ })[0]);
        expect(screen.getByRole("heading", { name: /Attach a paper/ })).toBeInTheDocument();
        expect(screen.getByText(/passport with Autumn Classic \(6 furlongs\)/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Attach it" })).toBeInTheDocument();
    });
});
