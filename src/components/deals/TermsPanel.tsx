"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
    agreeToTerms,
    proposeTerms,
    withdrawTermsAgreement,
} from "@/app/actions/deals";
import {
    awaitingAgreementFrom,
    blankBox,
    boxLines,
    boxTitle,
    formatStamp,
    isBoxEmpty,
    isFullyAgreed,
    newBoxId,
    TERM_BOX_TYPES,
    type DealTerms,
    type TermBox,
    type TermBoxType,
} from "@/lib/deals/terms";
import type { DealParty } from "@/lib/deals/vocabulary";

/**
 * THE CONTRACT BOXES.
 *
 * The owner's brief, verbatim: "a set of boxes both users agree to" —
 * the rules, payment plans, sent- and received-payment confirmations
 * with dates, offer and agreed price — "as many as necessary — could be
 * very specific with these."
 *
 * So this is a list, not a form. You add the boxes your deal needs, you
 * fill them in your own words, and the other person agrees to exactly
 * what is on the page. Editing anything clears both signatures, because
 * a contract one side can amend after the other has signed is not a
 * contract. Once both have agreed, this panel becomes a read-only
 * record — and the database refuses the edit too, not just this button.
 *
 * There is no "recommended terms" template here, deliberately. The
 * platform does not write anyone's terms.
 */

const TYPE_MENU: { type: TermBoxType; label: string; hint: string }[] = [
    { type: "price", label: "Agreed price", hint: "What the buyer pays in total" },
    { type: "payment_plan", label: "Payment plan", hint: "Paying over time, and what happens if a payment is missed" },
    { type: "shipping", label: "Shipping", hint: "Method, cost, who pays, insured, expected date" },
    { type: "rules", label: "Terms & rules", hint: "Anything you both want written down, in your words" },
    { type: "deadline", label: "Deadline", hint: "A date you both agree to" },
    { type: "items", label: "What changes hands", hint: "For trades and bundles" },
    { type: "custom", label: "Another box", hint: "Anything else" },
];

interface TermsPanelProps {
    conversationId: string;
    terms: DealTerms;
    party: DealParty;
    labels: { a: string; b: string };
    /** Disputed, or the migration isn't applied — read-only either way. */
    readOnly: boolean;
    readOnlyReason?: string | null;
}

