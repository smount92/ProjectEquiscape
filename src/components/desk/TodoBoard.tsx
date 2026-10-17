"use client";

/**
 * The Desk's To-do tab: one card per work list found by scanning the
 * Registry, with its count and who is on it ("I'm on it" claims the list
 * for a day). Lists that are only notes (the roster in a set title, until
 * the moderators agree a new rule) sit apart at the bottom.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { claimTodo, refreshTodoLists, releaseTodo, type TodoCard } from "@/app/actions/registry-desk-lists";
import { Button } from "@/components/ui/button";

const AT = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
});
const when = (iso: string) => `${AT.format(new Date(iso))} UTC`;

function claimLine(card: TodoCard): string {
    if (!card.claim)
        return card.rowsClaimed
            ? `Nobody has the whole list. ${card.rowsClaimed} rows are taken.`
            : "Nobody on it yet.";
    if (card.claim.done) return `@${card.claim.alias} marked it done.`;
    if (card.claim.mine) return `You are on it until ${when(card.claim.until)}.`;
    return `@${card.claim.alias} is on it until ${when(card.claim.until)}.`;
}

export default function TodoBoard({
    lists,
    computedAt,
    claimsReady,
}: {
    lists: TodoCard[];
    computedAt: string;
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

    const work = lists.filter((l) => l.tone !== "note");
    const notes = lists.filter((l) => l.tone === "note");

    const card = (l: TodoCard) => (
        <article key={l.key} className="ledger-card flex flex-col gap-2" aria-labelledby={`todo-${l.key}`}>
            <div className="flex items-baseline justify-between gap-3">
                <h2 id={`todo-${l.key}`} className="m-0 text-base font-bold text-foreground">
                    {l.title}
                </h2>
                <span className="font-serif text-2xl font-bold text-forest tabular-nums">
                    {l.count.toLocaleString("en-US")}
                </span>
            </div>
            <p className="m-0 text-sm text-secondary-foreground">{l.what}</p>
            {claimsReady && <p className="m-0 text-xs text-muted-foreground">{claimLine(l)}</p>}
            <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <Button asChild size="sm">
                    <Link href={`/catalog/desk/todo/${l.key}`}>Open the list</Link>
                </Button>
                {claimsReady && l.tone !== "note" && (!l.claim || l.claim.mine || l.claim.done) && (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                            run(() => (l.claim?.mine && !l.claim.done ? releaseTodo(l.key) : claimTodo(l.key)))
                        }
                    >
                        {l.claim?.mine && !l.claim.done ? "Let it go" : "I’m on it"}
                    </Button>
                )}
            </div>
        </article>
    );

    return (
        <section aria-label="To-do lists" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="m-0 max-w-[75ch] text-secondary-foreground">
                    Work lists found by scanning the whole Registry, Stablemates first. Claim one with “I’m on it” so
                    two people don’t fix the same rows.
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Checked {when(computedAt)}</span>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(refreshTodoLists)}>
                        Check again
                    </Button>
                </div>
            </div>
            {!claimsReady && (
                <p className="m-0 text-sm text-muted-foreground">
                    “I’m on it” is coming once update 244 is added. The lists work already.
                </p>
            )}
            {error && (
                <p role="alert" className="m-0 text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{work.map(card)}</div>
            {notes.length > 0 && (
                <>
                    <h2 className="mt-4 mb-0 font-serif text-lg font-bold text-foreground">For reference</h2>
                    <p className="m-0 text-sm text-muted-foreground">
                        Not problems: things worth a look, or patterns today’s rules allow.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{notes.map(card)}</div>
                </>
            )}
        </section>
    );
}
