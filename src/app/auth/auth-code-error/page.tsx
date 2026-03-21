import Link from "next/link";

export default function AuthCodeErrorPage() {
    return (
        <div className="min-h-[calc(100vh - var(sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
            <div className="bg-card border-edge animate-fade-in-up relative w-full max-w-[460px] overflow-hidden rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                <div className="bg-card border-edge sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
                    <div aria-hidden="true" className="mb-4 text-[3rem]">
                        ⚠️
                    </div>
                    <h1>Link Expired</h1>
                    <p className="mt-4">
                        This confirmation link has expired or is invalid. Please try signing up again or request a new
                        confirmation email.
                    </p>
                </div>
                <div className="gap-2" style={{ display: "flex", flexDirection: "column" }}>
                    <Link
                        href="/signup"
                        className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
                        id="retry-signup"
                    >
                        Sign Up Again
                    </Link>
                    <Link
                        href="/login"
                        className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
                        id="go-to-login"
                    >
                        Back to Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
}
