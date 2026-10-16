import type { ReactNode } from "react";

/**
 * A Registry result list, split by a "Sets that include …" heading where
 * the rows that match only inside a set's roster begin (MHH-075). Searching
 * "Arabian Stallion" lists the mold and its releases first, then the sets
 * that merely name an Arabian Stallion among their pieces, under this
 * heading, so a member reads them as sets and not as more Arabian Stallions.
 * `splitAt` is the index on this page (0 when the page is all sets); -1
 * draws the list whole.
 */
export default function SetsHeadingSplit<T>({
    items,
    splitAt,
    term,
    render,
}: {
    items: T[];
    splitAt: number;
    term?: string;
    render: (list: T[]) => ReactNode;
}) {
    if (splitAt < 0 || splitAt >= items.length) return <>{render(items)}</>;
    const name = term?.trim();
    return (
        <>
            {splitAt > 0 && render(items.slice(0, splitAt))}
            <div className="mt-6 mb-3 border-t border-input pt-4" data-testid="catalog-sets-heading">
                <h2 className="m-0 font-serif text-lg font-semibold text-foreground">
                    Sets that include {name ? `“${name}”` : "it"}
                </h2>
                <p className="m-0 text-sm text-muted-foreground">
                    These sets list it among their pieces. Each row is another piece from the set, filed under its own
                    mold.
                </p>
            </div>
            {render(items.slice(splitAt))}
        </>
    );
}
