"use client";

/**
 * The LEDGER filter bar for the Reference Catalog. Whole-catalog search,
 * facet dropdowns (server-driven maker/scale options across ALL rows, plus
 * the static item-type vocabulary), honest sorts, and active filters as
 * rubber-stamp chips with ✕ + clear-all.
 *
 * The URL is the single source of truth: every change router.push()es a new
 * /catalog?… so the server page re-renders the filtered table (shareable,
 * back-button-friendly, SEO-canonical). Only the search input keeps local
 * state until submit. Mirrors src/components/showring/ShowRingFilterBar.tsx.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
    activeCatalogChips,
    buildCatalogSearchParams,
    clearAllCatalogFilters,
    removeCatalogFilter,
    CATALOG_SORTS,
    CATALOG_TYPE_OPTIONS,
    type CatalogFilters,
    type CatalogSort,
} from "@/lib/catalog/filterParams";

const SORT_LABELS: Record<CatalogSort, string> = {
    "name-az": "Name A→Z",
    "name-za": "Name Z→A",
    "maker": "Maker",
    "newest": "Newest",
};

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
    CATALOG_TYPE_OPTIONS.map((t) => [t.value, t.label]),
);

const ALL = "__all__";

function FacetSelect({
    label,
    value,
    options,
    optionLabels,
    onChange,
    id,
}: {
    label: string;
    value: string | undefined;
    options: string[];
    optionLabels?: Record<string, string>;
    onChange: (value: string | undefined) => void;
    id: string;
}) {
    if (options.length === 0 && !value) return null;
    return (
        <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
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
                        {optionLabels?.[opt] ?? opt}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

export default function CatalogFilterBar({
    filters,
    makers,
    scales,
}: {
    filters: CatalogFilters;
    makers: string[];
    scales: string[];
}) {
    const router = useRouter();
    const [searchInput, setSearchInput] = useState(filters.q ?? "");

    // Keep the search box in sync when the URL changes underneath us (back
    // button, chip ✕) — adjust-state-during-render, not an effect.
    const [lastQ, setLastQ] = useState(filters.q);
    if (lastQ !== filters.q) {
        setLastQ(filters.q);
        setSearchInput(filters.q ?? "");
    }

    const chips = activeCatalogChips(filters);

    const push = (next: CatalogFilters) => {
        const qs = buildCatalogSearchParams(next).toString();
        router.push(qs ? `/catalog?${qs}` : "/catalog");
    };

    /** Any filter change resets to page 1 — the result set changed. */
    const setOrClear = (key: "maker" | "scale" | "type", value: string | undefined) => {
        const next = { ...filters, page: 1 };
        if (value === undefined) delete next[key];
        else next[key] = value;
        push(next);
    };

    const submitSearch = () => {
        const q = searchInput.trim();
        const next = { ...filters, page: 1 };
        if (q) next.q = q;
        else delete next.q;
        push(next);
    };

    return (
        <div className="ledger-card !py-3" id="catalog-filter-bar">
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
                        placeholder="Search the catalog by name, mold, or maker…"
                        id="catalog-search"
                        aria-label="Search the reference catalog"
                    />
                </div>
                <FacetSelect
                    label="Maker"
                    value={filters.maker}
                    options={makers}
                    onChange={(v) => setOrClear("maker", v)}
                    id="catalog-facet-maker"
                />
                <FacetSelect
                    label="Scale"
                    value={filters.scale}
                    options={scales}
                    onChange={(v) => setOrClear("scale", v)}
                    id="catalog-facet-scale"
                />
                <FacetSelect
                    label="Type"
                    value={filters.type}
                    options={CATALOG_TYPE_OPTIONS.map((t) => t.value)}
                    optionLabels={TYPE_LABELS}
                    onChange={(v) => setOrClear("type", v)}
                    id="catalog-facet-type"
                />

                {/* Sort */}
                <Select
                    value={filters.sort}
                    onValueChange={(v) => push({ ...filters, sort: v as CatalogSort, page: 1 })}
                >
                    <SelectTrigger
                        id="catalog-sort"
                        size="sm"
                        className="w-auto min-w-0 font-serif text-xs tracking-wide"
                        aria-label="Sort the catalog"
                    >
                        <span className="text-muted-foreground">Sort</span>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {CATALOG_SORTS.map((s) => (
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
                                onClick={() => push(removeCatalogFilter(filters, chip.key))}
                                aria-label={`Remove filter ${chip.label}`}
                                className="cursor-pointer border-none bg-transparent p-0 font-normal text-inherit opacity-60 hover:opacity-100"
                            >
                                ✕
                            </button>
                        </span>
                    ))}
                    <button
                        type="button"
                        onClick={() => push(clearAllCatalogFilters(filters))}
                        className="cursor-pointer border-none bg-transparent text-xs text-muted-foreground italic underline hover:text-foreground"
                        id="catalog-clear-all"
                    >
                        clear all
                    </button>
                </div>
            )}
        </div>
    );
}
