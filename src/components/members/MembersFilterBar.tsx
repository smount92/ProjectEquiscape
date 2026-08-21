"use client";

/**
 * The Members room's ledger bar: search the roster, choose the order.
 *
 * The URL is the state (`/discover?q=…&sort=…&page=…`). Search submits on
 * Enter or blur and always drops back to page 1 — the result set changed,
 * so the old page number means nothing. Sort is a row of studio chips
 * rendered as LINKS (the Paddock's convention: a chip you can still act
 * on is a link/button, a settled choice is a stamp), so the whole control
 * works without JavaScript beyond the input.
 */

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import {
    MEMBER_SEARCH_MIN_LENGTH,
    MEMBER_SORTS,
    MEMBER_SORT_LABELS,
    membersHref,
    sanitizeAliasQuery,
    type MemberSort,
} from "@/lib/members/directory";

export default function MembersFilterBar({ q, sort }: { q: string; sort: MemberSort }) {
    const router = useRouter();
    const [value, setValue] = useState(q);
    // Resync from the URL without an effect (same trick as the market
    // filter bar): if the prop moved, the input follows it.
    const [lastQ, setLastQ] = useState(q);
    if (q !== lastQ) {
        setLastQ(q);
        setValue(q);
    }

    function submit() {
        const cleaned = sanitizeAliasQuery(value);
        if (cleaned === q) return;
        router.push(
            membersHref({
                q: cleaned.length >= MEMBER_SEARCH_MIN_LENGTH ? cleaned : undefined,
                sort,
                page: 1,
            }),
        );
    }

    return (
        <div className="ledger-card !py-3" id="members-filter-bar">
            <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[200px] flex-1">
                    <label htmlFor="members-search" className="sr-only">
                        Search collectors by name
                    </label>
                    <Input
                        id="members-search"
                        type="search"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                submit();
                            }
                        }}
                        onBlur={submit}
                        placeholder="Search collectors by name…"
                        aria-label="Search collectors by name"
                    />
                </div>

                <nav aria-label="Order the directory" className="flex flex-wrap gap-1">
                    {MEMBER_SORTS.map((option) => (
                        <Link
                            key={option}
                            href={membersHref({ q: q || undefined, sort: option, page: 1 })}
                            scroll={false}
                            aria-current={option === sort ? "true" : undefined}
                            className={`studio-chip no-underline ${option === sort ? "active" : ""}`}
                        >
                            {MEMBER_SORT_LABELS[option]}
                        </Link>
                    ))}
                </nav>
            </div>

            {q && (
                <div className="border-input mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                    <Link
                        href={membersHref({ sort, page: 1 })}
                        scroll={false}
                        className="stamp inline-flex cursor-pointer items-center gap-1.5 no-underline"
                        aria-label={`Clear the search for ${q}`}
                    >
                        &ldquo;{q}&rdquo;
                        <span aria-hidden="true">✕</span>
                    </Link>
                </div>
            )}
        </div>
    );
}
