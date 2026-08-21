"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
    linkHorseToCommission,
    markModelReceived,
    recordPayment,
    type Commission,
} from "@/app/actions/art-studio";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/studio/terms";

/**
 * The artist's per-commission bookkeeping: did the model arrive, has the
 * money landed, which horse is this.
 *
 * NOTHING HERE PROCESSES PAYMENT. These are the artist's own records of
 * money that moved somewhere else, kept so the income summary is honest
 * and both sides have the same account of it.
 */
export default function ArtistControls({ commission }: { commission: Commission }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const deposit = commission.depositAmount;
    const balance =
        commission.agreedPrice != null
            ? Math.max(0, commission.agreedPrice - (commission.depositPaid ? (deposit ?? 0) : 0))
            : null;

    const act = async (fn: () => Promise<{ success: boolean; error?: string }>) => {
        setBusy(true);
        setError(null);
        const result = await fn();
        setBusy(false);
        if (!result.success) {
            setError(result.error ?? "That didn't save.");
            return;
        }
        router.refresh();
    };

    return (
        <div className="bg-card border-input rounded-lg border p-6 shadow-md">
            <h2 className="mb-4 font-serif text-lg font-bold">🧾 Your records</h2>

            {/* ── Logistics. A flag, not a pipeline stage: v1 used one
                `shipping` status for the model travelling BOTH ways. ── */}
            <div className="border-input/60 border-b pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <div className="text-sm font-semibold">The commissioner&rsquo;s model</div>
                        <div className="text-muted-foreground text-xs">
                            {commission.modelReceived
                                ? "Marked as arrived with you"
                                : "Not yet marked as arrived"}
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                            act(() => markModelReceived(commission.id, !commission.modelReceived))
                        }
                    >
                        {commission.modelReceived ? "Mark not arrived" : "Mark arrived"}
                    </Button>
                </div>
            </div>

            {/* ── Off-platform payment bookkeeping ── */}
            <div className="border-input/60 border-b py-4">
                <div className="mb-3 text-sm font-semibold">Payments received</div>

                <div className="grid gap-2">
                    <PaymentRow
                        label="Deposit"
                        amount={deposit}
                        paid={commission.depositPaid}
                        busy={busy}
                        onToggle={() =>
                            act(() =>
                                recordPayment(commission.id, {
                                    depositPaid: !commission.depositPaid,
                                }),
                            )
                        }
                    />
                    <PaymentRow
                        label="Balance"
                        amount={balance}
                        paid={commission.finalPaid}
                        busy={busy}
                        onToggle={() =>
                            act(() =>
                                recordPayment(commission.id, { finalPaid: !commission.finalPaid }),
                            )
                        }
                    />
                </div>

                <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                    These are your notes about money that moved elsewhere — Model Horse Hub never
                    holds it. Ticking a box records it for your income summary and shows the
                    commissioner you&rsquo;ve seen it.
                </p>
            </div>

            {/* ── The horse this work belongs to ── */}
            <div className="pt-4">
                <div className="mb-2 text-sm font-semibold">Linked horse</div>
                {commission.horseId ? (
                    <p className="text-muted-foreground m-0 text-xs leading-relaxed">
                        Linked. On delivery this stamps your verified artist credit on the horse
                        and writes the work into its provenance — which is what puts it on your
                        studio page with its show record.
                    </p>
                ) : (
                    <HorseLinker
                        commission={commission}
                        busy={busy}
                        onLink={(horseId) =>
                            act(() => linkHorseToCommission(commission.id, horseId))
                        }
                    />
                )}
            </div>

            {error && (
                <p className="text-destructive border-destructive/30 bg-destructive/10 mt-4 rounded-md border px-4 py-2 text-sm">
                    {error}
                </p>
            )}
        </div>
    );
}

function PaymentRow({
    label,
    amount,
    paid,
    busy,
    onToggle,
}: {
    label: string;
    amount: number | null;
    paid: boolean;
    busy: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">
                {label}
                <span className="text-muted-foreground ml-2 font-serif tabular-nums">
                    {formatMoney(amount)}
                </span>
            </span>
            <Button
                size="sm"
                variant={paid ? "default" : "outline"}
                disabled={busy}
                onClick={onToggle}
            >
                {paid ? "✓ Received" : "Mark received"}
            </Button>
        </div>
    );
}

/**
 * Linking a horse. The list is the COMMISSIONER's stable, not the
 * artist's — v1 let the artist attach any horse id at all, with no
 * ownership check, and that link is what drives the artist credit.
 */
function HorseLinker({
    commission,
    busy,
    onLink,
}: {
    commission: Commission;
    busy: boolean;
    onLink: (horseId: string) => void;
}) {
    const [horses, setHorses] = useState<{ id: string; name: string }[]>([]);
    const [selected, setSelected] = useState("");
    // Derived, not set inside the effect: with no client there is nothing
    // to fetch, so this never starts in a loading state at all.
    const [loading, setLoading] = useState(() => !!commission.clientId);

    useEffect(() => {
        if (!commission.clientId) return;
        const supabase = createClient();
        (async () => {
            // RLS returns only the commissioner's PUBLIC horses to the
            // artist. A private stable simply yields nothing here, and the
            // server re-checks ownership before it writes.
            const { data } = await supabase
                .from("user_horses")
                .select("id, custom_name")
                .eq("owner_id", commission.clientId as string)
                .order("custom_name")
                .limit(200);
            setHorses(
                ((data as { id: string; custom_name: string }[] | null) ?? []).map((h) => ({
                    id: h.id,
                    name: h.custom_name,
                })),
            );
            setLoading(false);
        })();
    }, [commission.clientId]);

    if (loading) {
        return <p className="text-muted-foreground m-0 text-xs">Loading their stable…</p>;
    }

    if (horses.length === 0) {
        return (
            <p className="text-muted-foreground m-0 text-xs leading-relaxed">
                No horses of theirs are visible to you. Ask the commissioner to link the horse
                from their side — it&rsquo;s how the finished piece gets your verified credit and
                its provenance entry.
            </p>
        );
    }

    return (
        <>
            <div className="flex flex-wrap items-center gap-2">
                <select
                    className="border-input bg-card ring-offset-background focus:ring-ring h-10 flex-1 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label="Choose the horse this commission is for"
                >
                    <option value="">Choose a horse…</option>
                    {horses.map((h) => (
                        <option key={h.id} value={h.id}>
                            {h.name}
                        </option>
                    ))}
                </select>
                <Button size="sm" disabled={!selected || busy} onClick={() => onLink(selected)}>
                    Link
                </Button>
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                On delivery this stamps your verified artist credit and writes the work into the
                horse&rsquo;s provenance.
            </p>
        </>
    );
}
