"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
    sendQuote,
    transitionCommission,
    type Commission,
} from "@/app/actions/art-studio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    availableTransitions,
    ballIsWith,
    revisionState,
    statusBlurb,
    type CommissionStatus,
    type Party,
    type Transition,
} from "@/lib/studio/pipeline";
import { formatMoney, killFeeFor } from "@/lib/studio/terms";

/**
 * The move panel: whose turn it is, and what they can do about it.
 *
 * Every button here is rendered from the SAME table the server enforces
 * (`availableTransitions`), so the UI cannot offer a move the action will
 * reject — and cannot hide one it would allow.
 */
export default function CommissionActions({
    commission,
    party,
}: {
    commission: Commission;
    party: Party;
}) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [note, setNote] = useState("");
    const [confirming, setConfirming] = useState<Transition | null>(null);
    const [quoting, setQuoting] = useState(false);

    const status = commission.status;
    const moves = availableTransitions(status, party);
    const yourTurn = ballIsWith(status) === party;
    const revisions = revisionState(commission.revisionsUsed, commission.revisionsIncluded);

    const run = async (to: CommissionStatus, reason?: string) => {
        setBusy(true);
        setError(null);
        const result = await transitionCommission(commission.id, to, reason);
        setBusy(false);
        if (!result.success) {
            setError(result.error ?? "That didn't work.");
            return;
        }
        setConfirming(null);
        setNote("");
        router.refresh();
    };

    const onMove = (move: Transition) => {
        // Quoting opens a form, not a one-click state change.
        if (move.to === "quoted") {
            setQuoting(true);
            return;
        }
        // Anything destructive, and anything that spends a revision, gets a
        // second step with the consequence spelled out.
        if (move.destructive || move.consumesRevision) {
            setConfirming(move);
            return;
        }
        void run(move.to);
    };

    return (
        <div className="bg-card border-input rounded-lg border p-6 shadow-md">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="m-0 font-serif text-lg font-bold">
                    {yourTurn ? "Your move" : "Where this stands"}
                </h2>
                {commission.revisionsIncluded > 0 && (
                    <span
                        className={`text-xs font-semibold ${
                            revisions.overAllowance ? "text-warning" : "text-muted-foreground"
                        }`}
                    >
                        {revisions.label}
                    </span>
                )}
            </div>

            <p className="text-secondary-foreground mb-4 text-sm leading-relaxed">
                {statusBlurb(status, party)}
            </p>

            {quoting && (
                <QuoteForm
                    commission={commission}
                    onClose={() => setQuoting(false)}
                    onDone={() => {
                        setQuoting(false);
                        router.refresh();
                    }}
                />
            )}

            {confirming && (
                <ConfirmPanel
                    move={confirming}
                    commission={commission}
                    note={note}
                    onNote={setNote}
                    busy={busy}
                    onCancel={() => {
                        setConfirming(null);
                        setNote("");
                    }}
                    onConfirm={() => void run(confirming.to, note)}
                />
            )}

            {!quoting && !confirming && (
                <>
                    {moves.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            {ballIsWith(status)
                                ? "Nothing for you to do right now."
                                : "This commission is closed."}
                        </p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {moves.map((move) => (
                                <Button
                                    key={`${move.to}-${move.label}`}
                                    variant={move.destructive ? "outline" : "default"}
                                    size="wide"
                                    disabled={busy}
                                    onClick={() => onMove(move)}
                                    className={
                                        move.destructive
                                            ? "text-muted-foreground"
                                            : undefined
                                    }
                                >
                                    {move.emoji} {move.label}
                                </Button>
                            ))}
                        </div>
                    )}
                </>
            )}

            {error && (
                <p className="text-destructive border-destructive/30 bg-destructive/10 mt-4 rounded-md border px-4 py-3 text-sm">
                    {error}
                </p>
            )}
        </div>
    );
}

/**
 * The quote: price, timeline, revisions. The commissioner sees this exact
 * figure and either accepts it or doesn't.
 */
