"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { searchCatalogAction, getReleasesForMold, getCatalogItem, type CatalogItem } from "@/app/actions/reference";
import MarketValueBadge from "@/components/MarketValueBadge";
import {
  applyTypeFilter,
  rankSearchResults,
  SEARCH_TYPE_FILTERS,
  type SearchTypeFilterKey,
} from "@/lib/catalog/searchRank";
import SuggestNewEntryForm from "@/components/SuggestNewEntryForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/* Props                                                              */
/* ------------------------------------------------------------------ */

interface UnifiedReferenceSearchProps {
  selectedCatalogId: string | null;
  onCatalogSelect: (catalogId: string | null, item: CatalogItem | null) => void;
  onCustomEntry?: (searchTerm: string) => void;
  externalSearchQuery?: string;
  aiNotice?: React.ReactNode;
  /** The finish the member has declared for the horse being linked.
   *  Used to FLOAT matching catalog types (resin horse → resin entries),
   *  never to hide anything — customs legitimately link to OF plastic. */
  finishType?: string | null;
}

/* ------------------------------------------------------------------ */
/* Icons for item types                                               */
/* ------------------------------------------------------------------ */

const TYPE_BADGES: Record<string, { icon: string; label: string }> = {
  plastic_mold: { icon: "\u{1F3ED}", label: "Mold" },
  plastic_release: { icon: "\u{1F4E6}", label: "Release" },
  artist_resin: { icon: "\u{1F3A8}", label: "Resin" },
  factory_resin: { icon: "\u{1F3A8}", label: "Factory Resin" },
  china: { icon: "\u{1F3FA}", label: "China" },
  micro_mini: { icon: "\u{1F40E}", label: "Micro Mini" },
  medallion: { icon: "\u{1F947}", label: "Medallion" },
  tack: { icon: "\u{1F9F5}", label: "Tack" },
  prop: { icon: "\u{1F9F1}", label: "Prop" },
  diorama: { icon: "\u{1F3DE}", label: "Diorama" },
};
const FALLBACK_BADGE = { icon: "\u{1F4C4}", label: "Entry" };

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function UnifiedReferenceSearch({
  selectedCatalogId,
  onCatalogSelect,
  onCustomEntry,
  externalSearchQuery,
  aiNotice,
  finishType,
}: UnifiedReferenceSearchProps) {
  const [query, setQuery] = useState("");
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  // Captured when the user clicks "Suggest adding it" — the old modal read
  // the term at mount (always "") and lost it; this reads it at click time.
  const [suggestTerm, setSuggestTerm] = useState("");
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [releases, setReleases] = useState<CatalogItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [typeFilter, setTypeFilter] = useState<SearchTypeFilterKey>("all");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // External search query from AI detection
  useEffect(() => {
    if (externalSearchQuery && externalSearchQuery.trim()) {
      setQuery(externalSearchQuery.trim());
    }
  }, [externalSearchQuery]);

  // Load selected item details on mount if selectedCatalogId is set
  useEffect(() => {
    if (selectedCatalogId && !selectedItem) {
      getCatalogItem(selectedCatalogId).then((item) => {
        if (item) setSelectedItem(item);
      });
    }
  }, [selectedCatalogId, selectedItem]);

  // Debounced search
  const runSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    setIsSearching(true);
    const items = await searchCatalogAction(q.trim());
    setResults(items);
    setShowDropdown(true);
    setIsSearching(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  // When a mold is clicked, expand its releases. We do NOT link the mold yet —
  // if it has releases we nudge the user to pick the specific one first (linking
  // to a mold when a release exists is the #1 source of coarse catalog data).
  const handleMoldClick = async (item: CatalogItem) => {
    setSelectedItem(item);
    setLoadingReleases(true);
    setReleases([]);
    const moldReleases = await getReleasesForMold(item.id);
    setReleases(moldReleases);
    setLoadingReleases(false);
    if (moldReleases.length === 0) {
      // No discrete releases catalogued (e.g. Peter Stone one-of-a-kinds) —
      // linking the mold itself is the correct choice here.
      onCatalogSelect(item.id, item);
      setShowDropdown(false);
      setQuery("");
    }
  };

  const handleSelect = (item: CatalogItem) => {
    setSelectedItem(item);
    setReleases([]);
    setShowDropdown(false);
    setQuery("");
    onCatalogSelect(item.id, item);
  };

  const handleClear = () => {
    setSelectedItem(null);
    setReleases([]);
    setQuery("");
    setResults([]);
    onCatalogSelect(null, null);
  };

  // ONE relevance-ordered list — never sectioned by type. The old
  // fixed sections (Molds, Releases, Resins last) buried exact matches
  // under fuzzy plastic and silently dropped every other item type.
  // Ranking: exact title > prefix > RPC similarity, with the declared
  // finish floating its own kind within each tier (searchRank.ts).
  const ranked = rankSearchResults(results, query, finishType);
  const visible = applyTypeFilter(ranked, typeFilter);
  const hasResults = visible.length > 0;
  const noResults = query.trim().length >= 2 && !isSearching && results.length === 0;

  return (
    <div className="relative" ref={containerRef}>
      {/* AI Detection Notice */}
      {aiNotice}

      {/* Selected Item Display (hide when browsing releases) */}
      {selectedItem && selectedCatalogId && releases.length === 0 ? (
        <>
          <div className="bg-success/10 border-success/30 flex items-center justify-between gap-4 rounded-lg border px-6 py-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="bg-success/10 text-success border-success/30 border">
                {TYPE_BADGES[selectedItem.itemType]?.icon || "\u{1F4CB}"}{" "}
                {TYPE_BADGES[selectedItem.itemType]?.label || selectedItem.itemType}
              </span>
              <span className="text-foreground font-bold">{selectedItem.title}</span>
              <span className="text-sm text-muted-foreground">{selectedItem.maker}</span>
              {selectedItem.parentTitle && (
                <span className="ref-selected-parent"> on {selectedItem.parentTitle}</span>
              )}
              {selectedItem.scale && <span className="text-muted-foreground text-sm"> {"\u00B7"} {selectedItem.scale}</span>}
              <MarketValueBadge catalogId={selectedCatalogId} compact />
            </div>
            <Button variant="outline" size="wide"
              onClick={handleClear}
              aria-label="Clear selection"
            >
              {"\u2715"}
            </Button>
          </div>
          <div className="bg-forest/10 border-forest/25 mt-2 rounded-md border px-4 py-2 text-sm text-muted-foreground">
            {"\u{1F517}"} <strong>Linked</strong> {"\u2014"} Manufacturer, scale, and release info will auto-fill on your passport.
          </div>
        </>
      ) : (
        <>
          {/* Search Input + photo identify */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <svg
                className="text-muted-foreground pointer-events-none absolute top-[50%] left-[16px] z-[1] translate-y-[-50%]"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="flex h-11 w-full rounded-md border border-input bg-card px-10 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                placeholder="Search molds, releases, or resins..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => {
                  if (query.trim() && hasResults) setShowDropdown(true);
                }}
                id="reference-search-input"
                autoComplete="off"
              />
              {query && (
                <button
                  className="text-muted-foreground hover:text-foreground absolute top-[50%] right-[12px] flex h-[28px] w-[28px] translate-y-[-50%] cursor-pointer items-center justify-center rounded-full border-0 bg-muted text-[0.8rem] transition-all duration-150"
                  onClick={() => {
                    setQuery("");
                    setShowDropdown(false);
                  }}
                  aria-label="Clear"
                >
                  {"\u2715"}
                </button>
              )}
            </div>
          </div>

          {/* Dropdown Results */}
          {showDropdown && (
            <div className="animate-fade-in-up mt-1 flex max-h-[420px] w-full flex-col overflow-y-auto rounded-lg border border-input bg-card shadow-lg">
              {isSearching ? (
                <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-input border-t-forest" />
                  Searching catalog...
                </div>
              ) : (
                <>
                  {/* Type filter chips — the manual override. Counts
                      come from the full ranked set so a chip never lies
                      about what it would show. */}
                  <div className="sticky top-0 z-40 flex items-center gap-1.5 border-b border-input bg-muted px-3 py-1.5">
                    {SEARCH_TYPE_FILTERS.map((f) => {
                      const count = applyTypeFilter(ranked, f.key).length;
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => setTypeFilter(f.key)}
                          className={
                            typeFilter === f.key
                              ? "rounded-full bg-forest px-2.5 py-0.5 text-xs font-semibold text-white"
                              : "rounded-full border border-input bg-transparent px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                          }
                        >
                          {f.label}{f.key === "all" ? "" : ` (${count})`}
                        </button>
                      );
                    })}
                  </div>

                  {/* ONE list in relevance order; type is a badge, not a
                      hierarchy. Exact matches surface first no matter what
                      kind of model they are. */}
                  {visible.map((item) => {
                    const badge = TYPE_BADGES[item.itemType] ?? FALLBACK_BADGE;
                    const isMold = item.itemType === "plastic_mold";
                    return (
                      <button
                        key={item.id}
                        className="group flex w-full cursor-pointer items-center gap-3 border-0 border-b border-input bg-transparent px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-success/10"
                        onClick={() => (isMold ? handleMoldClick(item) : handleSelect(item))}
                      >
                        <span className="shrink-0 text-base" aria-hidden="true">{badge.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-foreground">
                            {item.title}
                            {!!item.attributes.model_number && (
                              <span className="ml-1 font-normal text-muted-foreground">
                                #{String(item.attributes.model_number)}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {badge.label} {"·"} {item.maker}{item.scale ? ` ${"·"} ${item.scale}` : ""}
                          </div>
                        </div>
                        <span className={
                          isMold
                            ? "shrink-0 rounded-full bg-forest/10 px-2.5 py-1 text-xs font-semibold text-forest transition-colors group-hover:bg-forest group-hover:text-white"
                            : "shrink-0 rounded-full bg-forest/10 px-2.5 py-1 text-xs font-semibold text-forest opacity-0 transition-all group-hover:opacity-100"
                        }>
                          {isMold ? `${"▸"} Releases` : "Select"}
                        </span>
                      </button>
                    );
                  })}

                  {/* Filter emptied the list but matches exist elsewhere */}
                  {!hasResults && results.length > 0 && (
                    <div className="px-6 py-6 text-center text-sm text-muted-foreground">
                      No {SEARCH_TYPE_FILTERS.find((f) => f.key === typeFilter)?.label} matches —{" "}
                      <button type="button" className="text-forest font-medium underline" onClick={() => setTypeFilter("all")}>
                        show all types
                      </button>
                    </div>
                  )}

                  {/* No results */}
                  {noResults && (
                    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
                      <p className="text-sm text-muted-foreground">No references found for {"\u201C"}{query}{"\u201D"}</p>
                      <p className="text-xs text-muted-foreground">
                        Check the{" "}
                        <a href="/market/guide" className="text-forest font-medium hover:underline">
                          {"\u{1F4C8}"} Blue Book
                        </a>{" "}
                        for market data, or suggest a new entry.
                      </p>
                      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                        <button
                          className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-input bg-transparent px-6 py-2 text-sm font-medium text-secondary-foreground transition-all hover:border-forest hover:text-forest"
                          onClick={() => {
                            // Carry the search term into the suggestion form.
                            setSuggestTerm(query.trim());
                            setShowSuggestModal(true);
                            setShowDropdown(false);
                          }}
                        >
                          {"\u270D\uFE0F"} Suggest adding it
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Expanded Releases (when a mold is clicked) */}
          {releases.length > 0 && selectedItem && selectedItem.itemType === "plastic_mold" && (
            <div className="animate-fade-in-up mt-4 flex flex-col overflow-hidden rounded-lg border border-input bg-card shadow-md transition-all">
              <div className="flex items-center justify-between border-b border-input bg-success/10 px-4 py-2.5">
                <span className="text-sm text-secondary-foreground">
                  Releases for <strong className="text-foreground">{selectedItem.title}</strong>
                </span>
                <button
                  className="cursor-pointer rounded-md border border-input bg-transparent px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                  onClick={handleClear}
                >
                  {"\u2715"} Clear
                </button>
              </div>

              {/* Nudge: pick the specific release, not the mold */}
              <div className="border-b border-input bg-forest/5 px-4 py-2.5 text-sm text-secondary-foreground">
                {"\u{1F3AF}"} <strong className="text-foreground">Pick your exact release</strong> below {"—"} it links accurate values and matches you with buyers &amp; sellers of that exact color. Only link the mold if you truly don{"’"}t know which release yours is.
              </div>

              <div className="max-h-[360px] overflow-y-auto">
                {loadingReleases ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-input border-t-forest" />
                    Loading releases...
                  </div>
                ) : (
                  <>
                    {releases.map((rel) => (
                      <button
                        key={rel.id}
                        className="group flex w-full cursor-pointer items-center gap-3 border-0 border-b border-input bg-transparent px-4 py-2.5 text-left transition-colors hover:bg-success/10"
                        onClick={() => handleSelect(rel)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-foreground">
                            {rel.title}
                            {!!rel.attributes.model_number && (
                              <span className="ml-1 font-normal text-muted-foreground">
                                #{String(rel.attributes.model_number)}
                              </span>
                            )}
                          </div>
                          {!!rel.attributes.color_description && (
                            <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                              {String(rel.attributes.color_description)}
                            </div>
                          )}
                        </div>
                        <span className="shrink-0 rounded-full bg-forest/10 px-2.5 py-1 text-xs font-semibold text-forest opacity-0 transition-all group-hover:opacity-100">
                          Select
                        </span>
                      </button>
                    ))}

                    {/* Fallback: link the mold only — de-emphasized, last */}
                    <button
                      className="flex w-full cursor-pointer items-center gap-3 border-0 border-t border-input bg-transparent px-4 py-2.5 text-left transition-colors hover:bg-muted"
                      onClick={() => handleSelect(selectedItem)}
                    >
                      <div className="min-w-0 flex-1 text-sm text-muted-foreground">
                        {"\u{1F3ED}"} Not sure which release? <span className="underline">Link the mold only</span>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
      {/* Suggest a new entry — the MODERN catalog_suggestions flow
          (votes, changelog, curator credit), replacing the legacy
          database_suggestions modal that guessed makers from free text
          and orphaned releases. */}
      <Dialog
        open={showSuggestModal}
        onOpenChange={(open) => {
          if (!open) setShowSuggestModal(false);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-[580px]">
          <DialogHeader>
            <DialogTitle>{"📗"} Suggest a New Entry</DialogTitle>
            <DialogDescription>
              Couldn&apos;t find it? Propose it for the reference catalog — the community
              reviews it, and you get contributor credit when it&apos;s approved.
            </DialogDescription>
          </DialogHeader>
          <SuggestNewEntryForm
            key={suggestTerm}
            variant="dialog"
            initialTitle={suggestTerm}
            onCancel={() => setShowSuggestModal(false)}
            onSubmitted={(title) => {
              setShowSuggestModal(false);
              if (onCustomEntry) {
                onCustomEntry(title);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
