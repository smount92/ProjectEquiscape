// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HoofprintTimeline from "../HoofprintTimeline";

// Mock server actions
vi.mock("@/app/actions/hoofprint", () => ({
    addTimelineEvent: vi.fn().mockResolvedValue({ success: true }),
    deleteTimelineEvent: vi.fn().mockResolvedValue({ success: true }),
    updateLifeStage: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock next/link
vi.mock("next/link", () => ({
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const mockTimeline = [
    {
        id: "event-1",
        eventType: "acquired",
        title: "Acquired from breyer.com",
        description: "Purchased during Black Friday sale",
        eventDate: "2026-01-15T00:00:00Z",
        isPublic: true,
        userId: "user-1",
        userAlias: "TestCollector",
        sourceTable: "posts",
        metadata: {},
        createdAt: "2026-01-15T00:00:00Z",
    },
    {
        id: "event-2",
        eventType: "show_result",
        title: "1st in Collectibility",
        description: null,
        eventDate: "2026-02-10T00:00:00Z",
        isPublic: true,
        userId: "user-1",
        userAlias: "TestCollector",
        sourceTable: "show_records",
        metadata: {},
        createdAt: "2026-02-10T00:00:00Z",
    },
    {
        id: "event-3",
        eventType: "note",
        title: "Private restoration note",
        description: "Minor touch-up on left ear",
        eventDate: "2026-03-01T00:00:00Z",
        isPublic: false,
        userId: "user-1",
        userAlias: "TestCollector",
        sourceTable: "posts",
        metadata: {},
        createdAt: "2026-03-01T00:00:00Z",
    },
];

const mockOwnershipChain = [
    {
        id: "own-1",
        ownerId: "user-0",
        ownerAlias: "OriginalOwner",
        acquisitionType: "original",
        acquiredAt: "2025-06-01T00:00:00Z",
        releasedAt: "2026-01-15T00:00:00Z",
        salePrice: null,
        isPricePublic: false,
        notes: null,
    },
    {
        id: "own-2",
        ownerId: "user-1",
        ownerAlias: "TestCollector",
        acquisitionType: "purchase",
        acquiredAt: "2026-01-15T00:00:00Z",
        releasedAt: null,
        salePrice: 75,
        isPricePublic: true,
        notes: null,
    },
];

const defaultProps = {
    horseId: "horse-1",
    timeline: mockTimeline,
    ownershipChain: mockOwnershipChain,
    lifeStage: "completed",
    isOwner: true,
    currentUserId: "user-1",
};

describe("HoofprintTimeline", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders the Hoofprint™ header", () => {
        render(<HoofprintTimeline {...defaultProps} />);

        expect(screen.getByText("Hoofprint™")).toBeInTheDocument();
    });

    it("displays the life stage badge", () => {
        const { container } = render(<HoofprintTimeline {...defaultProps} />);

        const badge = container.querySelector(".hoofprint-stage-badge");
        expect(badge).toBeInTheDocument();
        expect(badge?.textContent).toContain("Completed");
    });

    it("renders ownership chain with links", () => {
        render(<HoofprintTimeline {...defaultProps} />);

        expect(screen.getByText("Chain of Custody:")).toBeInTheDocument();
        expect(screen.getByText("@OriginalOwner")).toBeInTheDocument();
        expect(screen.getByText("@TestCollector")).toBeInTheDocument();
    });

    it("renders all timeline events", () => {
        render(<HoofprintTimeline {...defaultProps} />);

        expect(screen.getByText("Acquired from breyer.com")).toBeInTheDocument();
        expect(screen.getByText("1st in Collectibility")).toBeInTheDocument();
        expect(screen.getByText("Private restoration note")).toBeInTheDocument();
    });

    it("shows private indicator for non-public events", () => {
        render(<HoofprintTimeline {...defaultProps} />);

        expect(screen.getByText("🔒 Private")).toBeInTheDocument();
    });

    it("shows Add Note button for owner", () => {
        render(<HoofprintTimeline {...defaultProps} />);

        expect(screen.getByText("📝 Add Note")).toBeInTheDocument();
    });

    it("hides Add Note button for non-owners", () => {
        render(<HoofprintTimeline {...defaultProps} isOwner={false} />);

        expect(screen.queryByText("📝 Add Note")).not.toBeInTheDocument();
    });

    it("toggles add event form on button click", async () => {
        const user = userEvent.setup();
        render(<HoofprintTimeline {...defaultProps} />);

        await user.click(screen.getByText("📝 Add Note"));

        expect(screen.getByPlaceholderText(/Won 1st at Breyerfest/)).toBeInTheDocument();
        expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("shows delete button only for user-authored 'posts' notes", () => {
        const { container } = render(<HoofprintTimeline {...defaultProps} />);

        // event-1 (sourceTable=posts, same user) — should have delete
        // event-2 (sourceTable=show_records) — should NOT have delete
        const deleteButtons = container.querySelectorAll("[title='Delete note']");
        expect(deleteButtons.length).toBe(2); // event-1 and event-3 are both posts
    });

    it("shows empty state when no timeline events", () => {
        render(<HoofprintTimeline {...defaultProps} timeline={[]} ownershipChain={[]} />);

        expect(screen.getByText("🐾 No timeline events yet.")).toBeInTheDocument();
    });

    it("shows life stage selector for owner", () => {
        render(<HoofprintTimeline {...defaultProps} />);

        const selector = screen.getByDisplayValue("✅ Completed");
        expect(selector).toBeInTheDocument();
    });

    it("shows event descriptions when present", () => {
        render(<HoofprintTimeline {...defaultProps} />);

        expect(screen.getByText("Purchased during Black Friday sale")).toBeInTheDocument();
        expect(screen.getByText("Minor touch-up on left ear")).toBeInTheDocument();
    });

    it("renders ownership chain arrows between owners", () => {
        render(<HoofprintTimeline {...defaultProps} />);

        expect(screen.getByText("→")).toBeInTheDocument();
    });
});
