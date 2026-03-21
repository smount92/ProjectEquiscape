"use client";

import { useState, useEffect, useCallback, useRef } from"react";
import { searchCatalogAction, getReleasesForMold, getCatalogItem, type CatalogItem } from"@/app/actions/reference";
import MarketValueBadge from"@/components/MarketValueBadge";
import SuggestReferenceModal from"@/components/SuggestReferenceModal";

/* ------------------------------------------------------------------ */
/* Props */
/* ------------------------------------------------------------------ */

interface UnifiedReferenceSearchProps {
 selectedCatalogId: string | null;
 onCatalogSelect: (catalogId: string | null, item: CatalogItem | null) => void;
 onCustomEntry?: (searchTerm: string) => void;
 externalSearchQuery?: string;
 aiNotice?: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/* Icons for item types */
/* ------------------------------------------------------------------ */

const TYPE_BADGES: Record<string, { icon: string; label: string }> = {
 plastic_mold: { icon:"🏭", label:"Mold" },
 plastic_release: { icon:"📦", label:"Release" },
 artist_resin: { icon:"🎨", label:"Resin" },
};

/* ------------------------------------------------------------------ */
/* Component */
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
 // the user doesn't explicitly click"Select Mold" in the releases panel
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
 const molds = results.filter((r) => r.itemType ==="plastic_mold");
 const releaseResults = results.filter((r) => r.itemType ==="plastic_release");
 const resins = results.filter((r) => r.itemType ==="artist_resin");
 const hasResults = results.length > 0;
 const noResults = query.trim().length >= 2 && !isSearching && !hasResults;

