"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { raiseDispute, recordSaleInVault, standDownDispute } from "@/app/actions/deals";
import { formatMoney, formatStamp } from "@/lib/deals/terms";

/**
 * THE RECORD PANEL — what this platform actually offers when a deal
 * goes wrong.
 *
 * The owner's ruling: we are the record, not the referee. We don't
 * arbitrate, don't refund, don't decide who is right. What we do is
 * freeze, preserve, and — his words — "USE our records to prove to
 * payment processors who did what."
 *
 * So this panel is deliberately unexciting: one link to the exportable
 * record, and one button that marks the deal disputed and freezes the
 * terms and the ledger. No "open a case", no "we'll investigate", no
 * implied adjudication we have no way to deliver.
 */

interface DealRecordPanelProps {
    conversationId: string;
    disputed: { at: string; reason: string | null; byMe: boolean } | null;
    /** The buyer, on a completed sale, gets the one-click vault hand-off. */
    vault: {
        offered: boolean;
        alreadyFiled: boolean;
        amount: number | null;
        horseId: string | null;
        horseName: string | null;
    };
    canDispute: boolean;
}

export default function DealRecordPanel({
    conversationId,
    disputed,
    vault,
    canDispute,
}: DealRecordPanelProps) {
    const [opening, setOpening] = useState(false);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [filed, setFiled] = useState<number | null>(null);
    const router = useRouter();

    const submit = async () => {
        setBusy(true);
        setError("");
        const result = await raiseDispute(conversationId, reason);
        if (result.success) {
            setOpening(false);
            router.refresh();
        } else {
            setError(result.error ?? "Couldn't mark this deal as disputed.");
        }
        setBusy(false);
    };

    const standDown = async () => {
        setBusy(true);
        setError("");
        const result = await standDownDispute(conversationId);
        if (result.success) router.refresh();
        else setError(result.error ?? "Couldn't stand the dispute down.");
        setBusy(false);
    };

    const fileInVault = async () => {
        setBusy(true);
        setError("");
        const result = await recordSaleInVault(conversationId);
        if (result.success) {
            setFiled(result.amount ?? null);
            router.refresh();
        } else {
            setError(result.error ?? "Couldn't file this into your vault.");
        }
        setBusy(false);
    };

    return (
        <section className="bg-card border-input rounded-lg border p-6 shadow-md" id="deal-record">
            <div className="brass-heading mb-4">
                <span className="brass-heading-bar" aria-hidden="true" />
                <h3 className="text-secondary-foreground m-0 text-sm">The record</h3>
                {disputed && <span className="stamp stamp-red ml-auto">Disputed</span>}
            </div>

            {/* ── The vault hand-off ── */}
            {vault.offered && !vault.alreadyFiled && filed === null && (
                <div className="border-input bg-muted/40 mb-4 rounded-lg border p-4">
                    <h4 className="mb-1 font-serif text-base font-bold">
                        💰 Record what this cost
                    </h4>
                    <p className="text-secondary-foreground mb-3 text-sm leading-relaxed">
                        File {vault.amount !== null ? formatMoney(vault.amount) : "the agreed price"}{" "}
                        into {vault.horseName ? <strong>{vault.horseName}</strong> : "the horse"}
                        &apos;s private vault as its purchase price. Only you can see it, and it
                        feeds your insurance report.
                    </p>
                    <Button onClick={fileInVault} disabled={busy}>
                        {busy
                            ? "Filing…"
                            : `Add ${vault.amount !== null ? formatMoney(vault.amount) : "it"} to the vault`}
                    </Button>
                </div>
            )}
            {(vault.alreadyFiled || filed !== null) && vault.offered && (
                <div className="border-success/30 bg-success/10 mb-4 rounded-lg border p-4 text-sm leading-relaxed">
                    ✅ Filed into {vault.horseName ? <strong>{vault.horseName}</strong> : "the horse"}
                    &apos;s vault
                    {filed !== null ? ` — ${formatMoney(filed)}` : ""}.{" "}
                    {vault.horseId && (
                        <Link href={`/stable/${vault.horseId}`} className="text-forest hover:underline">
                            Open the vault →
                        </Link>
                    )}
                </div>
            )}

            {/* ── The evidence pack ── */}
            <p className="text-secondary-foreground mb-3 text-sm leading-relaxed">
                Everything about this deal — who the parties are, what was agreed, every payment
                with its dates, both sides&apos; confirmations, and the whole conversation — is on
                one page you can print, save as a PDF, or paste into a dispute form.
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" size="wide">
                    <Link href={`/inbox/${conversationId}/record`}>📄 Open the deal record →</Link>
                </Button>
            </div>

            {/* ── Disputes ── */}
            {disputed ? (
                <div className="border-warning/40 bg-warning/10 rounded-lg border p-4 text-sm leading-relaxed">
                    <p className="mb-1">
                        <strong>Marked as disputed</strong> on {formatStamp(disputed.at)}.
                    </p>
                    {disputed.reason && (
                        <p className="text-secondary-foreground mb-2 italic">
                            &ldquo;{disputed.reason}&rdquo;
                        </p>
                    )}
                    <p className="text-muted-foreground mb-2 text-xs">
                        The terms and the payment ledger are frozen so both of you keep the same
                        copy of what happened. Model Horse Hub takes no position on who is right —
                        we hold no money and cannot refund anyone. Use the deal record above with
                        your payment provider.
                    </p>
                    {disputed.byMe && (
                        <Button variant="outline" size="wide" onClick={standDown} disabled={busy}>
                            {busy ? "…" : "Stand the dispute down"}
                        </Button>
                    )}
                </div>
            ) : opening ? (
                <div className="border-input bg-muted/40 rounded-lg border p-4">
                    <label className="mb-1 block text-sm font-semibold" htmlFor="dispute-reason">
                        What went wrong?
                    </label>
                    <p className="text-muted-foreground mb-2 text-xs leading-relaxed">
                        This becomes a permanent, unalterable part of the record and the other party
                        will see it. Say what happened, not what you think of them.
                    </p>
                    <textarea
                        id="dispute-reason"
                        className="border-input bg-card mb-3 min-h-[90px] w-full rounded-md border px-3 py-2 text-sm"
                        maxLength={2000}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                        <Button variant="destructive" onClick={submit} disabled={busy}>
                            {busy ? "…" : "Mark this deal disputed"}
                        </Button>
                        <Button
                            variant="outline"
                            size="wide"
                            onClick={() => setOpening(false)}
                            disabled={busy}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : canDispute ? (
                <Button variant="destructive-outline" size="wide" onClick={() => setOpening(true)}>
                    Something went wrong with this deal
                </Button>
            ) : null}

            {error && (
                <p className="text-destructive border-destructive/30 bg-destructive/10 mt-3 mb-0 rounded-md border px-4 py-2 text-sm">
                    {error}
                </p>
            )}
        </section>
    );
}
