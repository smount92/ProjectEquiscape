"use client";

/**
 * A per-browser preference read through useSyncExternalStore, so the
 * server render and the first client render agree (the fallback) and the
 * stored value arrives without a setState-in-effect. Used for the scale
 * chip a member pressed last on the Reference step.
 */

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "mhh:pref";

function read(key: string, fallback: string): string {
    try {
        return localStorage.getItem(key) ?? fallback;
    } catch {
        return fallback;
    }
}

function subscribe(cb: () => void): () => void {
    window.addEventListener(EVENT, cb);
    window.addEventListener("storage", cb);
    return () => {
        window.removeEventListener(EVENT, cb);
        window.removeEventListener("storage", cb);
    };
}

function writePref(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        /* private window: the choice lasts for this render only */
    }
    window.dispatchEvent(new Event(EVENT));
}

export function useLocalPref(key: string, fallback: string): [string, (next: string) => void] {
    const value = useSyncExternalStore(
        subscribe,
        () => read(key, fallback),
        () => fallback,
    );
    const set = useCallback((next: string) => writePref(key, next), [key]);
    return [value, set];
}
