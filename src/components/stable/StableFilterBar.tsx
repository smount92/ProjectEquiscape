"use client";

/**
 * The LEDGER filter bar (Digital Stable v2). Whole-collection search,
 * facet dropdowns (server-driven options), the brass "Has show
 * records" toggle, active filters as rubber-stamp chips with ✕,
 * clear-all, Save view, sort, and the Gallery/Ledger view toggle.
 *
 * Owns NO filter state: the parent passes the URL-derived filters and
 * receives changes via onFiltersChange (URL is the single source of
 * truth). Only the search input keeps local state until submit.
 */

import { useState, useEffect } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    activeFilterChips,
    clearAllFilters,
    filtersToViewParams,
    removeFilter,
    viewParamsToFilters,
    CATEGORY_LABELS,
    STABLE_SORTS,
    TRADE_OPTIONS,
    type StableFilters,
    type StableSort,
} from "@/lib/stable/filterParams";
import type { SavedView, StableFacetOptions } from "@/lib/stable/types";
import { deleteStableView, saveStableView } from "@/app/actions/stable";

const SORT_LABELS: Record<StableSort, string> = {
    "newest": "Newest",
    "oldest": "Oldest",
    "name-az": "Name A→Z",
    "name-za": "Name Z→A",
};

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
                        {optionLabels?.[opt] ?? opt}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

