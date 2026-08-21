import { statIsPresentable, type PublicStats } from "@/lib/stats/publicStatsShape";

/**
 * Live counts on the green webbing strap.
 *
 * `.stat-num` / `.stat-label` only style as descendants of `.stats-strap`
 * (globals.css:2733) — keep the wrapper.
 *
 * Every figure is a real read. A read that failed, or that came back zero,
 * drops out of the row; if all four drop out the section renders nothing.
 * Nobody needs to see "0 shows judged" on a front door.
 */
export default function StatsStrap({ stats }: { stats: PublicStats }) {
    const entries: { value: number; label: string }[] = [];

    if (statIsPresentable(stats.catalogItems)) {
        entries.push({ value: stats.catalogItems, label: "Reference entries" });
    }
    if (statIsPresentable(stats.publicHorses)) {
        entries.push({ value: stats.publicHorses, label: "Horses on show" });
    }
    if (statIsPresentable(stats.showsCompleted)) {
        entries.push({ value: stats.showsCompleted, label: "Shows judged" });
    }
    if (statIsPresentable(stats.listingsForSale)) {
        entries.push({ value: stats.listingsForSale, label: "For sale now" });
    }

    if (entries.length === 0) return null;

    return (
        <section className="px-8 py-8" id="stats">
            <div
                className="stats-strap mx-auto max-w-5xl"
                role="group"
                aria-label="Live counts from the database"
            >
                {entries.map(({ value, label }) => (
                    <div key={label}>
                        <div className="stat-num">{value.toLocaleString("en-US")}</div>
                        <div className="stat-label">{label}</div>
                    </div>
                ))}
            </div>
            <p className="text-muted-foreground mx-auto mt-3 max-w-5xl text-center text-xs">
                Counted from the database, not written into the page. Refreshed hourly.
            </p>
        </section>
    );
}
