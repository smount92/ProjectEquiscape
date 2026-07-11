"use client";

/**
 * The LEDGER filter bar for the Show Ring (v2). Whole-ring search,
 * facet dropdowns with server-driven options (finish/maker/scale
 * across ALL public horses — never derived from the loaded page),
 * trade-status select, active filters as rubber-stamp chips with ✕,
 * clear-all, and honest sorts.
 *
 * Owns NO filter state: the parent passes the URL-derived filters and
 * receives changes via onFiltersChange (URL is the single source of
 * truth). Only the search input keeps local state until submit.
 *
 * Mirrors src/components/stable/StableFilterBar.tsx; saved views are
 * a deliberate follow-up for the Show Ring (needs its own table or a
 * scope column on stable_saved_views — a future migration).
 */

import { useState } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
    activeShowRingChips,
    clearAllShowRingFilters,
    removeShowRingFilter,
    SHOWRING_SORTS,
    SHOWRING_TRADE_OPTIONS,
    type ShowRingFilters,
    type ShowRingSort,
} from "@/lib/showring/filterParams";
import type { ShowRingFacetOptions } from "@/lib/showring/types";

const SORT_LABELS: Record<ShowRingSort, string> = {
    "newest": "Newest",
    "oldest": "Oldest",
};

const ALL = "__all__";

function FacetSelect({
    label,
    value,
    options,
    onChange,
    id,
}: {
    label: string;
    value: string | undefined;
    options: string[];
    onChange: (value: string | undefined) => void;
    id: string;
}) {
    if (options.length === 0 && !value) return null;
    return (
        <Select
            value={value ?? ALL}
            onValueChange={(v) => onChange(v === ALL ? undefined : v)}
        >
            <SelectTrigger
                id={id}
                size="sm"
                className="w-auto min-w-0 font-serif text-xs tracking-wide"
                aria-label={`Filter by ${label.toLowerCase()}`}
            >
                <span className="text-muted-foreground">{label}</span>
                {value ? <SelectValue /> : null}
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={ALL}>All {label.toLowerCase()}s</SelectItem>
                {options.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                        {opt}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

export default function ShowRingFilterBar({
    filters,
    facetOptions,
    onFiltersChange,
}: {
    filters: ShowRingFilters;
    facetOptions: ShowRingFacetOptions;
    onFiltersChange: (filters: ShowRingFilters) => void;
}) {
    const [searchInput, setSearchInput] = useState(filters.q ?? "");

    // Keep the search box in sync when the URL changes underneath us
    // (back button, chip ✕) — the adjust-state-during-render pattern,
    // not an effect (react.dev/learn/you-might-not-need-an-effect).
    const [lastQ, setLastQ] = useState(filters.q);
    if (lastQ !== filters.q) {
        setLastQ(filters.q);
        setSearchInput(filters.q ?? "");
    }

    const chips = activeShowRingChips(filters);

    const setOrClear = (key: keyof ShowRingFilters, value: string | undefined) => {
        const next = { ...filters };
        if (value === undefined) delete next[key];
        else (next as Record<string, unknown>)[key] = value;
        onFiltersChange(next);
    };

    const submitSearch = () => {
        const q = searchInput.trim();
        setOrClear("q", q || undefined);
    };

    return (
        <div className="ledger-card !py-3" id="showring-filter-bar">
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
                        placeholder="Search the Show Ring by name, mold, maker, or sculptor…"
                        id="showring-search"
                        aria-label="Search the Show Ring"
                    />
                </div>
                <FacetSelect
                    label="Finish"
                    value={filters.finish}
                    options={facetOptions.finishes}
                    onChange={(v) => setOrClear("finish", v)}
                    id="showring-facet-finish"
                />
                <FacetSelect
                    label="Maker"
                    value={filters.maker}
                    options={facetOptions.makers}
                    onChange={(v) => setOrClear("maker", v)}
                    id="showring-facet-maker"
                />
                <FacetSelect
                    label="Scale"
                    value={filters.scale}
                    options={facetOptions.scales}
                    onChange={(v) => setOrClear("scale", v)}
                    id="showring-facet-scale"
                />
                <FacetSelect
                    label="Status"
                    value={filters.trade}
                    options={[...SHOWRING_TRADE_OPTIONS]}
                    onChange={(v) => setOrClear("trade", v)}
                    id="showring-facet-trade"
                />

                {/* Sort */}
                <Select
                    value={filters.sort}
                    onValueChange={(v) => onFiltersChange({ ...filters, sort: v as ShowRingSort })}
                >
                    <SelectTrigger
                        id="showring-sort"
                        size="sm"
                        className="w-auto min-w-0 font-serif text-xs tracking-wide"
                        aria-label="Sort the Show Ring"
                    >
                        <span className="text-muted-foreground">Sort</span>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {SHOWRING_SORTS.map((s) => (
                            <SelectItem key={s} value={s}>
                                {SORT_LABELS[s]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Row 2: stamp chips + clear-all (only when filters are active) */}
            {chips.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {chips.map((chip, i) => (
                        <span
                            key={chip.key}
                            className="stamp inline-flex items-center gap-1.5"
                            style={i % 2 === 1 ? { rotate: "1.2deg" } : undefined}
                        >
                            {chip.label}
                            <button
                                type="button"
                                onClick={() => onFiltersChange(removeShowRingFilter(filters, chip.key))}
                                aria-label={`Remove filter ${chip.label}`}
                                className="cursor-pointer border-none bg-transparent p-0 font-normal text-inherit opacity-60 hover:opacity-100"
                            >
                                ✕
                            </button>
                        </span>
                    ))}
                    <button
                        type="button"
                        onClick={() => onFiltersChange(clearAllShowRingFilters(filters))}
                        className="cursor-pointer border-none bg-transparent text-xs text-muted-foreground italic underline hover:text-foreground"
                        id="showring-clear-all"
                    >
                        clear all
                    </button>
                </div>
            )}
        </div>
    );
}
