import { ArrowRight } from "lucide-react";

import type { ConditionLedgerEntry } from "@/app/actions/conditionHistory";

/**
 * Condition ledger — every grade this model has carried, and why it changed.
 *
 * The data has existed since migration 026 and nothing ever showed it as a
 * ledger: the hoofprint timeline folds each change into one generic line
 * and never had room for the note. A wear history is one of the few things
 * a collector can't reconstruct from memory, so it reads best as its own
 * short column — newest first, old grade → new grade, the owner's note
 * underneath.
 *
 * Renders nothing when the horse has never been regraded, which is most of
 * them.
 */
export default function ConditionLedger({ entries }: { entries: ConditionLedgerEntry[] }) {
    if (entries.length === 0) return null;

    return (
        <div className="rounded-lg border border-border-tan/30 bg-card/20 p-5" id="condition-ledger">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-widest text-secondary-foreground uppercase">
                <span aria-hidden="true">📉</span> Condition Ledger
            </h3>

            <ol className="m-0 flex list-none flex-col gap-0 p-0">
                {entries.map((entry) => (
                    <li
                        key={entry.id}
                        className="border-b border-dashed border-border-tan/20 py-3 last:border-0"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                {entry.oldCondition ? (
                                    <>
                                        <span className="text-secondary-foreground font-normal">
                                            {entry.oldCondition}
                                        </span>
                                        <ArrowRight size={13} strokeWidth={1.75} aria-label="changed to" />
                                        <span>{entry.newCondition}</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-secondary-foreground font-normal">Graded</span>
                                        <ArrowRight size={13} strokeWidth={1.75} aria-label="as" />
                                        <span>{entry.newCondition}</span>
                                    </>
                                )}
                            </span>
                            {entry.changedAt && (
                                <time
                                    dateTime={entry.changedAt}
                                    className="text-secondary-foreground text-xs whitespace-nowrap"
                                >
                                    {new Date(entry.changedAt).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                    })}
                                </time>
                            )}
                        </div>
                        {entry.note && (
                            <p className="text-secondary-foreground m-0 mt-1 text-sm leading-[1.6] italic">
                                {entry.note}
                            </p>
                        )}
                    </li>
                ))}
            </ol>

            <p className="text-muted-foreground m-0 mt-3 text-xs">
                Logged automatically whenever you change this model&rsquo;s grade. Visible to you.
            </p>
        </div>
    );
}
