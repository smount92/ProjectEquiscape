"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
    confirmInstallmentReceived,
    markInstallmentSent,
    savePaymentPlan,
} from "@/app/actions/deals";
import { formatDate, formatMoney, formatStamp } from "@/lib/deals/terms";
import {
    buildPlan,
    daysOverdue,
    installmentState,
    installmentStateLabel,
    ledgerSummary,
    type Installment,
    type PlanCadence,
} from "@/lib/deals/ledger";
import type { DealParty } from "@/lib/deals/vocabulary";

/**
 * THE PAYMENT LEDGER.
 *
 * Six monthly payments arranged in a DM, tracked in nobody's
 * spreadsheet, with a $400 resin off the market for half a year on a
 * handshake. This is the tool nobody in this hobby has ever had, and it
 * costs us nothing regulatory because we only RECORD the schedule — the
 * money still moves between the two people, wherever it always did.
 *
 * Two things this panel deliberately does not do:
 *
 *  · It never enforces. A payment past its due date is shown as past
 *    due, in the same neutral type as everything else, with no red
 *    capitals and no automatic consequence. What happens on a missed
 *    payment is in the parties' own terms box, in their own words.
 *  · It never settles. "Marked sent" and "confirmed received" are two
 *    people's dated statements, and the panel says so out loud.
 */

interface PaymentPlanPanelProps {
    conversationId: string;
    installments: Installment[];
    party: DealParty;
    /** Which side owes the money, from the deal kind and the terms. */
    payer: DealParty | null;
    labels: { a: string; b: string };
    /** The price the terms agreed, so a new plan can be pre-split. */
    agreedPrice: number | null;
    readOnly: boolean;
    readOnlyReason?: string | null;
}

