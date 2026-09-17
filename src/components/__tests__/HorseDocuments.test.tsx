// @vitest-environment jsdom
/**
 * Documentation on the passport: public readers get the folds with
 * clickable references; the owner adds / edits / deletes in place.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import HorseDocuments from "@/components/passport/HorseDocuments";
import type { HorseDocumentView } from "@/lib/shows/documents";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), refresh }),
}));

const v4 = vi.hoisted(() => ({
    createHorseDocument: vi.fn(),
    updateHorseDocument: vi.fn(),
    deleteHorseDocument: vi.fn(),
}));
vi.mock("@/app/actions/shows-v4", () => v4);

const HORSE_ID = "11111111-1111-4111-8111-111111111111";
const DOCS: HorseDocumentView[] = [
    {
        id: "d1",
        kind: "breed",
        title: "AQHA standard",
        bodyMd: "Stock type per https://www.aqha.com/standard — short back, deep hip.",
        updatedAt: "2026-09-16T00:00:00Z",
    },
];

beforeEach(() => {
    vi.clearAllMocks();
    v4.createHorseDocument.mockResolvedValue({ success: true, documentId: "d2" });
    v4.updateHorseDocument.mockResolvedValue({ success: true });
    v4.deleteHorseDocument.mockResolvedValue({ success: true });
});

describe("HorseDocuments", () => {
    it("renders nothing for a public reader when there is nothing to read", () => {
        const { container } = render(<HorseDocuments horseId={HORSE_ID} documents={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("public readers get the kind, the title and a clickable reference", () => {
        render(<HorseDocuments horseId={HORSE_ID} documents={DOCS} />);
        expect(screen.getByText(/breed documentation: AQHA standard/i)).toBeInTheDocument();
        const link = screen.getByRole("link", { name: /aqha\.com/i });
        expect(link).toHaveAttribute("href", "https://www.aqha.com/standard");
        expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
        // No owner chrome for a reader.
        expect(screen.queryByRole("button", { name: /add documentation/i })).toBeNull();
        expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
    });

    it("the owner adds a document in place and the page refreshes", async () => {
        render(<HorseDocuments horseId={HORSE_ID} documents={[]} isOwner />);
        expect(screen.getByText(/no documentation yet/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /add documentation/i }));
        fireEvent.click(screen.getByRole("radio", { name: "Performance" }));
        fireEvent.change(screen.getByLabelText("Documentation title"), {
            target: { value: "Reining references" },
        });
        fireEvent.change(screen.getByLabelText("Documentation body"), {
            target: { value: "Pattern 7: https://example.org/pattern-7" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() => expect(refresh).toHaveBeenCalled());
        expect(v4.createHorseDocument).toHaveBeenCalledWith({
            horseId: HORSE_ID,
            kind: "performance",
            title: "Reining references",
            bodyMd: "Pattern 7: https://example.org/pattern-7",
        });
        expect(screen.queryByTestId("document-form")).toBeNull();
    });

    it("refuses to save an empty form and surfaces server errors", async () => {
        v4.createHorseDocument.mockResolvedValue({ success: false, error: "RLS says no." });
        render(<HorseDocuments horseId={HORSE_ID} documents={[]} isOwner />);
        fireEvent.click(screen.getByRole("button", { name: /add documentation/i }));
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        expect(await screen.findByRole("alert")).toHaveTextContent(/title and a body/i);
        expect(v4.createHorseDocument).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText("Documentation title"), {
            target: { value: "T" },
        });
        fireEvent.change(screen.getByLabelText("Documentation body"), {
            target: { value: "B" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("RLS says no."));
        expect(refresh).not.toHaveBeenCalled();
    });

    it("the owner edits an existing document with its values prefilled", async () => {
        render(<HorseDocuments horseId={HORSE_ID} documents={DOCS} isOwner />);
        fireEvent.click(screen.getByRole("button", { name: "Edit" }));
        expect(screen.getByLabelText("Documentation title")).toHaveValue("AQHA standard");
        expect(screen.getByRole("radio", { name: "Breed" })).toHaveAttribute(
            "aria-checked",
            "true",
        );
        fireEvent.change(screen.getByLabelText("Documentation title"), {
            target: { value: "AQHA breed standard" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        await waitFor(() => expect(refresh).toHaveBeenCalled());
        expect(v4.updateHorseDocument).toHaveBeenCalledWith({
            documentId: "d1",
            kind: "breed",
            title: "AQHA breed standard",
            bodyMd: DOCS[0].bodyMd,
        });
    });

    it("delete asks first, then removes and refreshes", async () => {
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
        render(<HorseDocuments horseId={HORSE_ID} documents={DOCS} isOwner />);
        fireEvent.click(screen.getByRole("button", { name: "Delete" }));
        expect(v4.deleteHorseDocument).not.toHaveBeenCalled();

        confirmSpy.mockReturnValue(true);
        fireEvent.click(screen.getByRole("button", { name: "Delete" }));
        await waitFor(() => expect(refresh).toHaveBeenCalled());
        expect(v4.deleteHorseDocument).toHaveBeenCalledWith({ documentId: "d1" });
        confirmSpy.mockRestore();
    });
});
