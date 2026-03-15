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
    <div className={`vault-reveal ${isUnlocked ? "unlocked" : ""}`}>
      <div className="vault-reveal-header">
        <div className="vault-reveal-lock" aria-hidden="true">
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
          className="vault-reveal-btn"
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

      <div className="vault-reveal-body" id="vault-data">
        {!hasData ? (
          <div className="vault-empty">
            <p>
              📭 No financial data recorded yet. You can add purchase details by
              editing this horse.
            </p>
          </div>
        ) : (
          <>
            <div className="vault-reveal-grid">
              {vault.purchase_price !== null && (
                <div className="vault-data-item">
                  <div className="vault-data-label">Purchase Price</div>
                  <div className="vault-data-value money">
                    {formatCurrency(vault.purchase_price, currencySymbol)}
                  </div>
                </div>
              )}

              {vault.estimated_current_value !== null && (
                <div className="vault-data-item">
                  <div className="vault-data-label">Estimated Value</div>
                  <div className="vault-data-value money">
                    {formatCurrency(vault.estimated_current_value, currencySymbol)}
                  </div>
                </div>
              )}

              {vault.purchase_date !== null && (
                <div className="vault-data-item">
                  <div className="vault-data-label">Purchase Date</div>
                  <div className="vault-data-value">
                    {formatDate(vault.purchase_date)}
                  </div>
                </div>
              )}

              {vault.purchase_date_text && !vault.purchase_date && (
                <div className="vault-data-item">
                  <div className="vault-data-label">Purchase Date</div>
                  <div className="vault-data-value">
                    {vault.purchase_date_text}
                  </div>
                </div>
              )}

              {vault.insurance_notes !== null && (
                <div className="vault-data-item">
                  <div className="vault-data-label">Insurance Notes</div>
                  <div className="vault-data-value">{vault.insurance_notes}</div>
                </div>
              )}
            </div>

            <div className="vault-privacy-label">
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
