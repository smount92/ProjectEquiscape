// @vitest-environment jsdom
/**
 * Notes are member-written, so this component's job is half convenience
 * and half containment: turn real links into links, and refuse to turn
 * anything else into markup.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import LinkifiedText from "@/components/LinkifiedText";

describe("LinkifiedText", () => {
    it("links a bare https URL and opens it safely", () => {
        render(<LinkifiedText text="Reference shot: https://flic.kr/p/583GMA" />);
        const link = screen.getByRole("link");
        expect(link).toHaveAttribute("href", "https://flic.kr/p/583GMA");
        expect(link).toHaveAttribute("target", "_blank");
        // nofollow so notes can't be used to pass ranking; noopener so the
        // opened page never gets a handle on our window.
        expect(link.getAttribute("rel")).toContain("noopener");
        expect(link.getAttribute("rel")).toContain("noreferrer");
        expect(link.getAttribute("rel")).toContain("nofollow");
    });

    it("keeps the surrounding words intact", () => {
        const { container } = render(
            <LinkifiedText text="55 made https://flic.kr/p/583GMA — a lovely one" />,
        );
        expect(container.textContent).toContain("55 made");
        expect(container.textContent).toContain("a lovely one");
    });

    it("links more than one URL", () => {
        render(
            <LinkifiedText text="https://flic.kr/p/583GMA and https://omhps.com/Model/Details/43ce" />,
        );
        expect(screen.getAllByRole("link")).toHaveLength(2);
    });

    it("leaves a javascript: payload as inert text", () => {
        const { container } = render(
            // eslint-disable-next-line no-script-url
            <LinkifiedText text="click javascript:alert('x') now" />,
        );
        expect(screen.queryByRole("link")).toBeNull();
        expect(container.textContent).toContain("javascript:alert('x')");
    });

    it("does not render markup found in the text", () => {
        const { container } = render(
            <LinkifiedText text={'<img src=x onerror="alert(1)"> and <b>bold</b>'} />,
        );
        expect(container.querySelector("img")).toBeNull();
        expect(container.querySelector("b")).toBeNull();
        // It survives as literal text, which is the point.
        expect(container.textContent).toContain("<b>bold</b>");
    });

    it("leaves sentence punctuation out of the href", () => {
        render(<LinkifiedText text="See https://omhps.com/Model/Details/43ce." />);
        expect(screen.getByRole("link")).toHaveAttribute(
            "href",
            "https://omhps.com/Model/Details/43ce",
        );
    });

    it("shortens a long address for display but links the whole thing", () => {
        const long = "https://omhps.com/Model/Details/43ce65ad-1111-2222-3333-444455556666";
        render(<LinkifiedText text={long} />);
        const link = screen.getByRole("link");
        expect(link).toHaveAttribute("href", long);
        expect(link.textContent!.length).toBeLessThan(long.length);
        expect(link).toHaveAttribute("title", long);
    });

    it("renders plain notes unchanged and handles empty text", () => {
        const { container } = render(<LinkifiedText text="No links here at all." />);
        expect(screen.queryByRole("link")).toBeNull();
        expect(container.textContent).toBe("No links here at all.");
        const { container: empty } = render(<LinkifiedText text="" />);
        expect(empty.textContent).toBe("");
    });
});
