/**
 * The Paddock's own skeleton. The shared root loader draws a card
 * GRID, which is the wrong shape here and made the room visibly
 * re-flow on every navigation — this one is the masthead, the stream
 * column and the rail, in their real proportions.
 */
export default function Loading() {
    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:py-12 lg:px-8">
            <div className="animate-pulse mx-auto max-w-6xl">
                <div className="leather-band stitched mb-6 h-[86px] rounded-xl" />

                <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-10">
                    <div className="flex min-w-0 flex-col gap-5">
                        <div className="ledger-card h-[150px]" />
                        <div className="ledger-card h-[180px]" />
                        <div className="ledger-card h-[180px]" />
                    </div>
                    <div className="flex flex-col gap-5">
                        <div className="ledger-card h-[140px]" />
                        <div className="ledger-card h-[160px]" />
                        <div className="ledger-card h-[120px]" />
                    </div>
                </div>
            </div>
        </div>
    );
}
