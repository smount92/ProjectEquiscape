// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import ClasslistBuilder from "@/components/shows/ClasslistBuilder";
import type { ConsoleDivision } from "@/lib/shows/console";
import {
    countTemplateClasses,
    NAMHSA_CORE_TEMPLATE,
} from "@/lib/shows/namhsaTemplate";

const actions = vi.hoisted(() => ({
    addClass: vi.fn().mockResolvedValue({ success: true, classId: "new-class" }),
    addDivision: vi.fn().mockResolvedValue({ success: true, divisionId: "new-div" }),
    addSection: vi.fn().mockResolvedValue({ success: true, sectionId: "new-sec" }),
    loadNamhsaTemplate: vi
        .fn()
        .mockResolvedValue({ success: true, divisions: 3, sections: 10, classes: 41 }),
    reorderClasslist: vi.fn().mockResolvedValue({ success: true, updated: 2 }),
    updateClass: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/app/actions/shows-v2", () => actions);

const SHOW_ID = "123e4567-e89b-42d3-a456-426614174000";

/** The NAMHSA template mapped into the console tree shape. */
function templateDivisions(): ConsoleDivision[] {
    return NAMHSA_CORE_TEMPLATE.divisions.map((d, di) => ({
        id: `div-${di}`,
        name: d.name,
        axis: d.axis,
        sortOrder: di,
        sections: d.sections.map((s, si) => ({
            id: `sec-${di}-${si}`,
            name: s.name,
            sortOrder: si,
            classes: s.classes.map((c, ci) => ({
                id: `cls-${di}-${si}-${ci}`,
                name: c.name,
                classNumber: c.classNumber ?? null,
                status: "scheduled" as const,
                maxPerEntrant: null,
                allowedScales: null,
                allowedFinishes: null,
                isQualifying: c.isQualifying ?? true,
                sortOrder: ci,
                entryCount: 0,
            })),
        })),
    }));
}

/** One tiny division/section tree for interaction tests. */
function smallTree(): ConsoleDivision[] {
    return [
        {
            id: "div-1",
            name: "Breed Halter",
            axis: "halter",
            sortOrder: 0,
            sections: [
                {
                    id: "sec-1",
                    name: "Stock Breeds",
                    sortOrder: 0,
                    classes: [
                        {
                            id: "cls-1",
                            name: "Quarter Horse",
                            classNumber: "110",
                            status: "scheduled",
                            maxPerEntrant: null,
                            allowedScales: null,
                            allowedFinishes: null,
                            isQualifying: true,
                            sortOrder: 0,
                            entryCount: 0,
                        },
                    ],
                },
            ],
        },
    ];
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("ClasslistBuilder — empty state", () => {
    it("offers the template picker and loads the chosen template", async () => {
        render(
            <ClasslistBuilder
                showId={SHOW_ID}
                showStatus="draft"
                divisions={[]}
                canManage
                entriesExist={false}
            />,
        );

        // All five templates render as picker cards.
        expect(screen.getByRole("button", { name: /namhsa core classlist/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /breed halter only/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /performance only/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /collectibility & fun only/i })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /virtual starter show/i }));

        await waitFor(() =>
            expect(actions.loadNamhsaTemplate).toHaveBeenCalledWith({
                showId: SHOW_ID,
                templateKey: "virtual_starter",
            }),
        );
    });
});

describe("ClasslistBuilder — template tree", () => {
    it("renders all 41 template classes across the tree", () => {
        render(
            <ClasslistBuilder
                showId={SHOW_ID}
                showStatus="draft"
                divisions={templateDivisions()}
                canManage
                entriesExist={false}
            />,
        );

        expect(countTemplateClasses(NAMHSA_CORE_TEMPLATE)).toBe(41);
        expect(screen.getAllByTestId("class-row")).toHaveLength(41);
        // Divisions render (name can also appear as a section/axis label)
        expect(screen.getAllByText("Breed Halter").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Performance").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Collectibility & Fun").length).toBeGreaterThan(0);
        // Fun classes carry their non-qualifying badge
        expect(screen.getAllByText("non-qualifying")).toHaveLength(4);
    });
});

describe("ClasslistBuilder — adding a class", () => {
    it("submits the new class to addClass with its section id", async () => {
        render(
            <ClasslistBuilder
                showId={SHOW_ID}
                showStatus="draft"
                divisions={smallTree()}
                canManage
                entriesExist={false}
            />,
        );

        fireEvent.change(screen.getByLabelText("New class name"), {
            target: { value: "Appaloosa" },
        });
        fireEvent.click(screen.getByRole("button", { name: /add class/i }));

        await waitFor(() =>
            expect(actions.addClass).toHaveBeenCalledWith({
                sectionId: "sec-1",
                name: "Appaloosa",
                sortOrder: 1,
            }),
        );
    });

    it("surfaces the action's refusal verbatim", async () => {
        actions.addClass.mockResolvedValueOnce({
            success: false,
            error: "The classlist can no longer be edited — this show has moved past its running phase.",
        });
        render(
            <ClasslistBuilder
                showId={SHOW_ID}
                showStatus="draft"
                divisions={smallTree()}
                canManage
                entriesExist={false}
            />,
        );

        fireEvent.change(screen.getByLabelText("New class name"), {
            target: { value: "Appaloosa" },
        });
        fireEvent.click(screen.getByRole("button", { name: /add class/i }));

        expect(
            await screen.findByText(/can no longer be edited/i),
        ).toBeInTheDocument();
    });
});

describe("ClasslistBuilder — frozen show", () => {
    it("renders read-only with an explanatory note once the show completes", () => {
        render(
            <ClasslistBuilder
                showId={SHOW_ID}
                showStatus="completed"
                divisions={smallTree()}
                canManage
                entriesExist={false}
            />,
        );

        // The note explains the freeze…
        expect(screen.getByRole("note")).toHaveTextContent(/classlist is frozen/i);
        // …and every mutation control is gone.
        expect(screen.queryByRole("button", { name: /add class/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /add section/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /add division/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /cancel class/i })).not.toBeInTheDocument();
        // The tree itself still renders for reference.
        expect(screen.getByText("Quarter Horse")).toBeInTheDocument();
    });

    it("renders read-only for stewards even while the show is mutable", () => {
        render(
            <ClasslistBuilder
                showId={SHOW_ID}
                showStatus="draft"
                divisions={smallTree()}
                canManage={false}
                entriesExist={false}
            />,
        );

        expect(screen.getByRole("note")).toHaveTextContent(/only the host or a co-host/i);
        expect(screen.queryByRole("button", { name: /add class/i })).not.toBeInTheDocument();
    });
});
