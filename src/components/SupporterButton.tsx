"use client";

import { useState } from "react";
import { Lamp } from "lucide-react";
import { track } from "@/lib/analytics";

/**
 * SupporterButton — triggers Stripe Checkout for the annual Supporter
 * contribution ("keep the lights on"; cosmetic recognition only).
 * Calls /api/checkout/supporter to create a session, then redirects to Stripe.
 * Mirrors UpgradeButton / StudioProButton.
 */
export default function SupporterButton({ priceLabel }: { priceLabel: string }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSupport = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/checkout/supporter", { method: "POST" });
            const data = await res.json();

            if (!res.ok || !data.url) {
                setError(data.error || "Failed to start checkout. Please try again.");
                setLoading(false);
                return;
            }

            track("checkout_start", { tier: "supporter" });
            window.location.href = data.url;
        } catch {
            setError("Network error. Please check your connection.");
            setLoading(false);
        }
    };

    return (
        <div>
            <button
                onClick={handleSupport}
                disabled={loading}
                className="btn-brass w-full py-3 text-base font-bold shadow-lg transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
                {loading ? (
                    <span className="flex items-center justify-center gap-2">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Starting checkout…
                    </span>
                ) : (
                    <span className="flex items-center justify-center gap-2">
                        <Lamp className="h-4 w-4" /> Become a Supporter — {priceLabel}
                    </span>
                )}
            </button>
            {error && (
                <p className="mt-2 text-center text-sm text-destructive">{error}</p>
            )}
        </div>
    );
}
