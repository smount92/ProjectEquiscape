"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Where the moderator was going when the Desk stopped them to ask. */
export type LeaveTarget = { kind: "link"; href: string } | { kind: "back" };

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
 * Back: the browser has already moved when popstate fires. The listener
 * runs in the capture phase, ahead of the router's own, puts this page
 * back on the stack and asks; "Leave" steps back again for real.
 */
export default function useLeaveGuard(active: boolean) {
    const router = useRouter();
    const [target, setTarget] = useState<LeaveTarget | null>(null);
    const leaving = useRef(false);
    const here = useRef<{ state: unknown; url: string } | null>(null);

    /** Call after changing the address in place (?release=), so Back returns here. */
    const noteHere = useCallback(() => {
        if (typeof window === "undefined") return;
        here.current = { state: window.history.state, url: window.location.href };
    }, []);

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
            e.stopImmediatePropagation();
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
        else window.history.back();
    }, [router, target]);

    const stay = useCallback(() => setTarget(null), []);

    return { target, leave, stay, noteHere };
}
