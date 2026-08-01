/**
 * GlossaryLink — a small superscript "?" that deep-links one glossary
 * definition (/learn/glossary#<anchor>). Deployed beside hobby jargon
 * (Hoofprint, mold, Blue Book, condition grades, OF) so outsiders can
 * always find the plain-English meaning one tap away.
 *
 * Server-safe (no client hooks) so it drops into SSG reference pages.
 * The visible glyph is decorative; the accessible name carries the term.
 */

import Link from "next/link";

export default function GlossaryLink({
    anchor,
    term,
    className = "",
}: {
    /** A stable id from /learn/glossary (entries.ts) — e.g. "hoofprint". */
    anchor: string;
    /** The jargon being explained — becomes the accessible label. */
    term: string;
    className?: string;
}) {
    return (
        <sup className={`ml-0.5 inline-flex align-super leading-none ${className}`}>
            <Link
                href={`/learn/glossary#${anchor}`}
                aria-label={`What does “${term}” mean? Open the glossary definition`}
                title={`What does “${term}” mean?`}
                className="inline-flex h-[1.05em] min-h-4 w-[1.05em] min-w-4 items-center justify-center rounded-full border border-current text-[0.62em] font-bold text-forest no-underline opacity-80 transition-opacity hover:opacity-100 focus-visible:opacity-100"
            >
                <span aria-hidden="true">?</span>
            </Link>
        </sup>
    );
}
