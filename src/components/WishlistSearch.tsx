"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { addToWishlist } from "@/app/actions/wishlist";
import { useRouter } from "next/navigation";

interface MoldResult {
    id: string;
    manufacturer: string;
    mold_name: string;
    scale: string;
}

interface ReleaseResult {
    id: string;
    mold_id: string;
    release_name: string;
    model_number: string | null;
    color_description: string | null;
    release_year_start: number | null;
    release_year_end: number | null;
    reference_molds: { mold_name: string; manufacturer: string } | null;
}

export default function WishlistSearch() {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [moldResults, setMoldResults] = useState<MoldResult[]>([]);
    const [releaseResults, setReleaseResults] = useState<ReleaseResult[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);

    const supabase = createClient();
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
                setMoldResults([]);
                setReleaseResults([]);
                setShowDropdown(false);
                return;
            }

            setLoading(true);

            const [moldRes, releaseRes] = await Promise.all([
                supabase
                    .from("reference_molds")
                    .select("id, manufacturer, mold_name, scale")
                    .or(`mold_name.ilike.%${q}%,manufacturer.ilike.%${q}%`)
                    .order("mold_name")
                    .limit(10),
                supabase
                    .from("reference_releases")
                    .select(
                        `id, mold_id, release_name, model_number, color_description,
             release_year_start, release_year_end,
             reference_molds(mold_name, manufacturer)`
                    )
                    .or(`release_name.ilike.%${q}%,color_description.ilike.%${q}%,model_number.ilike.%${q}%`)
                    .limit(10),
            ]);

            setMoldResults((moldRes.data as MoldResult[]) ?? []);
            setReleaseResults((releaseRes.data as unknown as ReleaseResult[]) ?? []);
            setLoading(false);
            setShowDropdown(true);
        },
        [supabase]
    );

    // Debounced search
    useEffect(() => {
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        if (!query.trim()) {
            setMoldResults([]);
            setReleaseResults([]);
            setShowDropdown(false);
            return;
        }
        fetchTimeoutRef.current = setTimeout(() => runSearch(query), 300);
        return () => {
            if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        };
    }, [query, runSearch]);

    const handleAddMold = async (mold: MoldResult) => {
        if (adding) return;
        setAdding(true);
        const result = await addToWishlist(mold.id, null);
        if (result.success) {
            setToast({ message: `✅ "${mold.mold_name}" added to Wishlist!`, type: "success" });
            setQuery("");
            setShowDropdown(false);
            router.refresh();
        } else {
            setToast({ message: result.error || "Failed to add", type: "error" });
        }
        setAdding(false);
    };

    const handleAddRelease = async (release: ReleaseResult) => {
        if (adding) return;
        setAdding(true);
        const result = await addToWishlist(release.mold_id, release.id);
        if (result.success) {
            setToast({ message: `✅ "${release.release_name}" added to Wishlist!`, type: "success" });
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
        const result = await addToWishlist(null, null, `Searching for: ${searchTerm}`);
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

    const hasResults = moldResults.length > 0 || releaseResults.length > 0;
    const noResults = query.trim() && !loading && !hasResults;

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
                    placeholder="Search molds & releases to add to your wishlist…"
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
                            {/* Base Molds */}
                            {moldResults.length > 0 && (
                                <>
                                    <div className="wishlist-search-group-header">🏭 Base Molds</div>
                                    {moldResults.map((mold) => (
                                        <button
                                            key={`mold-${mold.id}`}
                                            className="wishlist-search-result"
                                            onClick={() => handleAddMold(mold)}
                                            disabled={adding}
                                        >
                                            <div className="wishlist-search-result-info">
                                                <span className="wishlist-search-result-name">{mold.mold_name}</span>
                                                <span className="wishlist-search-result-meta"> · {mold.manufacturer} · {mold.scale}</span>
                                            </div>
                                            <span className="wishlist-search-add-badge">+ Add</span>
                                        </button>
                                    ))}
                                </>
                            )}

                            {/* Specific Releases */}
                            {releaseResults.length > 0 && (
                                <>
                                    <div className="wishlist-search-group-header">🎨 Specific Releases</div>
                                    {releaseResults.map((release) => {
                                        const parentMold = release.reference_molds?.mold_name ?? "Unknown mold";
                                        const parentMfg = release.reference_molds?.manufacturer ?? "";
                                        return (
                                            <button
                                                key={`release-${release.id}`}
                                                className="wishlist-search-result"
                                                onClick={() => handleAddRelease(release)}
                                                disabled={adding}
                                            >
                                                <div className="wishlist-search-result-info">
                                                    <span className="wishlist-search-result-name">{release.release_name}</span>
                                                    {release.model_number && (
                                                        <span className="wishlist-search-result-meta"> (#{release.model_number})</span>
                                                    )}
                                                    <div className="wishlist-search-result-context">
                                                        on <strong>{parentMold}</strong>
                                                        {parentMfg && <> · {parentMfg}</>}
                                                        {release.release_year_start && (
                                                            <> · {release.release_year_start}
                                                                {release.release_year_end &&
                                                                    release.release_year_end !== release.release_year_start &&
                                                                    `–${release.release_year_end}`}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="wishlist-search-add-badge">+ Add</span>
                                            </button>
                                        );
                                    })}
                                </>
                            )}

                            {/* No results — escape hatch */}
                            {noResults && (
                                <div className="wishlist-search-empty">
                                    <p>No molds or releases match &ldquo;{query}&rdquo;</p>
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
