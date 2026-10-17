"use client";

import { useEffect, useRef } from "react";

/** True when the key press belongs to a box the person is typing in. */
export function isTypingTarget(target: EventTarget | null): boolean {
    if (!target || typeof (target as HTMLElement).tagName !== "string") return false;
    const el = target as HTMLElement;
    const tag = el.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}

/** True on a Mac (or iPad with a keyboard), where the save key is ⌘S. */
export function isMacLike(nav: { platform?: string; userAgent?: string } | undefined): boolean {
    if (!nav) return false;
    return /Mac|iPhone|iPad|iPod/i.test(nav.platform || nav.userAgent || "");
}

/**
 * The editor's keys: J next, K previous (never while typing in a box, so a
 * "j" in a colour stays a "j"), and Ctrl/Cmd+S saves from anywhere,
 * including inside a box, instead of the browser's Save Page. None of them
 * act while `paused`: the page passes true while one of its own dialogs
 * (merge, remove, leave without saving) is open, and the dialog's buttons
 * decide. Other panels that call themselves dialogs (the cookie banner,
 * the notifications panel) don't stop the keys.
 */
export default function useDeskKeys(handlers: {
    onNext: () => void;
    onPrev: () => void;
    onSave: () => void;
    paused?: boolean;
}): void {
    const ref = useRef(handlers);
    useEffect(() => {
        ref.current = handlers;
    });

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            const paused = !!ref.current.paused;
            if ((e.ctrlKey || e.metaKey) && key === "s") {
                // Never the browser's Save Page on the Desk, dialog or not.
                e.preventDefault();
                if (!paused) ref.current.onSave();
                return;
            }
            if (paused) return;
            if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
            if (key === "j") {
                e.preventDefault();
                ref.current.onNext();
            } else if (key === "k") {
                e.preventDefault();
                ref.current.onPrev();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);
}
