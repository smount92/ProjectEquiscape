/**
 * Shared studio presentation — server-safe, no client state.
 *
 * Everything here speaks the site's leather/ledger vocabulary: parchment
 * cards (`bg-card border-input rounded-lg border shadow-md`), serif headings,
 * brass accents. No bespoke colours, no inline gradients.
 */

import Link from "next/link";
import type { ReactNode } from "react";

import { STATUS_LABELS, STUDIO_STATUS_LABELS, type CommissionStatus, type StudioStatus } from "@/lib/studio/pipeline";
import { formatMoney, termsLines, type StudioTerms } from "@/lib/studio/terms";

// ── Status pills ──────────────────────────────────────────────────────

const COMMISSION_PILL: Record<CommissionStatus, string> = {
    requested: "bg-warning/15 text-warning border-warning/40",
    quoted: "bg-info/15 text-info border-info/40",
    accepted: "bg-info/15 text-info border-info/40",
    in_progress: "bg-studio/15 text-studio border-studio/40",
    awaiting_approval: "bg-studio/20 text-studio border-studio/40",
    completed: "bg-success/15 text-success border-success/40",
    delivered: "bg-success/15 text-success border-success/40",
    received: "bg-success/20 text-success border-success/50",
    declined: "bg-destructive/15 text-destructive border-destructive/40",
    cancelled: "bg-destructive/15 text-destructive border-destructive/40",
};

export function CommissionPill({ status }: { status: CommissionStatus }) {
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${COMMISSION_PILL[status]}`}
        >
            {STATUS_LABELS[status]}
        </span>
    );
}

const STUDIO_DOT: Record<StudioStatus, string> = {
    open: "bg-success",
    waitlist: "bg-warning",
    closed: "bg-muted-foreground",
};

export function StudioStatusPill({ status, className = "" }: { status: StudioStatus; className?: string }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border border-input bg-card/70 px-3 py-1 text-xs font-semibold ${className}`}
        >
            <span className={`inline-block h-2 w-2 rounded-full ${STUDIO_DOT[status]}`} />
            {STUDIO_STATUS_LABELS[status]}
        </span>
    );
}

// ── Layout primitives ─────────────────────────────────────────────────

export function Panel({
    title,
    icon,
    actions,
    children,
    className = "",
}: {
    title?: ReactNode;
    icon?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={`rounded-lg border border-input bg-card p-6 shadow-md ${className}`}>
            {title && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="m-0 flex items-center gap-2 font-serif text-lg font-bold">
                        {icon}
                        {title}
                    </h2>
                    {actions}
                </div>
            )}
            {children}
        </section>
    );
}

/** A ledger line: label left, value right, hairline underneath. */
export function LedgerRow({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
    return (
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-input/60 py-2 last:border-b-0">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-right text-sm font-semibold">
                {value}
                {hint && <span className="ml-2 text-xs font-normal text-muted-foreground">{hint}</span>}
            </span>
        </div>
    );
}

export function Chip({ children }: { children: ReactNode }) {
    return (
        <span className="inline-block rounded-full border border-input bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            {children}
        </span>
    );
}

export function EmptyNote({ children }: { children: ReactNode }) {
    return <p className="py-2 text-sm text-muted-foreground">{children}</p>;
}

// ── Slots ─────────────────────────────────────────────────────────────

/**
 * A filled/empty slot meter. Slots are capacity and transparency, not a
 * reservation queue — so this reads as information, never as a countdown.
 */
export function SlotMeter({ used, max, label }: { used: number; max: number; label: string }) {
    const pips = Math.min(max, 20);
    return (
        <div>
            <div className="mb-1.5 flex flex-wrap gap-1" aria-hidden="true">
                {Array.from({ length: pips }, (_, i) => (
                    <span
                        key={i}
                        className={`h-2.5 w-6 rounded-sm ${
                            i < used ? "bg-studio" : "border border-input bg-transparent"
                        }`}
                    />
                ))}
            </div>
            <span className="text-xs text-muted-foreground">{label}</span>
        </div>
    );
}

// ── Terms ─────────────────────────────────────────────────────────────

/**
 * The structured terms, rendered as scannable lines. This is what replaces
 * v1's prose blob — and what gets frozen onto the agreement at acceptance.
 */
export function TermsList({ terms }: { terms: StudioTerms }) {
    return (
        <>
            <div className="grid">
                {termsLines(terms).map((line) => (
                    <LedgerRow key={line.label} label={line.label} value={line.value} />
                ))}
            </div>
            {terms.extraNote && (
                <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-secondary-foreground">
                    {terms.extraNote}
                </p>
            )}
        </>
    );
}

// ── Money ─────────────────────────────────────────────────────────────

/**
 * The standing reminder that this platform never touches the money. It
 * appears anywhere a price does, because the difference between "we hold
 * your deposit" and "you two arrange payment" is the whole trust model.
 */
export function OffPlatformNote({ className = "" }: { className?: string }) {
    return (
        <p className={`text-xs leading-relaxed text-muted-foreground ${className}`}>
            🤝 Model Horse Hub records what you agree — it never handles the money. Deposits and payments are arranged
            directly between the commissioner and the artist.
        </p>
    );
}

export function Money({ amount }: { amount: number | null | undefined }) {
    return <span className="font-serif tabular-nums">{formatMoney(amount)}</span>;
}

// ── Receipts ──────────────────────────────────────────────────────────

/** A ribbon/title summary for one finished horse. */
export function RecordSummary({
    showCount,
    nanQualifyingCount,
    bestPlacing,
    titles,
}: {
    showCount: number;
    nanQualifyingCount: number;
    bestPlacing: number | null;
    titles: string[];
}) {
    if (showCount === 0 && titles.length === 0) {
        return <span className="text-xs text-muted-foreground">No show record yet</span>;
    }
    const ordinal = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);

    return (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {bestPlacing != null && (
                <span className="rounded-full border border-tier-gold/40 bg-tier-gold/15 px-2 py-0.5 font-semibold text-tier-gold">
                    🏆 Best {ordinal(bestPlacing)}
                </span>
            )}
            {showCount > 0 && (
                <span className="text-muted-foreground">
                    {showCount} show{showCount === 1 ? "" : "s"}
                </span>
            )}
            {nanQualifyingCount > 0 && (
                <span className="rounded-full border border-input bg-muted px-2 py-0.5 font-semibold">
                    {nanQualifyingCount} NAN-qualifying
                </span>
            )}
            {titles.map((t) => (
                <span
                    key={t}
                    className="rounded-full border border-tier-gold/40 bg-tier-gold/10 px-2 py-0.5 font-semibold text-tier-gold"
                >
                    {t}
                </span>
            ))}
        </div>
    );
}

export function StudioLink({ slug, children }: { slug: string; children: ReactNode }) {
    return (
        <Link href={`/studio/${slug}`} className="font-semibold text-forest hover:underline">
            {children}
        </Link>
    );
}
