"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { searchCatalogAction, getReleasesForMold, getCatalogItem, type CatalogItem } from "@/app/actions/reference";
import MarketValueBadge from "@/components/MarketValueBadge";

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
    setLoadingReleases(true);
    setReleases([]);
    const moldReleases = await getReleasesForMold(item.id);
    setReleases(moldReleases);
    setLoadingReleases(false);

    if (moldReleases.length === 0) {
      // No releases — select the mold directly
      handleSelect(item);
    }
    // If releases exist, show them so user can pick mold or a specific release
    setSelectedItem(item);
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
    <div className="ref-search-container" ref={containerRef}>
      {/* AI Detection Notice */}
      {aiNotice}

      {/* Selected Item Display */}
      {selectedItem && selectedCatalogId ? (
        <div className="ref-selected-item">
          <div className="ref-selected-info">
            <span className="ref-type-badge">
              {TYPE_BADGES[selectedItem.itemType]?.icon || "📋"}{" "}
              {TYPE_BADGES[selectedItem.itemType]?.label || selectedItem.itemType}
            </span>
            <span className="ref-selected-title">{selectedItem.title}</span>
            <span className="ref-selected-maker">{selectedItem.maker}</span>
            {selectedItem.parentTitle && (
              <span className="ref-selected-parent"> on {selectedItem.parentTitle}</span>
            )}
            {selectedItem.scale && (
              <span className="ref-selected-scale"> · {selectedItem.scale}</span>
            )}
            <MarketValueBadge catalogId={selectedCatalogId} compact />
          </div>
          <button className="btn btn-ghost ref-clear-btn" onClick={handleClear} aria-label="Clear selection">
            ✕
          </button>
        </div>
      ) : (
        <>
          {/* Search Input */}
          <div className="ref-search-bar">
            <svg className="ref-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="ref-search-input"
              placeholder="Search molds, releases, or resins…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { if (query.trim() && hasResults) setShowDropdown(true); }}
              id="reference-search-input"
              autoComplete="off"
            />
            {query && (
              <button className="ref-search-clear" onClick={() => { setQuery(""); setShowDropdown(false); }} aria-label="Clear">
                ✕
              </button>
            )}
          </div>

          {/* Dropdown Results */}
          {showDropdown && (
            <div className="ref-dropdown animate-fade-in-up">
              {isSearching ? (
                <div className="ref-search-status">Searching…</div>
              ) : (
                <>
                  {/* Molds */}
                  {molds.length > 0 && (
                    <>
                      <div className="ref-group-header">🏭 Base Molds</div>
                      {molds.map((item) => (
                        <button key={item.id} className="ref-result-item" onClick={() => handleMoldClick(item)}>
                          <div className="ref-result-info">
                            <span className="ref-result-name">{item.title}</span>
                            <span className="ref-result-meta"> · {item.maker}{item.scale ? ` · ${item.scale}` : ""}</span>
                          </div>
                          <span className="ref-result-action">▸ Releases</span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Releases */}
                  {releaseResults.length > 0 && (
                    <>
                      <div className="ref-group-header">📦 Releases</div>
                      {releaseResults.map((item) => (
                        <button key={item.id} className="ref-result-item" onClick={() => handleSelect(item)}>
                          <div className="ref-result-info">
                            <span className="ref-result-name">{item.title}</span>
                            {!!item.attributes.model_number && (
                              <span className="ref-result-meta"> (#{String(item.attributes.model_number)})</span>
                            )}
                            <span className="ref-result-meta"> · {item.maker}</span>
                          </div>
                          <span className="ref-result-action">Select</span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Resins */}
                  {resins.length > 0 && (
                    <>
                      <div className="ref-group-header">🎨 Artist Resins</div>
                      {resins.map((item) => (
                        <button key={item.id} className="ref-result-item" onClick={() => handleSelect(item)}>
                          <div className="ref-result-info">
                            <span className="ref-result-name">{item.title}</span>
                            <span className="ref-result-meta"> · {item.maker}{item.scale ? ` · ${item.scale}` : ""}</span>
                          </div>
                          <span className="ref-result-action">Select</span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* No results */}
                  {noResults && (
                    <div className="ref-no-results">
                      <p>No references found for &ldquo;{query}&rdquo;</p>
                      {onCustomEntry && (
                        <button className="btn btn-ghost" onClick={() => { onCustomEntry(query.trim()); setShowDropdown(false); }}>
                          ✍️ Can&apos;t find it? Suggest adding it
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Expanded Releases (when a mold is clicked) */}
          {releases.length > 0 && selectedItem && selectedItem.itemType === "plastic_mold" && (
            <div className="ref-releases-panel animate-fade-in-up">
              <div className="ref-releases-header">
                <span>Releases for <strong>{selectedItem.title}</strong></span>
                <button className="btn btn-ghost" onClick={handleClear} style={{ fontSize: "0.75rem" }}>✕ Clear</button>
              </div>

              {/* Option: Select mold directly */}
              <button className="ref-result-item ref-mold-direct" onClick={() => handleSelect(selectedItem)}>
                <div className="ref-result-info">
                  <span className="ref-result-name">🏭 {selectedItem.title} (any release)</span>
                </div>
                <span className="ref-result-action">Select Mold</span>
              </button>

              {loadingReleases ? (
                <div className="ref-search-status">Loading releases…</div>
              ) : (
                releases.map((rel) => (
                  <button key={rel.id} className="ref-result-item" onClick={() => handleSelect(rel)}>
                    <div className="ref-result-info">
                      <span className="ref-result-name">{rel.title}</span>
                      {!!rel.attributes.model_number && (
                        <span className="ref-result-meta"> (#{String(rel.attributes.model_number)})</span>
                      )}
                      {!!rel.attributes.color_description && (
                        <span className="ref-result-meta"> · {String(rel.attributes.color_description)}</span>
                      )}
                    </div>
                    <span className="ref-result-action">Select</span>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
