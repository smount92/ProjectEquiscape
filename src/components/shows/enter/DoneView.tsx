"use client";

/**
 * The entry page's wrap-up: your live entries grouped by horse, each
 * class named (the halter class marked), and the way back to the show.
 */

import Link from "next/link";

import { classLabel, type EntrantLedger } from "@/lib/shows/entrantLedger";
import type { MyShowEntry } from "@/lib/shows/public";
import { Button } from "@/components/ui/button";

interface DoneViewProps {
    showId: string;
    ledger: EntrantLedger;
    myEntries: MyShowEntry[];
    /** null when nothing has room left. */
    onKeepEntering: (() => void) | null;
}

export default function DoneView({ showId, ledger, myEntries, onKeepEntering }: DoneViewProps) {
    const live = myEntries.filter((e) => e.status !== "scratched");
    const byHorse = new Map<string, { name: string; classIds: string[] }>();
    for (const e of live) {
        const h = byHorse.get(e.horseId) ?? { name: e.horseName, classIds: [] };
        if (!h.classIds.includes(e.classId)) h.classIds.push(e.classId);
        byHorse.set(e.horseId, h);
    }

    return (
        <section className="ledger-card" aria-labelledby="enter-done-heading" data-testid="done-view">
            <span className="ledger-tab" id="enter-done-heading">
                Your entries
            </span>
            {byHorse.size === 0 ? (
                <p className="text-sm text-muted-foreground">You haven&rsquo;t entered any horses yet.</p>
            ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {[...byHorse.entries()].map(([horseId, h]) => {
                        const halter = ledger.byHorse[horseId]?.halterClassId ?? null;
                        return (
                            <li key={horseId}>
                                <p className="m-0 font-serif font-bold text-forest">{h.name}</p>
                                <ul className="m-0 flex list-none flex-col p-0 pl-3 text-sm">
                                    {h.classIds.map((classId) => {
                                        const cls = ledger.byClass[classId];
                                        return (
                                            <li key={classId} className="flex flex-wrap items-center gap-2">
                                                <span>{cls ? classLabel(cls) : "A class no longer in the program"}</span>
                                                {classId === halter && <span className="stamp">Halter</span>}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </li>
                        );
                    })}
                </ul>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link href={`/shows/${showId}#entries`} className="btn-brass">
                    Back to the show
                </Link>
                {onKeepEntering && (
                    <Button variant="outline" onClick={onKeepEntering}>
                        Keep entering
                    </Button>
                )}
            </div>
        </section>
    );
}
