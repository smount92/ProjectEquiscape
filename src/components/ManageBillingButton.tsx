"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Opens Stripe's billing portal: update the card, see receipts, cancel. */
export default function ManageBillingButton({ variant = "outline" }: { variant?: "default" | "outline" }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const open = async () => {
        setBusy(true);
        setError(null);
        try {
            const res = await fetch("/api/billing/portal", { method: "POST" });
            const body = (await res.json()) as { url?: string; error?: string };
            if (body.url) {
                window.location.href = body.url;
                return;
            }
            setError(body.error ?? "The billing page couldn't open just now. Please try again.");
        } catch {
            setError("The billing page couldn't open just now. Please try again.");
        }
        setBusy(false);
    };

    return (
        <div>
            <Button
                type="button"
                variant={variant}
                onClick={open}
                disabled={busy}
                aria-describedby="manage-billing-note"
            >
                {busy ? "Opening…" : "Manage billing"}
            </Button>
            <p id="manage-billing-note" className="mt-1 max-w-[36ch] text-xs text-muted-foreground">
                Opens Stripe, our payment service, to update your card, see receipts or cancel.
            </p>
            {error && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}
