"use client";

/**
 * Marketplace front door — the ledger filter bar.
 *
 * Same contract as the Show Ring's filter bar: the URL is the single
 * source of truth (router.push, so the back button steps filters
 * instead of wiping them), every filter is applied server-side in the
 * page query, and active filters show as removable stamps.
 *
 * v1 of a front door, not a search engine — four filters that a buyer
 * actually reaches for: what kind of finish, what it costs, whether it
 * has been shown, and free text over name/maker/mold/sculptor.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import {
    activeListingChips,
    buildListingHref,
    countActiveListingFilters,
    LISTING_FINISH_OPTIONS,
    LISTING_SORT_OPTIONS,
    LISTING_TRADE_STATUSES,
    PRICE_BANDS,
    type ListingFilters,
} from "@/lib/market/listingFilters";

function FacetSelect({
    label,
    value,
    options,
    onChange,
    id,
}: {
    label: string;
    value: string | undefined;
    options: { value: string; label: string }[];
    onChange: (value: string | undefined) => void;
    id: string;
}) {
    return (
        <select
            id={id}
            aria-label={label}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
            className="min-w-[130px] rounded-md border border-input bg-card px-3 py-2 text-sm"
        >
            <option value="">{label}</option>
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    );
}

export default function MarketListingFilters({ filters }: { filters: ListingFilters }) {
    const router = useRouter();
    const [searchInput, setSearchInput] = useState(filters.q ?? "");

    // Server re-rendered with a different q (back button, chip removal):
    // resync the uncontrolled-feeling input without an effect.
    const [lastQ, setLastQ] = useState(filters.q);
    if (lastQ !== filters.q) {
        setLastQ(filters.q);
        setSearchInput(filters.q ?? "");
    }

    const push = useCallback(
        (next: ListingFilters) => {
            router.push(buildListingHref(next));
        },
        [router],
    );

    const setOrClear = useCallback(
        (key: keyof ListingFilters, value: string | boolean | undefined) => {
            const next = { ...filters };
            if (value === undefined || value === false || value === "") delete next[key];
            else (next as Record<string, unknown>)[key] = value;
            push(next);
        },
        [filters, push],
    );

    const submitSearch = () => {
        const q = searchInput.trim();
        if ((filters.q ?? "") !== q) setOrClear("q", q || undefined);
    };

    const chips = activeListingChips(filters);
    const activeCount = countActiveListingFilters(filters);

    return (
        <div className="ledger-card !py-3" id="market-filter-bar">
            {/* Row 1: search + facets */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-[200px] flex-1">
                    <Input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") submitSearch();
                        }}
                        onBlur={submitSearch}
                        placeholder="Search listings by name, maker, mold, or sculptor…"
                        id="market-listing-search"
                        aria-label="Search the marketplace"
                    />
                </div>

                <FacetSelect
                    label="Finish"
                    id="market-facet-finish"
                    value={filters.finish}
                    options={LISTING_FINISH_OPTIONS.map((f) => ({ value: f, label: f }))}
                    onChange={(v) => setOrClear("finish", v)}
                />
                <FacetSelect
                    label="Price"
                    id="market-facet-price"
                    value={filters.price}
                    options={PRICE_BANDS.map((b) => ({ value: b.id, label: b.label }))}
                    onChange={(v) => setOrClear("price", v)}
                />
                <FacetSelect
                    label="Status"
                    id="market-facet-trade"
                    value={filters.trade}
                    options={LISTING_TRADE_STATUSES.map((t) => ({ value: t, label: t }))}
                    onChange={(v) => setOrClear("trade", v)}
                />

                {/* The buyer who is hunting a proven horse. */}
                <button
                    type="button"
                    onClick={() => setOrClear("hasRecords", !filters.hasRecords)}
                    aria-pressed={Boolean(filters.hasRecords)}
                    className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                        filters.hasRecords
                            ? "border-warning bg-warning/15 text-warning"
                            : "border-input bg-card text-secondary-foreground hover:text-foreground"
                    }`}
                >
                    🏆 Has show record
                </button>

                <FacetSelect
                    label="Newest listings"
                    id="market-facet-sort"
                    value={filters.sort && filters.sort !== "newest" ? filters.sort : undefined}
                    options={LISTING_SORT_OPTIONS.filter((o) => o.value !== "newest").map((o) => ({
                        value: o.value,
                        label: o.label,
                    }))}
                    onChange={(v) => setOrClear("sort", v)}
                />
            </div>

            {/* Row 2: active filters as removable stamps */}
            {activeCount > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-input pt-3">
                    {chips.map((chip) => (
                        <button
                            key={chip.key}
                            type="button"
                            onClick={() => setOrClear(chip.key, undefined)}
                            className="stamp inline-flex cursor-pointer items-center gap-1.5"
                            aria-label={`Remove filter ${chip.label}`}
                        >
                            {chip.label}
                            <span aria-hidden="true">✕</span>
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => push(filters.sort ? { sort: filters.sort } : {})}
                        className="cursor-pointer text-xs text-secondary-foreground underline hover:text-foreground"
                    >
                        Clear all
                    </button>
                </div>
            )}
        </div>
    );
}
