"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

/**
 * PayPalButton — starts the PayPal Subscriptions flow.
 *
 * The sibling of UpgradeButton / StudioProButton: POST for a URL, then
 * hand the browser over. Same price, same tier, different rails.
 *
 * Wears PayPal's own gold. It shipped as a quiet outline button and the
 * first real customer missed it entirely — "didn't even see it." The
 * people this path exists for are scanning FOR PayPal, and what their
 * eye knows is the gold button and the two-tone mark, so that is what
 * this is. Card checkout keeps the top slot; this sits under it, but
 * unmistakably itself. Brand colors are fixed values on purpose — the
 * button must look the same on leather, ledger, day and lamplight.
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
                className="w-full cursor-pointer rounded-lg py-2.5 text-sm font-bold transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                    // PayPal's gold — their standard checkout button color,
                    // and the thing a PayPal-first buyer's eye scans for.
                    background: "#FFC439",
                    color: "#003087",
                    border: "1px solid #E3AC28",
                }}
            >
                {loading ? (
                    <span className="flex items-center justify-center gap-2">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Starting checkout…
                    </span>
                ) : (
                    <span className="flex items-center justify-center gap-2">
                        {/* PayPal's two-tone mark, drawn rather than loaded —
                            the site ships no third-party image hosts. */}
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
                            <path
                                fill="#003087"
                                d="M7.08 21.3h3.2l.72-4.55h2.2c3.7 0 6.16-1.9 6.76-5.5.28-1.66-.05-2.95-.94-3.83-.2-.2-.44-.38-.7-.53.02-.13.05-.26.07-.4.35-2.23-.02-3.75-1.2-5.02C15.87.05 13.9 0 11.5 0H5.1a.9.9 0 0 0-.9.77L1.5 20.2a.6.6 0 0 0 .6.7h3.9l.5-3.1z"
                            />
                            <path
                                fill="#009CDE"
                                d="M18.4 6.9c-.02.13-.04.26-.07.4-.6 3.6-3.06 5.5-6.76 5.5h-2.2l-.72 4.55h-3.2l-.5 3.1h3.55a.8.8 0 0 0 .8-.68l.03-.17.63-3.96.04-.22a.8.8 0 0 1 .79-.68h.5c3.24 0 5.78-1.32 6.52-5.13.3-1.59.15-2.92-.67-3.85a3.2 3.2 0 0 0-.74-.86z"
                            />
                        </svg>
                        Pay with PayPal
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
                        Same price. Your PayPal balance is used first.
                    </span>
                </p>
            )}
        </div>
    );
}
