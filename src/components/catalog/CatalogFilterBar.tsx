"use client";

/**
 * The LEDGER filter bar for the Reference Catalog. Row 1 holds the common
 * case — whole-catalog search, Maker/Scale/Type facets, honest sorts — and
 * an "Advanced ▾" toggle reveals the attributes-JSONB filters (release-year
 * range, color, model #, resin medium) so the primary row never crowds.
 * Active filters show as rubber-stamp chips with ✕ + clear-all.
 *
 * The URL is the single source of truth: every change router.push()es a new
 * /catalog?… so the server page re-renders the filtered table (shareable,
 * back-button-friendly, SEO-canonical). Text/number inputs keep local state
 * until submit. Mirrors src/components/showring/ShowRingFilterBar.tsx.
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
import { Button } from "@/components/ui/button";
import {
    activeCatalogChips,
    buildCatalogSearchParams,
    clearAllCatalogFilters,
    hasAdvancedCatalogFilters,
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
    materials = [],
}: {
    filters: CatalogFilters;
    makers: string[];
    scales: string[];
    materials?: string[];
}) {
    const router = useRouter();
    const [searchInput, setSearchInput] = useState(filters.q ?? "");
    const [advOpen, setAdvOpen] = useState(hasAdvancedCatalogFilters(filters));

    // Advanced-panel local inputs (applied together on Apply / Enter).
    const [yearFrom, setYearFrom] = useState(filters.yearFrom?.toString() ?? "");
    const [yearTo, setYearTo] = useState(filters.yearTo?.toString() ?? "");
    const [color, setColor] = useState(filters.color ?? "");
    const [model, setModel] = useState(filters.model ?? "");
    const [medium, setMedium] = useState(filters.medium ?? "");
    const [material, setMaterial] = useState(filters.material ?? "");

    // Keep local inputs in sync when the URL changes underneath us (back
    // button, chip ✕, clear-all) — adjust-state-during-render, not an effect.
    const [lastQ, setLastQ] = useState(filters.q);
    if (lastQ !== filters.q) {
        setLastQ(filters.q);
        setSearchInput(filters.q ?? "");
    }
    const advKey = [filters.yearFrom, filters.yearTo, filters.color, filters.model, filters.medium, filters.material].join("|");
    const [lastAdvKey, setLastAdvKey] = useState(advKey);
    if (lastAdvKey !== advKey) {
        setLastAdvKey(advKey);
        setYearFrom(filters.yearFrom?.toString() ?? "");
        setYearTo(filters.yearTo?.toString() ?? "");
        setColor(filters.color ?? "");
        setModel(filters.model ?? "");
        setMedium(filters.medium ?? "");
        setMaterial(filters.material ?? "");
        if (hasAdvancedCatalogFilters(filters)) setAdvOpen(true);
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

    /** Apply every Advanced input at once (one navigation, no partial state). */
    const applyAdvanced = () => {
        const next: CatalogFilters = { ...filters, page: 1 };
        const yf = Number.parseInt(yearFrom, 10);
        const yt = Number.parseInt(yearTo, 10);
        if (Number.isFinite(yf)) next.yearFrom = yf;
        else delete next.yearFrom;
        if (Number.isFinite(yt)) next.yearTo = yt;
        else delete next.yearTo;
        const c = color.trim();
        if (c) next.color = c;
        else delete next.color;
        const m = model.trim();
        if (m) next.model = m;
        else delete next.model;
        const md = medium.trim();
        if (md) next.medium = md;
        else delete next.medium;
        const mat = material.trim();
        if (mat) next.material = mat;
        else delete next.material;
        push(next);
    };

    const onAdvKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") applyAdvanced();
    };

    return (
        <div className="ledger-card !py-3" id="catalog-filter-bar">
            {/* Row 1: search + facets + sort + advanced toggle */}
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

                <button
                    type="button"
                    onClick={() => setAdvOpen((o) => !o)}
                    aria-expanded={advOpen}
                    aria-controls="catalog-advanced"
                    className="cursor-pointer rounded-full border border-input bg-transparent px-3 py-1.5 font-serif text-xs tracking-wide text-secondary-foreground transition-colors hover:bg-muted hover:text-foreground"
                    id="catalog-advanced-toggle"
                >
                    Advanced {advOpen ? "▴" : "▾"}
                </button>
            </div>

            {/* Advanced sub-row: attributes-JSONB filters (collapsed by default) */}
            {advOpen && (
                <div
                    id="catalog-advanced"
                    className="mt-3 flex flex-wrap items-end gap-3 border-t border-dashed border-[color:var(--color-border-tan,#CBC3A4)] pt-3"
                >
                    <div className="flex flex-col gap-1">
                        <label htmlFor="catalog-year-from" className="font-serif text-[0.65rem] tracking-widest text-muted-foreground uppercase">
                            Release year
                        </label>
                        <div className="flex items-center gap-1.5">
                            <Input
                                id="catalog-year-from"
                                type="number"
                                inputMode="numeric"
                                min={1900}
                                max={2100}
                                value={yearFrom}
                                onChange={(e) => setYearFrom(e.target.value)}
                                onKeyDown={onAdvKeyDown}
                                placeholder="From"
                                aria-label="Release year from"
                                className="w-[5.5rem]"
                            />
                            <span className="text-muted-foreground">–</span>
                            <Input
                                id="catalog-year-to"
                                type="number"
                                inputMode="numeric"
                                min={1900}
                                max={2100}
                                value={yearTo}
                                onChange={(e) => setYearTo(e.target.value)}
                                onKeyDown={onAdvKeyDown}
                                placeholder="To"
                                aria-label="Release year to"
                                className="w-[5.5rem]"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label htmlFor="catalog-color" className="font-serif text-[0.65rem] tracking-widest text-muted-foreground uppercase">
                            Color
                        </label>
                        <Input
                            id="catalog-color"
                            type="text"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            onKeyDown={onAdvKeyDown}
                            placeholder="contains…"
                            aria-label="Color contains"
                            className="w-40"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label htmlFor="catalog-model" className="font-serif text-[0.65rem] tracking-widest text-muted-foreground uppercase">
                            Model #
                        </label>
                        <Input
                            id="catalog-model"
                            type="text"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            onKeyDown={onAdvKeyDown}
                            placeholder="e.g. 1490"
                            aria-label="Model number"
                            className="w-32"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label htmlFor="catalog-medium" className="font-serif text-[0.65rem] tracking-widest text-muted-foreground uppercase">
                            Resin medium
                        </label>
                        <Input
                            id="catalog-medium"
                            type="text"
                            value={medium}
                            onChange={(e) => setMedium(e.target.value)}
                            onKeyDown={onAdvKeyDown}
                            placeholder="contains…"
                            aria-label="Resin medium contains"
                            className="w-40"
                        />
                    </div>
                    {(materials.length > 0 || material) && (
                        <div className="flex flex-col gap-1">
                            <label htmlFor="catalog-material" className="font-serif text-[0.65rem] tracking-widest text-muted-foreground uppercase">
                                Material
                            </label>
                            <Select
                                value={material || ALL}
                                onValueChange={(v) => setMaterial(v === ALL ? "" : v)}
                            >
                                <SelectTrigger
                                    id="catalog-material"
                                    size="sm"
                                    className="w-36 font-serif text-xs tracking-wide"
                                    aria-label="Filter by material"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>All materials</SelectItem>
                                    {materials.map((mat) => (
                                        <SelectItem key={mat} value={mat}>
                                            {mat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <Button size="sm" onClick={applyAdvanced} id="catalog-advanced-apply">
                        Apply
                    </Button>
                </div>
            )}

            {/* Chips row: stamp chips + clear-all (only when filters are active) */}
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
