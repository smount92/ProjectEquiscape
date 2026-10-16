// @vitest-environment jsdom
/**
 * MHH-076. The duplicate picker showed 8 rows from a thin search, so the
 * duplicate never appeared and Send looked dead.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import ReportDuplicateModal, { pickDetail, sendBlocker } from "@/components/ReportDuplicateModal";
import type { RegistryPick } from "@/app/actions/reference";

const reference = vi.hoisted(() => ({ findRegistryEntries: vi.fn() }));
vi.mock("@/app/actions/reference", () => reference);
const suggestions = vi.hoisted(() => ({ createSuggestion: vi.fn() }));
vi.mock("@/app/actions/catalog-suggestions", () => suggestions);
vi.mock("@/lib/context/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));

function pick(over: Partial<RegistryPick> & { id: string; title: string }): RegistryPick {
    return {
        maker: "Breyer",
        scale: "Stablemate (1:32)",
        itemType: "plastic_release",
        modelNumber: null,
        years: null,
        colour: null,
        moldTitle: null,
        sameMold: false,
        ...over,
    };
}

const PINTO = pick({
    id: "fe8b2e60",
    title: "Pinto Saddlebred",
    modelNumber: "5002",
    years: "1998",
    colour: "light chestnut pinto",
    moldTitle: "Saddlebred",
});
const MANY = Array.from({ length: 24 }, (_, i) => pick({ id: `r${i}`, title: `Saddlebred ${i}` }));

beforeEach(() => {
    vi.clearAllMocks();
    reference.findRegistryEntries.mockImplementation(async (term: string) =>
        term ? { picks: [...MANY, PINTO], more: true } : { picks: [], more: false },
    );
    suggestions.createSuggestion.mockResolvedValue({ success: true });
});

describe("ReportDuplicateModal", () => {
    it("tells look-alikes apart by number, years, colour and mold", () => {
        expect(pickDetail(PINTO)).toBe("#5002 · 1998 · light chestnut pinto · on Saddlebred");
        expect(pickDetail(pick({ id: "m", title: "Saddlebred", itemType: "plastic_mold" }))).toBe("mold");
        expect(sendBlocker(null, "")).toBe("Pick the entry to keep first");
        expect(sendBlocker(PINTO, "short")).toBe("Say how you can tell (10+ characters)");
        expect(sendBlocker(PINTO, "Same number #5002, same mold.")).toBeNull();
    });

    it("finds Pinto Saddlebred #5002 from 'Black and White Saddlebred', among up to 25, and sends", async () => {
        render(
            <ReportDuplicateModal
                catalogItem={{ id: "fb01b5ea", title: "#5904 Black and White Saddlebred", maker: "Breyer" }}
                openOnMount
            />,
        );
        const send = screen.getByRole("button", { name: "Pick the entry to keep first" });
        expect((send as HTMLButtonElement).disabled).toBe(true);
        fireEvent.change(screen.getByPlaceholderText("Search by name or model number…"), {
            target: { value: "Black and White Saddlebred" },
        });
        await waitFor(
            () => expect(reference.findRegistryEntries).toHaveBeenCalledWith("Black and White Saddlebred", "fb01b5ea"),
            { timeout: 2000 },
        );
        const list = await screen.findByTestId("report-duplicate-results");
        await waitFor(() => expect(within(list).getAllByTestId("report-duplicate-pick")).toHaveLength(25));
        expect(list.className).toContain("overflow-y-auto");
        const row = within(list).getByText("Pinto Saddlebred").closest("button") as HTMLButtonElement;
        expect(row.textContent).toContain("#5002 · 1998 · light chestnut pinto · on Saddlebred");
        expect(screen.getByText(/Showing the first 25/)).toBeTruthy();
        fireEvent.click(row);
        expect(screen.getByTestId("report-duplicate-keep").textContent).toContain("Pinto Saddlebred");
        expect(screen.getByRole("button", { name: "Say how you can tell (10+ characters)" })).toBeTruthy();
        fireEvent.change(screen.getByPlaceholderText(/Same mold, same model number/), {
            target: { value: "Same model number, both are the pinto on the Saddlebred mold." },
        });
        fireEvent.click(screen.getByRole("button", { name: "Send report" }));
        await waitFor(() =>
            expect(suggestions.createSuggestion).toHaveBeenCalledWith(
                expect.objectContaining({
                    catalogItemId: "fb01b5ea",
                    fieldChanges: { duplicate_of: "fe8b2e60", duplicate_of_title: "Pinto Saddlebred" },
                }),
            ),
        );
    });

    it("offers the other entries on the same mold before anything is typed", async () => {
        reference.findRegistryEntries.mockResolvedValue({
            picks: [pick({ id: "m", title: "Saddlebred", itemType: "plastic_mold", sameMold: true }), PINTO],
            more: false,
        });
        render(<ReportDuplicateModal catalogItem={{ id: "x", title: "Saddlebred", maker: "Breyer" }} openOnMount />);
        await waitFor(() => expect(reference.findRegistryEntries).toHaveBeenCalledWith("", "x"));
        expect(await screen.findByText("On the same mold")).toBeTruthy();
        expect(screen.getAllByTestId("report-duplicate-pick")).toHaveLength(2);
    });
});
