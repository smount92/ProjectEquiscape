"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { listHiddenPrices, restoreHiddenPrice, type HiddenPrice } from "@/app/actions/priceSignals";

/**
 * eBay prices members reported as the wrong model (MHH-022). Each stays
 * hidden, and its model off the eBay sweep, until the owner restores it.
 * A price that really was the wrong model is simply left here.
 */
export default function AdminHiddenPricesCard() {
    const [prices, setPrices] = useState<HiddenPrice[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    useEffect(() => {
        let live = true;
        listHiddenPrices()
            .then((r) => {
                if (!live) return;
                if (r.success) setPrices(r.prices);
                else setError(r.error);
            })
            .catch(() => {
                if (live) setError("The hidden prices couldn't load just now.");
            });
        return () => {
            live = false;
        };
    }, []);

    const restore = async (p: HiddenPrice) => {
        setBusy(p.catalogItemId);
        const r = await restoreHiddenPrice(p.catalogItemId).catch(() => ({
            success: false,
            error: "That price couldn't be restored just now.",
        }));
        if (r.success) setPrices((prev) => (prev ?? []).filter((x) => x.catalogItemId !== p.catalogItemId));
        else setError(r.error ?? "That price couldn't be restored just now.");
        setBusy(null);
    };

    return (
        <div className="rounded-lg border border-input bg-card p-4 shadow-sm">
            <p className="mt-0 mb-3 text-xs text-muted-foreground">
                A member said the eBay listings behind these prices were a different model. Each price is hidden and its
                model is off the eBay sweep. Open the page to check; if the listings were right, show the price again
                (the member is told). If they were wrong, leave it here.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {prices === null && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
            {prices?.length === 0 && <p className="text-sm text-muted-foreground">No hidden prices.</p>}
            {prices && prices.length > 0 && (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {prices.map((p) => (
                        <li
                            key={p.catalogItemId}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-input p-3 text-sm"
                        >
                            <div>
                                <Link
                                    href={`/catalog/${p.catalogItemId}`}
                                    className="font-semibold underline hover:no-underline"
                                >
                                    {p.title}
                                </Link>
                                {p.reports.map((r, i) => (
                                    <div key={i} className="text-xs text-muted-foreground">
                                        Reported by {r.reporter} on{" "}
                                        {new Date(r.reportedAt).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                        })}
                                        {r.note ? ` · "${r.note}"` : ""}
                                    </div>
                                ))}
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => restore(p)}
                                disabled={busy === p.catalogItemId}
                                aria-label={`Show the price for ${p.title} again`}
                            >
                                {busy === p.catalogItemId ? "Restoring…" : "Show it again"}
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
