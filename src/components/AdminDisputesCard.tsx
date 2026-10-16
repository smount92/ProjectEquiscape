"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listOpenDisputes, type OpenDispute } from "@/app/actions/admin-disputes";

/**
 * Open Deal Room disputes (MHH-020). The site keeps the record and does not
 * referee; this is so the owner knows, and can spot a pattern.
 */
export default function AdminDisputesCard() {
    const [disputes, setDisputes] = useState<OpenDispute[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let live = true;
        listOpenDisputes()
            .then((r) => {
                if (!live) return;
                if (r.success) setDisputes(r.disputes);
                else setError(r.error);
            })
            .catch(() => live && setError("The dispute list couldn't load just now."));
        return () => {
            live = false;
        };
    }, []);

    return (
        <section
            aria-labelledby="admin-disputes-heading"
            className="rounded-lg border border-input bg-card p-4 shadow-sm"
        >
            <h3 id="admin-disputes-heading" className="mt-0 mb-1 text-base font-bold">
                ⚖️ Open deal disputes
            </h3>
            <p className="mt-0 mb-3 text-xs text-muted-foreground">
                The site freezes the record and gives both members an evidence pack; it does not decide who is right.
                Step in only for conduct (threats, a pattern of non-delivery).
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!error && disputes === null && <p className="text-sm text-muted-foreground">Loading…</p>}
            {disputes?.length === 0 && <p className="text-sm text-muted-foreground">No open disputes.</p>}
            {disputes && disputes.length > 0 && (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {disputes.map((d) => (
                        <li key={d.conversationId} className="rounded-md border border-input p-3 text-sm">
                            <div className="font-semibold text-foreground">
                                {d.buyer} and {d.seller}
                                {d.horse && (
                                    <>
                                        {" · "}
                                        <Link href={`/stable/${d.horse.id}`} className="underline hover:no-underline">
                                            {d.horse.name}
                                        </Link>
                                    </>
                                )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Raised by {d.raisedBy} on{" "}
                                {new Date(d.openedAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                })}
                            </div>
                            {d.reason && <p className="mt-1 mb-0 whitespace-pre-line">{d.reason}</p>}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
