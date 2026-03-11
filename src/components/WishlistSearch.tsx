"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { searchCatalogAction, type CatalogItem } from "@/app/actions/reference";
import { addToWishlist } from "@/app/actions/wishlist";
import { useRouter } from "next/navigation";

const TYPE_ICONS: Record<string, string> = {
    plastic_mold: "🏭",
    plastic_release: "📦",
    artist_resin: "🎨",
};

export default function WishlistSearch() {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [results, setResults] = useState<CatalogItem[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);

    const router = useRouter();
    const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

    // Auto-hide toast
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(t);
    }, [toast]);

    const runSearch = useCallback(
        async (q: string) => {
            if (!q.trim()) {
                setResults([]);
                setShowDropdown(false);
                return;
            }

            setLoading(true);
            const items = await searchCatalogAction(q.trim());
            setResults(items);
            setLoading(false);
            setShowDropdown(true);
        },
        []
    );

    // Debounced search
    useEffect(() => {
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        if (!query.trim()) {
            setResults([]);
            setShowDropdown(false);
            return;
        }
        fetchTimeoutRef.current = setTimeout(() => runSearch(query), 300);
        return () => {
            if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        };
    }, [query, runSearch]);

    const handleAdd = async (item: CatalogItem) => {
        if (adding) return;
        setAdding(true);
        const result = await addToWishlist(item.id);
        if (result.success) {
            setToast({ message: `✅ "${item.title}" added to Wishlist!`, type: "success" });
            setQuery("");
            setShowDropdown(false);
            router.refresh();
        } else {
            setToast({ message: result.error || "Failed to add", type: "error" });
        }
        setAdding(false);
    };

    const handleCustomAdd = async () => {
        if (adding || !query.trim()) return;
        setAdding(true);
        const searchTerm = query.trim();
        const result = await addToWishlist(null, `Searching for: ${searchTerm}`);
        if (result.success) {
            setToast({ message: `✅ "${searchTerm}" added to Wishlist as custom entry!`, type: "success" });
            setQuery("");
            setShowDropdown(false);
            router.refresh();
        } else {
            setToast({ message: result.error || "Failed to add", type: "error" });
        }
        setAdding(false);
    };

    const hasResults = results.length > 0;
    const noResults = query.trim() && !loading && !hasResults;

    // Group by type
    const molds = results.filter(r => r.itemType === "plastic_mold");
    const releases = results.filter(r => r.itemType === "plastic_release");
    const resins = results.filter(r => r.itemType === "artist_resin");

    return (
        <div className="wishlist-search-container" ref={containerRef}>
            {/* Toast */}
            {toast && (
                <div className={`wishlist-toast ${toast.type === "success" ? "toast-success" : "toast-error"}`}>
                    {toast.message}
                </div>
            )}

            {/* Search input */}
            <div className="wishlist-search-bar">
                <svg
                    className="wishlist-search-icon"
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
                    className="wishlist-search-input"
                    placeholder="Search molds, releases & resins to add to your wishlist…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => { if (query.trim() && hasResults) setShowDropdown(true); }}
                    id="wishlist-search-input"
                    autoComplete="off"
                    disabled={adding}
                />
                {query && (
                    <button
                        className="wishlist-search-clear"
                        onClick={() => { setQuery(""); setShowDropdown(false); }}
                        aria-label="Clear search"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Dropdown results */}
            {showDropdown && (
                <div className="wishlist-search-dropdown animate-fade-in-up">
                    {loading ? (
                        <div className="wishlist-search-status">Searching…</div>
                    ) : (
                        <>
                            {/* Molds */}
                            {molds.length > 0 && (
                                <>
                                    <div className="wishlist-search-group-header">🏭 Base Molds</div>
                                    {molds.map((item) => (
                                        <button
                                            key={item.id}
                                            className="wishlist-search-result"
                                            onClick={() => handleAdd(item)}
                                            disabled={adding}
                                        >
                                            <div className="wishlist-search-result-info">
                                                <span className="wishlist-search-result-name">{item.title}</span>
                                                <span className="wishlist-search-result-meta"> · {item.maker}{item.scale ? ` · ${item.scale}` : ""}</span>
                                            </div>
                                            <span className="wishlist-search-add-badge">+ Add</span>
                                        </button>
                                    ))}
                                </>
                            )}

                            {/* Releases */}
                            {releases.length > 0 && (
                                <>
                                    <div className="wishlist-search-group-header">📦 Releases</div>
                                    {releases.map((item) => (
                                        <button
                                            key={item.id}
                                            className="wishlist-search-result"
                                            onClick={() => handleAdd(item)}
                                            disabled={adding}
                                        >
                                            <div className="wishlist-search-result-info">
                                                <span className="wishlist-search-result-name">{item.title}</span>
                                                {!!item.attributes.model_number && (
                                                    <span className="wishlist-search-result-meta"> (#{String(item.attributes.model_number)})</span>
                                                )}
                                                <span className="wishlist-search-result-meta"> · {item.maker}</span>
                                            </div>
                                            <span className="wishlist-search-add-badge">+ Add</span>
                                        </button>
                                    ))}
                                </>
                            )}

                            {/* Resins */}
                            {resins.length > 0 && (
                                <>
                                    <div className="wishlist-search-group-header">🎨 Artist Resins</div>
                                    {resins.map((item) => (
                                        <button
                                            key={item.id}
                                            className="wishlist-search-result"
                                            onClick={() => handleAdd(item)}
                                            disabled={adding}
                                        >
                                            <div className="wishlist-search-result-info">
                                                <span className="wishlist-search-result-name">{item.title}</span>
                                                <span className="wishlist-search-result-meta"> · {item.maker}{item.scale ? ` · ${item.scale}` : ""}</span>
                                            </div>
                                            <span className="wishlist-search-add-badge">+ Add</span>
                                        </button>
                                    ))}
                                </>
                            )}

                            {/* No results — escape hatch */}
                            {noResults && (
                                <div className="wishlist-search-empty">
                                    <p>No references match &ldquo;{query}&rdquo;</p>
                                    <button
                                        className="wishlist-search-custom-btn"
                                        onClick={handleCustomAdd}
                                        disabled={adding}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <circle cx="12" cy="12" r="10" />
                                            <line x1="12" y1="8" x2="12" y2="16" />
                                            <line x1="8" y1="12" x2="16" y2="12" />
                                        </svg>
                                        Can&apos;t find it? Add &ldquo;{query}&rdquo; to Wishlist
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
