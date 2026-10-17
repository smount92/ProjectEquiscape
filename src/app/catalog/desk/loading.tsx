/** Inside the Desk's layout: the masthead and tabs stay put while a section loads. */
export default function DeskLoading() {
    return (
        <div className="flex min-h-[70vh] animate-pulse flex-col gap-3" aria-busy="true" aria-label="Loading">
            <div className="h-10 w-2/3 rounded-lg bg-muted" />
            {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-36 rounded-lg border border-input bg-card/60" />
            ))}
        </div>
    );
}
