"use client";

/**
 * Wave 4a — the ONE show-side toast, extracted from the pattern
 * ShowEntriesPanel and ShowAnnounceDialog established (local state +
 * auto-dismiss timer + the `share-toast` pill from globals.css),
 * so every new success ping renders identically instead of each
 * component re-growing its own timer block.
 *
 * Usage:
 *   const { showToast, toastNode } = useShowToast();
 *   ...on success: showToast("Saved.");
 *   ...in JSX (anywhere — the pill is position:fixed): {toastNode}
 */

import { useCallback, useEffect, useRef, useState } from "react";

const TOAST_MS = 3000;

export function useShowToast(): {
    showToast: (message: string) => void;
    toastNode: React.ReactNode;
} {
    const [message, setMessage] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        [],
    );

    const showToast = useCallback((next: string) => {
        setMessage(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setMessage(null), TOAST_MS);
    }, []);

    const toastNode = message ? (
        <div className="share-toast" role="status" aria-live="polite">
            {message}
        </div>
    ) : null;

    return { showToast, toastNode };
}
