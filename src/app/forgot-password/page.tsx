"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction, type AuthFormState } from "@/app/auth/actions";

const initialState: AuthFormState = { error: null, success: false };

export default function ForgotPasswordPage() {
    const [state, formAction, isPending] = useActionState(forgotPasswordAction, initialState);

    if (state.success) {
        return (
            <div className="auth-page">
                <div className="card card-auth animate-fade-in-up">
                    <div className="card-header">
                        <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)" }} aria-hidden="true">
                            ✉️
                        </div>
                        <h1>Check Your Email</h1>
                        <p style={{ marginTop: "var(--space-md)" }}>
                            If an account exists with that email, we&apos;ve sent you a password reset link.
                            Check your inbox and spam folder.
                        </p>
                    </div>
                    <Link href="/login" className="btn btn-primary btn-full" id="back-to-login">
                        Back to Sign In
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page">
            <div className="card card-auth animate-fade-in-up">
                <div className="card-header">
                    <h1>Reset <span className="text-gradient">Password</span></h1>
                    <p>Enter your email and we&apos;ll send you a reset link</p>
                </div>

                {state.error && (
                    <div className="form-error" role="alert" id="forgot-error">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                        {state.error}
                    </div>
                )}

                <form action={formAction} noValidate>
                    <div className="form-group">
                        <label htmlFor="forgot-email" className="form-label">Email Address</label>
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

                    <button type="submit" className="btn btn-primary btn-full" disabled={isPending} id="forgot-submit">
                        {isPending ? (
                            <>
                                <span className="btn-spinner" aria-hidden="true" />
                                Sending...
                            </>
                        ) : (
                            "Send Reset Link"
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        Remember your password?{" "}
                        <Link href="/login" id="go-to-login">Sign in here</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
