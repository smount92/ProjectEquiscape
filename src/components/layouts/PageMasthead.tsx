/**
 * Generic leather masthead — the site-wide landmark header. One component
 * for the whole "Leather Edition" rollout: brass medallion + engraved title
 * + subtitle on a `.leather-band.stitched`, with an optional back-breadcrumb
 * and action slot. Use with a layout's `noHeader` prop so it IS the header.
 *
 * `compact` is the lighter treatment for working-surface FORM pages (smaller
 * band + medallion + title) — leather presence without shouting over a form.
 *
 * Day-mode trap: all text on the band uses the --leather-text ramp
 * (.text-engraved-light + inline leather-text vars), never default ink.
 */

import Link from "next/link";
import type { ReactNode } from "react";

export default function PageMasthead({
    icon,
    title,
    subtitle,
    actions,
    backHref,
    backLabel = "Back",
    compact = false,
}: {
    icon?: ReactNode;
    title: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
    backHref?: string;
    backLabel?: string;
    compact?: boolean;
}) {
    return (
        <div
            className={`leather-band stitched relative mb-6 rounded-xl ${
                compact ? "px-5 py-4" : "px-6 py-5"
            }`}
        >
            {backHref && (
                <Link
                    href={backHref}
                    className="relative z-[1] mb-2 inline-block font-serif text-[0.7rem] tracking-[0.18em] uppercase no-underline hover:underline"
                    style={{ color: "var(--leather-text-muted)" }}
                >
                    ← {backLabel}
                </Link>
            )}
            <div className="flex flex-wrap items-center gap-4">
                {icon && (
                    <span
                        aria-hidden="true"
                        className={`grid shrink-0 place-items-center rounded-full ${
                            compact ? "h-9 w-9 text-base" : "h-12 w-12 text-xl"
                        }`}
                        style={{
                            background:
                                "radial-gradient(circle at 32% 28%, var(--brass-hi), var(--brass) 45%, var(--brass-dark))",
                            boxShadow: "0 3px 7px rgba(0,0,0,.45), inset 0 -2px 4px rgba(0,0,0,.35)",
                        }}
                    >
                        {icon}
                    </span>
                )}
                <div className="min-w-0">
                    <h1
                        className={`text-engraved-light m-0 font-serif font-bold break-words uppercase ${
                            compact ? "text-lg tracking-[0.08em]" : "text-2xl tracking-[0.1em]"
                        }`}
                    >
                        {title}
                    </h1>
                    {subtitle && (
                        <span
                            className="font-serif text-[0.7rem] tracking-[0.18em] uppercase"
                            style={{ color: "var(--leather-text-soft)" }}
                        >
                            {subtitle}
                        </span>
                    )}
                </div>
                {actions && <div className="z-[1] ml-auto flex flex-wrap gap-2">{actions}</div>}
            </div>
        </div>
    );
}
