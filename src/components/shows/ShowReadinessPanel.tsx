"use client";

/**
 * Batch 3 — the "Get show-ready" panel that replaces the old
 * dead-end prose when entries are open but the viewer has no
 * enterable horses. Three states:
 *
 *   empty — no horses at all → a first-horse checklist that links
 *           straight into /add-horse with a returnTo back here.
 *   gaps  — horses exist but none are enterable → say exactly why,
 *           per bucket, with a direct link to the stable.
 *   ready — the stable looks enterable (fresher than the server
 *           render) → one click reloads the horse list.
 *
 * Guidance only: the server (entryRules + RLS) stays the sole
 * authority on what may actually enter.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { getMyShowReadiness } from "@/app/actions/show-readiness";
import { deriveReadinessState, type ReadinessState } from "@/lib/shows/readiness";
import type { ShowMode } from "@/lib/shows/types";
import { Button } from "@/components/ui/button";

interface ShowReadinessPanelProps {
    showId: string;
    mode: ShowMode;
    /** The stable looks enterable — parent refetches its horse list. */
    onHorsesReady: () => void | Promise<void>;
}

const CHECKLIST: { title: string; detail: string }[] = [
    {
        title: "Add your first horse",
        detail: "Name, finish, condition — the short version is fine.",
    },
    {
        title: "Give it a photo",
        detail: "Online shows judge the photo, so one clear side shot is enough.",
    },
    {
        title: "Set it public",
        detail: "Public is the default — public horses can enter shows and appear in the Show Ring.",
    },
];

export default function ShowReadinessPanel({
    showId,
    mode,
    onHorsesReady,
}: ShowReadinessPanelProps) {
    const [state, setState] = useState<ReadinessState | null>(null);
    const [failed, setFailed] = useState(false);
    const [checking, setChecking] = useState(false);
    const [loadingHorses, setLoadingHorses] = useState(false);

    const check = useCallback(async () => {
        setChecking(true);
        try {
            const result = await getMyShowReadiness();
            if (result.success) {
                setState(deriveReadinessState(result.readiness, mode));
                setFailed(false);
            } else {
                setFailed(true);
            }
        } catch {
            setFailed(true);
        }
        setChecking(false);
    }, [mode]);

    useEffect(() => {
        void check();
    }, [check]);

    const addHref = `/add-horse?returnTo=${encodeURIComponent(`/shows/${showId}`)}`;

    // Degraded fallback: the old prose, now at least carrying a link.
    if (failed) {
        return (
            <p className="ledger-card text-sm text-muted-foreground" role="note">
                Entries are open, but you have no public horses yet —{" "}
                <Link href={addHref} className="font-semibold text-forest hover:underline">
                    add a horse to your stable
                </Link>{" "}
                (and set it public) to enter.
            </p>
        );
    }

    if (!state) {
        return (
            <p className="ledger-card text-sm text-muted-foreground" role="status">
                Entries are open — checking your stable…
            </p>
        );
    }

    if (state.kind === "empty") {
        return (
            <section className="ledger-card" aria-labelledby="show-ready-heading">
                <span className="ledger-tab" id="show-ready-heading">
                    Get Show-Ready
                </span>
                <p className="text-sm text-muted-foreground">
                    Entries are open, and you&rsquo;re about two minutes from your first one.
                    The show will wait.
                </p>
                <ol className="mt-3 flex list-none flex-col gap-2.5 p-0">
                    {CHECKLIST.map((step, i) => (
                        <li key={step.title} className="flex items-start gap-3">
                            <span
                                aria-hidden="true"
                                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-forest bg-forest/10 font-serif text-xs font-bold text-forest"
                            >
                                {i + 1}
                            </span>
                            <div>
                                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                                <p className="text-xs text-muted-foreground">{step.detail}</p>
                            </div>
                        </li>
                    ))}
                </ol>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button asChild>
                        <Link href={addHref}>Add your first horse →</Link>
                    </Button>
                    <span className="text-xs text-muted-foreground">
                        You&rsquo;ll get a &ldquo;Back to the show&rdquo; button when it&rsquo;s
                        saved.
                    </span>
                </div>
            </section>
        );
    }

    if (state.kind === "gaps") {
        return (
            <section className="ledger-card" aria-labelledby="almost-ready-heading">
                <span className="ledger-tab" id="almost-ready-heading">
                    Almost Show-Ready
                </span>
                <p className="text-sm text-muted-foreground">
                    Entries are open — your stable just needs a touch-up:
                </p>
                <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
                    {state.messages.map((message) => (
                        <li key={message}>{message}</li>
                    ))}
                </ul>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                        <Link href="/stable">Open your stable →</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href={addHref}>Add another horse →</Link>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void check()} disabled={checking}>
                        {checking ? "Checking…" : "Re-check"}
                    </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                    Visibility and photos live on each horse&rsquo;s edit page — fix one and
                    re-check.
                </p>
            </section>
        );
    }

    // ready — the client sees fresher data than the server render did.
    return (
        <section className="ledger-card" aria-labelledby="ready-heading">
            <span className="ledger-tab" id="ready-heading">
                Ready to Enter
            </span>
            <p className="text-sm text-muted-foreground">
                {state.readyCount === 1
                    ? "Your stable has 1 show-ready horse."
                    : `Your stable has ${state.readyCount} show-ready horses.`}{" "}
                Load them to pick a class.
            </p>
            <div className="mt-3">
                <Button
                    size="sm"
                    disabled={loadingHorses}
                    onClick={async () => {
                        setLoadingHorses(true);
                        try {
                            await onHorsesReady();
                        } finally {
                            setLoadingHorses(false);
                        }
                    }}
                >
                    {loadingHorses ? "Loading…" : "Load my horses"}
                </Button>
            </div>
        </section>
    );
}
