"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { searchCatalogAction, getReleasesForMold, getCatalogItem, type CatalogItem } from "@/app/actions/reference";
import MarketValueBadge from "@/components/MarketValueBadge";
import SuggestReferenceModal from "@/components/SuggestReferenceModal";

/* ------------------------------------------------------------------ */
/* Props                                                              */
/* ------------------------------------------------------------------ */

interface UnifiedReferenceSearchProps {
  selectedCatalogId: string | null;
  onCatalogSelect: (catalogId: string | null, item: CatalogItem | null) => void;
  onCustomEntry?: (searchTerm: string) => void;
  externalSearchQuery?: string;
  aiNotice?: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/* Icons for item types                                               */
/* ------------------------------------------------------------------ */

const TYPE_BADGES: Record<string, { icon: string; label: string }> = {
  plastic_mold: { icon: "\u{1F3ED}", label: "Mold" },
  plastic_release: { icon: "\u{1F4E6}", label: "Release" },
  artist_resin: { icon: "\u{1F3A8}", label: "Resin" },
};

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function UnifiedReferenceSearch({
  selectedCatalogId,
  onCatalogSelect,
  onCustomEntry,
  externalSearchQuery,
  aiNotice,
}: UnifiedReferenceSearchProps) {
  const [query, setQuery] = useState("");
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [releases, setReleases] = useState<CatalogItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
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

  // When a mold is clicked, expand its releases
  const handleMoldClick = async (item: CatalogItem) => {
    setSelectedItem(item);
    onCatalogSelect(item.id, item);
    setLoadingReleases(true);
    setReleases([]);
    const moldReleases = await getReleasesForMold(item.id);
    setReleases(moldReleases);
    setLoadingReleases(false);
    if (moldReleases.length === 0) {
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

  // Group results by type for display
  const molds = results.filter((r) => r.itemType === "plastic_mold");
  const releaseResults = results.filter((r) => r.itemType === "plastic_release");
  const resins = results.filter((r) => r.itemType === "artist_resin");
  const hasResults = results.length > 0;
  const noResults = query.trim().length >= 2 && !isSearching && !hasResults;

  return (
    <div className="relative" ref={containerRef}>
      {/* AI Detection Notice */}
      {aiNotice}

      {/* Selected Item Display (hide when browsing releases) */}
      {selectedItem && selectedCatalogId && releases.length === 0 ? (
        <>
          <div className="bg-emerald-50/70 border-emerald-200 flex items-center justify-between gap-4 rounded-lg border px-6 py-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="bg-emerald-100/70 text-success border-emerald-300 border">
                {TYPE_BADGES[selectedItem.itemType]?.icon || "\u{1F4CB}"}{" "}
                {TYPE_BADGES[selectedItem.itemType]?.label || selectedItem.itemType}
              </span>
              <span className="text-stone-900 font-bold">{selectedItem.title}</span>
              <span className="text-sm text-stone-500">{selectedItem.maker}</span>
              {selectedItem.parentTitle && (
                <span className="ref-selected-parent"> on {selectedItem.parentTitle}</span>
              )}
              {selectedItem.scale && <span className="text-stone-500 text-sm"> {"\u00B7"} {selectedItem.scale}</span>}
              <MarketValueBadge catalogId={selectedCatalogId} compact />
            </div>
            <button
              className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
              onClick={handleClear}
              aria-label="Clear selection"
            >
              {"\u2715"}
            </button>
          </div>
          <div className="bg-forest/10 border-forest/25 mt-2 rounded-md border px-4 py-2 text-sm text-stone-500">
            {"\u{1F517}"} <strong>Linked</strong> {"\u2014"} Manufacturer, scale, and release info will auto-fill on your passport.
          </div>
        </>
      ) : (
        <>
          {/* Search Input */}
          <div className="relative mb-4">
            <svg
              className="text-stone-400 pointer-events-none absolute top-[50%] left-[16px] z-[1] translate-y-[-50%]"
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
              className="flex h-11 w-full rounded-md border border-edge bg-[#FEFCF8] px-10 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                className="text-stone-500 hover:text-stone-900 absolute top-[50%] right-[12px] flex h-[28px] w-[28px] translate-y-[-50%] cursor-pointer items-center justify-center rounded-full border-0 bg-[rgb(245_245_244)] text-[0.8rem] transition-all duration-150"
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

          {/* Dropdown Results */}
          {showDropdown && (
            <div className="animate-fade-in-up mt-1 flex max-h-[420px] w-full flex-col overflow-y-auto rounded-lg border border-edge bg-[#FEFCF8] shadow-lg">
              {isSearching ? (
                <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-stone-400">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-200 border-t-forest" />
                  Searching catalog...
                </div>
              ) : (
                <>
                  {/* Molds */}
                  {molds.length > 0 && (
                    <>
                      <div className="sticky top-0 z-40 flex items-center gap-1.5 border-b border-stone-200 bg-stone-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
                        <span>{"\u{1F3ED}"}</span> Base Molds
                      </div>
                      {molds.map((item) => (
                        <button
                          key={item.id}
                          className="group flex w-full cursor-pointer items-center gap-3 border-0 border-b border-stone-100 bg-transparent px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-emerald-50/50"
                          onClick={() => handleMoldClick(item)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-stone-800">{item.title}</div>
                            <div className="mt-0.5 text-xs text-stone-400">
                              {item.maker}{item.scale ? ` ${"\u00B7"} ${item.scale}` : ""}
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full bg-forest/10 px-2.5 py-1 text-xs font-semibold text-forest transition-colors group-hover:bg-forest group-hover:text-white">
                            {"\u25B8"} Releases
                          </span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Releases */}
                  {releaseResults.length > 0 && (
                    <>
                      <div className="sticky top-0 z-40 flex items-center gap-1.5 border-b border-stone-200 bg-stone-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
                        <span>{"\u{1F4E6}"}</span> Releases
                      </div>
                      {releaseResults.map((item) => (
                        <button
                          key={item.id}
                          className="group flex w-full cursor-pointer items-center gap-3 border-0 border-b border-stone-100 bg-transparent px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-emerald-50/50"
                          onClick={() => handleSelect(item)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-stone-800">
                              {item.title}
                              {!!item.attributes.model_number && (
                                <span className="ml-1 font-normal text-stone-400">
                                  #{String(item.attributes.model_number)}
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-xs text-stone-400">{item.maker}</div>
                          </div>
                          <span className="shrink-0 rounded-full bg-forest/10 px-2.5 py-1 text-xs font-semibold text-forest opacity-0 transition-all group-hover:opacity-100">
                            Select
                          </span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Resins */}
                  {resins.length > 0 && (
                    <>
                      <div className="sticky top-0 z-40 flex items-center gap-1.5 border-b border-stone-200 bg-stone-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
                        <span>{"\u{1F3A8}"}</span> Artist Resins
                      </div>
                      {resins.map((item) => (
                        <button
                          key={item.id}
                          className="group flex w-full cursor-pointer items-center gap-3 border-0 border-b border-stone-100 bg-transparent px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-emerald-50/50"
                          onClick={() => handleSelect(item)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-stone-800">{item.title}</div>
                            <div className="mt-0.5 text-xs text-stone-400">
                              {item.maker}{item.scale ? ` ${"\u00B7"} ${item.scale}` : ""}
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full bg-forest/10 px-2.5 py-1 text-xs font-semibold text-forest opacity-0 transition-all group-hover:opacity-100">
                            Select
                          </span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* No results */}
                  {noResults && (
                    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
                      <p className="text-sm text-stone-500">No references found for {"\u201C"}{query}{"\u201D"}</p>
                      <p className="text-xs text-stone-400">
                        Check the{" "}
                        <a href="/market" className="text-forest font-medium hover:underline">
                          {"\u{1F4C8}"} Price Guide
                        </a>{" "}
                        for market data, or suggest a new entry.
                      </p>
                      <button
                        className="mt-1 inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-edge bg-transparent px-6 py-2 text-sm font-medium text-stone-600 transition-all hover:border-forest hover:text-forest"
                        onClick={() => {
                          setShowSuggestModal(true);
                          setShowDropdown(false);
                        }}
                      >
                        {"\u270D\uFE0F"} Suggest adding it
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Expanded Releases (when a mold is clicked) */}
          {releases.length > 0 && selectedItem && selectedItem.itemType === "plastic_mold" && (
            <div className="animate-fade-in-up mt-4 flex flex-col overflow-hidden rounded-lg border border-edge bg-[#FEFCF8] shadow-md transition-all">
              <div className="flex items-center justify-between border-b border-stone-200 bg-emerald-50/60 px-4 py-2.5">
                <span className="text-sm text-stone-600">
                  Releases for <strong className="text-stone-800">{selectedItem.title}</strong>
                </span>
                <button
                  className="cursor-pointer rounded-md border border-stone-200 bg-transparent px-3 py-1 text-xs font-medium text-stone-500 transition-colors hover:border-red-300 hover:text-red-600"
                  onClick={handleClear}
                >
                  {"\u2715"} Clear
                </button>
              </div>

              <div className="max-h-[360px] overflow-y-auto">
                {/* Option: Select mold directly */}
                <button
                  className="group flex w-full cursor-pointer items-center gap-3 border-0 border-b border-stone-200 bg-emerald-50/30 px-4 py-3 text-left transition-colors hover:bg-emerald-50/60"
                  onClick={() => handleSelect(selectedItem)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-stone-800">
                      {"\u{1F3ED}"} {selectedItem.title}{" "}
                      <span className="font-normal text-stone-400">(any release)</span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-forest/10 px-2.5 py-1 text-xs font-semibold text-forest transition-colors group-hover:bg-forest group-hover:text-white">
                    Select Mold
                  </span>
                </button>

                {loadingReleases ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-stone-400">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-200 border-t-forest" />
                    Loading releases...
                  </div>
                ) : (
                  releases.map((rel) => (
                    <button
                      key={rel.id}
                      className="group flex w-full cursor-pointer items-center gap-3 border-0 border-b border-stone-100 bg-transparent px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-emerald-50/50"
                      onClick={() => handleSelect(rel)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-stone-800">
                          {rel.title}
                          {!!rel.attributes.model_number && (
                            <span className="ml-1 font-normal text-stone-400">
                              #{String(rel.attributes.model_number)}
                            </span>
                          )}
                        </div>
                        {!!rel.attributes.color_description && (
                          <div className="mt-0.5 line-clamp-1 text-xs text-stone-400">
                            {String(rel.attributes.color_description)}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-forest/10 px-2.5 py-1 text-xs font-semibold text-forest opacity-0 transition-all group-hover:opacity-100">
                        Select
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
      {/* Suggest Reference Modal */}
      <SuggestReferenceModal
        isOpen={showSuggestModal}
        searchTerm={query.trim()}
        onClose={() => setShowSuggestModal(false)}
        onSubmitted={(searchTerm) => {
          setShowSuggestModal(false);
          if (onCustomEntry) {
            onCustomEntry(searchTerm);
          }
        }}
      />
    </div>
  );
}
