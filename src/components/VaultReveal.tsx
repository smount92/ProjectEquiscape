"use client";

import { useState } from "react";

interface VaultData {
    purchase_price: number | null;
    purchase_date: string | null;
    estimated_current_value: number | null;
    insurance_notes: string | null;
    purchase_date_text: string | null;
}

interface VaultRevealProps {
    vault: VaultData | null;
    currencySymbol?: string;
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

export default function VaultReveal({ vault, currencySymbol = "$" }: VaultRevealProps) {
    const [isUnlocked, setIsUnlocked] = useState(false);

    const hasData =
        vault &&
        (vault.purchase_price !== null ||
            vault.purchase_date !== null ||
            vault.estimated_current_value !== null ||
            vault.insurance_notes !== null ||
            vault.purchase_date_text !== null);

    return (
        <div
            className={`vault-reveal relative overflow-hidden rounded-lg border border-[rgba(240,160,108,0.25)] bg-[var(--color-bg-card)] ${isUnlocked ? "unlocked" : ""}`}
        >
            <div className="flex items-center gap-4 p-8">
                <div
                    className="p-[0 var(--space-xl) var(--space-xl) var(--space-xl)]-lock flex h-11 max-h-[500px] w-11 shrink-0 items-center justify-center rounded-md border border-[rgba(240,160,108,0.25)] bg-[linear-gradient(135deg,rgba(240,160,108,0.15),rgba(240,208,108,0.1))] text-[1.4rem] transition-all"
                    aria-hidden="true"
                >
                    {isUnlocked ? "🔓" : "🔒"}
                </div>
                <div className="flex-1">
                    <h3>Financial Vault</h3>
                    <p>
                        {isUnlocked
                            ? "Your private financial data is shown below"
                            : "Click to reveal private financial details"}
                    </p>
                </div>
                <button
                    className="min-h-[var(--inline-flex hover:no-underline-min-h)] leading-none-min-h)] inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[rgba(240,160,108,0.4)] border-[transparent] bg-[rgba(240,160,108,0.1)] px-6 px-8 py-2 font-sans text-base text-sm font-[var(--font-family)] font-semibold text-[var(--color-accent-secondary)] no-underline transition-all duration-150 hover:border-[var(--color-accent-secondary)] hover:bg-[rgba(240,160,108,0.2)]"
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
                </button>
            </div>

            <div className="max-h-[0] overflow-hidden px-8 py-[0] transition-all" id="vault-data">
                {!hasData ? (
                    <div className="text-muted py-6 text-center text-sm">
                        <p>📭 No financial data recorded yet. You can add purchase details by editing this horse.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                            {vault.purchase_price !== null && (
                                <div className="border-edge rounded-md border bg-[var(--color-bg-input)] p-4">
                                    <div className="text-muted mb-1 text-xs font-medium tracking-[0.05em] uppercase">
                                        Purchase Price
                                    </div>
                                    <div className="text-success text-base font-bold">
                                        {formatCurrency(vault.purchase_price, currencySymbol)}
                                    </div>
                                </div>
                            )}

                            {vault.estimated_current_value !== null && (
                                <div className="border-edge rounded-md border bg-[var(--color-bg-input)] p-4">
                                    <div className="text-muted mb-1 text-xs font-medium tracking-[0.05em] uppercase">
                                        Estimated Value
                                    </div>
                                    <div className="text-success text-base font-bold">
                                        {formatCurrency(vault.estimated_current_value, currencySymbol)}
                                    </div>
                                </div>
                            )}

                            {vault.purchase_date !== null && (
                                <div className="border-edge rounded-md border bg-[var(--color-bg-input)] p-4">
                                    <div className="text-muted mb-1 text-xs font-medium tracking-[0.05em] uppercase">
                                        Purchase Date
                                    </div>
                                    <div className="text-ink text-base font-bold">
                                        {formatDate(vault.purchase_date)}
                                    </div>
                                </div>
                            )}

                            {vault.purchase_date_text && !vault.purchase_date && (
                                <div className="border-edge rounded-md border bg-[var(--color-bg-input)] p-4">
                                    <div className="text-muted mb-1 text-xs font-medium tracking-[0.05em] uppercase">
                                        Purchase Date
                                    </div>
                                    <div className="text-ink text-base font-bold">{vault.purchase_date_text}</div>
                                </div>
                            )}

                            {vault.insurance_notes !== null && (
                                <div className="border-edge rounded-md border bg-[var(--color-bg-input)] p-4">
                                    <div className="text-muted mb-1 text-xs font-medium tracking-[0.05em] uppercase">
                                        Insurance Notes
                                    </div>
                                    <div className="text-ink text-base font-bold">{vault.insurance_notes}</div>
                                </div>
                            )}
                        </div>

                        <div className="border-edge text-muted mt-4 flex items-center gap-1 border-t pt-4 text-xs">
                            <span>🛡️</span>
                            <span>
                                This data is encrypted and only visible to you. Protected by Row Level Security.
                            </span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