export default function StableFilterBar({
    filters,
    facetOptions,
    collections,
    initialSavedViews,
    view,
    onViewChange,
    onFiltersChange,
}: {
    filters: StableFilters;
    facetOptions: StableFacetOptions;
    collections: { id: string; name: string }[];
    initialSavedViews: SavedView[];
    view: "grid" | "ledger";
    onViewChange: (view: "grid" | "ledger") => void;
    onFiltersChange: (filters: StableFilters) => void;
}) {
    const [searchInput, setSearchInput] = useState(filters.q ?? "");
    const [savedViews, setSavedViews] = useState<SavedView[]>(initialSavedViews);
    const [viewName, setViewName] = useState("");
    const [viewsOpen, setViewsOpen] = useState(false);
    const [viewError, setViewError] = useState<string | null>(null);
    const [savingView, setSavingView] = useState(false);

    // Keep the search box in sync when the URL changes underneath us
    // (back button, chip ✕, saved-view load).
    useEffect(() => {
        setSearchInput(filters.q ?? "");
    }, [filters.q]);

    const chips = activeFilterChips(filters, collections);

    const set = (patch: Partial<StableFilters>) => onFiltersChange({ ...filters, ...patch });
    const setOrClear = (key: keyof StableFilters, value: string | undefined) => {
        const next = { ...filters };
        if (value === undefined) delete next[key];
        else (next as Record<string, unknown>)[key] = value;
        onFiltersChange(next);
    };

    const submitSearch = () => {
        const q = searchInput.trim();
        setOrClear("q", q || undefined);
    };

    const handleSaveView = async () => {
        const name = viewName.trim();
        if (!name) {
            setViewError("Give the view a name.");
            return;
        }
        setSavingView(true);
        setViewError(null);
        const result = await saveStableView({ name, params: filtersToViewParams(filters) });
        setSavingView(false);
        if (!result.success) {
            setViewError(result.error);
            return;
        }
        setSavedViews((prev) => {
            const rest = prev.filter((v) => v.name !== result.view.name);
            return [...rest, result.view].sort((a, b) => a.name.localeCompare(b.name));
        });
        setViewName("");
    };

    const handleLoadView = (savedView: SavedView) => {
        setViewsOpen(false);
        onFiltersChange(viewParamsToFilters(savedView.params));
    };

    const handleDeleteView = async (savedView: SavedView) => {
        const result = await deleteStableView({ id: savedView.id });
        if (result.success) {
            setSavedViews((prev) => prev.filter((v) => v.id !== savedView.id));
        } else {
            setViewError(result.error);
        }
    };

    return (
        <div className="ledger-card !py-3" id="stable-filter-bar">
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
                        placeholder="Search your whole stable by name, mold, maker, or sculptor…"
                        id="stable-search"
                        aria-label="Search your stable"
                    />
                </div>
                <FacetSelect
                    label="Finish"
                    value={filters.finish}
                    options={facetOptions.finishes}
                    onChange={(v) => setOrClear("finish", v)}
                    id="stable-facet-finish"
                />
                <FacetSelect
                    label="Maker"
                    value={filters.maker}
                    options={facetOptions.makers}
                    onChange={(v) => setOrClear("maker", v)}
                    id="stable-facet-maker"
                />
                <FacetSelect
                    label="Scale"
                    value={filters.scale}
                    options={facetOptions.scales}
                    onChange={(v) => setOrClear("scale", v)}
                    id="stable-facet-scale"
                />
                <FacetSelect
                    label="Status"
                    value={filters.trade}
                    options={[...TRADE_OPTIONS]}
                    onChange={(v) => setOrClear("trade", v)}
                    id="stable-facet-trade"
                />
                <FacetSelect
                    label="Category"
                    value={filters.category}
                    options={facetOptions.categories}
                    optionLabels={CATEGORY_LABELS}
                    onChange={(v) => setOrClear("category", v)}
                    id="stable-facet-category"
                />
                <FacetSelect
                    label="Collection"
                    value={filters.collection}
                    options={collections.map((c) => c.id)}
                    optionLabels={Object.fromEntries(collections.map((c) => [c.id, c.name]))}
                    onChange={(v) => setOrClear("collection", v)}
                    id="stable-facet-collection"
                />
                <button
                    type="button"
                    onClick={() => set({ hasRecords: filters.hasRecords ? undefined : true })}
                    aria-pressed={Boolean(filters.hasRecords)}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 font-serif text-xs tracking-wide transition-colors ${
                        filters.hasRecords
                            ? "border-warning bg-warning/15 font-semibold text-warning"
                            : "border-warning/50 bg-warning/5 text-warning/90 hover:bg-warning/10"
                    }`}
                    id="stable-has-records"
                >
                    🏆 Has show records
                </button>
            </div>

            {/* Row 2: stamp chips + clear-all + save view + sort + view toggle */}
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
                            onClick={() => onFiltersChange(removeFilter(filters, chip.key))}
                            aria-label={`Remove filter ${chip.label}`}
                            className="cursor-pointer border-none bg-transparent p-0 font-normal text-inherit opacity-60 hover:opacity-100"
                        >
                            ✕
                        </button>
                    </span>
                ))}
                {chips.length > 0 && (
                    <button
                        type="button"
                        onClick={() => onFiltersChange(clearAllFilters(filters))}
                        className="cursor-pointer border-none bg-transparent text-xs text-muted-foreground italic underline hover:text-foreground"
                        id="stable-clear-all"
                    >
                        clear all
                    </button>
                )}

                <div className="ml-auto flex flex-wrap items-center gap-2">
                    {/* Save view */}
                    <Popover open={viewsOpen} onOpenChange={setViewsOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" id="stable-save-view">
                                💾 Views{savedViews.length > 0 ? ` (${savedViews.length})` : ""}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-72">
                            <div className="flex flex-col gap-3">
                                <div>
                                    <p className="mb-1.5 font-serif text-xs font-semibold tracking-widest text-secondary-foreground uppercase">
                                        Save current view
                                    </p>
                                    <div className="flex gap-2">
                                        <Input
                                            value={viewName}
                                            onChange={(e) => setViewName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleSaveView();
                                            }}
                                            placeholder="View name…"
                                            maxLength={60}
                                            id="stable-view-name"
                                        />
                                        <Button size="sm" onClick={handleSaveView} disabled={savingView}>
                                            {savingView ? "Saving…" : "Save"}
                                        </Button>
                                    </div>
                                    {viewError && <p className="mt-1 text-xs text-destructive">{viewError}</p>}
                                </div>
                                {savedViews.length > 0 && (
                                    <div>
                                        <p className="mb-1.5 font-serif text-xs font-semibold tracking-widest text-secondary-foreground uppercase">
                                            Saved views
                                        </p>
                                        <ul className="flex flex-col gap-1">
                                            {savedViews.map((v) => (
                                                <li key={v.id} className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleLoadView(v)}
                                                        className="flex-1 cursor-pointer truncate rounded-md border-none bg-transparent px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                                                    >
                                                        {v.name}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteView(v)}
                                                        aria-label={`Delete view ${v.name}`}
                                                        className="cursor-pointer border-none bg-transparent px-1 text-xs text-muted-foreground hover:text-destructive"
                                                    >
                                                        🗑️
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Sort */}
                    <Select value={filters.sort} onValueChange={(v) => set({ sort: v as StableSort })}>
                        <SelectTrigger
                            id="stable-sort"
                            size="sm"
                            className="w-auto min-w-0 font-serif text-xs tracking-wide"
                            aria-label="Sort your stable"
                        >
                            <span className="text-muted-foreground">Sort</span>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {STABLE_SORTS.map((s) => (
                                <SelectItem key={s} value={s}>
                                    {SORT_LABELS[s]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Gallery / Ledger view toggle */}
                    <div className="inline-flex gap-[2px] rounded-full bg-muted p-[3px]" id="dashboard-view-toggle">
                        <button
                            type="button"
                            className={`font-inherit cursor-pointer rounded-full border-none px-3 py-1 text-sm transition-all duration-200 ${view === "grid" ? "bg-forest font-semibold text-white" : "bg-transparent text-secondary-foreground hover:text-foreground"}`}
                            onClick={() => onViewChange("grid")}
                            aria-pressed={view === "grid"}
                        >
                            🖼️ Gallery
                        </button>
                        <button
                            type="button"
                            className={`font-inherit cursor-pointer rounded-full border-none px-3 py-1 text-sm transition-all duration-200 ${view === "ledger" ? "bg-forest font-semibold text-white" : "bg-transparent text-secondary-foreground hover:text-foreground"}`}
                            onClick={() => onViewChange("ledger")}
                            aria-pressed={view === "ledger"}
                        >
                            📋 Ledger
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
