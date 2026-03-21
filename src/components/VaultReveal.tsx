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
    <div className={`vault-reveal bg-[var(--color-bg-card)] border border-[rgba(240,160,108,0.25)] rounded-lg overflow-hidden relative ${isUnlocked ? "unlocked" : ""}`}>
      <div className="p-8 flex items-center gap-4">
        <div className="max-h-[500px] p-[0 var(--space-xl) var(--space-xl) var(--space-xl)]-lock w-11 h-11 rounded-md flex items-center justify-center text-[1.4rem] bg-[linear-gradient(135deg,rgba(240,160,108,0.15),rgba(240,208,108,0.1))] border border-[rgba(240,160,108,0.25)] shrink-0 transition-all" aria-hidden="true">
          {isUnlocked ? "🔓" : "🔒"}
        </div>
        <div style={{ flex: 1 }}>
          <h3>Financial Vault</h3>
          <p>
            {isUnlocked
              ? "Your private financial data is shown below"
              : "Click to reveal private financial details"}
          </p>
        </div>
        <button
          className="py-2 px-6 min-h-[var(--btn-min-h)] font-[var(--font-family)] text-sm font-semibold rounded-md cursor-pointer transition-all inline-flex items-center gap-2 border border-[rgba(240,160,108,0.4)] bg-[rgba(240,160,108,0.1)] text-[var(--color-accent-secondary)] hover:bg-[rgba(240,160,108,0.2)] hover:border-[var(--color-accent-secondary)]"
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

      <div className="max-h-[0] overflow-hidden transition-all py-[0] px-8" id="vault-data">
        {!hasData ? (
          <div className="text-center py-6 text-muted text-sm">
            <p>
              📭 No financial data recorded yet. You can add purchase details by
              editing this horse.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              {vault.purchase_price !== null && (
                <div className="p-4 bg-[var(--color-bg-input)] rounded-md border border-edge">
                  <div className="text-xs text-muted font-medium mb-1 uppercase tracking-[0.05em]">Purchase Price</div>
                  <div className="text-base text-success font-bold">
                    {formatCurrency(vault.purchase_price, currencySymbol)}
                  </div>
                </div>
              )}

              {vault.estimated_current_value !== null && (
                <div className="p-4 bg-[var(--color-bg-input)] rounded-md border border-edge">
                  <div className="text-xs text-muted font-medium mb-1 uppercase tracking-[0.05em]">Estimated Value</div>
                  <div className="text-base text-success font-bold">
                    {formatCurrency(vault.estimated_current_value, currencySymbol)}
                  </div>
                </div>
              )}

              {vault.purchase_date !== null && (
                <div className="p-4 bg-[var(--color-bg-input)] rounded-md border border-edge">
                  <div className="text-xs text-muted font-medium mb-1 uppercase tracking-[0.05em]">Purchase Date</div>
                  <div className="text-base text-ink font-bold">
                    {formatDate(vault.purchase_date)}
                  </div>
                </div>
              )}

              {vault.purchase_date_text && !vault.purchase_date && (
                <div className="p-4 bg-[var(--color-bg-input)] rounded-md border border-edge">
                  <div className="text-xs text-muted font-medium mb-1 uppercase tracking-[0.05em]">Purchase Date</div>
                  <div className="text-base text-ink font-bold">
                    {vault.purchase_date_text}
                  </div>
                </div>
              )}

              {vault.insurance_notes !== null && (
                <div className="p-4 bg-[var(--color-bg-input)] rounded-md border border-edge">
                  <div className="text-xs text-muted font-medium mb-1 uppercase tracking-[0.05em]">Insurance Notes</div>
                  <div className="text-base text-ink font-bold">{vault.insurance_notes}</div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 mt-4 pt-4 border-t border-edge text-xs text-muted">
              <span>🛡️</span>
              <span>
                This data is encrypted and only visible to you. Protected by Row
                Level Security.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
