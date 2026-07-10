// @vitest-environment jsdom
/**
 * Phase E1 — the entry gallery render contract. The blind rule is
 * server-side (a blind payload has null owner fields); these tests
 * pin the component's side of the bargain: a blind payload renders
 * NO owner text anywhere, and a revealed payload links the owners.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import ShowEntryGallery from "@/components/shows/ShowEntryGallery";
import type { GalleryEntry, ShowGalleryData } from "@/lib/shows/gallery";

vi.mock("next/link", () => ({
    default: ({
        children,
        href,
        ...props
    }: {
        children: React.ReactNode;
        href: string;
        [key: string]: unknown;
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

const actions = vi.hoisted(() => ({
    castVote: vi.fn().mockResolvedValue({ success: true }),
    removeVote: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/app/actions/shows-v2", () => actions);

function entry(overrides: Partial<GalleryEntry> = {}): GalleryEntry {
    return {
        id: "entry-1",
        horseName: "Dash of Cash",
        entryNumber: 12,
        photoUrl: "https://cdn.test/photo1.webp",
        ownerAlias: null,
        ownerId: null,
        voteCount: 3,
        viewerHasVoted: false,
        isOwn: false,
        place: null,
        ...overrides,
    };
}

function gallery(overrides: Partial<ShowGalleryData> = {}): ShowGalleryData {
    return {
        votingEnabled: true,
        votingOpen: true,
        revealed: false,
        resultsPublished: false,
        classes: [
            {
                classId: "class-1",
                className: "OF Quarter Horse",
                classNumber: "1",
                divisionName: "OF Plastic Halter",
                sectionName: "Stock",
                classStatus: "judging",
                entries: [entry()],
            },
        ],
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    actions.castVote.mockResolvedValue({ success: true });
    actions.removeVote.mockResolvedValue({ success: true });
});

describe("ShowEntryGallery — the blind rule (render side)", () => {
    it("renders NO owner text for a blind payload", () => {
        render(<ShowEntryGallery gallery={gallery()} authed />);

        // The entry is there: photo, horse name, leg-tag number.
        expect(screen.getByText("Dash of Cash")).toBeInTheDocument();
        expect(screen.getByText("#12")).toBeInTheDocument();
        // …but no owner line and no profile link at all.
        expect(screen.queryByTestId("gallery-owner")).not.toBeInTheDocument();
        expect(document.querySelector('a[href^="/profile/"]')).toBeNull();
        // The gallery announces the convention.
        expect(screen.getByText("Blind browsing")).toBeInTheDocument();
    });

    it("links the owner once the payload is revealed", () => {
        render(
            <ShowEntryGallery
                gallery={gallery({
                    revealed: true,
                    classes: [
                        {
                            ...gallery().classes[0],
                            entries: [entry({ ownerAlias: "pattycakes", ownerId: "owner-9" })],
                        },
                    ],
                })}
                authed
            />,
        );
        const owner = screen.getByTestId("gallery-owner");
        expect(owner).toHaveTextContent("@pattycakes");
        expect(owner).toHaveAttribute("href", "/profile/pattycakes");
        expect(screen.queryByText("Blind browsing")).not.toBeInTheDocument();
    });
});

describe("ShowEntryGallery — voting", () => {
    it("casts a vote from the heart button", async () => {
        render(<ShowEntryGallery gallery={gallery()} authed />);
        expect(screen.getByTestId("vote-count")).toHaveTextContent("3");

        fireEvent.click(screen.getByTestId("vote-button"));
        await waitFor(() =>
            expect(actions.castVote).toHaveBeenCalledWith({ entryId: "entry-1" }),
        );
        expect(actions.removeVote).not.toHaveBeenCalled();
    });

    it("un-votes when the viewer already voted", async () => {
        render(
            <ShowEntryGallery
                gallery={gallery({
                    classes: [
                        {
                            ...gallery().classes[0],
                            entries: [entry({ viewerHasVoted: true })],
                        },
                    ],
                })}
                authed
            />,
        );
        fireEvent.click(screen.getByTestId("vote-button"));
        await waitFor(() =>
            expect(actions.removeVote).toHaveBeenCalledWith({ entryId: "entry-1" }),
        );
    });

    it("disables the heart on your own entry", () => {
        render(
            <ShowEntryGallery
                gallery={gallery({
                    classes: [
                        { ...gallery().classes[0], entries: [entry({ isOwn: true })] },
                    ],
                })}
                authed
            />,
        );
        expect(screen.getByTestId("vote-button")).toBeDisabled();
    });

    it("disables the heart for anonymous viewers but still shows the count", () => {
        render(<ShowEntryGallery gallery={gallery()} authed={false} />);
        expect(screen.getByTestId("vote-button")).toBeDisabled();
        expect(screen.getByTestId("vote-count")).toHaveTextContent("3");
    });
});

describe("ShowEntryGallery — results view", () => {
    it("shows ribbons and the Results heading once published", () => {
        render(
            <ShowEntryGallery
                gallery={gallery({
                    votingOpen: false,
                    revealed: true,
                    resultsPublished: true,
                    classes: [
                        {
                            ...gallery().classes[0],
                            classStatus: "placed",
                            entries: [
                                entry({
                                    place: 1,
                                    ownerAlias: "pattycakes",
                                    ownerId: "owner-9",
                                }),
                            ],
                        },
                    ],
                })}
                authed
            />,
        );
        expect(screen.getByRole("heading", { name: "Results" })).toBeInTheDocument();
        expect(screen.getByTestId("ribbon-chip")).toHaveTextContent("1st");
    });
});
