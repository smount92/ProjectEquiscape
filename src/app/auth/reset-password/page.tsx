"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
    const router = useRouter();
    const supabase = createClient();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);
    const [success, setSuccess] = useState(false);

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
