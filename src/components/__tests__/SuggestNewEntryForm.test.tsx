// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const createSuggestion = vi.fn();
vi.mock("@/app/actions/catalog-suggestions", () => ({
    createSuggestion: (...args: unknown[]) => createSuggestion(...args),
}));
vi.mock("@/lib/context/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import SuggestNewEntryForm from "@/components/SuggestNewEntryForm";

describe("SuggestNewEntryForm — a mold is asked for its name once", () => {
    beforeEach(() => {
        createSuggestion.mockReset();
        createSuggestion.mockResolvedValue({ success: true });
    });

    it("relabels the title and hides the separate Mold field when the type is Mold", () => {
        render(<SuggestNewEntryForm />);
        expect(screen.getByLabelText(/title \/ name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/belongs to mold/i)).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText(/entry type/i), { target: { value: "plastic_mold" } });
        expect(screen.getByLabelText(/^mold name/i)).toBeInTheDocument();
        expect(screen.queryByLabelText(/belongs to mold/i)).not.toBeInTheDocument();
    });

    it("submits the mold name into both title and mold_name", async () => {
        render(<SuggestNewEntryForm />);
        fireEvent.change(screen.getByLabelText(/entry type/i), { target: { value: "plastic_mold" } });
        fireEvent.change(screen.getByLabelText(/^mold name/i), { target: { value: "Family Arabian Stallion" } });
        fireEvent.change(screen.getByLabelText(/reason|why/i), { target: { value: "Missing mold from the 1960s line." } });
        fireEvent.click(screen.getByRole("button", { name: /submit/i }));
        await waitFor(() => expect(createSuggestion).toHaveBeenCalled());
        const input = createSuggestion.mock.calls[0][0] as { fieldChanges: Record<string, unknown> };
        expect(input.fieldChanges.title).toBe("Family Arabian Stallion");
        expect(input.fieldChanges.mold_name).toBe("Family Arabian Stallion");
        expect(input.fieldChanges.item_type).toBe("plastic_mold");
    });
});
