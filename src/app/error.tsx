"use client";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6">
            <div className="bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all text-center py-[var(--space-3xl)] px-8 animate-fade-in-up max-w-[500px] mx-auto">
                <div className="text-center py-[var(--space-3xl)] px-8-icon">⚠️</div>
                <h2>Something Went Wrong</h2>
                <p>An unexpected error occurred. Please try again.</p>
                <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm" onClick={reset}>
                    Try Again
                </button>
            </div>
        </div>
    );
}
