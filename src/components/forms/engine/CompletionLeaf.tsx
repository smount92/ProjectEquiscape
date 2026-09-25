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

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import ShowRecordForm from "@/components/ShowRecordForm";
import ShowRecordsImport from "@/components/ShowRecordsImport";
import PedigreeCard from "@/components/PedigreeCard";

export default function CompletionLeaf({
    horseName,
    horseId,
    visibility,
    categoryLabel,
    photoWarning,
    /** Set when the user arrived from a show's "get show-ready" ramp. */
    showReturnTo,
    onAddAnother,
    onAddAnotherLikeThis,
    isModel = true,
}: {
    horseName: string;
    horseId: string | null;
    visibility: "public" | "unlisted" | "private";
    categoryLabel: string;
    photoWarning: string | null;
    showReturnTo: string | null;
    onAddAnother: () => void;
    /** Same reference, finish, breed and collections, fresh name and photos. */
    onAddAnotherLikeThis?: () => void;
    /** Plate V (records) only makes sense for a model, not tack or a prop. */
    isModel?: boolean;
}) {
    const passportHref =
        visibility === "public" ? `/community/${horseId}` : `/stable/${horseId}`;
    // Plate V — the horse exists now, so its records can be written
    // here without a trip to the passport and back (a user adding ten
    // horses in a row asked for exactly this). Each save re-arms a
    // blank form; the count says what landed.
    const [recordsSaved, setRecordsSaved] = useState(0);
    const [recordFormKey, setRecordFormKey] = useState(0);
    const [recordOpen, setRecordOpen] = useState(false);

    return (
        <div className="success-overlay">
            <div className="animate-fade-in-up max-h-[calc(100dvh-2rem)] w-full max-w-[720px] overflow-y-auto">
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

                        <div className="mt-1 flex flex-wrap gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={onAddAnother}
                            >
                                Add another
                            </Button>
                            {onAddAnotherLikeThis && (
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={onAddAnotherLikeThis}
                                    title="Keeps the reference, finish, breed and collections; clears the name and photos"
                                >
                                    Add another like this
                                </Button>
                            )}
                            <Button asChild variant="outline" className="flex-1">
                                <Link href="/dashboard">View stable</Link>
                            </Button>
                        </div>
                    </div>
                </div>

                {horseId && isModel && (
                    <div className="fe-leaf mt-4 text-left" data-testid="plate-v">
                        <p className="mb-1 font-serif text-[0.8125rem] tracking-[0.18em] text-muted-foreground uppercase">
                            Plate V · While it&apos;s fresh
                        </p>
                        <p className="mb-4 text-sm text-secondary-foreground">
                            Show results and lineage can go on the record now. Everything here
                            is optional and can also be edited from the passport later.
                        </p>

                        <details className="group mb-3 rounded-md border border-input bg-card/60 p-3" open={recordOpen}
                            onToggle={(e) => setRecordOpen((e.target as HTMLDetailsElement).open)}>
                            <summary className="cursor-pointer list-none font-serif text-sm font-bold tracking-wide">
                                🏆 Show results
                                {recordsSaved > 0 && (
                                    <span className="ml-2 rounded-full bg-forest/10 px-2 py-0.5 text-xs font-semibold text-forest">
                                        {recordsSaved} recorded
                                    </span>
                                )}
                            </summary>
                            <div className="mt-3">
                                <ShowRecordForm
                                    key={recordFormKey}
                                    horseId={horseId}
                                    onSave={() => {
                                        setRecordsSaved((n) => n + 1);
                                        setRecordFormKey((k) => k + 1);
                                    }}
                                    onCancel={() => setRecordOpen(false)}
                                />
                                <div className="mt-3 border-t border-dashed border-input pt-3 text-sm text-muted-foreground">
                                    Lots of placings? Import them from a spreadsheet:{" "}
                                    <ShowRecordsImport horseId={horseId} horseName={horseName} />
                                </div>
                            </div>
                        </details>

                        <details className="group rounded-md border border-input bg-card/60 p-3">
                            <summary className="cursor-pointer list-none font-serif text-sm font-bold tracking-wide">
                                🧬 Sire, dam &amp; lineage
                            </summary>
                            <div className="mt-3">
                                <PedigreeCard horseId={horseId} pedigree={null} isOwner />
                            </div>
                        </details>

                        <p className="mt-3 mb-0 text-xs text-muted-foreground">
                            Papers and documents attach from the passport, where the files can be
                            filed against a specific placing.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
