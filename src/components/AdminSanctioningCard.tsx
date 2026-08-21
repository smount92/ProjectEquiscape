"use client";

/**
 * Admin — MHH sanctioning requests (Season 1 manual approval).
 * createShow tags non-admin hosts' requests in sanctioning_note;
 * this card lists that queue with Grant / Dismiss. Granting flips
 * is_mhh_qualifying on and notifies the host. The card is
 * admin-page-only (the actions re-verify ADMIN_EMAIL server-side
 * regardless).
 */

import { useEffect, useState, useTransition } from "react";

import {
    listSanctioningRequests,
    resolveSanctioningRequest,
    type SanctioningRequestRow,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

export default function AdminSanctioningCard() {
    const [rows, setRows] = useState<SanctioningRequestRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const refresh = async () => {
        const result = await listSanctioningRequests();
        if (result.success) setRows(result.requests);
    };
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const result = await listSanctioningRequests();
            if (!cancelled && result.success) setRows(result.requests);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const resolve = (showId: string, decision: "grant" | "dismiss") => {
        startTransition(async () => {
            setError(null);
            const result = await resolveSanctioningRequest(showId, decision);
            if (!result.success) {
                setError(result.error ?? "Could not resolve the request.");
                return;
            }
            await refresh();
        });
    };

    if (rows.length === 0 && !error) return null;

    return (
        <section className="rounded-lg border border-input bg-card p-5">
            <h2 className="mt-0 mb-1 text-base font-bold text-foreground">
                🏅 Sanctioning requests
            </h2>
            <p className="mt-0 mb-4 text-xs text-muted-foreground">
                Hosts asking for MHH sanctioning on their show. Granting makes placings
                there earn Championship Series points and mint qualification cards.
            </p>

            {error && (
                <p role="alert" className="m-0 mb-3 text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}

            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {rows.map((r) => (
                    <li
                        key={r.showId}
                        className="flex flex-wrap items-center gap-3 rounded-md border border-input px-3 py-2 text-sm"
                    >
                        <div className="min-w-0 flex-1">
                            <a
                                href={`/shows/${r.showId}`}
                                className="font-semibold text-forest no-underline hover:underline"
                            >
                                {r.title}
                            </a>
                            <div className="text-xs text-muted-foreground">
                                @{r.hostAlias} · {r.status}
                                {r.showYear && <> · Season {r.showYear}</>}
                                {" · "}requested {new Date(r.createdAt).toLocaleDateString()}
                            </div>
                            {r.note && (
                                <div className="mt-1 text-xs text-secondary-foreground italic">
                                    &ldquo;{r.note}&rdquo;
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                disabled={pending}
                                onClick={() => resolve(r.showId, "grant")}
                            >
                                Grant
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pending}
                                onClick={() => resolve(r.showId, "dismiss")}
                            >
                                Dismiss
                            </Button>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
