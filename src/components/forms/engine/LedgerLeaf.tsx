"use client";

/**
 * A ledger leaf — the paper a section of the form is written on.
 *
 * The old forms drew every section as `rounded-xl border border-input
 * bg-card p-6 shadow-sm`: a webform card. This is the same information on
 * ruled ledger paper with a kraft index tab, which is what filling in a
 * stable's records should feel like.
 *
 * Lamplight drops the ruling (house rule) and Simple Mode flattens the
 * whole thing — both handled in CSS, so this component stays honest.
 */

import type { ReactNode } from "react";

export function LedgerLeaf({
    tab,
    children,
    className = "",
}: {
    /** Kraft index tab sitting on the leaf's top edge. */
    tab?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={className}>
            {tab && <span className="ledger-tab">{tab}</span>}
            <div className="fe-leaf">{children}</div>
        </div>
    );
}

/**
 * A section heading inside a leaf: engraved forest smallcaps with a
 * hairline rule running out to the right margin.
 */
export function LeafHeading({
    children,
    note,
}: {
    children: ReactNode;
    note?: ReactNode;
}) {
    return (
        <>
            <div className="fe-leaf-heading">
                <h2>{children}</h2>
            </div>
            {note && (
                <p className="-mt-3 mb-5 text-sm text-secondary-foreground">{note}</p>
            )}
        </>
    );
}
