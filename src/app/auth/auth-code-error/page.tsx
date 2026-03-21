import Link from "next/link";

export default function AuthCodeErrorPage() {
    return (
        <div className="flex items-center justify-center min-h-[calc(100vh - var(--sticky top-0 z-[100] h-[var(--header max-sm:py-[0] max-sm:px-4-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all-height))] p-8">
            <div className="bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all w-full max-w-[460px] relative overflow-hidden animate-fade-in-up">
                <div className="bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all-sticky top-0 z-[100] h-[var(--header max-sm:py-[0] max-sm:px-4-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">
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
                    <Link href="/signup" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm flex w-full" id="retry-signup">
                        Sign Up Again
                    </Link>
                    <Link href="/login" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge flex w-full" id="go-to-login">
                        Back to Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
}
