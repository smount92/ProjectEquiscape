import ScoreRadar from "@/components/shows/ScoreRadar";
import type { Rubric } from "@/lib/shows/rubrics";

/**
 * The entrant's scorecard — what every entry in a scored class leaves
 * with, whatever it placed. Radar against the class average, then the
 * criteria ledger with weights. The judge's prose lives in the
 * critique block beside this; the numbers live here. Rendered only
 * once the class publishes results (the caller gates).
 */
export default function ScorecardPanel({
    rubric,
    scores,
    total,
    averages,
    horseName,
}: {
    rubric: Rubric;
    scores: Record<string, number>;
    total: number | null;
    averages: Record<string, number> | null;
    horseName: string;
}) {
    return (
        <div className="border-input bg-card rounded-xl border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-foreground m-0 font-serif text-base font-bold">
                    🎯 Scorecard
                </h4>
                {total != null && (
                    <span className="text-foreground font-serif text-xl font-bold tabular-nums">
                        {total}
                        <span className="text-muted-foreground text-sm font-normal"> / 100</span>
                    </span>
                )}
            </div>
            <div className="text-muted-foreground mt-1 mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span>
                    <span
                        aria-hidden="true"
                        className="mr-1.5 inline-block w-3.5 rounded-sm border-t-[3px] align-middle"
                        style={{ borderColor: "var(--chart-entry)" }}
                    />
                    {horseName}
                </span>
                {averages && (
                    <span>
                        <span
                            aria-hidden="true"
                            className="mr-1.5 inline-block w-3.5 rounded-sm border-t-[3px] border-dashed align-middle"
                            style={{ borderColor: "var(--chart-avg)" }}
                        />
                        Class average
                    </span>
                )}
            </div>

            <ScoreRadar rubric={rubric} scores={scores} averages={averages} />

            <div className="mt-2">
                {rubric.criteria.map((c) => {
                    const s = scores[c.key];
                    const avg = averages?.[c.key];
                    return (
                        <div key={c.key} className="border-border-tan/30 border-b border-dashed py-2 last:border-b-0">
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                                <span className="font-semibold">
                                    {c.label}
                                    <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                                        {c.weight}%
                                    </span>
                                </span>
                                <span className="font-serif font-bold tabular-nums">
                                    {s ?? "—"}
                                    <span className="text-muted-foreground text-xs font-normal">
                                        {" "}/10{avg != null ? ` · class ${avg}` : ""}
                                    </span>
                                </span>
                            </div>
                            <div className="bg-border-tan/30 relative mt-1.5 h-2 overflow-visible rounded-full">
                                <div
                                    className="absolute inset-y-0 left-0 rounded-full"
                                    style={{ width: `${(s ?? 0) * 10}%`, background: "var(--chart-entry)" }}
                                />
                                {avg != null && (
                                    <div
                                        aria-hidden="true"
                                        className="absolute -top-0.5 -bottom-0.5 w-[3px] rounded-sm"
                                        style={{ left: `calc(${avg * 10}% - 1.5px)`, background: "var(--chart-avg)" }}
                                    />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
