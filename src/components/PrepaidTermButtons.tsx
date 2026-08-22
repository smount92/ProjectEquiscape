"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

/**
 * PrepaidTermButtons — buy a membership that ENDS.
 *
 * ── WHY THIS EXISTS, IN THE CUSTOMER'S OWN WORDS ──────────────────
 *
 * "not really keen on a recurring monthly payment... would prefer the
 * choice of a one-time (or single payment) or maybe a choice of 3-month?
 * 6-month?"
 *
 * She is the second person to ask. What she is declining is not the
 * price — it is the standing authorization. So the design job here is
 * not "another way to pay", it is making unmistakably clear that this
 * particular button does not sign her up to anything.
 *
 * ── WHICH IS WHY THE COPY IS THE FEATURE ──────────────────────────
 *
 * A member must never be a moment's doubt about whether they have just
 * started something that renews. So:
 *
 *   · the heading says what it is, in words, before any price;
 *   · every button carries the total, not a per-month figure — a
 *     per-month price is the visual language of a subscription and would
 *     undo the whole point;
 *   · the end state is stated plainly, on screen, before the click:
 *     access ends, nothing auto-charges;
 *   · the spread-payment option, when it exists, is labelled as the one
 *     that DOES take monthly payments, and says how many.
 *
 * Renders nothing at all unless the caller passes `enabled` — the flags
 * are read on the server (paypalPathLive + prepaidTermsEnabled) and
 * passed down, so the dark-shipped state has no inbound path from here.
 */

export interface TermOption {
    key: string;
    label: string;
    months: number;
    /** Total, charged once. */
    prepaidPrice: string;
    /** Per-cycle price of the spread-payment version. */
    monthlyPrice: string;
    /** What the spread-payment version costs in total. */
    fixedTotal: string;
    /** Whether the owner has configured a PayPal plan for the spread option. */
    spreadAvailable: boolean;
}

export default function PrepaidTermButtons({
    tier,
    enabled,
    terms,
    variant = "ledger",
}: {
    tier: "pro" | "studio";
    enabled: boolean;
    terms: TermOption[];
    /** `leather` for the Pro panel, `ledger` for the Studio leaf. */
    variant?: "leather" | "ledger";
}) {
    const [pending, setPending] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [spread, setSpread] = useState(false);

    if (!enabled || terms.length === 0) return null;

    const leather = variant === "leather";
    const anySpread = terms.some((t) => t.spreadAvailable);
    const shown = spread ? terms.filter((t) => t.spreadAvailable) : terms;

    const softStyle = leather ? { color: "var(--leather-text-soft)" } : undefined;
    const mutedClass = leather ? "" : "text-muted-foreground";

    const start = async (term: TermOption) => {
        setPending(term.key);
        setError(null);
        try {
            const res = await fetch("/api/checkout/paypal/prepaid", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ term: term.key, mode: spread ? "fixed" : "prepaid" }),
            });
            const data = await res.json();

            if (!res.ok || !data.url) {
                setError(data.error || "Failed to start checkout. Please try again.");
                setPending(null);
                return;
            }

            track("checkout_start", {
                tier,
                provider: "paypal",
                term: term.key,
                mode: spread ? "fixed" : "prepaid",
            });
            // `assign` rather than `location.href = …`: identical
            // navigation, but a method call instead of a write to a
            // module-scope object, which is what the compiler's
            // immutability rule is actually looking for.
            window.location.assign(data.url);
        } catch {
            setError("Network error. Please check your connection.");
            setPending(null);
        }
    };

    return (
        <div
            className="mt-4 rounded-lg border p-3"
            style={
                leather
                    ? { borderColor: "var(--leather-text-muted)", background: "rgba(0,0,0,0.12)" }
                    : { borderColor: "var(--input)" }
            }
        >
            {/* The heading does the work. It has to be readable as
                "this is the not-a-subscription one" at a glance. */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                <span
                    className="font-serif text-[0.7rem] font-bold tracking-[0.16em] uppercase"
                    style={leather ? { color: "var(--leather-text-muted)" } : undefined}
                >
                    <span className={leather ? undefined : "text-forest"}>
                        {spread ? "Or spread it over monthly payments" : "Or pay once — no subscription"}
                    </span>
                </span>

                {anySpread && (
                    <button
                        type="button"
                        onClick={() => setSpread((v) => !v)}
                        className={`cursor-pointer text-xs underline underline-offset-2 ${mutedClass}`}
                        style={softStyle}
                    >
                        {spread ? "Pay once instead" : "Prefer monthly payments?"}
                    </button>
                )}
            </div>

            <p className="mt-1.5 text-xs leading-relaxed" style={softStyle}>
                <span className={mutedClass}>
                    {spread
                        ? "Billed monthly, then it stops on its own — no cancelling needed. Access ends when the last payment's month runs out."
                        : "One payment, and that's it. Nothing renews, nothing is stored to charge later, and access simply ends on the date you've paid up to."}
                </span>
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {shown.map((term) => (
                    <button
                        key={term.key}
                        onClick={() => start(term)}
                        disabled={pending !== null}
                        className="cursor-pointer rounded-lg border px-2 py-2 text-center transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                        style={
                            leather
                                ? {
                                      borderColor: "var(--brass-dark)",
                                      color: "var(--leather-text)",
                                      background: "rgba(255,255,255,0.06)",
                                  }
                                : { borderColor: "var(--input)" }
                        }
                    >
                        <span className="block font-serif text-sm font-bold">
                            {pending === term.key ? "Starting…" : term.label}
                        </span>
                        {/* The TOTAL, always. A "/month" here would read as
                            a subscription no matter what the heading says. */}
                        <span className="block text-xs" style={softStyle}>
                            <span className={mutedClass}>
                                {spread
                                    ? `$${term.monthlyPrice} × ${term.months} = $${term.fixedTotal}`
                                    : `$${term.prepaidPrice} total`}
                            </span>
                        </span>
                    </button>
                ))}
            </div>

            {error && <p className="mt-2 text-center text-sm text-destructive">{error}</p>}

            {!error && !spread && (
                <p className="mt-2 text-center text-[0.7rem]" style={softStyle}>
                    <span className={mutedClass}>
                        Already a member? Buying another term adds the months on to the time you have left.
                    </span>
                </p>
            )}
        </div>
    );
}
