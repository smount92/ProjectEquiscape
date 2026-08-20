"use client";

/**
 * "You're listed as handler" — the consent half of proxy showing
 * (owner decision 2026-08-19). Self-fetching: renders nothing for
 * viewers who aren't named on any live entry at this show; named
 * handlers get the list and a one-click removal each.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { getMyHandlerEntries, removeSelfAsHandler } from "@/app/actions/shows-v2";
import { Button } from "@/components/ui/button";

interface HandlerEntry {
    id: string;
    horseName: string;
    className: string;
}

export default function HandlerBanner({ showId }: { showId: string }) {
    const router = useRouter();
    const [entries, setEntries] = useState<HandlerEntry[]>([]);
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const result = await getMyHandlerEntries({ showId });
            if (!cancelled && result.success && result.entries.length > 0) {
                setEntries(result.entries);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [showId]);

    if (entries.length === 0) return null;

    return (
        <div
            className="flex flex-col gap-2 rounded-lg border border-forest/40 bg-forest/5 px-4 py-3"
            role="status"
            aria-label="You are listed as a handler at this show"
        >
            <p className="m-0 text-sm font-semibold text-foreground">
                🤝 You&apos;re listed as the handler on{" "}
                {entries.length === 1 ? "an entry" : `${entries.length} entries`} at this show.
            </p>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {entries.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-secondary-foreground">
                            {e.horseName} — {e.className}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                                startTransition(async () => {
                                    const result = await removeSelfAsHandler({ entryId: e.id });
                                    if (result.success) {
                                        setEntries((prev) => prev.filter((x) => x.id !== e.id));
                                        router.refresh();
                                    }
                                })
                            }
                        >
                            Remove me
                        </Button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
