export default function Loading() {
    return (
        <div className="mx-auto min-h-[60vh] max-w-[var(--max-width)] px-6 py-[0]">
            <div className="loading-skeleton">
                <div className="skeleton-hero" />
                <div className="grid-cols-[repeat(auto-fill, minmax(260px, 1fr))] grid gap-6">
                    <div className="skeleton-bg-card border-edge rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]" />
                    <div className="skeleton-bg-card border-edge rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]" />
                    <div className="skeleton-bg-card border-edge rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]" />
                    <div className="skeleton-bg-card border-edge rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]" />
                    <div className="skeleton-bg-card border-edge rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]" />
                    <div className="skeleton-bg-card border-edge rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]" />
                </div>
            </div>
        </div>
    );
}
