// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const createSuggestion = vi.fn();
vi.mock("@/app/actions/catalog-suggestions", () => ({
    createSuggestion: (...args: unknown[]) => createSuggestion(...args),
}));
const pickMold = vi.fn();
vi.mock("@/app/actions/linker", () => ({
    pickMold: (...args: unknown[]) => pickMold(...args),
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

describe("SuggestNewEntryForm — releases are filed under a picked mold", () => {
    beforeEach(() => {
        createSuggestion.mockReset();
        createSuggestion.mockResolvedValue({ success: true });
        pickMold.mockReset();
        pickMold.mockResolvedValue([
            { id: "mold-1", title: "Justin Morgan", maker: "Breyer", scale: "Traditional (1:9)" },
        ]);
    });

    it("sends the picked mold's id with the suggestion", async () => {
        render(<SuggestNewEntryForm />);
        fireEvent.change(screen.getByLabelText(/title \/ name/i), { target: { value: "Montana Harvest" } });
        fireEvent.change(screen.getByLabelText(/belongs to mold/i), { target: { value: "justin" } });
        fireEvent.mouseDown(await screen.findByRole("option", { name: /justin morgan/i }, { timeout: 2000 }));
        expect(screen.getByText(/linked to this mold/i)).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(/reason|why/i), { target: { value: "Missing release on this mold." } });
        fireEvent.click(screen.getByRole("button", { name: /submit/i }));
        await waitFor(() => expect(createSuggestion).toHaveBeenCalled());
        const input = createSuggestion.mock.calls[0][0] as { fieldChanges: Record<string, unknown> };
        expect(input.fieldChanges.parent_catalog_id).toBe("mold-1");
        expect(input.fieldChanges.mold_name).toBe("Justin Morgan");
    });

    it("moves a model number typed at the front of the title into its own field", async () => {
        render(<SuggestNewEntryForm />);
        fireEvent.change(screen.getByLabelText(/title \/ name/i), { target: { value: "#1838 Montana Harvest" } });
        fireEvent.change(screen.getByLabelText(/reason|why/i), { target: { value: "Missing release on this mold." } });
        fireEvent.click(screen.getByRole("button", { name: /submit/i }));
        await waitFor(() => expect(createSuggestion).toHaveBeenCalled());
        const input = createSuggestion.mock.calls[0][0] as { fieldChanges: Record<string, unknown> };
        expect(input.fieldChanges.title).toBe("Montana Harvest");
        expect(input.fieldChanges.model_number).toBe("1838");
        expect(input.fieldChanges.parent_catalog_id).toBeUndefined();
    });
});

describe("SuggestNewEntryForm — the mold picker behaves like a proper list", () => {
    beforeEach(() => {
        createSuggestion.mockReset();
        createSuggestion.mockResolvedValue({ success: true });
        pickMold.mockReset();
        pickMold.mockResolvedValue([
            { id: "mold-1", title: "Justin Morgan", maker: "Breyer", scale: "Traditional (1:9)" },
            { id: "mold-2", title: "Justin Morgan (G2)", maker: "Breyer", scale: "Stablemate (1:32)" },
        ]);
    });

    it("picks with the arrow keys and Enter", async () => {
        render(<SuggestNewEntryForm />);
        const box = screen.getByLabelText(/belongs to mold/i);
        fireEvent.change(box, { target: { value: "justin" } });
        await screen.findByRole("listbox", {}, { timeout: 2000 });
        fireEvent.keyDown(box, { key: "ArrowDown" });
        fireEvent.keyDown(box, { key: "ArrowDown" });
        fireEvent.keyDown(box, { key: "Enter" });
        expect(screen.getByText(/linked to this mold/i)).toBeInTheDocument();
        expect((box as HTMLInputElement).value).toBe("Justin Morgan (G2)");
    });

    it("unlinks the picked mold when the scale changes", async () => {
        render(<SuggestNewEntryForm />);
        fireEvent.change(screen.getByLabelText(/belongs to mold/i), { target: { value: "justin" } });
        const list = await screen.findByRole("listbox", {}, { timeout: 2000 });
        fireEvent.mouseDown(within(list).getAllByRole("option")[0]);
        expect(screen.getByText(/linked to this mold/i)).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(/^scale/i), { target: { value: "Stablemate (1:32)" } });
        expect(screen.queryByText(/linked to this mold/i)).not.toBeInTheDocument();
    });
});
