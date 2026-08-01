"use client";

import { useState, useTransition } from "react";
import { setSupporterLedgerListing } from "@/app/actions/supporter";

/**
 * SupporterLedgerToggle — a supporter's opt-IN for the public Supporters'
 * Ledger on the About page. Lives on the /upgrade page (shown only when the
 * viewer is an active supporter). Default is opted out; this only ever
 * touches the user's own preference column.
 */
export default function SupporterLedgerToggle({ initialListed }: { initialListed: boolean }) {
    const [listed, setListed] = useState(initialListed);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const handleChange = (next: boolean) => {
        setError(null);
        const previous = listed;
        setListed(next);
        startTransition(async () => {
            const result = await setSupporterLedgerListing(next);
            if (!result.success) {
                setListed(previous);
                setError(result.error || "Could not save your preference.");
            }
        });
    };

    return (
        <div className="text-left">
            <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={listed}
                    disabled={pending}
                    onChange={(e) => handleChange(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-(--brass)"
                />
                <span>
                    <span className="font-semibold text-foreground">List me on the Supporters&apos; Ledger</span>
                    <span className="block text-xs text-secondary-foreground">
                        Your alias and the month you first supported, on the About page. Off by default — the
                        plaque on your profile stays either way.
                    </span>
                </span>
            </label>
            {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
        </div>
    );
}
