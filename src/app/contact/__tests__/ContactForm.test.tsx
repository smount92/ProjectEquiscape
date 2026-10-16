// @vitest-environment jsdom
/**
 * The contact form keeps what the member typed when sending fails (React
 * 19 resets a `<form action>` even on error), opens on the category a link
 * asked for, prefills a signed-in member, and confirms with focus.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { submitContactForm } = vi.hoisted(() => ({ submitContactForm: vi.fn() }));
vi.mock("@/app/actions/contact", () => ({ submitContactForm }));

import ContactForm from "../ContactForm";
import { initialContactCategory } from "@/lib/contact/categories";

const empty = { name: "", email: "" };

beforeEach(() => {
    submitContactForm.mockReset();
});

async function fillAndSend(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("Your Name"), "Pat");
    await user.type(screen.getByLabelText("Email Address"), "pat@example.com");
    await user.type(screen.getByLabelText(/Subject/), "Broken page");
    await user.type(screen.getByLabelText("Message"), "The Registry page errored.");
    await user.click(screen.getByRole("button", { name: "Send Message" }));
}

describe("ContactForm", () => {
    it("keeps every field when sending fails", async () => {
        submitContactForm.mockResolvedValue({ error: "Something went wrong. Please try again later.", success: false });
        const user = userEvent.setup();
        render(<ContactForm errorRef="" initialCategory="question" prefill={empty} />);
        await user.selectOptions(screen.getByLabelText("What's this about?"), "billing");
        await fillAndSend(user);

        expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
        expect(screen.getByLabelText("Your Name")).toHaveValue("Pat");
        expect(screen.getByLabelText("Email Address")).toHaveValue("pat@example.com");
        expect(screen.getByLabelText(/Subject/)).toHaveValue("Broken page");
        expect(screen.getByLabelText("Message")).toHaveValue("The Registry page errored.");
        expect(screen.getByLabelText("What's this about?")).toHaveValue("billing");

        const sent = submitContactForm.mock.calls[0][1] as FormData;
        expect(sent.get("category")).toBe("billing");
        expect(sent.get("message")).toBe("The Registry page errored.");
    });

    it("lets the browser check the fields (no noValidate)", () => {
        render(<ContactForm errorRef="" initialCategory="question" prefill={empty} />);
        const form = screen.getByRole("button", { name: "Send Message" }).closest("form")!;
        expect(form).not.toHaveAttribute("novalidate");
        expect(screen.getByLabelText("Email Address")).toHaveAttribute("type", "email");
        expect(screen.getByLabelText("Email Address")).toBeRequired();
    });

    it("prefills a signed-in member's name and email", () => {
        render(
            <ContactForm
                errorRef=""
                initialCategory="question"
                prefill={{ name: "Pat Rider", email: "pat@example.com" }}
            />,
        );
        expect(screen.getByLabelText("Your Name")).toHaveValue("Pat Rider");
        expect(screen.getByLabelText("Email Address")).toHaveValue("pat@example.com");
    });

    it("opens on the category it was given, with the Report-button hint for reports", () => {
        render(<ContactForm errorRef="" initialCategory="report" prefill={empty} />);
        const select = screen.getByLabelText("What's this about?");
        expect(select).toHaveValue("report");
        expect(select).toHaveAttribute("aria-describedby", "contact-report-hint");
        expect(screen.getByText(/To report a post or member, use the/)).toHaveTextContent(
            "To report a post or member, use the 🚩 Report button on it.",
        );
    });

    it("hides the hint for other categories", async () => {
        const user = userEvent.setup();
        render(<ContactForm errorRef="" initialCategory="report" prefill={empty} />);
        await user.selectOptions(screen.getByLabelText("What's this about?"), "question");
        expect(screen.queryByText(/To report a post or member/)).not.toBeInTheDocument();
    });

    it("confirms in a status region and moves focus to the heading", async () => {
        submitContactForm.mockResolvedValue({ error: null, success: true });
        const user = userEvent.setup();
        render(<ContactForm errorRef="" initialCategory="question" prefill={empty} />);
        await fillAndSend(user);

        const heading = await screen.findByRole("heading", { name: "Thanks, we have your message" });
        expect(screen.getByRole("status")).toHaveTextContent("We'll reply by email as soon as we can.");
        await waitFor(() => expect(heading).toHaveFocus());
    });
});

describe("initialContactCategory", () => {
    it("takes ?category= only when it is a real category", () => {
        expect(initialContactCategory("report", false)).toBe("report");
        expect(initialContactCategory("billing", true)).toBe("billing");
        expect(initialContactCategory("<script>", false)).toBe("question");
        expect(initialContactCategory(undefined, false)).toBe("question");
    });

    it("falls back to 'problem' when an error page sent the member", () => {
        expect(initialContactCategory(undefined, true)).toBe("problem");
        expect(initialContactCategory("nonsense", true)).toBe("problem");
    });
});
