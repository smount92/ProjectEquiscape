import { monthlySeries, type IncomeSummary } from "@/lib/studio/income";
import { formatMoney } from "@/lib/studio/terms";
import { LedgerRow, OffPlatformNote, Panel } from "./StudioBits";

/**
 * The income summary — the half of a commission tracker artists actually
 * open it for: what did I earn, which months were good, what's still owed.
 *
 * Every figure is a DISPLAY of prices the artist agreed and payments they
 * told us arrived. Model Horse Hub processes nothing.
 */
export default function IncomePanel({ summary }: { summary: IncomeSummary }) {
    const series = monthlySeries(summary.byMonth, 12);
    const peak = Math.max(...series.map((b) => b.total), 1);
    const hasHistory = summary.earnedCount > 0;

    return (
        <Panel title="The books" icon="📈">
            <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <Stat
                    label="Earned, all time"
                    value={formatMoney(summary.earnedAllTime)}
                    hint={`${summary.earnedCount} commission${summary.earnedCount === 1 ? "" : "s"}`}
                />
                <Stat
                    label="Last 12 months"
                    value={formatMoney(summary.earnedLast12)}
                    hint={
                        summary.averageCommission != null
                            ? `${formatMoney(summary.averageCommission)} average`
                            : undefined
                    }
                />
                <Stat
                    label="On the bench"
                    value={formatMoney(summary.committedActive)}
                    hint={`${summary.activeCount} in progress`}
                />
            </div>

            {hasHistory ? (
                <>
                    <div className="border-input bg-muted/30 mb-4 rounded-md border p-4">
                        <div className="mb-2 flex items-end justify-between gap-1">
                            {series.map((bucket) => (
                                <div
                                    key={bucket.key}
                                    className="flex flex-1 flex-col items-center gap-1"
                                    title={`${bucket.label}: ${formatMoney(bucket.total)}`}
                                >
                                    <div
                                        className={`w-full rounded-t-sm ${
                                            bucket.total > 0 ? "bg-studio" : "bg-input"
                                        }`}
                                        style={{
                                            height: `${Math.max(2, (bucket.total / peak) * 72)}px`,
                                        }}
                                    />
                                    <span className="text-muted-foreground text-[0.6rem]">
                                        {bucket.label.slice(0, 1)}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="text-muted-foreground flex justify-between text-[0.65rem]">
                            <span>{series[0]?.label}</span>
                            <span>{series[series.length - 1]?.label}</span>
                        </div>
                    </div>

                    {summary.bestMonth && summary.bestMonth.total > 0 && (
                        <p className="text-secondary-foreground mb-4 text-sm">
                            Your best month was <strong>{summary.bestMonth.label}</strong> —{" "}
                            {formatMoney(summary.bestMonth.total)} across{" "}
                            {summary.bestMonth.count} commission
                            {summary.bestMonth.count === 1 ? "" : "s"}.
                        </p>
                    )}
                </>
            ) : (
                <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                    Nothing completed yet. Once you finish a commission its agreed price lands
                    here, and the monthly view fills in as you go.
                </p>
            )}

            <div className="grid">
                {summary.quotedCount > 0 && (
                    <LedgerRow
                        label="Quotes outstanding"
                        value={formatMoney(summary.quotedOutstanding)}
                        hint={`${summary.quotedCount} awaiting an answer`}
                    />
                )}
                {summary.depositsOutstanding > 0 && (
                    <LedgerRow
                        label="Deposits not yet received"
                        value={formatMoney(summary.depositsOutstanding)}
                    />
                )}
                {summary.balanceOutstanding > 0 && (
                    <LedgerRow
                        label="Balances still owed"
                        value={formatMoney(summary.balanceOutstanding)}
                    />
                )}
            </div>

            <div className="border-input mt-4 border-t pt-4">
                <OffPlatformNote />
            </div>
        </Panel>
    );
}

function Stat({
    label,
    value,
    hint,
}: {
    label: string;
    value: string;
    hint?: string;
}) {
    return (
        <div className="border-input bg-muted/40 rounded-md border p-4">
            <div className="text-muted-foreground mb-1 text-xs">{label}</div>
            <div className="font-serif text-xl font-bold tabular-nums">{value}</div>
            {hint && <div className="text-muted-foreground mt-0.5 text-xs">{hint}</div>}
        </div>
    );
}
