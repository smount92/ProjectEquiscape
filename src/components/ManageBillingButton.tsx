"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Opens Stripe's billing portal: update the card, see invoices, cancel. */
export default function ManageBillingButton() {
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
            <Button type="button" variant="outline" onClick={open} disabled={busy}>
                {busy ? "Opening…" : "Manage billing"}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">Update your card, see invoices or cancel, on Stripe.</p>
            {error && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}
