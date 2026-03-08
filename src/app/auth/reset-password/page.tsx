"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);
    const [success, setSuccess] = useState(false);
    const [ready, setReady] = useState(false); // true when session is ready for password update

    useEffect(() => {
        // Method 1: If a PKCE ?code= parameter is present, exchange it
        const code = searchParams.get("code");
        if (code) {
            supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
                if (exchangeError) {
                    console.error("[ResetPassword] Code exchange failed:", exchangeError.message);
                    setError("This reset link has expired. Please request a new one.");
                } else {
                    setReady(true);
                }
            });
            return;
        }

        // Method 2: Listen for PASSWORD_RECOVERY event (token-hash flow via URL fragment)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === "PASSWORD_RECOVERY") {
                setReady(true);
            } else if (event === "SIGNED_IN") {
                // If the user was signed in via the recovery token, the session is ready
                setReady(true);
            }
        });

        // Method 3: Check if user already has a valid session (e.g., navigated here directly)
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                setReady(true);
            }
        });

        return () => subscription.unsubscribe();
    }, [searchParams, supabase.auth]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setIsPending(true);
        const { error: updateError } = await supabase.auth.updateUser({ password });

        if (updateError) {
            setError(updateError.message);
            setIsPending(false);
            return;
        }

        setSuccess(true);
        setTimeout(() => router.push("/dashboard"), 2000);
    };

    if (success) {
        return (
            <div className="auth-page">
                <div className="card card-auth animate-fade-in-up">
                    <div className="card-header">
                        <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)" }} aria-hidden="true">✅</div>
                        <h1>Password Updated!</h1>
                        <p style={{ marginTop: "var(--space-md)" }}>Redirecting to your stable...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!ready) {
        return (
            <div className="auth-page">
                <div className="card card-auth animate-fade-in-up">
                    <div className="card-header">
                        <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)" }} aria-hidden="true">🔐</div>
                        <h1>Verifying <span className="text-gradient">Reset Link</span></h1>
                        <p style={{ marginTop: "var(--space-md)" }}>
                            {error || "Please wait while we verify your reset link..."}
                        </p>
                        {error && (
                            <a href="/forgot-password" className="btn btn-primary btn-full" style={{ marginTop: "var(--space-lg)" }}>
                                Request New Reset Link
                            </a>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page">
            <div className="card card-auth animate-fade-in-up">
                <div className="card-header">
                    <h1>New <span className="text-gradient">Password</span></h1>
                    <p>Choose a new password for your account</p>
                </div>

                {error && (
                    <div className="form-error" role="alert">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                    <div className="form-group">
                        <label htmlFor="new-password" className="form-label">New Password</label>
                        <input
                            id="new-password"
                            type="password"
                            className="form-input"
                            placeholder="At least 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            autoComplete="new-password"
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirm-new-password" className="form-label">Confirm New Password</label>
                        <input
                            id="confirm-new-password"
                            type="password"
                            className="form-input"
                            placeholder="Re-enter your password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            autoComplete="new-password"
                        />
                    </div>

                    <button type="submit" className="btn btn-primary btn-full" disabled={isPending} id="reset-submit">
                        {isPending ? (
                            <>
                                <span className="btn-spinner" aria-hidden="true" />
                                Updating...
                            </>
                        ) : (
                            "Update Password"
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