export default function TermsPanel({
    conversationId,
    terms,
    party,
    labels,
    readOnly,
    readOnlyReason,
}: TermsPanelProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<TermBox[]>(terms.boxes);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const agreed = isFullyAgreed(terms);
    const waitingOn = awaitingAgreementFrom(terms);
    const myStamp = party === "a" ? terms.agreedByAAt : terms.agreedByBAt;
    const theirStamp = party === "a" ? terms.agreedByBAt : terms.agreedByAAt;
    const visible = terms.boxes.filter((b) => !isBoxEmpty(b));

    const startEditing = () => {
        setDraft(terms.boxes.length > 0 ? terms.boxes : [blankBox("price")]);
        setEditing(true);
        setError("");
    };

    const save = async () => {
        setBusy(true);
        setError("");
        const result = await proposeTerms(conversationId, draft);
        if (result.success) {
            setEditing(false);
            router.refresh();
        } else {
            setError(result.error ?? "Couldn't save those terms.");
        }
        setBusy(false);
    };

    const sign = async () => {
        setBusy(true);
        setError("");
        const result = await agreeToTerms(conversationId);
        if (result.success) router.refresh();
        else setError(result.error ?? "Couldn't record your agreement.");
        setBusy(false);
    };

    const unsign = async () => {
        setBusy(true);
        setError("");
        const result = await withdrawTermsAgreement(conversationId);
        if (result.success) router.refresh();
        else setError(result.error ?? "Couldn't withdraw.");
        setBusy(false);
    };

    return (
        <section className="bg-card border-input rounded-lg border p-6 shadow-md" id="deal-terms">
            <div className="brass-heading mb-4">
                <span className="brass-heading-bar" aria-hidden="true" />
                <h3 className="text-secondary-foreground m-0 text-sm">The agreement</h3>
                {agreed && <span className="stamp ml-auto">Agreed</span>}
            </div>

            {editing ? (
                <BoxEditor
                    draft={draft}
                    setDraft={setDraft}
                    labels={labels}
                    busy={busy}
                    onSave={save}
                    onCancel={() => setEditing(false)}
                />
            ) : visible.length === 0 ? (
                <div className="text-secondary-foreground text-sm leading-relaxed">
                    <p className="mb-3">
                        Nothing is written down yet. Add the boxes this deal needs — the price, how
                        it&apos;s being paid, shipping, and any rules you both want on the record.
                        Both of you agree to exactly what&apos;s on the page, and after that neither
                        side can change it.
                    </p>
                    <p className="text-muted-foreground mb-4 text-xs">
                        Model Horse Hub doesn&apos;t write your terms and doesn&apos;t hold your
                        money. We keep the record.
                    </p>
                    {!readOnly && <Button onClick={startEditing}>Write the terms</Button>}
                </div>
            ) : (
                <>
                    <div className="flex flex-col">
                        {visible.map((box) => (
                            <div
                                key={box.id}
                                className="border-input/60 border-b py-3 last:border-b-0"
                            >
                                <div className="mb-1 font-serif text-base font-bold">
                                    {boxTitle(box)}
                                </div>
                                {boxLines(box, labels).map((line, i) => (
                                    <div
                                        key={i}
                                        className="flex flex-wrap items-baseline justify-between gap-2 py-0.5"
                                    >
                                        {line.label && (
                                            <span className="text-muted-foreground text-xs">
                                                {line.label}
                                            </span>
                                        )}
                                        <span className="text-sm whitespace-pre-wrap">
                                            {line.value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* Signatures */}
                    <div className="border-input mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                        <div className="text-muted-foreground text-xs">
                            <div>
                                {labels.a}:{" "}
                                {terms.agreedByAAt ? formatStamp(terms.agreedByAAt) : "not yet agreed"}
                            </div>
                            <div>
                                {labels.b}:{" "}
                                {terms.agreedByBAt ? formatStamp(terms.agreedByBAt) : "not yet agreed"}
                            </div>
                        </div>

                        {!readOnly && (
                            <div className="flex flex-wrap items-center gap-2">
                                {!agreed && !myStamp && (
                                    <Button onClick={sign} disabled={busy}>
                                        {busy ? "…" : "✍️ I agree to these terms"}
                                    </Button>
                                )}
                                {!agreed && myStamp && (
                                    <>
                                        <span className="text-success text-sm font-semibold">
                                            You agreed
                                            {waitingOn ? " — waiting on the other side" : ""}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="wide"
                                            onClick={unsign}
                                            disabled={busy}
                                        >
                                            Withdraw
                                        </Button>
                                    </>
                                )}
                                {!agreed && (
                                    <Button
                                        variant="outline"
                                        size="wide"
                                        onClick={startEditing}
                                        disabled={busy}
                                    >
                                        Edit
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>

                    {!agreed && theirStamp && !myStamp && (
                        <p className="text-muted-foreground mt-2 mb-0 text-xs">
                            Editing anything now clears their agreement and they&apos;ll be asked
                            again.
                        </p>
                    )}
                    {agreed && (
                        <p className="text-muted-foreground mt-2 mb-0 text-xs">
                            Both sides agreed to revision {terms.revision}. These terms are now part
                            of the record and can&apos;t be edited by either of you.
                        </p>
                    )}
                </>
            )}

            {readOnly && readOnlyReason && (
                <p className="text-muted-foreground mt-3 mb-0 text-xs">{readOnlyReason}</p>
            )}
            {error && (
                <p className="text-destructive border-destructive/30 bg-destructive/10 mt-3 mb-0 rounded-md border px-4 py-2 text-sm">
                    {error}
                </p>
            )}
        </section>
    );
}

// ── The editor ────────────────────────────────────────────────────────

function BoxEditor({
    draft,
    setDraft,
    labels,
    busy,
    onSave,
    onCancel,
}: {
    draft: TermBox[];
    setDraft: (b: TermBox[]) => void;
    labels: { a: string; b: string };
    busy: boolean;
    onSave: () => void;
    onCancel: () => void;
}) {
    const update = (id: string, patch: Partial<TermBox>) => {
        setDraft(draft.map((b) => (b.id === id ? ({ ...b, ...patch } as TermBox) : b)));
    };
    const remove = (id: string) => setDraft(draft.filter((b) => b.id !== id));
    const add = (type: TermBoxType) => setDraft([...draft, blankBox(type, newBoxId())]);

    return (
        <div className="flex flex-col gap-4">
            {draft.map((box) => (
                <div key={box.id} className="border-input bg-muted/40 rounded-lg border p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <input
                            className="border-input bg-card h-9 flex-1 rounded-md border px-3 font-serif text-sm font-bold"
                            value={box.label ?? ""}
                            placeholder={boxTitle({ ...box, label: null })}
                            maxLength={120}
                            onChange={(e) => update(box.id, { label: e.target.value })}
                            aria-label="Box title"
                        />
                        <Button
                            variant="destructive-outline"
                            size="xs"
                            onClick={() => remove(box.id)}
                            disabled={busy}
                        >
                            Remove
                        </Button>
                    </div>
                    <BoxFields box={box} update={update} labels={labels} />
                </div>
            ))}

            <div className="border-input rounded-lg border border-dashed p-4">
                <div className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                    Add a box
                </div>
                <div className="flex flex-wrap gap-2">
                    {TYPE_MENU.filter((t) => TERM_BOX_TYPES.includes(t.type)).map((t) => (
                        <Button
                            key={t.type}
                            variant="outline"
                            size="xs"
                            title={t.hint}
                            onClick={() => add(t.type)}
                            disabled={busy}
                        >
                            + {t.label}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Button onClick={onSave} disabled={busy}>
                    {busy ? "Saving…" : "Save the terms"}
                </Button>
                <Button variant="outline" size="wide" onClick={onCancel} disabled={busy}>
                    Cancel
                </Button>
                <span className="text-muted-foreground text-xs">
                    Saving clears both agreements — you&apos;ll each confirm the new version.
                </span>
            </div>
        </div>
    );
}

const FIELD =
    "border-input bg-card h-9 w-full rounded-md border px-3 text-sm";
const AREA =
    "border-input bg-card min-h-[80px] w-full rounded-md border px-3 py-2 text-sm";
const LABEL = "text-muted-foreground mb-1 block text-xs";

function BoxFields({
    box,
    update,
    labels,
}: {
    box: TermBox;
    update: (id: string, patch: Partial<TermBox>) => void;
    labels: { a: string; b: string };
}) {
    switch (box.type) {
        case "price":
            return (
                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label className={LABEL} htmlFor={`${box.id}-amount`}>
                            Amount (USD)
                        </label>
                        <input
                            id={`${box.id}-amount`}
                            type="number"
                            min="0"
                            step="0.01"
                            className={FIELD}
                            value={box.amount ?? ""}
                            onChange={(e) =>
                                update(box.id, {
                                    amount: e.target.value === "" ? null : Number(e.target.value),
                                } as Partial<TermBox>)
                            }
                        />
                    </div>
                    <div>
                        <label className={LABEL} htmlFor={`${box.id}-method`}>
                            How it&apos;s being paid
                        </label>
                        <input
                            id={`${box.id}-method`}
                            className={FIELD}
                            placeholder="e.g. PayPal Goods & Services"
                            value={box.method ?? ""}
                            onChange={(e) =>
                                update(box.id, { method: e.target.value } as Partial<TermBox>)
                            }
                        />
                    </div>
                </div>
            );

        case "payment_plan":
            return (
                <div className="grid gap-3">
                    <div>
                        <label className={LABEL} htmlFor={`${box.id}-count`}>
                            Number of payments
                        </label>
                        <input
                            id={`${box.id}-count`}
                            type="number"
                            min="1"
                            max="120"
                            className={FIELD}
                            value={box.installmentCount ?? ""}
                            onChange={(e) =>
                                update(box.id, {
                                    installmentCount:
                                        e.target.value === "" ? null : Number(e.target.value),
                                } as Partial<TermBox>)
                            }
                        />
                    </div>
                    <div>
                        <label className={LABEL} htmlFor={`${box.id}-missed`}>
                            If a payment is missed — your words, not ours
                        </label>
                        <textarea
                            id={`${box.id}-missed`}
                            className={AREA}
                            maxLength={4000}
                            placeholder="Say what you have both agreed happens. An unfilled version of this box is where disputes come from."
                            value={box.missedPaymentTerms ?? ""}
                            onChange={(e) =>
                                update(box.id, {
                                    missedPaymentTerms: e.target.value,
                                } as Partial<TermBox>)
                            }
                        />
                    </div>
                </div>
            );

        case "shipping":
            return (
                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label className={LABEL} htmlFor={`${box.id}-method`}>
                            Method
                        </label>
                        <input
                            id={`${box.id}-method`}
                            className={FIELD}
                            placeholder="e.g. USPS Priority, double-boxed"
                            value={box.method ?? ""}
                            onChange={(e) =>
                                update(box.id, { method: e.target.value } as Partial<TermBox>)
                            }
                        />
                    </div>
                    <div>
                        <label className={LABEL} htmlFor={`${box.id}-cost`}>
                            Cost
                        </label>
                        <input
                            id={`${box.id}-cost`}
                            type="number"
                            min="0"
                            step="0.01"
                            className={FIELD}
                            value={box.cost ?? ""}
                            onChange={(e) =>
                                update(box.id, {
                                    cost: e.target.value === "" ? null : Number(e.target.value),
                                } as Partial<TermBox>)
                            }
                        />
                    </div>
                    <div>
                        <label className={LABEL} htmlFor={`${box.id}-paidby`}>
                            Paid by
                        </label>
                        <select
                            id={`${box.id}-paidby`}
                            className={FIELD}
                            value={box.paidBy ?? ""}
                            onChange={(e) =>
                                update(box.id, {
                                    paidBy: (e.target.value || null) as never,
                                } as Partial<TermBox>)
                            }
                        >
                            <option value="">Not stated</option>
                            <option value="a">{labels.a}</option>
                            <option value="b">{labels.b}</option>
                            <option value="split">Split</option>
                        </select>
                    </div>
                    <div>
                        <label className={LABEL} htmlFor={`${box.id}-ship-date`}>
                            Expected to ship by
                        </label>
                        <input
                            id={`${box.id}-ship-date`}
                            type="date"
                            className={FIELD}
                            value={box.expectedShipDate ?? ""}
                            onChange={(e) =>
                                update(box.id, {
                                    expectedShipDate: e.target.value || null,
                                } as Partial<TermBox>)
                            }
                        />
                    </div>
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                        <input
                            type="checkbox"
                            checked={box.insured === true}
                            onChange={(e) =>
                                update(box.id, { insured: e.target.checked } as Partial<TermBox>)
                            }
                        />
                        Insured
                    </label>
                </div>
            );

        case "deadline":
            return (
                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label className={LABEL} htmlFor={`${box.id}-date`}>
                            Date
                        </label>
                        <input
                            id={`${box.id}-date`}
                            type="date"
                            className={FIELD}
                            value={box.date ?? ""}
                            onChange={(e) =>
                                update(box.id, { date: e.target.value || null } as Partial<TermBox>)
                            }
                        />
                    </div>
                    <div>
                        <label className={LABEL} htmlFor={`${box.id}-note`}>
                            What happens by then
                        </label>
                        <input
                            id={`${box.id}-note`}
                            className={FIELD}
                            maxLength={400}
                            value={box.note ?? ""}
                            onChange={(e) =>
                                update(box.id, { note: e.target.value } as Partial<TermBox>)
                            }
                        />
                    </div>
                </div>
            );

        case "items":
            return (
                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label className={LABEL} htmlFor={`${box.id}-from-a`}>
                            From {labels.a} — one per line
                        </label>
                        <textarea
                            id={`${box.id}-from-a`}
                            className={AREA}
                            value={box.fromA.join("\n")}
                            onChange={(e) =>
                                update(box.id, {
                                    fromA: e.target.value.split("\n"),
                                } as Partial<TermBox>)
                            }
                        />
                    </div>
                    <div>
                        <label className={LABEL} htmlFor={`${box.id}-from-b`}>
                            From {labels.b} — one per line
                        </label>
                        <textarea
                            id={`${box.id}-from-b`}
                            className={AREA}
                            value={box.fromB.join("\n")}
                            onChange={(e) =>
                                update(box.id, {
                                    fromB: e.target.value.split("\n"),
                                } as Partial<TermBox>)
                            }
                        />
                    </div>
                </div>
            );

        case "rules":
        case "custom":
            return (
                <div>
                    <label className={LABEL} htmlFor={`${box.id}-text`}>
                        In your own words
                    </label>
                    <textarea
                        id={`${box.id}-text`}
                        className={AREA}
                        maxLength={4000}
                        value={box.text}
                        onChange={(e) =>
                            update(box.id, { text: e.target.value } as Partial<TermBox>)
                        }
                    />
                </div>
            );
    }
}
