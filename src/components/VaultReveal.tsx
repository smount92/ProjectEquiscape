"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import LinkifiedText from "@/components/LinkifiedText";
import { shareOf, type SetPurchase } from "@/lib/vault/setPurchase";
import { hasPurchaseNote } from "@/lib/vault/purchaseNotes";

interface VaultData {
    purchase_price: number | null;
    purchase_date: string | null;
    estimated_current_value: number | null;
    insurance_notes: string | null;
    purchase_date_text: string | null;
    is_trade?: boolean | null;
    /** 241; absent until the migration is pasted. */
    purchase_notes?: string | null;
}

/** A free-text vault note: full width, its own line breaks, links clickable. */
function NoteCard({ label, text, testId }: { label: string; text: string; testId: string }) {
    return (
        <div className="rounded-md border border-input bg-card p-4 sm:col-span-2" data-testid={testId}>
            <div className="mb-1 text-xs font-medium tracking-[0.05em] text-secondary-foreground uppercase">
                {label}
            </div>
            <div className="text-sm leading-relaxed [overflow-wrap:anywhere] whitespace-pre-line text-foreground">
                <LinkifiedText text={text} />
            </div>
        </div>
    );
}

interface VaultRevealProps {
    vault: VaultData | null;
    currencySymbol?: string;
    /** The set this horse was bought in, if any (224). */
    setPurchase?: SetPurchase | null;
}

function formatCurrency(value: number, symbol: string = "$"): string {
    const formatted = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
    return `${symbol}${formatted}`;
}

