"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { searchCatalogAction, getReleasesForMold, getCatalogItem, type CatalogItem } from "@/app/actions/reference";
import MarketValueBadge from "@/components/MarketValueBadge";
import SuggestReferenceModal from "@/components/SuggestReferenceModal";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface UnifiedReferenceSearchProps {
  selectedCatalogId: string | null;
  onCatalogSelect: (catalogId: string | null, item: CatalogItem | null) => void;
  onCustomEntry?: (searchTerm: string) => void;
  externalSearchQuery?: string;
  aiNotice?: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Icons for item types                                               */
/* ------------------------------------------------------------------ */

const TYPE_BADGES: Record<string, { icon: string; label: string }> = {
  plastic_mold: { icon: "🏭", label: "Mold" },
  plastic_release: { icon: "📦", label: "Release" },
  artist_resin: { icon: "🎨", label: "Resin" },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
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
    // Immediately select the mold so catalog_id is persisted even if
    // the user doesn't explicitly click "Select Mold" in the releases panel
    setSelectedItem(item);
    onCatalogSelect(item.id, item);

    setLoadingReleases(true);
    setReleases([]);
    const moldReleases = await getReleasesForMold(item.id);
    setReleases(moldReleases);
    setLoadingReleases(false);

    if (moldReleases.length === 0) {
      // No releases — mold is already selected above, just close dropdown
      setShowDropdown(false);
      setQuery("");
    }
    // If releases exist, show them so user can pick a specific release (overrides the mold)
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
  const molds = results.filter(r => r.itemType === "plastic_mold");
  const releaseResults = results.filter(r => r.itemType === "plastic_release");
  const resins = results.filter(r => r.itemType === "artist_resin");
  const hasResults = results.length > 0;
  const noResults = query.trim().length >= 2 && !isSearching && !hasResults;

  return (
    <div className="relative" ref={containerRef}>
      {/* AI Detection Notice */}
      {aiNotice}

      {/* Selected Item Display (hide when browsing releases) */}
      {selectedItem && selectedCatalogId && releases.length === 0 ? (
        <>
          <div className="flex items-center justify-between gap-4 py-4 px-6 bg-[rgba(44, 85, 69, 0.06)] border border-[rgba(44, 85, 69, 0.2)] rounded-lg">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="bg-[rgba(92, 224, 160, 0.12)] text-success border border-[rgba(92, 224, 160, 0.25)]">
                {TYPE_BADGES[selectedItem.itemType]?.icon || "📋"}{" "}
                {TYPE_BADGES[selectedItem.itemType]?.label || selectedItem.itemType}
              </span>
              <span className="font-bold text-ink">{selectedItem.title}</span>
              <span className="text-[var(--color-text-secondary)] text-sm">{selectedItem.maker}</span>
              {selectedItem.parentTitle && (
                <span className="ref-selected-parent"> on {selectedItem.parentTitle}</span>
              )}
              {selectedItem.scale && (
                <span className="text-muted text-sm"> · {selectedItem.scale}</span>
              )}
              <MarketValueBadge catalogId={selectedCatalogId} compact />
            </div>
            <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge shrink-0 text-sm" onClick={handleClear} aria-label="Clear selection">
              ✕
            </button>
          </div>
          <div style={{
            background: "rgba(61, 90, 62, 0.08)",
            border: "1px solid rgba(61, 90, 62, 0.25)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-sm) var(--space-md)",
            fontSize: "calc(var(--font-size-sm) * var(--font-scale))",
            color: "var(--color-text-secondary)",
            marginTop: "var(--space-sm)",
          }}>
            🔗 <strong>Linked</strong> — Manufacturer, scale, and release info will auto-fill on your passport.
          </div>
        </>
      ) : (
        <>
          {/* Search Input */}
          <div className="relative mb-4">
            <svg className="absolute left-[16px] top-[50%] translate-y-[-50%] text-muted pointer-events-none z-[1]" width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="text-muted"
              placeholder="Search molds, releases, or resins…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { if (query.trim() && hasResults) setShowDropdown(true); }}
              id="reference-search-input"
              autoComplete="off"
            />
            {query && (
              <button className="absolute right-[12px] top-[50%] translate-y-[-50%] w-[28px] h-[28px] flex items-center justify-center border-0 bg-[rgba(0,0,0,0.06)] text-muted rounded-full cursor-pointer text-[0.8rem] transition-all duration-150 hover:0.1)] hover:text-ink" onClick={() => { setQuery(""); setShowDropdown(false); }} aria-label="Clear">
                ✕
              </button>
            )}
          </div>

          {/* Dropdown Results */}
          {showDropdown && (
            <div className="w-[6px] animate-fade-in-up">
              {isSearching ? (
                <div className="py-6 px-4 text-center text-muted text-sm">Searching…</div>
              ) : (
                <>
                  {/* Molds */}
                  {molds.length > 0 && (
                    <>
                      <div className="ref-group-sticky top-0 z-[100] h-[var(--header max-sm:py-[0] max-sm:px-4-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">🏭 Base Molds</div>
                      {molds.map((item) => (
                        <button key={item.id} className="border-b-0" onClick={() => handleMoldClick(item)}>
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-ink">{item.title}</span>
                            <span className="text-xs text-muted"> · {item.maker}{item.scale ? ` · ${item.scale}` : ""}</span>
                          </div>
                          <span className="text-xs font-semibold text-forest whitespace-nowrap shrink-0 pl-2">▸ Releases</span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Releases */}
                  {releaseResults.length > 0 && (
                    <>
                      <div className="ref-group-sticky top-0 z-[100] h-[var(--header max-sm:py-[0] max-sm:px-4-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">📦 Releases</div>
                      {releaseResults.map((item) => (
                        <button key={item.id} className="border-b-0" onClick={() => handleSelect(item)}>
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-ink">{item.title}</span>
                            {!!item.attributes.model_number && (
                              <span className="text-xs text-muted"> (#{String(item.attributes.model_number)})</span>
                            )}
                            <span className="text-xs text-muted"> · {item.maker}</span>
                          </div>
                          <span className="text-xs font-semibold text-forest whitespace-nowrap shrink-0 pl-2">Select</span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Resins */}
                  {resins.length > 0 && (
                    <>
                      <div className="ref-group-sticky top-0 z-[100] h-[var(--header max-sm:py-[0] max-sm:px-4-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">🎨 Artist Resins</div>
                      {resins.map((item) => (
                        <button key={item.id} className="border-b-0" onClick={() => handleSelect(item)}>
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-ink">{item.title}</span>
                            <span className="text-xs text-muted"> · {item.maker}{item.scale ? ` · ${item.scale}` : ""}</span>
                          </div>
                          <span className="text-xs font-semibold text-forest whitespace-nowrap shrink-0 pl-2">Select</span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* No results */}
                  {noResults && (
                    <div className="py-6 px-4 text-center text-[var(--color-text-secondary)] text-sm flex flex-col items-center gap-2">
                      <p>No references found for &ldquo;{query}&rdquo;</p>
                      <p className="text-xs text-muted mt-1" >
                        Check the <a href="/market" className="text-forest" >📈 Price Guide</a> for market data, or use the button below.
                      </p>
                      <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" onClick={() => { setShowSuggestModal(true); setShowDropdown(false); }}>
                        ✍️ Can&apos;t find it? Suggest adding it
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Expanded Releases (when a mold is clicked) */}
          {releases.length > 0 && selectedItem && selectedItem.itemType === "plastic_mold" && (
            <div className="mt-4 border border-edge rounded-lg overflow-hidden bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all animate-fade-in-up">
              <div className="flex items-center justify-between py-2 px-4 bg-[rgba(44, 85, 69, 0.06)] border-b border-edge text-sm text-[var(--color-text-secondary)]">
                <span>Releases for <strong>{selectedItem.title}</strong></span>
                <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge text-xs" onClick={handleClear}>✕ Clear</button>
              </div>

              {/* Option: Select mold directly */}
              <button className="border-b-0 bg-[rgba(92, 224, 160, 0.04)] border-b border-[var(--color-border) !important]" onClick={() => handleSelect(selectedItem)}>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-ink">🏭 {selectedItem.title} (any release)</span>
                </div>
                <span className="text-xs font-semibold text-forest whitespace-nowrap shrink-0 pl-2">Select Mold</span>
              </button>

              {loadingReleases ? (
                <div className="py-6 px-4 text-center text-muted text-sm">Loading releases…</div>
              ) : (
                releases.map((rel) => (
                  <button key={rel.id} className="border-b-0" onClick={() => handleSelect(rel)}>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-ink">{rel.title}</span>
                      {!!rel.attributes.model_number && (
                        <span className="text-xs text-muted"> (#{String(rel.attributes.model_number)})</span>
                      )}
                      {!!rel.attributes.color_description && (
                        <span className="text-xs text-muted"> · {String(rel.attributes.color_description)}</span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-forest whitespace-nowrap shrink-0 pl-2">Select</span>
                  </button>
                ))
              )}
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
