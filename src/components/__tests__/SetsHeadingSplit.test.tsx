// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SetsHeadingSplit from "@/components/catalog/SetsHeadingSplit";

const list = (items: string[]) => (
    <ul>
        {items.map((i) => (
            <li key={i}>{i}</li>
        ))}
    </ul>
);

describe("SetsHeadingSplit (MHH-075)", () => {
    it("draws the sets under their own heading after the mold's own rows", () => {
        const { container } = render(
            <SetsHeadingSplit
                items={["mold", "release", "set A", "set B"]}
                splitAt={2}
                term="Arabian Stallion"
                render={list}
            />,
        );
        expect(screen.getByTestId("catalog-sets-heading").textContent).toContain(
            "Sets that include “Arabian Stallion”",
        );
        const lists = container.querySelectorAll("ul");
        expect(lists).toHaveLength(2);
        expect(lists[0].textContent).toBe("moldrelease");
        expect(lists[1].textContent).toBe("set Aset B");
    });

    it("opens a page of only sets with the heading, and draws a list with no sets whole", () => {
        const { container, rerender } = render(
            <SetsHeadingSplit items={["set A"]} splitAt={0} term="Saddlebred" render={list} />,
        );
        expect(screen.getByTestId("catalog-sets-heading")).toBeTruthy();
        expect(container.querySelectorAll("ul")).toHaveLength(1);
        rerender(<SetsHeadingSplit items={["mold"]} splitAt={-1} term="Saddlebred" render={list} />);
        expect(screen.queryByTestId("catalog-sets-heading")).toBeNull();
        rerender(<SetsHeadingSplit items={["mold"]} splitAt={5} term="Saddlebred" render={list} />);
        expect(screen.queryByTestId("catalog-sets-heading")).toBeNull();
    });
});