 return (
 <div className="relative" ref={containerRef}>
 {/* AI Detection Notice */}
 {aiNotice}

 {/* Selected Item Display (hide when browsing releases) */}
 {selectedItem && selectedCatalogId && releases.length === 0 ? (
 <>
 <div className="bg-[rgba(44,85,69,0.06)] border-[rgba(44,85,69,0.2)] flex items-center justify-between gap-4 rounded-lg border px-6 py-4">
 <div className="flex min-w-0 flex-wrap items-center gap-2">
 <span className="bg-[rgba(92,224,160,0.12)] text-success border-[rgba(92,224,160,0.25)] border">
 {TYPE_BADGES[selectedItem.itemType]?.icon ||"📋"}{""}
 {TYPE_BADGES[selectedItem.itemType]?.label || selectedItem.itemType}
 </span>
 <span className="text-ink font-bold">{selectedItem.title}</span>
 <span className="text-sm text-[var(--color-text-secondary)]">{selectedItem.maker}</span>
 {selectedItem.parentTitle && (
 <span className="ref-selected-parent"> on {selectedItem.parentTitle}</span>
 )}
 {selectedItem.scale && <span className="text-muted text-sm"> · {selectedItem.scale}</span>}
 <MarketValueBadge catalogId={selectedCatalogId} compact />
 </div>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={handleClear}
 aria-label="Clear selection"
 >
 ✕
 </button>
 </div>
 <div
 style={{
 background:"rgba(61, 90, 62, 0.08)",
 border:"1px solid rgba(61, 90, 62, 0.25)",
 borderRadius:"var(--radius-md)",
 padding:"var(--space-sm) var(--space-md)",
 fontSize:"calc(var(--font-size-sm) * var(--font-scale))",
 color:"var(--color-text-secondary)",
 marginTop:"var(--space-sm)",
 }}
 >
 🔗 <strong>Linked</strong> — Manufacturer, scale, and release info will auto-fill on your
 passport.
 </div>
 </>
 ) : (
 <>
 {/* Search Input */}
 <div className="relative mb-4">
 <svg
 className="text-muted pointer-events-none absolute top-[50%] left-[16px] z-[1] translate-y-[-50%]"
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
 className="text-muted"
 placeholder="Search molds, releases, or resins…"
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
 className="text-muted hover:0.1)] hover:text-ink absolute top-[50%] right-[12px] flex h-[28px] w-[28px] translate-y-[-50%] cursor-pointer items-center justify-center rounded-full border-0 bg-[rgba(0,0,0,0.06)] text-[0.8rem] transition-all duration-150"
 onClick={() => {
 setQuery("");
 setShowDropdown(false);
 }}
 aria-label="Clear"
 >
 ✕
 </button>
 )}
 </div>

 {/* Dropdown Results */}
 {showDropdown && (
 <div className="animate-fade-in-up w-[6px]">
 {isSearching ? (
 <div className="text-muted px-4 py-6 text-center text-sm">Searching…</div>
 ) : (
 <>
 {/* Molds */}
 {molds.length > 0 && (
 <>
 <div className="sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 🏭 Base Molds
 </div>
 {molds.map((item) => (
 <button
 key={item.id}
 className="border-b-0"
 onClick={() => handleMoldClick(item)}
 >
 <div className="min-w-0 flex-1">
 <span className="text-ink font-semibold">{item.title}</span>
 <span className="text-muted text-xs">
 {""}
 · {item.maker}
 {item.scale ? ` · ${item.scale}` :""}
 </span>
 </div>
 <span className="text-forest shrink-0 pl-2 text-xs font-semibold whitespace-nowrap">
 ▸ Releases
 </span>
 </button>
 ))}
 </>
 )}

 {/* Releases */}
 {releaseResults.length > 0 && (
 <>
 <div className="sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 📦 Releases
 </div>
 {releaseResults.map((item) => (
 <button
 key={item.id}
 className="border-b-0"
 onClick={() => handleSelect(item)}
 >
 <div className="min-w-0 flex-1">
 <span className="text-ink font-semibold">{item.title}</span>
 {!!item.attributes.model_number && (
 <span className="text-muted text-xs">
 {""}
 (#{String(item.attributes.model_number)})
 </span>
 )}
 <span className="text-muted text-xs"> · {item.maker}</span>
 </div>
 <span className="text-forest shrink-0 pl-2 text-xs font-semibold whitespace-nowrap">
 Select
 </span>
 </button>
 ))}
 </>
 )}

 {/* Resins */}
 {resins.length > 0 && (
 <>
 <div className="sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 🎨 Artist Resins
 </div>
 {resins.map((item) => (
 <button
 key={item.id}
 className="border-b-0"
 onClick={() => handleSelect(item)}
 >
 <div className="min-w-0 flex-1">
 <span className="text-ink font-semibold">{item.title}</span>
 <span className="text-muted text-xs">
 {""}
 · {item.maker}
 {item.scale ? ` · ${item.scale}` :""}
 </span>
 </div>
 <span className="text-forest shrink-0 pl-2 text-xs font-semibold whitespace-nowrap">
 Select
 </span>
 </button>
 ))}
 </>
 )}

 {/* No results */}
 {noResults && (
 <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">
 <p>No references found for &ldquo;{query}&rdquo;</p>
 <p className="text-muted mt-1 text-xs">
 Check the{""}
 <a href="/market" className="text-forest">
 📈 Price Guide
 </a>{""}
 for market data, or use the button below.
 </p>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => {
 setShowSuggestModal(true);
 setShowDropdown(false);
 }}
 >
 ✍️ Can&apos;t find it? Suggest adding it
 </button>
 </div>
 )}
 </>
 )}
 </div>
 )}

 {/* Expanded Releases (when a mold is clicked) */}
 {releases.length > 0 && selectedItem && selectedItem.itemType ==="plastic_mold" && (
 <div className="border-edge bg-card border-edge animate-fade-in-up mt-4 overflow-hidden rounded-lg border shadow-md transition-all">
 <div className="bg-[rgba(44,85,69,0.06)] border-edge flex items-center justify-between border-b px-4 py-2 text-sm text-[var(--color-text-secondary)]">
 <span>
 Releases for <strong>{selectedItem.title}</strong>
 </span>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={handleClear}
 >
 ✕ Clear
 </button>
 </div>

 {/* Option: Select mold directly */}
 <button
 className="bg-[rgba(92,224,160,0.04)] border-[var(--color-border) !important] border-b border-b-0"
 onClick={() => handleSelect(selectedItem)}
 >
 <div className="min-w-0 flex-1">
 <span className="text-ink font-semibold">
 🏭 {selectedItem.title} (any release)
 </span>
 </div>
 <span className="text-forest shrink-0 pl-2 text-xs font-semibold whitespace-nowrap">
 Select Mold
 </span>
 </button>

 {loadingReleases ? (
 <div className="text-muted px-4 py-6 text-center text-sm">Loading releases…</div>
 ) : (
 releases.map((rel) => (
 <button key={rel.id} className="border-b-0" onClick={() => handleSelect(rel)}>
 <div className="min-w-0 flex-1">
 <span className="text-ink font-semibold">{rel.title}</span>
 {!!rel.attributes.model_number && (
 <span className="text-muted text-xs">
 {""}
 (#{String(rel.attributes.model_number)})
 </span>
 )}
 {!!rel.attributes.color_description && (
 <span className="text-muted text-xs">
 {""}
 · {String(rel.attributes.color_description)}
 </span>
 )}
 </div>
 <span className="text-forest shrink-0 pl-2 text-xs font-semibold whitespace-nowrap">
 Select
 </span>
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
