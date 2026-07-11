// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignupPage from "../page";

const { signupAction, resendConfirmationAction } = vi.hoisted(() => ({
    signupAction: vi.fn(),
    resendConfirmationAction: vi.fn(),
}));
vi.mock("@/app/auth/actions", () => ({
    signupAction,
    resendConfirmationAction,
}));

async function signUpSuccessfully() {
    const user = userEvent.setup();
    render(<SignupPage />);
    await user.type(screen.getByLabelText(/choose your alias/i), "StableQueen42");
    await user.type(screen.getByLabelText(/email address/i), "rider@example.com");
    await user.type(screen.getByLabelText(/^password/i), "secret1");
    await user.type(screen.getByLabelText(/confirm password/i), "secret1");
    await user.click(screen.getByRole("button", { name: /create my account/i }));
    await screen.findByText(/we've sent a confirmation link/i);
    return user;
}

beforeEach(() => {
    vi.clearAllMocks();
    signupAction.mockResolvedValue({ error: null, success: true });
    resendConfirmationAction.mockResolvedValue({ error: null, success: true });
});

describe("signup email-confirm interstitial", () => {
    it("shows the spam/expiry note and a resend button after signup", async () => {
        await signUpSuccessfully();
        expect(screen.getByText(/check your spam folder/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /resend confirmation email/i })).toBeInTheDocument();
    });

    it("resends the confirmation to the signup email and confirms it", async () => {
        const user = await signUpSuccessfully();
        await user.click(screen.getByRole("button", { name: /resend confirmation email/i }));

        await waitFor(() => {
            expect(resendConfirmationAction).toHaveBeenCalledTimes(1);
        });
        const formData = resendConfirmationAction.mock.calls[0][1] as FormData;
        expect(formData.get("email")).toBe("rider@example.com");

        // Confirms, then stays disabled so it can't be spammed
        const sent = await screen.findByRole("button", { name: /re-sent/i });
        expect(sent).toBeDisabled();
    });

    it("surfaces a resend failure (e.g. Supabase rate limit) inline", async () => {
        resendConfirmationAction.mockResolvedValue({
            error: "For security purposes, you can only request this once every 60 seconds",
            success: false,
        });
        const user = await signUpSuccessfully();
        await user.click(screen.getByRole("button", { name: /resend confirmation email/i }));
        expect(await screen.findByRole("alert")).toHaveTextContent(/60 seconds/i);
    });
});
