"use client";

/**
 * Admin — the sanctioning review page's interactive parts.
 *
 *   AdminSanctioningDecision: Grant / Dismiss right where the admin
 *   has just read the show (the same resolveSanctioningRequest the
 *   queue card calls). Grant is offered even without a pending
 *   request — the owner may sanction a show proactively.
 *
 *   AdminReviewProgram: the public ProgramAccordion, read-only, so
 *   the classlist is reviewed exactly as entrants will see it.
 */

import Link from "next/link";
import { useState, useTransition } from "react";

import { resolveSanctioningRequest } from "@/app/actions/admin";
import ProgramAccordion from "@/components/shows/ProgramAccordion";
import { Button } from "@/components/ui/button";
import type { ConsoleDivision } from "@/lib/shows/console";

export function AdminSanctioningDecision({
    showId,
    title,
    requested,
    isMhhQualifying,
    note,
}: {
    showId: string;
    title: string;
    requested: boolean;
    isMhhQualifying: boolean;
    /** The host's own words (marker stripped). */
    note: string | null;
}) {
    const [decided, setDecided] = useState<"grant" | "dismiss" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const decide = (decision: "grant" | "dismiss") => {
        startTransition(async () => {
            setError(null);
            const result = await resolveSanctioningRequest(showId, decision);
            if (!result.success) {
                setError(result.error ?? "Could not resolve the request.");
                return;
            }
            setDecided(decision);
        });
    };

    const sanctioned = isMhhQualifying || decided === "grant";

    return (
        <section className="ledger-card" aria-labelledby="sanctioning-decision-heading" data-testid="sanctioning-decision">
            <span className="ledger-tab" id="sanctioning-decision-heading">
                🏅 Sanctioning
            </span>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="m-0 text-sm font-semibold text-foreground">
                        {sanctioned
                            ? "MHH Sanctioned"
                            : decided === "dismiss"
                              ? "Request dismissed"
                              : requested
                                ? "Sanctioning requested by the host"
                                : "Not sanctioned — no request pending"}
                    </p>
                    {note && decided === null && (
                        <p className="m-0 mt-1 text-sm text-secondary-foreground italic">
                            &ldquo;{note}&rdquo;
                        </p>
                    )}
                    {decided === "grant" && (
                        <p className="m-0 mt-1 text-xs text-muted-foreground">
                            The host has been notified. Placings at {title} now earn Series points and
                            can mint cards.
                        </p>
                    )}
                    {decided === "dismiss" && (
                        <p className="m-0 mt-1 text-xs text-muted-foreground">
                            The request is out of the queue; the host can ask again from show settings.
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    {decided !== null ? (
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/admin">← Back to the queue</Link>
                        </Button>
                    ) : sanctioned ? null : (
                        <>
                            <Button size="sm" disabled={pending} onClick={() => decide("grant")}>
                                {pending ? "Working…" : "Grant sanctioning"}
                            </Button>
                            {requested && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pending}
                                    onClick={() => decide("dismiss")}
                                >
                                    Dismiss request
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </div>
            {error && (
                <p role="alert" className="m-0 mt-2 text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}
        </section>
    );
}

export function AdminReviewProgram({
    divisions,
    showYear,
    showIsQualifying,
}: {
    divisions: ConsoleDivision[];
    showYear: number | null;
    showIsQualifying: boolean;
}) {
    return (
        <ProgramAccordion
            divisions={divisions}
            canEnter={false}
            onEnter={() => {}}
            defaultOpenIndex={0}
            showYear={showYear}
            showIsQualifying={showIsQualifying}
        />
    );
}
