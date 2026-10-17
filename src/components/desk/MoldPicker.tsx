"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchMolds, type MoldHit } from "@/app/actions/registry-desk";

/**
 * Find a mold by name. On the Mold view's front page each result opens
 * that mold; inside the editor ("Filed under mold") a result is picked.
 */
export default function MoldPicker({
    onPick,
    autoFocus = false,
    excludeId,
}: {
    /** Pick mode: called with the chosen mold instead of opening it. */
    onPick?: (mold: MoldHit) => void;
    autoFocus?: boolean;
    /** A mold not to offer (the one it is already under). */
    excludeId?: string | null;
}) {
    const inputId = useId();
    const [term, setTerm] = useState("");
    const [hits, setHits] = useState<MoldHit[]>([]);
    const [state, setState] = useState<"idle" | "searching" | "done" | "error">("idle");
    const [error, setError] = useState("");

    useEffect(() => {
        const words = term.trim();
        if (words.length < 2) return;
        let live = true;
        const t = setTimeout(async () => {
            setState("searching");
            const r = await searchMolds(words);
            if (!live) return;
            if (r.success) {
                setHits(r.molds.filter((m) => m.id !== excludeId));
                setState("done");
            } else {
                setError(r.error);
                setState("error");
            }
        }, 300);
        return () => {
            live = false;
            clearTimeout(t);
        };
    }, [term, excludeId]);

    const showHits = term.trim().length >= 2;

    return (
        <div className="flex flex-col gap-2">
            <label htmlFor={inputId} className="text-sm font-semibold text-foreground">
                {onPick ? "Find the mold to file it under" : "Find a mold"}
            </label>
            <div className="relative">
                <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                    id={inputId}
                    type="search"
                    value={term}
                    autoFocus={autoFocus}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Saddlebred, Lady Phase, Proud Arabian Mare ..."
                    className="pl-9"
                    autoComplete="off"
                />
            </div>
            <p role="status" aria-live="polite" className="m-0 text-xs text-muted-foreground">
                {!showHits
                    ? "Type at least two letters."
                    : state === "searching"
                      ? "Looking ..."
                      : state === "error"
                        ? error
                        : state === "done" && hits.length === 0
                          ? "No mold by that name. Try fewer words."
                          : state === "done"
                            ? `${hits.length} mold${hits.length === 1 ? "" : "s"}`
                            : ""}
            </p>
            {showHits && hits.length > 0 && (
                <ul
                    className="m-0 flex max-h-[50vh] list-none flex-col gap-1 overflow-y-auto p-0"
                    data-testid="mold-hits"
                >
                    {hits.map((m) => {
                        const sub = [m.maker, m.scale, `${m.releases} release${m.releases === 1 ? "" : "s"}`]
                            .filter(Boolean)
                            .join(" · ");
                        const body = (
                            <>
                                <span className="block font-semibold text-foreground">{m.title}</span>
                                <span className="block text-xs text-muted-foreground">{sub}</span>
                            </>
                        );
                        return (
                            <li key={m.id}>
                                {onPick ? (
                                    <button
                                        type="button"
                                        onClick={() => onPick(m)}
                                        className="w-full cursor-pointer rounded-lg border border-input bg-card px-3 py-2 text-left hover:border-forest hover:bg-forest/5 max-md:min-h-11"
                                    >
                                        {body}
                                    </button>
                                ) : (
                                    <Link
                                        href={`/catalog/desk/mold/${m.id}`}
                                        className="block rounded-lg border border-input bg-card px-3 py-2 no-underline hover:border-forest hover:bg-forest/5 max-md:min-h-11"
                                    >
                                        {body}
                                    </Link>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
