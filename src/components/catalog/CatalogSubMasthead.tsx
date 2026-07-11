/**
 * Leather masthead for the catalog SUB-pages (detail, suggestions list +
 * detail, suggest-new form, changelog). A lighter sibling of
 * CatalogMasthead: a back-to-catalog breadcrumb on leather, brass medallion,
 * engraved title + subtitle, and an optional action slot. Used with the
 * layout's noHeader hatch so it IS the page header.
 *
 * Day-mode trap: all text on the band uses the --leather-text ramp.
 */

import Link from "next/link";
import type { ReactNode } from "react";

export default function CatalogSubMasthead({
    icon,
    title,
    subtitle,
    actions,
    backHref = "/catalog",
    backLabel = "Reference Catalog",
}: {
    icon: string;
    title: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
    backHref?: string;
    backLabel?: string;
}) {
    return (
        <div className="leather-band stitched relative mb-6 rounded-xl px-6 py-5">
            <Link
                href={backHref}
                className="relative z-[1] mb-2 inline-block font-serif text-[0.7rem] tracking-[0.18em] uppercase no-underline hover:underline"
                style={{ color: "var(--leather-text-muted)" }}
            >
                ← {backLabel}
            </Link>
            <div className="flex flex-wrap items-center gap-4">
                <span
                    aria-hidden="true"
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl"
                    style={{
                        background:
                            "radial-gradient(circle at 32% 28%, var(--brass-hi), var(--brass) 45%, var(--brass-dark))",
                        boxShadow: "0 3px 7px rgba(0,0,0,.45), inset 0 -2px 4px rgba(0,0,0,.35)",
                    }}
                >
                    {icon}
                </span>
                <div className="min-w-0">
                    <h1 className="text-engraved-light m-0 font-serif text-2xl font-bold tracking-[0.08em] break-words uppercase">
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
