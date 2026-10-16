// @vitest-environment jsdom
/**
 * The entry wiring: Enter and Re-enter link to the entry page when the
 * show is known, the copy says what a scratch really does, and the My
 * Entries tab counts LIVE entries only (matching the sticky pill).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { MyEntriesCard, PublicClassRow } from "@/components/shows/ShowEntrySectionParts";
import type { ConsoleClass } from "@/lib/shows/console";
import type { MyShowEntry } from "@/lib/shows/public";

// The shared setup mocks next/link to return null, so no Link would
// render at all. Use a real anchor here so href assertions mean something.
vi.mock("next/link", () => ({
    default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

function cls(overrides: Partial<ConsoleClass> = {}): ConsoleClass {
    return {
        id: "c1",
        name: "OF Breyer Halter",
        classNumber: "101",
        status: "scheduled",
        maxPerEntrant: null,
        allowedScales: null,
        allowedFinishes: null,
        isQualifying: false,
        sortOrder: 0,
        entryCount: 0,
        exhibitorCount: 0,
        ...(overrides as object),
    } as ConsoleClass;
}

function entry(overrides: Partial<MyShowEntry> = {}): MyShowEntry {
    return {
        id: "e1",
        classId: "c1",
        horseId: "h1",
        horseName: "Sunny",
        entryNumber: 1,
        status: "entered",
        handlerAlias: null,
        photoId: null,
        place: null,
        ...overrides,
    };
}

describe("PublicClassRow entry control", () => {
    it("links Enter to the entry page, preselecting the class", () => {
        render(<PublicClassRow cls={cls()} canEnter showId="s1" />);
        const link = screen.getByRole("link", { name: "Enter" });
        expect(link).toHaveAttribute("href", "/shows/s1/enter?class=c1");
    });

    it("falls back to the Enter button and onEnter when no showId is given", () => {
        const onEnter = vi.fn();
        render(<PublicClassRow cls={cls()} canEnter onEnter={onEnter} />);
        expect(screen.queryByRole("link", { name: "Enter" })).not.toBeInTheDocument();
        screen.getByRole("button", { name: "Enter" }).click();
        expect(onEnter).toHaveBeenCalledTimes(1);
    });

    it("renders no Enter control when the viewer cannot enter", () => {
        render(<PublicClassRow cls={cls()} canEnter={false} showId="s1" />);
        expect(screen.queryByRole("link", { name: "Enter" })).not.toBeInTheDocument();
    });

    it("says 'Up to N of your horses' for a per-entrant cap", () => {
        render(<PublicClassRow cls={cls({ maxPerEntrant: 2 })} canEnter={false} />);
        expect(screen.getByText("Up to 2 of your horses")).toBeInTheDocument();
        expect(screen.queryByText(/entrant/i)).not.toBeInTheDocument();
    });

    it("names the class-room link 'See entries →'", () => {
        render(<PublicClassRow cls={cls()} canEnter={false} classRoomHref="/shows/s1/class/c1" />);
        expect(screen.getByRole("link", { name: "See entries →" })).toHaveAttribute("href", "/shows/s1/class/c1");
        expect(screen.queryByText(/class room/i)).not.toBeInTheDocument();
    });
});

describe("MyEntriesCard", () => {
    const classById = new Map([["c1", cls()]]);
    const noLive = () => false;

    it("counts LIVE entries only in the tab heading", () => {
        render(
            <MyEntriesCard
                myEntries={[
                    entry({ id: "e1", horseId: "h1" }),
                    entry({ id: "e2", horseId: "h2", status: "scratched" }),
                    entry({ id: "e3", horseId: "h3", status: "scratched" }),
                ]}
                classById={classById}
                entriesOpen={false}
                scratching={false}
                hasLiveEntry={noLive}
                onScratch={() => {}}
                onReenter={() => {}}
            />,
        );
        expect(screen.getByText("My Entries · 1")).toBeInTheDocument();
    });

    it("links Re-enter to the entry page with the class and horse preselected", () => {
        render(
            <MyEntriesCard
                myEntries={[entry({ status: "scratched" })]}
                classById={classById}
                entriesOpen
                scratching={false}
                hasLiveEntry={noLive}
                onScratch={() => {}}
                onReenter={() => {}}
                showId="s1"
            />,
        );
        expect(screen.getByRole("link", { name: "Re-enter" })).toHaveAttribute(
            "href",
            "/shows/s1/enter?class=c1&horse=h1",
        );
    });

    it("keeps the Re-enter button when no showId is given", () => {
        const onReenter = vi.fn();
        render(
            <MyEntriesCard
                myEntries={[entry({ status: "scratched" })]}
                classById={classById}
                entriesOpen
                scratching={false}
                hasLiveEntry={noLive}
                onScratch={() => {}}
                onReenter={onReenter}
            />,
        );
        expect(screen.queryByRole("link", { name: "Re-enter" })).not.toBeInTheDocument();
        screen.getByRole("button", { name: "Re-enter" }).click();
        expect(onReenter).toHaveBeenCalledWith(classById.get("c1"));
    });

    it("explains withdrawal in the new copy while entries are open", () => {
        render(
            <MyEntriesCard
                myEntries={[entry()]}
                classById={classById}
                entriesOpen
                scratching={false}
                hasLiveEntry={noLive}
                onScratch={() => {}}
                onReenter={() => {}}
            />,
        );
        const section = screen.getByRole("region", { name: "My Entries · 1" });
        expect(
            within(section).getByText(
                "Scratch to withdraw a horse. You can enter it again later; the withdrawn entry stays on the record.",
            ),
        ).toBeInTheDocument();
    });
});