function QuoteForm({
    commission,
    onClose,
    onDone,
}: {
    commission: Commission;
    onClose: () => void;
    onDone: () => void;
}) {
    const [price, setPrice] = useState(
        commission.agreedPrice != null ? String(commission.agreedPrice) : "",
    );
    const [note, setNote] = useState(commission.quoteNote ?? "");
    const [completion, setCompletion] = useState(commission.estimatedCompletion ?? "");
    const [revisions, setRevisions] = useState(
        commission.revisionsIncluded ? String(commission.revisionsIncluded) : "",
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isRevising = commission.status === "quoted";

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const value = Number(price);
        if (!Number.isFinite(value) || value <= 0) {
            setError("A quote needs a price.");
            return;
        }
        setBusy(true);
        setError(null);
        const result = await sendQuote(commission.id, {
            price: value,
            note: note.trim() || undefined,
            estimatedCompletion: completion || null,
            revisionsIncluded: revisions ? Number(revisions) : undefined,
        });
        setBusy(false);
        if (!result.success) {
            setError(result.error ?? "That didn't send.");
            return;
        }
        onDone();
    };

    return (
        <form onSubmit={submit} className="border-input bg-muted/40 rounded-lg border p-4">
            <h3 className="mb-1 font-serif text-base font-bold">
                {isRevising ? "Revise your quote" : "Send a quote"}
            </h3>
            <p className="text-muted-foreground mb-4 text-xs leading-relaxed">
                {commission.budgetAmount != null && (
                    <>
                        They said their budget is{" "}
                        <strong>{formatMoney(commission.budgetAmount)}</strong>. That&rsquo;s a
                        guide, not a ceiling —{" "}
                    </>
                )}
                quote what the work is worth. Nothing is committed until they accept, and your
                terms are attached automatically.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                    <span className="mb-1 block text-sm font-semibold">Price</span>
                    <Input
                        type="number"
                        min={1}
                        step={5}
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="e.g. 850"
                        required
                    />
                </label>
                <label className="block">
                    <span className="mb-1 block text-sm font-semibold">
                        Estimated completion
                    </span>
                    <Input
                        type="date"
                        value={completion}
                        onChange={(e) => setCompletion(e.target.value)}
                    />
                </label>
            </div>

            <label className="mt-4 block">
                <span className="mb-1 block text-sm font-semibold">
                    Revisions included{" "}
                    <span className="text-muted-foreground">(optional override)</span>
                </span>
                <Input
                    type="number"
                    min={0}
                    max={20}
                    value={revisions}
                    onChange={(e) => setRevisions(e.target.value)}
                    placeholder="Leave blank to use your studio default"
                />
            </label>

            <label className="mt-4 block">
                <span className="mb-1 block text-sm font-semibold">
                    What this covers <span className="text-muted-foreground">(optional)</span>
                </span>
                <Textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Includes minor prep and a matte seal. Appaloosa spotting adds $150 if you want it."
                />
            </label>

            {error && (
                <p className="text-destructive border-destructive/30 bg-destructive/10 mt-4 rounded-md border px-4 py-2 text-sm">
                    {error}
                </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
                <Button type="submit" disabled={busy}>
                    {busy ? "Sending…" : isRevising ? "Send revised quote" : "Send quote"}
                </Button>
                <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                    Cancel
                </Button>
            </div>
        </form>
    );
}

/**
 * The consequence step. Cancelling after an agreement is kill-fee
 * territory, and the agreed figure is shown at exactly the moment it
 * becomes relevant — which is the etiquette every real commission ToS
 * assumes and no software ever implements.
 */
function ConfirmPanel({
    move,
    commission,
    note,
    onNote,
    busy,
    onCancel,
    onConfirm,
}: {
    move: Transition;
    commission: Commission;
    note: string;
    onNote: (v: string) => void;
    busy: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const snapshot = commission.termsSnapshot;
    const killFee =
        move.afterAgreement && snapshot
            ? killFeeFor(commission.agreedPrice, snapshot.killFeePercent)
            : null;
    const revisions = revisionState(commission.revisionsUsed, commission.revisionsIncluded);

    return (
        <div className="border-input bg-muted/40 rounded-lg border p-4">
            <h3 className="mb-2 font-serif text-base font-bold">
                {move.emoji} {move.label}?
            </h3>

            {move.afterAgreement && (
                <div className="border-warning/40 bg-warning/10 mb-4 rounded-md border p-3 text-sm leading-relaxed">
                    <p className="m-0">
                        Terms were already agreed on this commission.
                        {killFee != null ? (
                            <>
                                {" "}
                                Under them, <strong>{formatMoney(killFee)}</strong> (
                                {snapshot?.killFeePercent}% of{" "}
                                {formatMoney(commission.agreedPrice)}) is owed for work already
                                done.
                            </>
                        ) : (
                            " Check the agreed terms below before you go ahead."
                        )}{" "}
                        Model Horse Hub doesn&rsquo;t collect or refund anything — settle it
                        between yourselves.
                    </p>
                </div>
            )}

            {move.consumesRevision && (
                <div className="border-input bg-card mb-4 rounded-md border p-3 text-sm leading-relaxed">
                    <p className="m-0">
                        {revisions.overAllowance ? (
                            <>
                                You&rsquo;ve used all{" "}
                                <strong>{revisions.included}</strong> included revision
                                {revisions.included === 1 ? "" : "s"}. The artist may charge for
                                this one
                                {snapshot?.extraRevisionFee != null && (
                                    <>
                                        {" "}
                                        (their rate is{" "}
                                        <strong>{formatMoney(snapshot.extraRevisionFee)}</strong>)
                                    </>
                                )}
                                .
                            </>
                        ) : (
                            <>
                                This uses revision{" "}
                                <strong>{revisions.used + 1}</strong> of{" "}
                                <strong>{revisions.included}</strong>. Be specific — one clear
                                list of changes is worth five messages.
                            </>
                        )}
                    </p>
                </div>
            )}

            <label className="block">
                <span className="mb-1 block text-sm font-semibold">
                    {move.consumesRevision ? "What needs changing" : "Add a note"}
                    {!move.consumesRevision && (
                        <span className="text-muted-foreground"> (optional)</span>
                    )}
                </span>
                <Textarea
                    rows={3}
                    value={note}
                    onChange={(e) => onNote(e.target.value)}
                    placeholder={
                        move.consumesRevision
                            ? "The blaze is a little wide, and the near hind sock should stop lower."
                            : "A short reason helps the other person — and stays on the record."
                    }
                />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={onConfirm} disabled={busy}>
                    {busy ? "Working…" : `Yes, ${move.label.toLowerCase()}`}
                </Button>
                <Button variant="outline" onClick={onCancel} disabled={busy}>
                    Never mind
                </Button>
            </div>
        </div>
    );
}
