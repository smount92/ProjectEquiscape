import Link from "next/link";

export default function AuthCodeErrorPage() {
    return (
        <div className="auth-page">
            <div className="card card-auth animate-fade-in-up">
                <div className="card-header">
                    <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)" }} aria-hidden="true">
                        ⚠️
                    </div>
                    <h1>Link Expired</h1>
                    <p style={{ marginTop: "var(--space-md)" }}>
                        This confirmation link has expired or is invalid. Please try signing up again
                        or request a new confirmation email.
                    </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                    <Link href="/signup" className="btn btn-primary btn-full" id="retry-signup">
                        Sign Up Again
                    </Link>
                    <Link href="/login" className="btn btn-ghost btn-full" id="go-to-login">
                        Back to Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
}
