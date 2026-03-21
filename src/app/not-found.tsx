import Link from "next/link";

export default function NotFound() {
    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6">
            <div className="bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all text-center py-[var(--space-3xl)] px-8 animate-fade-in-up" style={{ maxWidth: "500px", margin: "0 auto" }}>
                <div className="text-center py-[var(--space-3xl)] px-8-icon">🔍</div>
                <h2>Page Not Found</h2>
                <p>The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
                <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm">
                    Back to Stable
                </Link>
            </div>
        </div>
    );
}
