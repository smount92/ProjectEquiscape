"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

import { searchCatalogAction, type CatalogItem } from "@/app/actions/reference";
import { addToWishlist } from "@/app/actions/wishlist";
import { Button } from "@/components/ui/button";

/**
 * Want List add-flow: Registry search → one tap → on the list.
 *
 * 2026-08 restyle: the class strings in the results dropdown had been
 * mangled by an automated CSS migration (`hover:0.25)]`, a literal
 * `rgb(250 250 249)` border, and the full button class string copied onto
 * the inner name/meta spans, which made every span a full-width flex row).
 * The toast also reached for `.toast-success` / `.toast-error`, which are
 * defined nowhere — so it rendered as unstyled text on no background.
 * All of that is now token-based. Behaviour is unchanged.
 */

// Every item type has a home: china, micro minis, medallions and factory
// resins used to vanish from the dropdown because no group claimed them.
const TYPE_GROUPS: { key: string; label: string; types: string[] | null }[] = [
    { key: "plastic_mold", label: "🏭 Base molds", types: ["plastic_mold"] },
    { key: "plastic_release", label: "📦 Releases", types: ["plastic_release"] },
    { key: "artist_resin", label: "🎨 Artist resins", types: ["artist_resin", "factory_resin"] },
    { key: "other", label: "🐎 China, micro minis and more", types: null },
];
const GROUPED = new Set(TYPE_GROUPS.flatMap((g) => g.types ?? []));

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

    const runSearch = useCallback(async (q: string) => {
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
    }, []);

    // Debounced search
    useEffect(() => {
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        if (!query.trim()) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale results when the query is emptied
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
            setToast({ message: `✅ “${item.title}” is on your Want List.`, type: "success" });
            setQuery("");
            setShowDropdown(false);
            router.refresh();
        } else {
            setToast({ message: result.error || "Couldn’t add that — try again.", type: "error" });
        }
        setAdding(false);
    };

    const handleCustomAdd = async () => {
        if (adding || !query.trim()) return;
        setAdding(true);
        const searchTerm = query.trim();
        const result = await addToWishlist(null, `Searching for: ${searchTerm}`);
        if (result.success) {
            setToast({
                message: `✅ “${searchTerm}” added as a note. Matchmaker can’t watch this one.`,
                type: "success",
            });
            setQuery("");
            setShowDropdown(false);
            router.refresh();
        } else {
            setToast({ message: result.error || "Couldn’t add that — try again.", type: "error" });
        }
        setAdding(false);
    };

    const hasResults = results.length > 0;
    const noResults = query.trim() && !loading && !hasResults;

    return (
        <div className="relative" ref={containerRef}>
            {/* Toast */}
            {toast && (
                <div
                    role="status"
                    aria-live="polite"
                    className={`wishlist-toast border ${
                        toast.type === "success"
                            ? "border-success/40 bg-success/10 text-success"
                            : "border-destructive/40 bg-destructive/10 text-destructive"
                    }`}
                >
                    {toast.message}
                </div>
            )}

            {/* Search input */}
            <div className="flex items-center gap-2 rounded-lg border border-input bg-muted px-4 py-2 transition-colors focus-within:border-forest">
                <svg
                    className="shrink-0 text-muted-foreground"
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
                    className="min-h-[36px] flex-1 border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    placeholder="Search molds, releases and resins…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => {
                        if (query.trim() && hasResults) setShowDropdown(true);
                    }}
                    id="wishlist-search-input"
                    aria-label="Search the Registry to add to your Want List"
                    autoComplete="off"
                    disabled={adding}
                />
                {query && (
                    <button
                        type="button"
                        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-secondary text-[0.7rem] text-muted-foreground transition-all hover:text-foreground"
                        onClick={() => {
                            setQuery("");
                            setShowDropdown(false);
                        }}
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
                        <div className="p-4 text-center text-sm text-muted-foreground">Searching…</div>
                    ) : (
                        <>
                            {TYPE_GROUPS.map(({ key, label, types }) => {
                                const group = results.filter((r) =>
                                    types ? types.includes(r.itemType) : !GROUPED.has(r.itemType),
                                );
                                if (group.length === 0) return null;
                                return (
                                    <div key={key}>
                                        <div className="border-b border-input bg-muted px-4 py-2 text-xs font-bold tracking-[0.05em] text-secondary-foreground uppercase">
                                            {label}
                                        </div>
                                        {group.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                className="flex w-full cursor-pointer items-center justify-between gap-3 border-0 border-b border-input bg-transparent px-4 py-2 text-left transition-all hover:bg-muted"
                                                onClick={() => handleAdd(item)}
                                                disabled={adding}
                                            >
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-semibold text-foreground">
                                                        {item.title}
                                                        {!!item.attributes.model_number && (
                                                            <> (#{String(item.attributes.model_number)})</>
                                                        )}
                                                    </span>
                                                    <span className="block truncate text-xs text-muted-foreground">
                                                        {item.maker}
                                                        {item.scale ? ` · ${item.scale}` : ""}
                                                    </span>
                                                </span>
                                                <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-[3px] text-xs font-bold text-success">
                                                    + Add
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                );
                            })}

                            {/* No results — escape hatch */}
                            {noResults && (
                                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                                    <p className="mb-1">Nothing in the Registry matches &ldquo;{query}&rdquo;.</p>
                                    <p className="mb-3 text-xs">
                                        Add it as a note instead — it will sit on your list, but Matchmaker can only
                                        watch cataloged models.
                                    </p>
                                    <Button variant="outline" size="wide" onClick={handleCustomAdd} disabled={adding}>
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <circle cx="12" cy="12" r="10" />
                                            <line x1="12" y1="8" x2="12" y2="16" />
                                            <line x1="8" y1="12" x2="16" y2="12" />
                                        </svg>
                                        Add &ldquo;{query}&rdquo; as a note
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
