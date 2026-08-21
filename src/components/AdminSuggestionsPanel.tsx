"use client";

/**
 * The legacy `database_suggestions` queue (migration 020).
 *
 * Nothing files into this table any more — the add-horse picker writes
 * to `catalog_suggestions` instead. This panel exists only to drain
 * what is already in it, and it RETIRES ITSELF: when the queue is
 * empty it renders nothing at all, so the Content tab stops carrying a
 * dead section the moment the last row clears.
 *
 * It previously could not clear at all. The old action wrote a
 * `reviewed_at` column that `database_suggestions` has never had, so
 * every Approve and Reject failed with PGRST204 — and this component
 * destructured only `{ success }`, throwing the error away, so the
 * button blinked and the row stayed. Both halves are fixed: the action
 * (resolveLegacySuggestion) no longer writes the phantom column, and
 * failures are shown here instead of swallowed.
 */

import { useState, useTransition } from "react";

import { resolveLegacySuggestion, type LegacySuggestionRow } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

const TYPE_EMOJI: Record<string, string> = {
    mold: "🐴",
    release: "📦",
    resin: "🎨",
};

const TYPE_LABEL: Record<string, string> = {
    mold: "Mold",
    release: "Release",
    resin: "Artist Resin",
};

type Decision = "approve" | "reject" | "dismiss";

export default function AdminSuggestionsPanel({
    suggestions,
}: {
    suggestions: LegacySuggestionRow[];
}) {
    const [items, setItems] = useState(suggestions);
    const [isPending, startTransition] = useTransition();
    const [working, setWorking] = useState<{ id: string; decision: Decision } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const resolve = (id: string, decision: Decision) => {
        setWorking({ id, decision });
        setError(null);
        startTransition(async () => {
            const result = await resolveLegacySuggestion(id, decision);
            if (result.success) {
                setItems((prev) => prev.filter((s) => s.id !== id));
            } else {
                // The whole point of this rewrite: say what went wrong.
                setError(result.error ?? "Could not clear that suggestion.");
            }
            setWorking(null);
        });
    };

    // Self-retiring: a drained queue renders nothing, not an empty state.
    if (items.length === 0) return null;

    const busy = (id: string, decision: Decision) =>
        isPending && working?.id === id && working.decision === decision;
    const rowBusy = (id: string) => isPending && working?.id === id;

    return (
        <div className="flex flex-col gap-3">
            <div>
                <h3 className="mt-0 mb-1 flex flex-wrap items-center gap-2 text-base font-bold">
                    💡 Database suggestions
                    <span className="text-xs font-medium text-muted-foreground">
                        (legacy queue — retires when empty)
                    </span>
                </h3>
                <p className="mt-0 mb-0 text-xs text-muted-foreground">
                    The old <span className="font-mono">database_suggestions</span> pipeline. No new
                    submissions arrive here. <strong>Approve</strong> mints a catalog entry (and
                    skips it if an identical one already exists);{" "}
                    <strong>Reject</strong> declines it; <strong>Dismiss</strong> clears junk with
                    no side effects whatsoever. This section disappears when the last row goes.
                </p>
            </div>

            {error && (
                <p
                    role="alert"
                    className="m-0 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm font-semibold text-destructive"
                >
                    {error}
                </p>
            )}

            {items.map((s) => (
                <div key={s.id} className="rounded-lg border border-input bg-card px-4 py-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground">
                            {TYPE_EMOJI[s.suggestionType] ?? "📝"}{" "}
                            {TYPE_LABEL[s.suggestionType] ?? s.suggestionType}
                            {s.name ? ` — ${s.name}` : ""}
                        </span>
                        <span className="text-xs whitespace-nowrap text-muted-foreground">
                            @{s.submitterAlias} ·{" "}
                            {new Date(s.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                            })}
                        </span>
                    </div>
                    {s.details && (
                        <div className="mb-3 text-sm leading-relaxed whitespace-pre-wrap text-secondary-foreground">
                            {s.details}
                        </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            onClick={() => resolve(s.id, "approve")}
                            disabled={rowBusy(s.id)}
                        >
                            {busy(s.id, "approve") ? "…" : "✅ Approve"}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resolve(s.id, "reject")}
                            disabled={rowBusy(s.id)}
                        >
                            {busy(s.id, "reject") ? "…" : "❌ Reject"}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            title="Clear this row without touching the catalog"
                            onClick={() => resolve(s.id, "dismiss")}
                            disabled={rowBusy(s.id)}
                        >
                            {busy(s.id, "dismiss") ? "…" : "🧹 Dismiss"}
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}
