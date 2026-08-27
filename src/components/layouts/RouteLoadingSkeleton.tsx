/**
 * Route loading skeleton (dashboard, catalog, market, community, feed,
 * discover, shows — each route's loading.tsx re-exports this).
 *
 * SIZED FOR CLS, not looks. The previous version was a hero strip over
 * six EMPTY (zero-height) cards inside min-h-[60vh]: on mobile the
 * footer sat one small scroll away, people scroll immediately while
 * data loads, and when the real page streamed in (2-3 viewports tall)
 * the footer shifted by up to 1.36 viewports — the single biggest
 * driver of the mobile Real Experience Score sitting at 77 while
 * desktop sat at 99. Cards now hold real height and the container
 * spans well past one viewport, so during the load there is skeleton
 * where the user scrolls, not footer.
 */
export default function Loading() {
    return (
        <div className="mx-auto min-h-[130vh] max-w-6xl px-6 py-8 md:min-h-[100vh]">
            <div className="animate-pulse">
                <div className="skeleton-hero" />
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6">
                    {Array.from({ length: 8 }, (_, i) => (
                        <div
                            key={i}
                            className="bg-card/50 border-input h-44 rounded-lg border shadow-md"
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
