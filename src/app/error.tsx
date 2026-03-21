"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <div className="mx-auto max-w-[var(--max-width)] px-6 py-[0]">
            <div className="bg-card border-edge animate-fade-in-up mx-auto max-w-[500px] rounded-lg border p-12 px-8 py-[var(--space-3xl)] text-center shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                <div className="px-8-icon py-[var(--space-3xl)] text-center">⚠️</div>
                <h2>Something Went Wrong</h2>
                <p>An unexpected error occurred. Please try again.</p>
                <button
                    className="hover:no-underline-min-h)] bg-forest text-inverse inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                    onClick={reset}
                >
                    Try Again
                </button>
            </div>
        </div>
    );
}
