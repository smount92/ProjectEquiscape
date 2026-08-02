"use client";

import { useSyncExternalStore, type ReactNode } from "react";

/**
 * Cards ⇄ compact-table switch for the CATALOG_V2 browse. Both views are
 * server-rendered by the page and passed in as nodes — this component only
 * decides which one shows, so the power-curator table stays the EXISTING
 * CatalogResultsTable renderer (no fork) and the cards stay a server
 * component.
 *
 * The preference lives in localStorage, read through useSyncExternalStore
 * (localStorage IS an external store — no setState-in-effect). The server
 * snapshot is always "cards" (the new default); a stored "table" preference
 * applies right after hydration.
 */

const STORAGE_KEY = "catalog:viewMode";

type ViewMode = "cards" | "table";

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
    listeners.add(onStoreChange);
    // Cross-tab sync for free: storage events fire in OTHER tabs.
    window.addEventListener("storage", onStoreChange);
    return () => {
        listeners.delete(onStoreChange);
        window.removeEventListener("storage", onStoreChange);
    };
}

function getSnapshot(): ViewMode {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === "table" ? "table" : "cards";
    } catch {
        return "cards"; // storage blocked — cards default
    }
}

function getServerSnapshot(): ViewMode {
    return "cards";
}

function setStoredMode(next: ViewMode): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
        /* storage blocked — the toggle simply won't persist */
    }
    for (const l of listeners) l();
}

export default function CatalogViewToggle({
    cards,
    table,
}: {
    cards: ReactNode;
    table: ReactNode;
}) {
    const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    return (
        <div>
            <div className="mb-2 flex justify-end">
                <button
                    type="button"
                    onClick={() => setStoredMode(mode === "cards" ? "table" : "cards")}
                    aria-pressed={mode === "table"}
                    title={mode === "cards" ? "Switch to compact table" : "Switch to cards"}
                    aria-label={mode === "cards" ? "Switch to compact table" : "Switch to cards"}
                    id="catalog-view-toggle"
                    className="inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-md border border-input bg-transparent px-2.5 py-1 font-serif text-xs tracking-wide text-secondary-foreground transition-colors hover:border-forest hover:text-forest"
                >
                    <span aria-hidden="true">{mode === "cards" ? "☰" : "🃏"}</span>
                    {mode === "cards" ? "Compact table" : "Cards"}
                </button>
            </div>
            {mode === "cards" ? cards : table}
        </div>
    );
}
