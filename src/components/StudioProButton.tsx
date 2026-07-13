"use client";

import { useState } from "react";
import { Palette } from "lucide-react";
import { track } from "@/lib/analytics";

/**
 * StudioProButton — triggers Stripe Checkout for Studio Pro artist tier
 * Calls /api/checkout/studio-pro to create a session, then redirects to Stripe
 */
export default function StudioProButton() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleUpgrade = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/checkout/studio-pro", { method: "POST" });
            const data = await res.json();

            if (!res.ok || !data.url) {
                setError(data.error || "Failed to start checkout. Please try again.");
                setLoading(false);
                return;
            }

            track("checkout_start", { tier: "studio_pro" });
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
                className="w-full cursor-pointer rounded-lg bg-studio px-6 py-3 text-base font-bold text-background shadow-lg transition-all hover:bg-studio/90 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
                {loading ? (
                    <span className="flex items-center justify-center gap-2">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Starting checkout…
                    </span>
                ) : (
                    <span className="flex items-center justify-center gap-2">
                        <Palette className="h-4 w-4" /> Upgrade to Studio Pro — $10/mo
                    </span>
                )}
            </button>
            {error && (
                <p className="mt-2 text-center text-sm text-destructive">{error}</p>
            )}
        </div>
    );
}
