import type { Rubric } from "@/lib/shows/rubrics";

/**
 * The scorecard radar — one entry's shape against the class average.
 * Server-safe SVG (no hooks, geometry computed at render), styled
 * through CSS variables so both themes hold. Identity never rides on
 * color alone: the entry is a FILLED SOLID polygon, the average a
 * DASHED line, and both appear in the legend the caller renders.
 *
 * Chart steps (validated, dataviz six checks):
 *   light  entry #1f7d4a · average #c07c14  on cream
 *   dark   entry #35a56b · average #c4841f  on ink
 * exposed as --chart-entry / --chart-avg in globals.css.
 */
export default function ScoreRadar({
    rubric,
    scores,
    averages,
    size = 300,
}: {
    rubric: Rubric;
    scores: Record<string, number>;
    averages?: Record<string, number> | null;
    size?: number;
}) {
    const n = rubric.criteria.length;
    const cx = size / 2;
    const cy = size / 2 + 6;
    const R = size / 2 - 52;

    const pt = (i: number, v: number): [number, number] => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        return [cx + Math.cos(a) * R * (v / 10), cy + Math.sin(a) * R * (v / 10)];
    };
    const ringPoints = (v: number) =>
        rubric.criteria.map((_, i) => pt(i, v).join(",")).join(" ");

    const entryPts = rubric.criteria.map((c, i) => pt(i, scores[c.key] ?? 0));
    const avgPts = averages
        ? rubric.criteria.map((c, i) => pt(i, averages[c.key] ?? 0))
        : null;

    return (
        <svg
            viewBox={`0 0 ${size} ${size + 8}`}
            className="mx-auto block h-auto w-full max-w-[340px]"
            role="img"
            aria-label={`Radar chart: ${rubric.criteria
                .map((c) => `${c.label} ${scores[c.key] ?? "—"} of 10`)
                .join(", ")}${averages ? ", dashed line shows the class average" : ""}.`}
        >
            {[2, 4, 6, 8, 10].map((v) => (
                <polygon
                    key={v}
                    points={ringPoints(v)}
                    fill="none"
                    stroke="var(--border-tan, #d8cbae)"
                    strokeOpacity={0.55}
                    strokeWidth={1}
                />
            ))}
            {rubric.criteria.map((_, i) => {
                const [x, y] = pt(i, 10);
                return (
                    <line
                        key={i}
                        x1={cx}
                        y1={cy}
                        x2={x}
                        y2={y}
                        stroke="var(--border-tan, #d8cbae)"
                        strokeOpacity={0.55}
                        strokeWidth={1}
                    />
                );
            })}
            {avgPts && (
                <polygon
                    points={avgPts.map((p) => p.join(",")).join(" ")}
                    fill="none"
                    stroke="var(--chart-avg, #c07c14)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    strokeLinejoin="round"
                />
            )}
            <polygon
                points={entryPts.map((p) => p.join(",")).join(" ")}
                fill="var(--chart-entry, #1f7d4a)"
                fillOpacity={0.16}
                stroke="var(--chart-entry, #1f7d4a)"
                strokeWidth={2.5}
                strokeLinejoin="round"
            />
            {entryPts.map(([x, y], i) => (
                <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={4}
                    fill="var(--chart-entry, #1f7d4a)"
                    stroke="var(--card, #fffdf6)"
                    strokeWidth={2}
                >
                    <title>
                        {rubric.criteria[i].label}: {scores[rubric.criteria[i].key] ?? "—"}/10
                        {averages ? ` (class avg ${averages[rubric.criteria[i].key] ?? "—"})` : ""}
                    </title>
                </circle>
            ))}
            {rubric.criteria.map((c, i) => {
                const [x, y] = pt(i, 12.6);
                const anchor = x < cx - 10 ? "end" : x > cx + 10 ? "start" : "middle";
                const words = c.label.split(" ");
                const line1 = words.slice(0, Math.ceil(words.length / 2)).join(" ");
                const line2 = words.slice(Math.ceil(words.length / 2)).join(" ");
                return (
                    <text
                        key={c.key}
                        x={x}
                        y={y}
                        textAnchor={anchor}
                        fontSize={10.5}
                        fontWeight={600}
                        fill="var(--foreground, #2b241b)"
                    >
                        {line2 ? (
                            <>
                                <tspan x={x} dy="-0.3em">{line1}</tspan>
                                <tspan x={x} dy="1.1em">
                                    {line2} · {scores[c.key] ?? "—"}
                                </tspan>
                            </>
                        ) : (
                            <>{c.label} · {scores[c.key] ?? "—"}</>
                        )}
                    </text>
                );
            })}
        </svg>
    );
}
