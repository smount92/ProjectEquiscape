export default function Loading() {
    return (
        <div className="page-container min-h-[60vh]">
            <div className="loading-skeleton">
                <div className="skeleton-hero" />
                <div className="grid grid-cols-[repeat(auto-fill, minmax(260px, 1fr))] gap-6">
                    <div className="skeleton-card" />
                    <div className="skeleton-card" />
                    <div className="skeleton-card" />
                    <div className="skeleton-card" />
                    <div className="skeleton-card" />
                    <div className="skeleton-card" />
                </div>
            </div>
        </div>
    );
}
