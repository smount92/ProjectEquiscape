"use client";

/**
 * The moment the record is entered.
 *
 * The old success screen was a 🎉 and four buttons. This is the ledger
 * line being stamped: the horse's name in serif, a rubber stamp landing
 * over it, and the two or three things you would actually want to do next
 * — laid out so the primary one is obvious.
 *
 * `.success-overlay` is kept as the wrapper class: it is what
 * `e2e/inventory.spec.ts` waits for to know the save landed.
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CompletionLeaf({
    horseName,
    horseId,
    visibility,
    categoryLabel,
    photoWarning,
    /** Set when the user arrived from a show's "get show-ready" ramp. */
    showReturnTo,
    onAddAnother,
}: {
    horseName: string;
    horseId: string | null;
    visibility: "public" | "unlisted" | "private";
    categoryLabel: string;
    photoWarning: string | null;
    showReturnTo: string | null;
    onAddAnother: () => void;
}) {
    const passportHref =
        visibility === "public" ? `/community/${horseId}` : `/stable/${horseId}`;

    return (
        <div className="success-overlay">
            <div className="animate-fade-in-up max-h-[calc(100dvh-2rem)] w-full max-w-[520px] overflow-y-auto">
                <div className="fe-leaf text-center">
                    <p className="mb-1 font-serif text-[0.8125rem] tracking-[0.18em] text-muted-foreground uppercase">
                        Entered in the ledger
                    </p>

                    <h2 className="m-0 font-serif text-3xl font-bold break-words text-forest">
                        {horseName}
                    </h2>

                    <div className="my-5 flex justify-center">
                        <span className="stamp fe-stamp-land text-base">Recorded</span>
                    </div>

                    <p className="mb-6 text-sm text-secondary-foreground">
                        Your {categoryLabel.toLowerCase()} is catalogued
                        {visibility === "public"
                            ? " and visible in the Show Ring."
                            : visibility === "unlisted"
                              ? " — anyone with the link can see it."
                              : " and kept private to you."}
                    </p>

                    {photoWarning && (
                        <div
                            className="mb-5 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-left text-sm text-warning"
                            role="alert"
                        >
                            {photoWarning}
                        </div>
                    )}

                    <div className="flex flex-col items-stretch gap-3">
                        {showReturnTo ? (
                            <>
                                <Button asChild size="wide">
                                    <Link href={showReturnTo}>Back to the show →</Link>
                                </Button>
                                {visibility === "private" && (
                                    <p
                                        className="rounded-md border border-warning/40 bg-warning/10 px-4 py-2 text-left text-xs text-warning"
                                        role="note"
                                    >
                                        Heads up: this horse is private — set it public to
                                        enter the show.
                                    </p>
                                )}
                                {horseId && (
                                    <Button asChild variant="outline">
                                        <Link href={passportHref}>View passport →</Link>
                                    </Button>
                                )}
                            </>
                        ) : (
                            <>
                                {horseId && (
                                    <Button asChild size="wide">
                                        <Link href={passportHref}>View passport →</Link>
                                    </Button>
                                )}
                                <Button asChild variant="outline">
                                    <Link href="/shows">Enter in a show →</Link>
                                </Button>
                            </>
                        )}

                        <div className="mt-1 flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={onAddAnother}
                            >
                                Add another
                            </Button>
                            <Button asChild variant="outline" className="flex-1">
                                <Link href="/dashboard">View stable</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