export default function PaymentPlanPanel({
    conversationId,
    installments,
    party,
    payer,
    labels,
    agreedPrice,
    readOnly,
    readOnlyReason,
}: PaymentPlanPanelProps) {
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [building, setBuilding] = useState(false);
    const router = useRouter();

    const summary = useMemo(() => ledgerSummary(installments), [installments]);
    const iAmPayer = payer !== null && party === payer;
    const payerLabel = payer === "a" ? labels.a : payer === "b" ? labels.b : "the paying side";

    const act = async (id: string, fn: () => Promise<{ success: boolean; error?: string }>) => {
        setBusyId(id);
        setError("");
        const result = await fn();
        if (result.success) router.refresh();
        else setError(result.error ?? "That didn't work.");
        setBusyId(null);
    };

    if (installments.length === 0) {
        return (
            <section className="bg-card border-input rounded-lg border p-6 shadow-md" id="deal-ledger">
                <Heading />
                {building ? (
                    <PlanBuilder
                        conversationId={conversationId}
                        agreedPrice={agreedPrice}
                        onDone={() => {
                            setBuilding(false);
                            router.refresh();
                        }}
                        onCancel={() => setBuilding(false)}
                    />
                ) : (
                    <div className="text-secondary-foreground text-sm leading-relaxed">
                        <p className="mb-3">
                            Paying over time? Write the schedule down. Each payment becomes a row
                            you both see: due, marked sent, confirmed received — with dates.
                        </p>
                        <p className="text-muted-foreground mb-4 text-xs">
                            Model Horse Hub never holds funds. This is a shared record of payments
                            you make to each other directly.
                        </p>
                        {!readOnly && (
                            <Button onClick={() => setBuilding(true)}>Set up a payment plan</Button>
                        )}
                        {readOnly && readOnlyReason && (
                            <p className="text-muted-foreground m-0 text-xs">{readOnlyReason}</p>
                        )}
                    </div>
                )}
            </section>
        );
    }

    return (
        <section className="bg-card border-input rounded-lg border p-6 shadow-md" id="deal-ledger">
            <Heading />

            {/* Progress — by money confirmed, not by rows ticked */}
            <div className="mb-4">
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-serif text-base font-bold">
                        {formatMoney(summary.confirmedTotal)}{" "}
                        <span className="text-muted-foreground font-sans text-sm font-normal">
                            of {formatMoney(summary.total)} confirmed
                        </span>
                    </span>
                    <span className="text-muted-foreground text-xs">
                        {summary.confirmedCount} of {summary.count} payments
                    </span>
                </div>
                <div
                    className="bg-muted h-2 w-full overflow-hidden rounded-full"
                    role="progressbar"
                    aria-valuenow={summary.progressPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Payments confirmed"
                >
                    <div
                        className="bg-forest h-full rounded-full transition-all"
                        style={{ width: `${summary.progressPct}%` }}
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                    <thead>
                        <tr className="border-input text-muted-foreground border-b text-left text-xs">
                            <th className="py-2 pr-2 font-semibold">#</th>
                            <th className="py-2 pr-2 font-semibold">Amount</th>
                            <th className="py-2 pr-2 font-semibold">Due</th>
                            <th className="py-2 pr-2 font-semibold">Sent</th>
                            <th className="py-2 pr-2 font-semibold">Received</th>
                            <th className="py-2 font-semibold" />
                        </tr>
                    </thead>
                    <tbody>
                        {installments.map((row) => {
                            const state = installmentState(row);
                            const late = daysOverdue(row);
                            return (
                                <tr key={row.id} className="border-input/60 border-b last:border-b-0">
                                    <td className="text-muted-foreground py-2.5 pr-2">{row.seq}</td>
                                    <td className="py-2.5 pr-2 font-semibold">
                                        {formatMoney(row.amount)}
                                    </td>
                                    <td className="py-2.5 pr-2">
                                        {formatDate(row.dueDate)}
                                        {late > 0 && (
                                            <span className="text-muted-foreground block text-[0.65rem]">
                                                {late} day{late === 1 ? "" : "s"} ago
                                            </span>
                                        )}
                                    </td>
                                    <td className="text-muted-foreground py-2.5 pr-2 text-xs">
                                        {row.markedSentAt ? formatStamp(row.markedSentAt) : "—"}
                                    </td>
                                    <td className="text-muted-foreground py-2.5 pr-2 text-xs">
                                        {row.confirmedAt ? formatStamp(row.confirmedAt) : "—"}
                                    </td>
                                    <td className="py-2.5 text-right">
                                        {readOnly ? (
                                            <StateChip state={state} />
                                        ) : state === "confirmed" ? (
                                            <StateChip state={state} />
                                        ) : iAmPayer && !row.markedSentAt ? (
                                            <Button
                                                size="xs"
                                                variant="outline"
                                                disabled={busyId === row.id}
                                                onClick={() =>
                                                    act(row.id, () => markInstallmentSent(row.id))
                                                }
                                            >
                                                {busyId === row.id ? "…" : "I sent this"}
                                            </Button>
                                        ) : !iAmPayer && payer !== null ? (
                                            <Button
                                                size="xs"
                                                disabled={busyId === row.id}
                                                onClick={() =>
                                                    act(row.id, () =>
                                                        confirmInstallmentReceived(row.id),
                                                    )
                                                }
                                            >
                                                {busyId === row.id ? "…" : "Received"}
                                            </Button>
                                        ) : (
                                            <StateChip state={state} />
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="border-input text-muted-foreground mt-4 border-t pt-3 text-xs leading-relaxed">
                {summary.allConfirmed ? (
                    <>Paid in full. Both sides have confirmed every payment.</>
                ) : (
                    <>
                        {payer
                            ? `${payerLabel} marks a payment sent; the other side confirms it arrived. `
                            : "Your terms don't say who is paying — add a price box to name the paying side. "}
                        {summary.overdue.length > 0 && (
                            <>
                                {summary.overdue.length} payment
                                {summary.overdue.length === 1 ? " is" : "s are"} past the date you
                                agreed. Model Horse Hub doesn&apos;t act on that — what happens next
                                is whatever your terms say.
                            </>
                        )}
                    </>
                )}
            </div>

            {readOnly && readOnlyReason && (
                <p className="text-muted-foreground mt-2 mb-0 text-xs">{readOnlyReason}</p>
            )}
            {error && (
                <p className="text-destructive border-destructive/30 bg-destructive/10 mt-3 mb-0 rounded-md border px-4 py-2 text-sm">
                    {error}
                </p>
            )}
        </section>
    );
}

function Heading() {
    return (
        <div className="brass-heading mb-4">
            <span className="brass-heading-bar" aria-hidden="true" />
            <h3 className="text-secondary-foreground m-0 text-sm">Payment ledger</h3>
        </div>
    );
}

function StateChip({ state }: { state: ReturnType<typeof installmentState> }) {
    const tone =
        state === "confirmed"
            ? "bg-success/15 text-success border-success/40"
            : state === "sent"
              ? "border-forest/25 bg-forest/5 text-forest"
              : state === "overdue" || state === "due"
                ? "border-input bg-muted text-secondary-foreground"
                : "border-input bg-muted text-muted-foreground";
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tone}`}
        >
            {installmentStateLabel(state)}
        </span>
    );
}

// ── Setting one up ────────────────────────────────────────────────────

/**
 * The builder splits a total across N dates as ARITHMETIC, then hands
 * every row back for editing. It is a calculator, not a policy: the
 * parties choose the total, the count, the first date and the cadence,
 * and can change any row before saving.
 */
function PlanBuilder({
    conversationId,
    agreedPrice,
    onDone,
    onCancel,
}: {
    conversationId: string;
    agreedPrice: number | null;
    onDone: () => void;
    onCancel: () => void;
}) {
    const [total, setTotal] = useState(agreedPrice != null ? String(agreedPrice) : "");
    const [count, setCount] = useState("6");
    const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
    const [cadence, setCadence] = useState<PlanCadence>("monthly");
    const [rows, setRows] = useState<{ amount: number; dueDate: string | null }[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const preview = () => {
        const t = Number(total);
        const c = Number(count);
        if (!Number.isFinite(t) || t <= 0) {
            setError("Enter the total these payments add up to.");
            return;
        }
        if (!Number.isFinite(c) || c < 1) {
            setError("Enter how many payments.");
            return;
        }
        setError("");
        setRows(
            buildPlan({ total: t, count: c, startDate: start || null, cadence }).map((r) => ({
                amount: r.amount,
                dueDate: r.dueDate,
            })),
        );
    };

    const save = async () => {
        if (!rows) return;
        setBusy(true);
        setError("");
        const result = await savePaymentPlan(conversationId, rows);
        if (result.success) onDone();
        else setError(result.error ?? "Couldn't save the plan.");
        setBusy(false);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-4">
                <div>
                    <label className="text-muted-foreground mb-1 block text-xs" htmlFor="plan-total">
                        Total
                    </label>
                    <input
                        id="plan-total"
                        type="number"
                        min="0"
                        step="0.01"
                        className="border-input bg-card h-9 w-full rounded-md border px-3 text-sm"
                        value={total}
                        onChange={(e) => setTotal(e.target.value)}
                    />
                </div>
                <div>
                    <label className="text-muted-foreground mb-1 block text-xs" htmlFor="plan-count">
                        Payments
                    </label>
                    <input
                        id="plan-count"
                        type="number"
                        min="1"
                        max="120"
                        className="border-input bg-card h-9 w-full rounded-md border px-3 text-sm"
                        value={count}
                        onChange={(e) => setCount(e.target.value)}
                    />
                </div>
                <div>
                    <label className="text-muted-foreground mb-1 block text-xs" htmlFor="plan-start">
                        First due
                    </label>
                    <input
                        id="plan-start"
                        type="date"
                        className="border-input bg-card h-9 w-full rounded-md border px-3 text-sm"
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                    />
                </div>
                <div>
                    <label
                        className="text-muted-foreground mb-1 block text-xs"
                        htmlFor="plan-cadence"
                    >
                        Every
                    </label>
                    <select
                        id="plan-cadence"
                        className="border-input bg-card h-9 w-full rounded-md border px-3 text-sm"
                        value={cadence}
                        onChange={(e) => setCadence(e.target.value as PlanCadence)}
                    >
                        <option value="weekly">Week</option>
                        <option value="biweekly">Two weeks</option>
                        <option value="monthly">Month</option>
                    </select>
                </div>
            </div>

            {rows && (
                <div className="border-input bg-muted/40 rounded-lg border p-4">
                    <div className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                        Change any row before you save
                    </div>
                    <div className="flex flex-col gap-2">
                        {rows.map((row, i) => (
                            <div key={i} className="flex flex-wrap items-center gap-2">
                                <span className="text-muted-foreground w-6 text-xs">{i + 1}</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="border-input bg-card h-9 w-28 rounded-md border px-3 text-sm"
                                    value={row.amount}
                                    aria-label={`Payment ${i + 1} amount`}
                                    onChange={(e) =>
                                        setRows(
                                            rows.map((r, j) =>
                                                j === i ? { ...r, amount: Number(e.target.value) } : r,
                                            ),
                                        )
                                    }
                                />
                                <input
                                    type="date"
                                    className="border-input bg-card h-9 rounded-md border px-3 text-sm"
                                    value={row.dueDate ?? ""}
                                    aria-label={`Payment ${i + 1} due date`}
                                    onChange={(e) =>
                                        setRows(
                                            rows.map((r, j) =>
                                                j === i
                                                    ? { ...r, dueDate: e.target.value || null }
                                                    : r,
                                            ),
                                        )
                                    }
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                {rows ? (
                    <>
                        <Button onClick={save} disabled={busy}>
                            {busy ? "Saving…" : "Save the plan"}
                        </Button>
                        <Button
                            variant="outline"
                            size="wide"
                            onClick={() => setRows(null)}
                            disabled={busy}
                        >
                            Start over
                        </Button>
                    </>
                ) : (
                    <Button onClick={preview}>Work out the payments</Button>
                )}
                <Button variant="outline" size="wide" onClick={onCancel} disabled={busy}>
                    Cancel
                </Button>
            </div>

            {error && (
                <p className="text-destructive border-destructive/30 bg-destructive/10 m-0 rounded-md border px-4 py-2 text-sm">
                    {error}
                </p>
            )}
        </div>
    );
}
