// @vitest-environment jsdom
/**
 * Papers on the passport: framed scans open the lightbox, PDFs open in
 * a new tab, visitors get no controls, the owner gets file / edit /
 * hide / remove, and an empty folder is an invitation only to the owner.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import PapersSection from "@/components/passport/PapersSection";
import type { PaperView } from "@/app/actions/papers";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), refresh }),
}));

const actions = vi.hoisted(() => ({
    createPaper: vi.fn(),
    updatePaper: vi.fn(),
    deletePaper: vi.fn(),
}));
vi.mock("@/app/actions/papers", () => actions);

const lightbox = vi.hoisted(() => vi.fn());
vi.mock("@/components/PhotoLightbox", () => ({
    default: (props: { images: { url: string; label?: string }[]; initialIndex: number }) => {
        lightbox(props);
        return <div data-testid="lightbox">{props.images[props.initialIndex]?.label}</div>;
    },
}));

vi.mock("@/lib/supabase/client", () => ({
    createClient: () => ({
        auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
        storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    }),
}));

const HORSE = "22222222-2222-4222-8222-222222222222";
const PAPERS: PaperView[] = [
    {
        id: "p1",
        horseId: HORSE,
        kind: "breeding_certificate",
        title: "Breeding certificate — Winter Wonderland",
        issuedBy: "Starrfyre",
        issuedOn: "2014-03-01",
        notes: "Sire's page: https://www.starrfyre.com/rds/sdlist/hanoverians/winter_wonderland.htm",
        mime: "image/webp",
        url: "https://signed.example/p1.webp",
        byteSize: 240_000,
        isPublic: true,
        createdAt: "2026-09-19T00:00:00Z",
        showRecordId: null,
        accomplishmentId: null,
    },
    {
        id: "p2",
        horseId: HORSE,
        kind: "registration",
        title: "Registry papers",
        issuedBy: null,
        issuedOn: null,
        notes: null,
        mime: "application/pdf",
        url: "https://signed.example/p2.pdf",
        byteSize: 1_500_000,
        isPublic: false,
        createdAt: "2026-09-19T00:00:01Z",
    },
];

beforeEach(() => {
    vi.clearAllMocks();
    actions.updatePaper.mockResolvedValue({ success: true });
    actions.deletePaper.mockResolvedValue({ success: true });
});

describe("PapersSection", () => {
    it("renders nothing for a visitor when the folder is empty", () => {
        const { container } = render(<PapersSection horseId={HORSE} horseName="Winter Wonderland" papers={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("a visitor sees framed scans, a PDF plate, captions with clickable links — and no controls", () => {
        render(<PapersSection horseId={HORSE} horseName="Winter Wonderland" papers={PAPERS} />);
        expect(screen.getByText(/2 on file/)).toBeInTheDocument();
        expect(screen.getByText("Breeding certificate — Winter Wonderland")).toBeInTheDocument();
        expect(screen.getByText("Issued by Starrfyre · March 2014")).toBeInTheDocument();
        // The scan is a framed image that opens the lightbox.
        expect(screen.getByRole("img", { name: /Breeding certificate — Winter Wonderland/ })).toBeInTheDocument();
        // The PDF is a plate that opens in a new tab.
        const pdf = screen.getByRole("link", { name: /Open Registry papers \(PDF\)/ });
        expect(pdf).toHaveAttribute("href", "https://signed.example/p2.pdf");
        expect(pdf).toHaveAttribute("target", "_blank");
        // The note's URL is a real link.
        expect(screen.getByRole("link", { name: /starrfyre\.com/ })).toHaveAttribute(
            "href",
            "https://www.starrfyre.com/rds/sdlist/hanoverians/winter_wonderland.htm",
        );
        expect(screen.queryByRole("button", { name: /File a paper/ })).toBeNull();
        expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    });

    it("opens the lightbox on the scan, with only image papers in the reel", () => {
        render(<PapersSection horseId={HORSE} horseName="Winter Wonderland" papers={PAPERS} />);
        fireEvent.click(screen.getByRole("button", { name: /View Breeding certificate — Winter Wonderland full size/ }));
        expect(screen.getByTestId("lightbox")).toHaveTextContent("Breeding certificate — Winter Wonderland");
        expect(lightbox).toHaveBeenCalledWith(
            expect.objectContaining({ images: [{ url: "https://signed.example/p1.webp", label: "Breeding certificate — Winter Wonderland" }], initialIndex: 0 }),
        );
    });

    it("the owner gets the invitation on an empty folder, and controls on a full one", async () => {
        const { rerender } = render(<PapersSection horseId={HORSE} horseName="Winter Wonderland" papers={[]} isOwner />);
        expect(screen.getByText(/No papers filed yet/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /File a paper/ })).toBeInTheDocument();

        rerender(<PapersSection horseId={HORSE} horseName="Winter Wonderland" papers={PAPERS} isOwner />);
        expect(screen.getByText(/only you/)).toBeInTheDocument(); // the private PDF is marked
        fireEvent.click(screen.getAllByRole("button", { name: /Show on passport/ })[0]);
        await waitFor(() => expect(actions.updatePaper).toHaveBeenCalledWith({ paperId: "p2", isPublic: true }));
        expect(refresh).toHaveBeenCalled();
    });

    it("removing a paper asks first", async () => {
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
        render(<PapersSection horseId={HORSE} horseName="Winter Wonderland" papers={PAPERS} isOwner />);
        fireEvent.click(screen.getAllByRole("button", { name: /Remove/ })[0]);
        expect(actions.deletePaper).not.toHaveBeenCalled();
        confirmSpy.mockReturnValue(true);
        fireEvent.click(screen.getAllByRole("button", { name: /Remove/ })[0]);
        await waitFor(() => expect(actions.deletePaper).toHaveBeenCalledWith("p1"));
        confirmSpy.mockRestore();
    });

    it("the filing dialog refuses to file without a file, and names the problem", async () => {
        render(<PapersSection horseId={HORSE} horseName="Winter Wonderland" papers={[]} isOwner />);
        fireEvent.click(screen.getByRole("button", { name: /File a paper/ }));
        expect(await screen.findByText("File a paper")).toBeInTheDocument();
        fireEvent.change(screen.getByPlaceholderText(/Breeding certificate — Winter Wonderland/), {
            target: { value: "Her certificate" },
        });
        fireEvent.click(screen.getByRole("button", { name: "File it" }));
        expect(await screen.findByRole("alert")).toHaveTextContent(/Choose the scan, photo or PDF first/);
        expect(actions.createPaper).not.toHaveBeenCalled();
    });
});
