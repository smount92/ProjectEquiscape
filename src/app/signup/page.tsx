"use client";

import { useState } from "react";
import Link from "next/link";
import { signupAction, type AuthFormState } from "@/app/auth/actions";

export default function SignupPage() {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (formData: FormData) => {
        setIsPending(true);
        setError(null);

        const result: AuthFormState = await signupAction({ error: null, success: false }, formData);

        if (result.success) {
            setSuccess(true);
        } else {
            setError(result.error);
        }
        setIsPending(false);
    };

    // Success state — show confirmation message
    if (success) {
        return (
            <div className="min-h-[calc(100vh - var(--sticky h-[var(--header max-sm:px-4-height)] bg-parchment-dark border-edge transition-all-height))] top-0 z-[100] flex items-center justify-between justify-center border-b p-8 px-8 py-[0] max-sm:py-[0]">
                <div className="bg-card border-edge animate-fade-in-up relative w-full max-w-[460px] overflow-hidden rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                    <div className="bg-card border-edge transition-all-sticky h-[var(--header max-sm:px-4-height)] bg-parchment-dark border-edge top-0 z-[100] flex items-center justify-between rounded-lg border border-b p-12 px-8 py-[0] shadow-md transition-all max-[480px]:rounded-[var(--radius-md)] max-sm:py-[0]">
                        <div
                            style={{
                                fontSize: "3rem",
                                marginBottom: "var(--space-md)",
                            }}
                            aria-hidden="true"
                        >
                            ✉️
                        </div>
                        <h1>Check Your Email</h1>
                        <p className="mt-4">
                            We&apos;ve sent a confirmation link to your email address. Click the link to activate your
                            account and start building your Digital Stable!
                        </p>
                    </div>
                    <Link
                        href="/login"
                        className="hover:no-underline-min-h)] bg-forest text-inverse flex inline-flex min-h-[var(--opacity-[0.5] w-full cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                        id="back-to-login"
                    >
                        Back to Sign In
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh - var(--sticky h-[var(--header max-sm:px-4-height)] bg-parchment-dark border-edge transition-all-height))] top-0 z-[100] flex items-center justify-between justify-center border-b p-8 px-8 py-[0] max-sm:py-[0]">
            <div className="bg-card border-edge animate-fade-in-up relative w-full max-w-[460px] overflow-hidden rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                <div className="bg-card border-edge transition-all-sticky h-[var(--header max-sm:px-4-height)] bg-parchment-dark border-edge top-0 z-[100] flex items-center justify-between rounded-lg border border-b p-12 px-8 py-[0] shadow-md transition-all max-[480px]:rounded-[var(--radius-md)] max-sm:py-[0]">
                    <h1>
                        Join the <span className="text-forest">Stable</span>
                    </h1>
                    <p>Create your account and start cataloging your collection</p>
                </div>

                {error && (
                    <div
                        className="text-danger mt-2 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm"
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

                {/* ---- Privacy Callout (PRD Requirement) ---- */}
                <div
                    className="bg-[rgba(44, 85, 69, 0.08)] border-[rgba(44, 85, 69, 0.2)] mb-6 flex items-start gap-2 rounded-md border p-4"
                    role="note"
                    aria-label="Privacy information"
                >
                    <span
                        className="bg-[rgba(44, 85, 69, 0.08)] border-[rgba(44, 85, 69, 0.2)] mb-6-icon flex items-start gap-2 rounded-md border p-4"
                        aria-hidden="true"
                    >
                        🛡️
                    </span>
                    <p>
                        <strong>Your real name is private.</strong> Your alias is how the community will know you. Only
                        you can see your personal details — we take your privacy seriously.
                    </p>
                </div>

                <form action={handleSubmit} noValidate>
                    {/* Alias Name */}
                    <div className="mb-6">
                        <label htmlFor="signup-alias" className="text-ink mb-1 block text-sm font-semibold">
                            Choose Your Alias *
                        </label>
                        <input
                            id="signup-alias"
                            name="aliasName"
                            type="text"
                            className="form-input"
                            placeholder="e.g. StableQueen42"
                            required
                            minLength={3}
                            maxLength={30}
                            autoFocus
                            autoComplete="username"
                        />
                        <span className="text-muted mt-1 block text-xs">
                            This is your public display name (3–30 characters). Choose wisely — this is how collectors
                            will know you!
                        </span>
                    </div>

                    {/* Email */}
                    <div className="mb-6">
                        <label htmlFor="signup-email" className="text-ink mb-1 block text-sm font-semibold">
                            Email Address *
                        </label>
                        <input
                            id="signup-email"
                            name="email"
                            type="email"
                            className="form-input"
                            placeholder="you@example.com"
                            required
                            autoComplete="email"
                        />
                        <span className="text-muted mt-1 block text-xs">
                            We&apos;ll send a confirmation link. Your email is never shared.
                        </span>
                    </div>

                    {/* Password */}
                    <div className="mb-6">
                        <label htmlFor="signup-password" className="text-ink mb-1 block text-sm font-semibold">
                            Password *
                        </label>
                        <div style={{ position: "relative" }}>
                            <input
                                id="signup-password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                className="form-input"
                                placeholder="At least 6 characters"
                                required
                                minLength={6}
                                autoComplete="new-password"
                                style={{ paddingRight: "48px" }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                style={{
                                    position: "absolute",
                                    right: "12px",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    background: "none",
                                    border: "none",
                                    color: "var(--color-text-muted)",
                                    cursor: "pointer",
                                    padding: "4px",
                                    display: "flex",
                                    alignItems: "center",
                                }}
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

                    {/* Confirm Password */}
                    <div className="mb-6">
                        <label htmlFor="signup-confirm-password" className="text-ink mb-1 block text-sm font-semibold">
                            Confirm Password *
                        </label>
                        <input
                            id="signup-confirm-password"
                            name="confirmPassword"
                            type={showPassword ? "text" : "password"}
                            className="form-input"
                            placeholder="Re-enter your password"
                            required
                            autoComplete="new-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="hover:no-underline-min-h)] bg-forest text-inverse flex inline-flex min-h-[var(--opacity-[0.5] w-full cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                        disabled={isPending}
                        id="signup-submit"
                    >
                        {isPending ? (
                            <>
                                <span
                                    className="hover:no-underline-min-h)] leading-none-spinner inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] px-8 py-2 font-sans text-base font-semibold no-underline transition-all duration-150"
                                    aria-hidden="true"
                                />
                                Creating Account...
                            </>
                        ) : (
                            "Create My Account"
                        )}
                    </button>
                </form>

                <div className="text-muted mt-8 text-center text-sm">
                    <p>
                        Already have an account?{" "}
                        <Link href="/login" id="go-to-login">
                            Sign in here
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
