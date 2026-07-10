"use client";

/**
 * Phase E1 — console Overview: judging progress once the show is
 * judging (or in results review).
 *
 *   judged shows          → classes placed / total + judge-queue link
 *   community-vote shows  → voting status while judging; the
 *                           "Derive placings from votes" button
 *                           (finalizeCommunityVotes) in results
 *                           review, host/co-host only.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { finalizeCommunityVotes } from "@/app/actions/shows-v2";
import type { ConsoleDivision } from "@/lib/shows/console";
import type { ShowJudging, ShowStatus } from "@/lib/shows/types";
import { Button } from "@/components/ui/button";

interface JudgingProgressCardProps {
    showId: string;
    status: ShowStatus;
    judging: ShowJudging;
    divisions: ConsoleDivision[];
    canManage: boolean;
}

export default function JudgingProgressCard({
    showId,
    status,
    judging,
    divisions,
    canManage,
}: JudgingProgressCardProps) {
    const router = useRouter();
    const [finalizing, setFinalizing] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (status !== "judging" && status !== "results_review") return null;

    const classes = divisions.flatMap((d) => d.sections.flatMap((s) => s.classes));
    const judgeable = classes.filter(
        (c) => c.status !== "cancelled" && c.status !== "combined",
    );
    const placed = judgeable.filter((c) => c.status === "placed").length;

    const handleFinalize = async () => {
        setFinalizing(true);
        setError(null);
        setMessage(null);
        const result = await finalizeCommunityVotes({ showId });
        setFinalizing(false);
        if (!result.success) {
            setError(result.error);
            return;
        }
        setMessage(
            result.classesPlaced === 0
                ? "No votes were cast — no placings to derive."
                : `Derived ${result.placingsWritten} placing${result.placingsWritten === 1 ? "" : "s"} across ${result.classesPlaced} class${result.classesPlaced === 1 ? "" : "es"}.`,
        );
        router.refresh();
    };

    return (
        <section className="ledger-card" aria-labelledby="judging-progress-heading">
            <span className="ledger-tab" id="judging-progress-heading">
                Judging Progress
            </span>

            {judging === "judged" ? (
                <div className="flex flex-wrap items-center gap-4">
                    <span className="stamp" data-testid="judging-progress-stamp">
                        {placed} of {judgeable.length} classes placed
                    </span>
                    {status === "judging" && (
                        <Link
                            href={`/shows/host/${showId}/judge`}
                            className="text-sm font-semibold text-forest hover:underline"
                        >
                            Open the judge queue →
                        </Link>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {status === "judging" ? (
                        <p className="m-0 text-sm text-muted-foreground">
                            Community voting is open on the public show page — the tally is
                            live on the entry gallery.
                        </p>
                    ) : (
                        <>
                            <p className="m-0 text-sm text-muted-foreground">
                                Voting is closed. Derive the provisional placings from the
                                vote tally (top 6 per class, ties to the earliest entry),
                                review them, then complete the show to publish.
                            </p>
                            {canManage && (
                                <div>
                                    <Button
                                        onClick={handleFinalize}
                                        disabled={finalizing}
                                        data-testid="finalize-votes"
                                    >
                                        {finalizing ? "Deriving…" : "Derive placings from votes"}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {message && <p className="mt-3 text-sm font-semibold text-forest">{message}</p>}
            {error && (
                <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}
        </section>
    );
}
