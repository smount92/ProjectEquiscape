// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportButton from "../ReportButton";
import { ACCOUNT_SUSPENDED } from "@/lib/actions/result";

const { submitReport } = vi.hoisted(() => ({ submitReport: vi.fn() }));
vi.mock("@/app/actions/moderation", () => ({ submitReport }));
vi.mock("next/navigation", () => ({ usePathname: () => "/shows/s1/class/c1" }));

beforeEach(() => {
    submitReport.mockReset();
    submitReport.mockResolvedValue({ success: true });
});

const ENTRY_ID = "3b8f0f2e-6f3a-4d2b-9c1e-2a7d8e9f0a1b";
const LOGIN_HERE = "/login?redirectTo=%2Fshows%2Fs1%2Fclass%2Fc1";

describe("ReportButton", () => {
    it("is never shown on your own content", () => {
        const { container } = render(<ReportButton targetType="post" targetId={ENTRY_ID} isOwn />);
        expect(container).toBeEmptyDOMElement();
    });

    it("names what it reports, in both looks", () => {
        render(
            <>
                <ReportButton targetType="show_entry" targetId={ENTRY_ID} />
                <ReportButton targetType="comment" targetId={ENTRY_ID} variant="icon" />
            </>,
        );
        expect(screen.getByRole("button", { name: "Report this show entry" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Report this reply" })).toBeInTheDocument();
    });

    it("gives the icon at least a 24×24 target, borderless or not", () => {
        render(
            <ReportButton targetType="show_entry" targetId={ENTRY_ID} variant="icon" className="border-transparent" />,
        );
        const icon = screen.getByRole("button", { name: "Report this show entry" });
        expect(icon.className).toMatch(/\bmin-h-6\b/);
        expect(icon.className).toMatch(/\bmin-w-6\b/);
        expect(icon.className).not.toMatch(/\bmin-h-0\b/);
    });

    it("asks a visitor to log in first, coming back to this page, instead of opening the form", () => {
        render(
            <>
                <ReportButton targetType="horse" targetId={ENTRY_ID} signedIn={false} />
                <ReportButton targetType="show_entry" targetId={ENTRY_ID} signedIn={false} variant="icon" />
            </>,
        );
        expect(screen.getByRole("link", { name: /^Log in to report$/ })).toHaveAttribute("href", LOGIN_HERE);
        expect(screen.getByRole("link", { name: "Log in to report this show entry" })).toHaveAttribute(
            "href",
            LOGIN_HERE,
        );
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("opens a dialog, closes on Escape and gives focus back", async () => {
        const user = userEvent.setup();
        render(<ReportButton targetType="message" targetId={ENTRY_ID} variant="icon" />);
        const trigger = screen.getByRole("button", { name: "Report this message" });
        await user.click(trigger);
        expect(screen.getByRole("dialog", { name: "Report this message" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Community Conduct rules/ })).toHaveAttribute(
            "href",
            "/terms#community-conduct",
        );

        await user.keyboard("{Escape}");
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(trigger).toHaveFocus();
        expect(submitReport).not.toHaveBeenCalled();
    });

    it("can't be sent until a reason is picked, then sends, thanks the member, and keeps the button as 'Reported'", async () => {
        const user = userEvent.setup();
        render(<ReportButton targetType="id_suggestion" targetId={ENTRY_ID} />);
        await user.click(screen.getByRole("button", { name: "Report this suggestion" }));

        const send = screen.getByRole("button", { name: "Send report" });
        expect(send).toBeDisabled();

        await user.click(screen.getByRole("radio", { name: "Spam or scam" }));
        await user.type(screen.getByLabelText(/anything else/i), "  Same link posted ten times  ");
        await user.click(send);

        expect(submitReport).toHaveBeenCalledWith({
            targetType: "id_suggestion",
            targetId: ENTRY_ID,
            reason: "Spam or scam",
            details: "Same link posted ten times",
        });
        expect(await screen.findByText(/we.ll let you know what we decide/i)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Done" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

        // The same button, still there, so focus came back to it.
        const reported = screen.getByRole("button", { name: "You reported this suggestion" });
        expect(reported).toHaveTextContent("Reported");
        expect(reported).toHaveAttribute("aria-disabled", "true");
        expect(reported).toHaveFocus();

        // …and it doesn't open again.
        await user.click(reported);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(submitReport).toHaveBeenCalledTimes(1);
    });

    it("shows the server's words when it fails, with a log-in link back to this page when that is the problem", async () => {
        submitReport.mockResolvedValueOnce({ success: false, error: "Please log in to do that." });
        const user = userEvent.setup();
        render(<ReportButton targetType="user" targetId={ENTRY_ID} />);
        await user.click(screen.getByRole("button", { name: "Report this member" }));
        await user.click(screen.getByRole("radio", { name: "Harassment or bullying" }));
        await user.click(screen.getByRole("button", { name: "Send report" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Please log in to do that.");
        expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", LOGIN_HERE);
    });

    it("tells a suspended member they are suspended, not to log in", async () => {
        submitReport.mockResolvedValueOnce({ success: false, error: ACCOUNT_SUSPENDED });
        const user = userEvent.setup();
        render(<ReportButton targetType="post" targetId={ENTRY_ID} />);
        await user.click(screen.getByRole("button", { name: "Report this post" }));
        await user.click(screen.getByRole("radio", { name: "Other" }));
        await user.click(screen.getByRole("button", { name: "Send report" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(/Your account is suspended/);
        expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
    });
});
