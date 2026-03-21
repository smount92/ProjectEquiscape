"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction, type AuthFormState } from "@/app/auth/actions";

const initialState: AuthFormState = { error: null, success: false };

export default function ForgotPasswordPage() {
    const [state, formAction, isPending] = useActionState(forgotPasswordAction, initialState);

    if (state.success) {
        return (
            <div className="min-h-[calc(100vh - var(--sticky h-[var(--header max-sm:px-4-height)] bg-parchment-dark border-edge transition-all-height))] top-0 z-[100] flex items-center justify-between justify-center border-b p-8 px-8 py-[0] max-sm:py-[0]">
                <div className="bg-card border-edge animate-fade-in-up relative w-full max-w-[460px] overflow-hidden rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                    <div className="bg-card border-edge transition-all-sticky h-[var(--header max-sm:px-4-height)] bg-parchment-dark border-edge top-0 z-[100] flex items-center justify-between rounded-lg border border-b p-12 px-8 py-[0] shadow-md transition-all max-[480px]:rounded-[var(--radius-md)] max-sm:py-[0]">
                        <div aria-hidden="true" className="mb-4 text-[3rem]">
                            ✉️
                        </div>
                        <h1>Check Your Email</h1>
                        <p className="mt-4">
                            If an account exists with that email, we&apos;ve sent you a password reset link. Check your
                            inbox and spam folder.
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
                        Reset <span className="text-forest">Password</span>
                    </h1>
                    <p>Enter your email and we&apos;ll send you a reset link</p>
                </div>

                {state.error && (
                    <div
                        className="text-danger mt-2 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm"
                        role="alert"
                        id="forgot-error"
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
                        {state.error}
                    </div>
                )}

                <form action={formAction} noValidate>
                    <div className="mb-6">
                        <label htmlFor="forgot-email" className="text-ink mb-1 block text-sm font-semibold">
                            Email Address
                        </label>
                        <input
                            id="forgot-email"
                            name="email"
                            type="email"
                            className="form-input"
                            placeholder="you@example.com"
                            required
                            autoComplete="email"
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        className="hover:no-underline-min-h)] bg-forest text-inverse flex inline-flex min-h-[var(--opacity-[0.5] w-full cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                        disabled={isPending}
                        id="forgot-submit"
                    >
                        {isPending ? (
                            <>
                                <span
                                    className="hover:no-underline-min-h)] leading-none-spinner inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] px-8 py-2 font-sans text-base font-semibold no-underline transition-all duration-150"
                                    aria-hidden="true"
                                />
                                Sending...
                            </>
                        ) : (
                            "Send Reset Link"
                        )}
                    </button>
                </form>

                <div className="text-muted mt-8 text-center text-sm">
                    <p>
                        Remember your password?{" "}
                        <Link href="/login" id="go-to-login">
                            Sign in here
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
