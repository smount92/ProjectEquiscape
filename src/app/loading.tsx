export default function Loading() {
    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6 min-h-[60vh]">
            <div className="loading-skeleton">
                <div className="skeleton-hero" />
                <div className="grid grid-cols-[repeat(auto-fill, minmax(260px, 1fr))] gap-6">
                    <div className="skeleton-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all" />
                    <div className="skeleton-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all" />
                    <div className="skeleton-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all" />
                    <div className="skeleton-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all" />
                    <div className="skeleton-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all" />
                    <div className="skeleton-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all" />
                </div>
            </div>
        </div>
    );
}
