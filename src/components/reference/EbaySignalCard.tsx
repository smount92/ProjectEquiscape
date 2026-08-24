"use client";

import { useState, useTransition } from "react";
import { reportWrongModelMatch } from "@/app/actions/priceSignals";
import { EBAY_AFFILIATE_DISCLOSURE, EBAY_AFFILIATE_REL } from "@/lib/utils/ebayAffiliate";

export interface EbaySignalView {
    askingLow: number;
    askingMedian: number;
    askingHigh: number;
    sampleSize: number;
    observedAt: string;
    listings: { title: string; price: number; url: string }[];
}

/**
 * EbaySignalCard — "on eBay right now" for one model, with receipts.
 *
 * TWO WORDS THAT MUST NEVER BLUR: these are ASKING prices from active
 * listings, not sold prices. Every label here says asking; none says
 * worth, value, or sold. The Blue Book section above this one is where
 * sold data will live, and the two must stay visually and verbally
 * distinct forever.
 *
 * The report button exists because the listing-to-model matching is
 * automated and a member will eventually catch it wrong. Reporting hides
 * the signal immediately and stops the sweep refreshing this model until
 * an admin resolves it — the member is trusted first, checked second.
 */
export default function EbaySignalCard({
    catalogItemId,
    signal,
}: {
    catalogItemId: string;
    signal: EbaySignalView;
}) {
    const [reported, setReported] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [note, setNote] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    if (reported) {
        return (
            <div className="rounded-xl border border-input bg-card p-5 text-sm text-secondary-foreground shadow-sm">
                🚩 Thanks — this price signal is hidden while we check the match.
            </div>
        );
    }

    const money = (n: number) => `$${Number(n).toLocaleString("en-US")}`;
    const observed = new Date(signal.observedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });

    const handleReport = () => {
        setError(null);
        startTransition(async () => {
            const result = await reportWrongModelMatch({ catalogItemId, note: note.trim() || undefined });
            if (result.success) setReported(true);
            else setError(result.error ?? "Could not file the report.");
        });
    };

    return (
        <div className="overflow-hidden rounded-xl border border-input bg-card shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr]">
                <div className="border-b border-input p-5 sm:border-r sm:border-b-0">
                    <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                        Median asking
                    </div>
                    <div className="mt-1 text-4xl font-extrabold tabular-nums text-foreground">
                        {money(signal.askingMedian)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                        {money(signal.askingLow)}–{money(signal.askingHigh)} across{" "}
                        {signal.sampleSize} listing{signal.sampleSize !== 1 ? "s" : ""} · checked {observed}
                    </div>
                </div>
                <div className="p-5">
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                        {signal.listings.map((l) => (
                            <li key={l.url} className="flex items-baseline gap-2 text-sm">
                                <span className="font-semibold tabular-nums text-foreground">{money(l.price)}</span>
                                <a
                                    href={l.url}
                                    target="_blank"
                                    rel={EBAY_AFFILIATE_REL}
                                    className="text-forest min-w-0 truncate hover:underline"
                                >
                                    {l.title}
                                </a>
                                <span aria-hidden="true" className="text-xs text-muted-foreground">↗</span>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="m-0 text-xs text-muted-foreground">
                            Asking prices, not sales. {EBAY_AFFILIATE_DISCLOSURE}
                        </p>
                        {!confirming ? (
                            <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground text-xs underline"
                                onClick={() => setConfirming(true)}
                            >
                                Is this the wrong model? Report it
                            </button>
                        ) : null}
                    </div>
                    {confirming && (
                        <div className="border-input mt-3 flex flex-col gap-2 border-t pt-3">
                            <input
                                type="text"
                                className="border-input bg-card w-full rounded-md border px-3 py-1.5 text-sm"
                                placeholder="Optional: what did it match instead? (helps us fix it faster)"
                                value={note}
                                maxLength={500}
                                onChange={(e) => setNote(e.target.value)}
                            />
                            {error && <p className="m-0 text-xs text-destructive">{error}</p>}
                            <div className="flex gap-3 text-xs">
                                <button
                                    type="button"
                                    className="text-destructive font-semibold underline disabled:opacity-50"
                                    disabled={pending}
                                    onClick={handleReport}
                                >
                                    {pending ? "Reporting…" : "Yes — hide it and tell the admins"}
                                </button>
                                <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground underline"
                                    disabled={pending}
                                    onClick={() => setConfirming(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
