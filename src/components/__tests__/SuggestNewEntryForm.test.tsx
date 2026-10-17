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
        fireEvent.change(screen.getByLabelText(/reason|why/i), {
            target: { value: "Missing mold from the 1960s line." },
        });
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

describe("SuggestNewEntryForm — a model number typed into the title (MHH-079)", () => {
    beforeEach(() => {
        createSuggestion.mockReset();
        createSuggestion.mockResolvedValue({ success: true });
    });

    const fill = (title: string, model: string) => {
        render(<SuggestNewEntryForm />);
        fireEvent.change(screen.getByLabelText(/title \/ name/i), { target: { value: title } });
        fireEvent.change(screen.getByLabelText(/model number/i), { target: { value: model } });
        fireEvent.change(screen.getByLabelText(/reason|why/i), { target: { value: "Missing release on this mold." } });
        fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    };

    it("takes the number off the title when the box already holds it", async () => {
        fill("#5038 Silky Sullivan", "5038");
        await waitFor(() => expect(createSuggestion).toHaveBeenCalled());
        const input = createSuggestion.mock.calls[0][0] as { fieldChanges: Record<string, unknown> };
        expect(input.fieldChanges.title).toBe("Silky Sullivan");
        expect(input.fieldChanges.model_number).toBe("5038");
    });

    it("asks which number is right when they disagree, then sends the one picked", async () => {
        fill("#5038 Silky Sullivan", "5039");
        const ask = await screen.findByTestId("new-entry-number-conflict");
        expect(ask.textContent).toMatch(/#5038.*5039/);
        expect(createSuggestion).not.toHaveBeenCalled();
        fireEvent.click(within(ask).getByRole("button", { name: "It's #5039" }));
        await waitFor(() => expect(createSuggestion).toHaveBeenCalled());
        const input = createSuggestion.mock.calls[0][0] as { fieldChanges: Record<string, unknown> };
        expect(input.fieldChanges.title).toBe("Silky Sullivan");
        expect(input.fieldChanges.model_number).toBe("5039");
    });

    it("asks whether a bare number in front of the name is the model number, and keeps it in the name on No", async () => {
        fill("101 Dalmatians", "");
        const ask = await screen.findByTestId("new-entry-number-conflict");
        expect(ask.textContent).toMatch(/starts with 101.*model number\?/);
        expect(createSuggestion).not.toHaveBeenCalled();
        fireEvent.click(within(ask).getByRole("button", { name: /part of the name/i }));
        await waitFor(() => expect(createSuggestion).toHaveBeenCalled());
        const input = createSuggestion.mock.calls[0][0] as { fieldChanges: Record<string, unknown> };
        expect(input.fieldChanges.title).toBe("101 Dalmatians");
        expect(input.fieldChanges.model_number).toBeUndefined();
    });

    it("moves a bare number into the box when the member says it is the model number", async () => {
        fill("5038 Silky Sullivan", "");
        const ask = await screen.findByTestId("new-entry-number-conflict");
        fireEvent.click(within(ask).getByRole("button", { name: "It's #5038" }));
        await waitFor(() => expect(createSuggestion).toHaveBeenCalled());
        const input = createSuggestion.mock.calls[0][0] as { fieldChanges: Record<string, unknown> };
        expect(input.fieldChanges.title).toBe("Silky Sullivan");
        expect(input.fieldChanges.model_number).toBe("5038");
    });
});

describe("SuggestNewEntryForm — a release's last year (MHH-077)", () => {
    beforeEach(() => {
        createSuggestion.mockReset();
        createSuggestion.mockResolvedValue({ success: true });
    });

    const fill = (first: string, last: string) => {
        render(<SuggestNewEntryForm />);
        fireEvent.change(screen.getByLabelText(/title \/ name/i), { target: { value: "Pinto Saddlebred" } });
        fireEvent.change(screen.getByLabelText(/first year/i), { target: { value: first } });
        fireEvent.change(screen.getByLabelText(/last year/i), { target: { value: last } });
        fireEvent.change(screen.getByLabelText(/reason|why/i), { target: { value: "Missing release on this mold." } });
        fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    };

    it("sends the first and the last year", async () => {
        fill("1995", "1997");
        await waitFor(() => expect(createSuggestion).toHaveBeenCalled());
        const input = createSuggestion.mock.calls[0][0] as { fieldChanges: Record<string, unknown> };
        expect(input.fieldChanges.year).toBe(1995);
        expect(input.fieldChanges.year_end).toBe(1997);
    });

    it("says so when the last year is before the first, and sends nothing", async () => {
        fill("1997", "1995");
        expect(await screen.findByText(/before the first/i)).toBeInTheDocument();
        expect(createSuggestion).not.toHaveBeenCalled();
    });
});
