"use client";

import { useState } from "react";

/**
 * UpgradeButton — triggers Stripe Checkout flow
 * Calls /api/checkout to create a session, then redirects to Stripe
 */
export default function UpgradeButton() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleUpgrade = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/checkout", { method: "POST" });
            const data = await res.json();

            if (!res.ok || !data.url) {
                setError(data.error || "Failed to start checkout. Please try again.");
                setLoading(false);
                return;
            }

            // Redirect to Stripe's hosted checkout
            window.location.href = data.url;
        } catch {
            setError("Network error. Please check your connection.");
            setLoading(false);
        }
    };

    return (
        <div>
            <button
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full cursor-pointer rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-base font-bold text-white shadow-lg transition-all hover:from-amber-600 hover:to-orange-600 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
                {loading ? (
                    <span className="flex items-center justify-center gap-2">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Starting checkout…
                    </span>
                ) : (
                    "💎 Upgrade to MHH Pro — $9/mo"
                )}
            </button>
            {error && (
                <p className="mt-2 text-center text-sm text-red-600">{error}</p>
            )}
        </div>
    );
}
