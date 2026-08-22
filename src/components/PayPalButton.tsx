"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

/**
 * PayPalButton — starts the PayPal Subscriptions flow.
 *
 * The sibling of UpgradeButton / StudioProButton: POST for a URL, then
 * hand the browser over. Same price, same tier, different rails.
 *
 * Deliberately the QUIETER of the two options on each card. Card checkout
 * stays the primary button; this sits under it as a plain alternative,
 * because most members will use a card and the ones who want PayPal
 * already know they do.
 *
 * Renders nothing at all unless the caller passes `enabled` — the flag is
 * read on the server (src/lib/paypal/flag.ts) and passed down, so the
 * dark-shipped state has no inbound path from the UI.
 */
export default function PayPalButton({
    plan,
    enabled,
    variant = "ledger",
}: {
    plan: "pro" | "studio";
    enabled: boolean;
    /** `leather` for the Pro panel, `ledger` for the Studio leaf. */
    variant?: "leather" | "ledger";
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!enabled) return null;

    const handleClick = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/checkout/paypal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan }),
            });
            const data = await res.json();

            if (!res.ok || !data.url) {
                setError(data.error || "Failed to start checkout. Please try again.");
                setLoading(false);
                return;
            }

            track("checkout_start", { tier: plan, provider: "paypal" });
            window.location.href = data.url;
        } catch {
            setError("Network error. Please check your connection.");
            setLoading(false);
        }
    };

    const leather = variant === "leather";

    return (
        <div className="mt-3">
            <button
                onClick={handleClick}
                disabled={loading}
                className="w-full cursor-pointer rounded-lg border py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
                style={
                    leather
                        ? {
                              borderColor: "var(--leather-text-soft)",
                              color: "var(--leather-text)",
                              background: "transparent",
                          }
                        : undefined
                }
            >
                {loading ? (
                    <span className="flex items-center justify-center gap-2">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Starting checkout…
                    </span>
                ) : (
                    <span className="flex items-center justify-center gap-2">
                        {/* PayPal's mark, drawn rather than loaded — the site
                            ships no third-party image hosts. */}
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-4 w-4 shrink-0"
                            fill="currentColor"
                        >
                            <path d="M7.08 21.3h3.2l.72-4.55h2.2c3.7 0 6.16-1.9 6.76-5.5.28-1.66-.05-2.95-.94-3.83-.2-.2-.44-.38-.7-.53.02-.13.05-.26.07-.4.35-2.23-.02-3.75-1.2-5.02C15.87.05 13.9 0 11.5 0H5.1a.9.9 0 0 0-.9.77L1.5 20.2a.6.6 0 0 0 .6.7h3.9l.5-3.1zM9.1 4.6h3.1c1.53 0 2.6.2 3.1.75.36.4.5.95.4 1.7-.4 2.5-1.85 3.35-4.2 3.35H9.9a.9.9 0 0 0-.9.77l-.6 3.8-.9 5.7H5.4L8.2 4.6h.9z" />
                        </svg>
                        Pay with PayPal instead
                    </span>
                )}
            </button>
            {error && <p className="mt-2 text-center text-sm text-destructive">{error}</p>}
            {!error && (
                <p
                    className="mt-1.5 text-center text-xs"
                    style={leather ? { color: "var(--leather-text-soft)" } : undefined}
                >
                    <span className={leather ? undefined : "text-muted-foreground"}>
                        Same price. Uses your PayPal balance or a card on file.
                    </span>
                </p>
            )}
        </div>
    );
}
