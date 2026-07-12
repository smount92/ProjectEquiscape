"use client";

import { useState } from "react";
import Link from "next/link";
import { resendConfirmationAction, signupAction, type AuthFormState } from "@/app/auth/actions";
import { track } from "@/lib/analytics";
import { Input } from "@/components/ui/input";
import FocusLayout from "@/components/layouts/FocusLayout";
import PageMasthead from "@/components/layouts/PageMasthead";

export default function SignupPage() {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [signupEmail, setSignupEmail] = useState<string | null>(null);
    const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
    const [resendError, setResendError] = useState<string | null>(null);

    const handleSubmit = async (formData: FormData) => {
        setIsPending(true);
        setError(null);

        const result: AuthFormState = await signupAction({ error: null, success: false }, formData);

        if (result.success) {
            setSignupEmail((formData.get("email") as string) || null);
            setSuccess(true);
            track("sign_up", { method: "email" });
        } else {
            setError(result.error);
        }
        setIsPending(false);
    };

    const handleResend = async () => {
        if (!signupEmail || resendStatus === "sending") return;
        setResendStatus("sending");
        setResendError(null);

        const formData = new FormData();
        formData.set("email", signupEmail);
        const result = await resendConfirmationAction({ error: null, success: false }, formData);

        if (result.success) {
            setResendStatus("sent");
        } else {
            setResendStatus("error");
            setResendError(result.error);
        }
    };

    if (success) {
        return (
            <FocusLayout title="Check Your Email">
                <div className="animate-fade-in-up border-input bg-card relative w-full max-w-[440px] overflow-hidden rounded-xl border shadow-lg">
                    <div className="border-input border-b px-8 pt-8 pb-6 text-center">
                        <div className="mb-3 text-4xl" aria-hidden="true">
                            ✉️
                        </div>
                        <p className="text-secondary-foreground mt-2 text-sm leading-relaxed">
                            We&apos;ve sent a confirmation link to your email address. Click the link to activate your
                            account and start building your Digital Stable!
                        </p>
                        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                            Can&apos;t find it? Check your spam folder — and confirm soon, since the link expires.
                        </p>
                    </div>
                    <div className="px-8 pt-6 pb-8 text-center">
                        {signupEmail && (
                            <div className="mb-4">
                                <button
                                    type="button"
                                    onClick={handleResend}
                                    disabled={resendStatus === "sending" || resendStatus === "sent"}
                                    className="border-input text-secondary-foreground hover:bg-muted hover:text-foreground w-full cursor-pointer rounded-lg border bg-transparent px-6 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60"
                                    id="resend-confirmation"
                                >
                                    {resendStatus === "sending"
                                        ? "Sending…"
                                        : resendStatus === "sent"
                                          ? "Confirmation email re-sent ✓"
                                          : "Resend confirmation email"}
                                </button>
                                {resendStatus === "error" && resendError && (
                                    <p className="text-destructive mt-2 text-xs" role="alert" id="resend-error">
                                        {resendError}
                                    </p>
                                )}
                            </div>
                        )}
                        <Link
                            href="/login"
                            className="bg-forest hover:bg-forest-dark inline-block w-full cursor-pointer rounded-lg border-0 px-6 py-3 text-center text-sm font-semibold text-white no-underline shadow-sm transition-all hover:shadow-md"
                            id="back-to-login"
                        >
                            Back to Sign In
                        </Link>
                    </div>
                </div>
            </FocusLayout>
        );
    }

    return (
        <FocusLayout noHeader>
            <PageMasthead compact icon="🐴" title="Join the Stable" subtitle="Create your account and start cataloging your collection" />
            <div className="animate-fade-in-up border-input bg-card relative w-full max-w-[440px] overflow-hidden rounded-xl border shadow-lg">
                {/* Body */}
                <div className="px-8 pt-6 pb-8">
                    {error && (
                        <div
                            className="mb-6 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                            role="alert"
                            id="signup-error"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                            {error}
                        </div>
                    )}

                    {/* Privacy Callout */}
                    <div
                        className="border-forest/20 bg-forest/5 mb-6 flex items-start gap-3 rounded-lg border p-4"
                        role="note"
                        aria-label="Privacy information"
                    >
                        <span className="mt-0.5 text-lg" aria-hidden="true">
                            🛡️
                        </span>
                        <p className="text-secondary-foreground text-sm leading-relaxed">
                            <strong className="text-foreground">Your real name is private.</strong> Your alias is how
                            the community will know you. Only you can see your personal details — we take your privacy
                            seriously. And your data is never trapped here: we back up nightly, and you can export your
                            entire collection as CSV or PDF anytime.
                        </p>
                    </div>

                    <form action={handleSubmit} noValidate>
                        <div className="mb-5">
                            <label
                                htmlFor="signup-alias"
                                className="text-foreground mb-1.5 block text-sm font-semibold"
                            >
                                Choose Your Alias *
                            </label>
                            <Input
                                id="signup-alias"
                                name="aliasName"
                                type="text"
                                className="border-input bg-card focus:border-forest focus:ring-forest/20 w-full rounded-lg border px-4 py-3 text-sm transition-colors focus:ring-2 focus:outline-none"
                                placeholder="e.g. StableQueen42"
                                required
                                minLength={3}
                                maxLength={30}
                                autoFocus
                                autoComplete="username"
                            />
                            <span className="text-muted-foreground mt-1.5 block text-xs">
                                This is your public display name (3–30 characters). Choose wisely!
                            </span>
                        </div>

                        <div className="mb-5">
                            <label
                                htmlFor="signup-email"
                                className="text-foreground mb-1.5 block text-sm font-semibold"
                            >
                                Email Address *
                            </label>
                            <Input
                                id="signup-email"
                                name="email"
                                type="email"
                                className="border-input bg-card focus:border-forest focus:ring-forest/20 w-full rounded-lg border px-4 py-3 text-sm transition-colors focus:ring-2 focus:outline-none"
                                placeholder="you@example.com"
                                required
                                autoComplete="email"
                            />
                            <span className="text-muted-foreground mt-1.5 block text-xs">
                                We&apos;ll send a confirmation link. Your email is never shared.
                            </span>
                        </div>

                        <div className="mb-5">
                            <label
                                htmlFor="signup-password"
                                className="text-foreground mb-1.5 block text-sm font-semibold"
                            >
                                Password *
                            </label>
                            <div className="relative">
                                <Input
                                    id="signup-password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    className="border-input bg-card focus:border-forest focus:ring-forest/20 w-full rounded-lg border px-4 py-3 pr-12 text-sm transition-colors focus:ring-2 focus:outline-none"
                                    placeholder="At least 6 characters"
                                    required
                                    minLength={6}
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 flex -translate-y-1/2 items-center border-none bg-transparent p-1 transition-colors"
                                >
                                    {showPassword ? (
                                        <svg
                                            width="18"
                                            height="18"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    ) : (
                                        <svg
                                            width="18"
                                            height="18"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="mb-6">
                            <label
                                htmlFor="signup-confirm-password"
                                className="text-foreground mb-1.5 block text-sm font-semibold"
                            >
                                Confirm Password *
                            </label>
                            <Input
                                id="signup-confirm-password"
                                name="confirmPassword"
                                type={showPassword ? "text" : "password"}
                                className="border-input bg-card focus:border-forest focus:ring-forest/20 w-full rounded-lg border px-4 py-3 text-sm transition-colors focus:ring-2 focus:outline-none"
                                placeholder="Re-enter your password"
                                required
                                autoComplete="new-password"
                            />
                        </div>

                        <button
                            type="submit"
                            className="bg-forest hover:bg-forest-dark w-full cursor-pointer rounded-lg border-0 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isPending}
                            id="signup-submit"
                        >
                            {isPending ? "Creating Account..." : "Create My Account"}
                        </button>
                    </form>

                    <div className="border-input text-muted-foreground mt-6 border-t pt-5 text-center text-sm">
                        <p>
                            Already have an account?{" "}
                            <Link href="/login" className="text-forest font-semibold hover:underline" id="go-to-login">
                                Sign in here
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </FocusLayout>
    );
}
