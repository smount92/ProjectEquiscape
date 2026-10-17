"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchEntries, type EntryHit } from "@/app/actions/registry-desk";
import { CATEGORY_LABELS } from "@/lib/catalog/taxonomy";

/**
 * Find ANY Registry entry by name or model number: releases with no mold,
 * resins, tack, props ... the rows the mold picker can't reach. Each
 * result opens in the Desk editor.
 */
export default function EntrySearch() {
    const inputId = useId();
    const [term, setTerm] = useState("");
    const [hits, setHits] = useState<EntryHit[]>([]);
    const [state, setState] = useState<"idle" | "searching" | "done" | "error">("idle");
    const [error, setError] = useState("");

    useEffect(() => {
        const words = term.trim();
        if (words.length < 2) return;
        let live = true;
        const t = setTimeout(async () => {
            setState("searching");
            const r = await searchEntries(words);
            if (!live) return;
            if (r.success) {
                setHits(r.entries);
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
    }, [term]);

    const showHits = term.trim().length >= 2;

    return (
        <div className="flex flex-col gap-2">
            <label htmlFor={inputId} className="text-sm font-semibold text-foreground">
                Find any entry, by name or model number
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
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Little Bit, 711198, Western saddle ..."
                    className="pl-9"
                    autoComplete="off"
                />
            </div>
            <p role="status" aria-live="polite" className="m-0 text-xs text-muted-foreground">
                {!showHits
                    ? "Releases with no mold, resins, tack, props: everything is here."
                    : state === "searching"
                      ? "Looking ..."
                      : state === "error"
                        ? error
                        : state === "done" && hits.length === 0
                          ? "Nothing by that name or number."
                          : state === "done"
                            ? `${hits.length} entr${hits.length === 1 ? "y" : "ies"}`
                            : ""}
            </p>
            {showHits && hits.length > 0 && (
                <ul
                    className="m-0 flex max-h-[50vh] list-none flex-col gap-1 overflow-y-auto p-0"
                    data-testid="entry-hits"
                >
                    {hits.map((h) => {
                        const sub = [
                            CATEGORY_LABELS[h.itemType] ?? h.itemType,
                            h.modelNumber ? `#${h.modelNumber}` : "",
                            h.maker,
                            h.scale,
                            h.moldTitle ? `under ${h.moldTitle}` : h.itemType === "plastic_release" ? "no mold" : "",
                        ]
                            .filter(Boolean)
                            .join(" · ");
                        return (
                            <li key={h.id}>
                                <Link
                                    href={h.href}
                                    className="block rounded-lg border border-input bg-card px-3 py-2 no-underline hover:border-forest hover:bg-forest/5 max-md:min-h-11"
                                >
                                    <span className="block font-semibold break-words text-foreground">{h.title}</span>
                                    <span className="block text-xs text-muted-foreground">{sub}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
