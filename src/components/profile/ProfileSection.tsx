/**
 * Shared furniture for the profile's sections — the brass heading
 * row every other approved surface uses, and an empty state that
 * says something instead of leaving a hole.
 */

import type { ReactNode } from "react";

export function SectionHeading({
    title,
    note,
    id,
}: {
    title: ReactNode;
    /** Quiet right-aligned aside — counts, provenance, caveats. */
    note?: ReactNode;
    id?: string;
}) {
    return (
        <div className="brass-heading mb-3" id={id}>
            <span className="brass-heading-bar" aria-hidden="true" />
            <h2 className="font-serif text-base font-bold text-foreground">{title}</h2>
            {note && <span className="ml-auto text-xs text-muted-foreground italic">{note}</span>}
        </div>
    );
}

/**
 * An empty section with a bit of barn humour. Deliberately quieter
 * than the page's real content — an empty shelf should read as "not
 * yet", never as an error.
 */
export function EmptyNote({
    icon,
    title,
    children,
    action,
}: {
    icon: string;
    title: string;
    children?: ReactNode;
    action?: ReactNode;
}) {
    return (
        <div className="rounded-lg border border-dashed border-input bg-card/40 px-6 py-8 text-center backdrop-blur-sm">
            <div className="mb-2 text-3xl" aria-hidden="true">
                {icon}
            </div>
            <h3 className="mb-1 font-serif text-base font-bold text-foreground">{title}</h3>
            {children && <p className="mx-auto max-w-[46ch] text-sm text-secondary-foreground">{children}</p>}
            {action && <div className="mt-4 flex justify-center">{action}</div>}
        </div>
    );
}
