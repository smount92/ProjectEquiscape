"use client";

/**
 * Numbered pages for a stable list: "Showing 97–144 of 412", Previous /
 * Next, a compact page list (first, current ±2, last) and a page-size
 * select. Owns no state — the parent turns every choice into a URL and
 * pushes it, so the browser's Back restores the page (member report,
 * 2026-10-12: Show More lost her place every time she opened a horse).
 */

import { STABLE_PER_OPTIONS, type StablePer } from "@/lib/stable/filterParams";
import { pageWindow, rangeOf } from "@/lib/stable/pagination";

const btn =
    "inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-full border border-input bg-card px-3 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card";

export default function StablePagination({
    page,
    pageCount,
    per,
    totalCount,
    shown,
    onPage,
    onPer,
    placement,
}: {
    page: number;
    pageCount: number;
    per: StablePer;
    /** Horses matching the current filters, across every page. */
    totalCount: number;
    /** Horses on this page. */
    shown: number;
    onPage: (page: number) => void;
    onPer: (per: StablePer) => void;
    /** Top and bottom copies get distinct labels and ids. */
    placement: "top" | "bottom";
}) {
    // Nothing to page and nothing smaller to choose: stay out of the way.
    if (totalCount <= STABLE_PER_OPTIONS[0] && page <= 1) return null;

    const { from, to } = rangeOf(page, per, shown);
    const items = pageWindow(page, pageCount);

    return (
        <nav
            aria-label={placement === "top" ? "Stable pages" : "Stable pages (bottom)"}
            className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-sm ${placement === "top" ? "mb-4" : "mt-8"}`}
            data-testid={`stable-pagination-${placement}`}
        >
            <p className="m-0 text-muted-foreground" aria-live={placement === "top" ? "polite" : undefined}>
                Showing{" "}
                <b className="text-foreground">
                    {from.toLocaleString()}–{to.toLocaleString()}
                </b>{" "}
                of <b className="text-foreground">{totalCount.toLocaleString()}</b>
            </p>

            {pageCount > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                        type="button"
                        className={btn}
                        onClick={() => onPage(page - 1)}
                        disabled={page <= 1}
                        aria-label="Previous page"
                    >
                        ← Previous
                    </button>
                    <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0">
                        {items.map((item, i) =>
                            item === "gap" ? (
                                <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted-foreground">
                                    …
                                </li>
                            ) : (
                                <li key={item}>
                                    <button
                                        type="button"
                                        className={
                                            item === page
                                                ? `${btn} !border-forest !bg-forest font-semibold !text-white`
                                                : btn
                                        }
                                        onClick={() => onPage(item)}
                                        aria-label={`Page ${item}`}
                                        aria-current={item === page ? "page" : undefined}
                                    >
                                        {item}
                                    </button>
                                </li>
                            ),
                        )}
                    </ol>
                    <button
                        type="button"
                        className={btn}
                        onClick={() => onPage(page + 1)}
                        disabled={page >= pageCount}
                        aria-label="Next page"
                    >
                        Next →
                    </button>
                </div>
            )}

            <label className="ml-auto flex items-center gap-2 text-muted-foreground">
                <span>Per page</span>
                <select
                    id={`stable-per-page-${placement}`}
                    className="h-8 cursor-pointer rounded-md border border-input bg-card px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-forest"
                    value={per}
                    onChange={(e) => onPer(Number(e.target.value) as StablePer)}
                    aria-label="Models per page"
                >
                    {STABLE_PER_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                            {n}
                        </option>
                    ))}
                </select>
            </label>
        </nav>
    );
}
