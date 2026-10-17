"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Where the moderator was going when the Desk stopped them to ask:
 * a link; a step through history the Desk can measure (`delta` -1 is Back,
 * +1 is Forward); or Back to a page it can't measure.
 */
export type LeaveTarget = { kind: "link"; href: string } | { kind: "history"; delta: 1 | -1 } | { kind: "back" };

/** The key the Desk writes into its own history entries, so it can tell Back from Forward. */
export const STAMP_KEY = "mhhDeskStamp";

let lastStamp = 0;

/** The Desk's stamp on a history entry's state, if it has one. */
export function stampOf(state: unknown): number | null {
    const v = state && typeof state === "object" ? (state as Record<string, unknown>)[STAMP_KEY] : undefined;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Stamp the current history entry (once) with a number that only grows.
 * Entries further on in the history were made later, so a landed entry
 * with a bigger stamp is Forward and a smaller one is Back.
 */
function stampCurrentEntry(): number {
    const state = window.history.state as unknown;
    const have = stampOf(state);
    if (have !== null) return have;
    const stamp = Math.max(Date.now(), lastStamp + 1);
    lastStamp = stamp;
    try {
        const base = state && typeof state === "object" ? (state as Record<string, unknown>) : {};
        window.history.replaceState({ ...base, [STAMP_KEY]: stamp }, "", window.location.href);
    } catch {
        // A browser that refuses: Back falls back to putting the page back on the stack.
    }
    return stamp;
}

/**
 * The internal page a click on this link would open, or null when the
 * click isn't leaving: a new tab, a download, another site, a modified
 * click, or a link to this same page.
 */
export function leavingHref(e: MouseEvent, here: Location): string | null {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
    const target = e.target as Element | null;
    const a = target?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a) return null;
    if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return null;
    const url = new URL(a.getAttribute("href") ?? "", here.href);
    if (url.origin !== here.origin) return null;
    if (url.pathname === here.pathname && url.search === here.search) return null;
    return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Keeps unsaved edits from vanishing on in-app navigation. While `active`
 * (anything unsaved), one capture listener stops internal link clicks and
 * the Back and Forward buttons, and the page asks first. Reloading or
 * closing the tab is the browser's own "Leave site?" (beforeunload).
 *
 * Back and Forward: the browser has already moved when popstate fires.
 * The listener runs in the capture phase, ahead of the router's own. When
 * the page it landed on carries the Desk's stamp, the move is undone with
 * history.go(-delta), which keeps the rest of the history (Forward
 * included) as it was; "Leave" makes the same move again. A page without a
 * stamp (one outside the Desk, so only ever reached by Back here) is
 * handled as before: this page is put back on the stack and "Leave" steps
 * back.
 */
export default function useLeaveGuard(active: boolean) {
    const router = useRouter();
    const [target, setTarget] = useState<LeaveTarget | null>(null);
    const leaving = useRef(false);
    const restoring = useRef(false);
    const here = useRef<{ state: unknown; url: string; stamp: number } | null>(null);

    /** Call after changing the address in place (?release=), so Back returns here. */
    const noteHere = useCallback(() => {
        if (typeof window === "undefined") return;
        const stamp = stampCurrentEntry();
        here.current = { state: window.history.state, url: window.location.href, stamp };
    }, []);

    // Stamp this page's entry as soon as it opens, so a later Back or
    // Forward onto it from another Desk page can be told apart.
    useEffect(() => {
        noteHere();
    }, [noteHere]);

    useEffect(() => {
        if (!active) return;
        noteHere();
        const onClick = (e: MouseEvent) => {
            if (leaving.current) return;
            const href = leavingHref(e, window.location);
            if (!href) return;
            e.preventDefault();
            e.stopPropagation();
            setTarget({ kind: "link", href });
        };
        const onPop = (e: PopStateEvent) => {
            if (leaving.current || !here.current) return;
            const landed = stampOf(e.state);
            if (restoring.current && landed === here.current.stamp) {
                // Our own history.go() bringing the browser back here: nothing to ask.
                restoring.current = false;
                e.stopImmediatePropagation();
                return;
            }
            e.stopImmediatePropagation();
            if (landed !== null && landed !== here.current.stamp) {
                const delta: 1 | -1 = landed > here.current.stamp ? 1 : -1;
                restoring.current = true;
                window.history.go(-delta);
                setTarget({ kind: "history", delta });
                return;
            }
            window.history.pushState(here.current.state, "", here.current.url);
            setTarget({ kind: "back" });
        };
        document.addEventListener("click", onClick, true);
        window.addEventListener("popstate", onPop, true);
        return () => {
            document.removeEventListener("click", onClick, true);
            window.removeEventListener("popstate", onPop, true);
        };
    }, [active, noteHere]);

    /** Go where they were going, unguarded. */
    const leave = useCallback(() => {
        const t = target;
        setTarget(null);
        if (!t) return;
        leaving.current = true;
        if (t.kind === "link") router.push(t.href);
        else if (t.kind === "history") window.history.go(t.delta);
        else window.history.back();
    }, [router, target]);

    const stay = useCallback(() => setTarget(null), []);

    return { target, leave, stay, noteHere };
}
