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

    const result: AuthFormState = await signupAction(
      { error: null, success: false },
      formData
    );

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
      <div className="flex items-center justify-center min-h-[calc(100vh - var(--sticky top-0 z-[100] h-[var(--header-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all-height))] p-8">
        <div className="bg-card border border-edge rounded-lg p-12 shadow-md transition-all w-full max-w-[460px] relative overflow-hidden animate-fade-in-up">
          <div className="bg-card border border-edge rounded-lg p-12 shadow-md transition-all-sticky top-0 z-[100] h-[var(--header-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">
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
            <p style={{ marginTop: "var(--space-md)" }}>
              We&apos;ve sent a confirmation link to your email address. Click
              the link to activate your account and start building your Digital
              Stable!
            </p>
          </div>
          <Link href="/login" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm flex w-full" id="back-to-login">
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh - var(--sticky top-0 z-[100] h-[var(--header-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all-height))] p-8">
      <div className="bg-card border border-edge rounded-lg p-12 shadow-md transition-all w-full max-w-[460px] relative overflow-hidden animate-fade-in-up">
        <div className="bg-card border border-edge rounded-lg p-12 shadow-md transition-all-sticky top-0 z-[100] h-[var(--header-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">
          <h1>
            Join the{" "}
            <span className="text-forest">Stable</span>
          </h1>
          <p>Create your account and start cataloging your collection</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 mt-2 py-2 px-4 bg-[rgba(240,108,126,0.1)] border border-[rgba(240,108,126,0.3)] rounded-md text-danger text-sm" role="alert" id="signup-error">
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
        <div className="flex items-start gap-2 p-4 bg-[rgba(44, 85, 69, 0.08)] border border-[rgba(44, 85, 69, 0.2)] rounded-md mb-6" role="note" aria-label="Privacy information">
          <span className="flex items-start gap-2 p-4 bg-[rgba(44, 85, 69, 0.08)] border border-[rgba(44, 85, 69, 0.2)] rounded-md mb-6-icon" aria-hidden="true">
            🛡️
          </span>
          <p>
            <strong>Your real name is private.</strong> Your alias is how the
            community will know you. Only you can see your personal details — we
            take your privacy seriously.
          </p>
        </div>

        <form action={handleSubmit} noValidate>
          {/* Alias Name */}
          <div className="mb-6">
            <label htmlFor="signup-alias" className="block text-sm font-semibold text-ink mb-1">
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
            <span className="block mt-1 text-xs text-muted">
              This is your public display name (3–30 characters). Choose wisely —
              this is how collectors will know you!
            </span>
          </div>

          {/* Email */}
          <div className="mb-6">
            <label htmlFor="signup-email" className="block text-sm font-semibold text-ink mb-1">
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
            <span className="block mt-1 text-xs text-muted">
              We&apos;ll send a confirmation link. Your email is never shared.
            </span>
          </div>

          {/* Password */}
          <div className="mb-6">
            <label htmlFor="signup-password" className="block text-sm font-semibold text-ink mb-1">
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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="mb-6">
            <label htmlFor="signup-confirm-password" className="block text-sm font-semibold text-ink mb-1">
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
            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm flex w-full"
            disabled={isPending}
            id="signup-submit"
          >
            {isPending ? (
              <>
                <span className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-spinner" aria-hidden="true" />
                Creating Account...
              </>
            ) : (
              "Create My Account"
            )}
          </button>
        </form>

        <div className="text-center mt-8 text-sm text-muted">
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