function formatDate(dateStr: string): string {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

export default function VaultReveal({ vault, currencySymbol = "$", setPurchase = null }: VaultRevealProps) {
    const [isUnlocked, setIsUnlocked] = useState(false);

    const hasData =
        vault &&
        (vault.purchase_price !== null ||
            vault.purchase_date !== null ||
            vault.estimated_current_value !== null ||
            vault.insurance_notes !== null ||
            vault.purchase_date_text !== null ||
            hasPurchaseNote(vault.purchase_notes) ||
            vault.is_trade ||
            !!setPurchase);

    return (
        <div
            className={`vault-reveal relative overflow-hidden rounded-lg border border-orange-200 bg-[var(--card)] ${isUnlocked ? "unlocked" : ""}`}
        >
            <div className="flex flex-wrap items-center gap-4 p-8">
                <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-orange-200 bg-[linear-gradient(135deg,rgba(240,160,108,0.15),rgba(240,208,108,0.1))] text-[1.4rem] transition-all"
                    aria-hidden="true"
                >
                    {isUnlocked ? "🔓" : "🔒"}
                </div>
                <div className="min-w-[11rem] flex-1">
                    <h3>Financial Vault</h3>
                    <p>
                        {isUnlocked
                            ? "Your private financial data is shown below"
                            : "Click to reveal private financial details"}
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => setIsUnlocked(!isUnlocked)}
                    aria-expanded={isUnlocked}
                    aria-controls="vault-data"
                    id="vault-reveal-button"
                >
                    {isUnlocked ? (
                        <>
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                            Hide
                        </>
                    ) : (
                        <>
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                            Reveal
                        </>
                    )}
                </Button>
            </div>

            {/* Rows 0fr → 1fr animates to the content's own height, so long
                notes are never clipped the way a fixed max-height clipped them.
                inert while locked: links inside can't be tabbed to unseen. */}
            <div
                className={`grid transition-[grid-template-rows] duration-300 ${isUnlocked ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                id="vault-data"
                inert={!isUnlocked}
            >
                <div className="min-h-0 overflow-hidden">
                    <div className="px-8 pt-4 pb-4">
                        {!hasData ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                <p>
                                    📭 No financial data recorded yet. You can add purchase details by editing this
                                    horse.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                                    {vault.purchase_price !== null && (
                                        <div className="rounded-md border border-input bg-card p-4">
                                            <div className="mb-1 text-xs font-medium tracking-[0.05em] text-secondary-foreground uppercase">
                                                Purchase Price
                                            </div>
                                            <div className="text-base font-bold text-success">
                                                {setPurchase
                                                    ? formatCurrency(
                                                          shareOf(setPurchase.price, setPurchase.members.length),
                                                          currencySymbol,
                                                      )
                                                    : formatCurrency(vault.purchase_price, currencySymbol)}
                                            </div>
                                            {setPurchase && (
                                                <div className="mt-1 text-xs text-muted-foreground">
                                                    share of a {formatCurrency(setPurchase.price, currencySymbol)} set
                                                    of {setPurchase.members.length}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {setPurchase && (
                                        <div
                                            className="rounded-md border border-input bg-card p-4 sm:col-span-2"
                                            data-testid="vault-set-purchase"
                                        >
                                            <div className="mb-1 text-xs font-medium tracking-[0.05em] text-secondary-foreground uppercase">
                                                Bought as a set
                                            </div>
                                            <div className="text-sm">
                                                <strong>
                                                    {setPurchase.label || `Set of ${setPurchase.members.length}`}
                                                </strong>
                                                {" · "}
                                                {setPurchase.members.map((m, i) => (
                                                    <span key={m.id}>
                                                        <Link
                                                            href={`/stable/${m.id}`}
                                                            className="underline underline-offset-2"
                                                        >
                                                            {m.name}
                                                        </Link>
                                                        {i < setPurchase.members.length - 1 ? ", " : ""}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                The vault total counts this set once.
                                            </div>
                                        </div>
                                    )}

                                    {vault.is_trade && (
                                        <div className="rounded-md border border-input bg-card p-4">
                                            <div className="mb-1 text-xs font-medium tracking-[0.05em] text-secondary-foreground uppercase">
                                                Acquisition Method
                                            </div>
                                            <div className="flex items-center gap-1.5 text-base font-bold text-success">
                                                🔄 Acquired via Trade
                                            </div>
                                        </div>
                                    )}

                                    {vault.estimated_current_value !== null && (
                                        <div className="rounded-md border border-input bg-card p-4">
                                            <div className="mb-1 text-xs font-medium tracking-[0.05em] text-secondary-foreground uppercase">
                                                Estimated Value
                                            </div>
                                            <div className="text-base font-bold text-success">
                                                {formatCurrency(vault.estimated_current_value, currencySymbol)}
                                            </div>
                                        </div>
                                    )}

                                    {vault.purchase_date !== null && (
                                        <div className="rounded-md border border-input bg-card p-4">
                                            <div className="mb-1 text-xs font-medium tracking-[0.05em] text-secondary-foreground uppercase">
                                                Purchase Date
                                            </div>
                                            <div className="text-base font-bold text-foreground">
                                                {formatDate(vault.purchase_date)}
                                            </div>
                                        </div>
                                    )}

                                    {vault.purchase_date_text && !vault.purchase_date && (
                                        <div className="rounded-md border border-input bg-card p-4">
                                            <div className="mb-1 text-xs font-medium tracking-[0.05em] text-secondary-foreground uppercase">
                                                Purchase Date
                                            </div>
                                            <div className="text-base font-bold text-foreground">
                                                {vault.purchase_date_text}
                                            </div>
                                        </div>
                                    )}

                                    {hasPurchaseNote(vault.purchase_notes) && (
                                        <NoteCard
                                            label="Purchase notes"
                                            text={vault.purchase_notes}
                                            testId="vault-purchase-notes"
                                        />
                                    )}

                                    {vault.insurance_notes !== null && (
                                        <NoteCard
                                            label="Insurance Notes"
                                            text={vault.insurance_notes}
                                            testId="vault-insurance-notes"
                                        />
                                    )}
                                </div>

                                <div className="mt-4 flex items-center gap-1 border-t border-input pt-4 text-xs text-secondary-foreground">
                                    <span>🛡️</span>
                                    <span>
                                        This data is encrypted and only visible to you. Protected by Row Level Security.
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
