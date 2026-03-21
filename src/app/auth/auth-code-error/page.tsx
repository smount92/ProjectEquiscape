import Link from "next/link";

export default function AuthCodeErrorPage() {
    return (
        <div className="min-h-[calc(100vh - var(--sticky h-[var(--header max-sm:px-4-height)] bg-parchment-dark border-edge transition-all-height))] top-0 z-[100] flex items-center justify-between justify-center border-b p-8 px-8 py-[0] max-sm:py-[0]">
            <div className="bg-card border-edge animate-fade-in-up relative w-full max-w-[460px] overflow-hidden rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                <div className="bg-card border-edge transition-all-sticky h-[var(--header max-sm:px-4-height)] bg-parchment-dark border-edge top-0 z-[100] flex items-center justify-between rounded-lg border border-b p-12 px-8 py-[0] shadow-md transition-all max-[480px]:rounded-[var(--radius-md)] max-sm:py-[0]">
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
                        className="hover:no-underline-min-h)] bg-forest text-inverse flex inline-flex min-h-[var(--opacity-[0.5] w-full cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                        id="retry-signup"
                    >
                        Sign Up Again
                    </Link>
                    <Link
                        href="/login"
                        className="hover:no-underline-min-h)] text-ink-light border-edge flex inline-flex min-h-[var(--opacity-[0.5] w-full cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                        id="go-to-login"
                    >
                        Back to Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
}
