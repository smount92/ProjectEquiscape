/**
 * Ledger-card detail blocks for the public passport.
 *
 * The member passport (community/[id]/page.tsx) grew a dense parchment
 * ledger — owner pill, "Model Details" rows, show identity, notes. The
 * ANON passport rendered four fields and a login CTA, which left a tall
 * empty tan panel on exactly the page a launch announcement points
 * logged-out visitors at. These are that same visual rhythm, extracted
 * as presentational pieces so the anon card can match without forking
 * the member markup.
 *
 * Presentational only: every value handed in must already be anon-safe
 * (get_public_passport, migration 135, is the source). No reads here.
 */

import type { ReactNode } from "react";

/** One "Label ......... Value" row — the member card's rhythm. */
export function DetailRow({ label, children }: { label: ReactNode; children: ReactNode }) {
    return (
        <div className="flex items-center justify-between border-b border-white/20 px-0 py-[5px]">
            <span className="text-sm font-medium text-secondary-foreground">{label}</span>
            <span className="max-w-[60%] text-right text-sm font-semibold text-foreground">
                {children}
            </span>
        </div>
    );
}

/** A titled sub-card on the parchment (Model Details / Show Identity / Notes). */
export function LedgerBlock({
    icon,
    title,
    children,
    testId,
}: {
    icon: string;
    title: string;
    children: ReactNode;
    testId?: string;
}) {
    return (
        <div
            className="rounded-lg border border-input bg-card/40 p-4 shadow-md transition-all"
            data-testid={testId}
        >
            <h3>
                <span aria-hidden="true">{icon}</span> {title}
            </h3>
            {children}
        </div>
    );
}
