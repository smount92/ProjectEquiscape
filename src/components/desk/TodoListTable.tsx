"use client";

/**
 * One to-do list: its rows, a page at a time. Each row opens the Mold
 * view with that release picked (or the mold itself); "I'm on it" claims
 * the row for a day and "Done" takes it off the list until the next check.
 * One column of rows, so it reads the same on a phone.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { claimTodo, markTodoDone, releaseTodo, type ClaimView, type TodoRow } from "@/app/actions/registry-desk-lists";
import type { TodoListDef } from "@/lib/registry/checks";
import { FLAG_LABELS } from "@/lib/registry/checks";
import { Button } from "@/components/ui/button";

/** Where a row opens: the Mold view for anything on a mold, the edit page for the rest. */
function openHref(row: TodoRow): string {
    if (row.kind === "near_name") return `/catalog?q=${encodeURIComponent(row.title.split(" / ")[0])}`;
    if (row.moldId && row.id && row.moldId !== row.id)
        return `/catalog/desk/mold/${row.moldId}?release=${encodeURIComponent(row.id)}`;
    if (row.moldId) return `/catalog/desk/mold/${row.moldId}`;
    return row.id ? `/catalog/${row.id}` : "/catalog";
}

function claimWords(c: ClaimView | null): string | null {
    if (!c) return null;
    if (c.done) return c.mine ? "You marked it done." : `@${c.alias} marked it done.`;
    return c.mine ? "You are on it." : `@${c.alias} is on it.`;
}

export default function TodoListTable({
    list,
    rows,
    count,
    kept,
    page,
    pageCount,
    claimsReady,
}: {
    list: TodoListDef;
    rows: TodoRow[];
    count: number;
    kept: number;
    page: number;
    pageCount: number;
    claimsReady: boolean;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const run = (fn: () => Promise<{ success: boolean; error?: string }>) =>
        startTransition(async () => {
            setError(null);
            const r = await fn();
            if (!r.success) setError(r.error ?? "That didn't work. Please try again.");
            else router.refresh();
        });

    return (
        <section aria-labelledby="todo-list-title" className="flex flex-col gap-3">
            <div>
                <Link href="/catalog/desk/todo" className="text-sm font-semibold text-forest">
                    ← All to-do lists
                </Link>
                <h2 id="todo-list-title" className="mt-2 mb-1 font-serif text-2xl font-bold text-foreground">
                    {list.title} <span className="text-forest tabular-nums">{count.toLocaleString("en-US")}</span>
                </h2>
                <p className="m-0 max-w-[75ch] text-secondary-foreground">{list.what}</p>
                {kept < count && (
                    <p className="mt-1 mb-0 text-xs text-muted-foreground">
                        Showing the first {kept.toLocaleString("en-US")}. As these are fixed, more appear.
                    </p>
                )}
            </div>
            {error && (
                <p role="alert" className="m-0 text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}
            {rows.length === 0 ? (
                <div className="ledger-card text-center text-secondary-foreground">
                    Nothing on this list. Nice work.
                </div>
            ) : (
                <ul className="ledger-card m-0 flex list-none flex-col divide-y divide-input">
                    {rows.map((row) => {
                        const claim = row.claim;
                        const takenByOther = claim && !claim.mine && !claim.done;
                        return (
                            <li
                                key={row.key}
                                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <Link
                                        href={openHref(row)}
                                        className="font-semibold break-words text-foreground hover:text-forest"
                                    >
                                        {row.title}
                                    </Link>
                                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                                        {row.maker && <span>{row.maker}</span>}
                                        {row.scale && <span>{row.scale}</span>}
                                        {row.moldTitle && row.moldId !== row.id && <span>under {row.moldTitle}</span>}
                                        {list.key === "duplicates" && <span>{FLAG_LABELS[row.kind]}</span>}
                                    </div>
                                    {row.detail && (
                                        <p className="mt-1 mb-0 text-sm text-secondary-foreground">{row.detail}</p>
                                    )}
                                    {claimWords(claim) && (
                                        <p className="mt-1 mb-0 text-xs font-semibold text-forest">
                                            {claimWords(claim)}
                                        </p>
                                    )}
                                </div>
                                {claimsReady && list.tone !== "note" && !takenByOther && (
                                    <div className="flex shrink-0 flex-wrap gap-2">
                                        {claim?.mine && !claim.done ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={pending}
                                                onClick={() => run(() => releaseTodo(list.key, row.key))}
                                            >
                                                Let it go
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={pending}
                                                onClick={() => run(() => claimTodo(list.key, row.key))}
                                            >
                                                I’m on it
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            disabled={pending}
                                            onClick={() => run(() => markTodoDone(list.key, row.key))}
                                        >
                                            Done
                                        </Button>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            {pageCount > 1 && (
                <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-sm">
                    {page > 1 ? (
                        <Link
                            href={`/catalog/desk/todo/${list.key}?page=${page - 1}`}
                            className="font-semibold text-forest"
                        >
                            ← Previous
                        </Link>
                    ) : (
                        <span />
                    )}
                    <span className="text-muted-foreground">
                        Page {page} of {pageCount}
                    </span>
                    {page < pageCount ? (
                        <Link
                            href={`/catalog/desk/todo/${list.key}?page=${page + 1}`}
                            className="font-semibold text-forest"
                        >
                            Next →
                        </Link>
                    ) : (
                        <span />
                    )}
                </nav>
            )}
        </section>
    );
}
