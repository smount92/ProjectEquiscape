"use client";
/**
 * Keeps the session's navigation trail (lib/nav/trail) in step with the
 * History API. Mounted once, in the header. It watches pushState /
 * replaceState (how the app router navigates) and popstate (Back and
 * Forward), so it needs no router hooks and never forces a page into
 * client rendering.
 *
 * Alongside the stack it records the page the reader just left (on a
 * push or a history move, not a replace), because a Back pops that page
 * off the stack and nothing else remembers it.
 */
import { useEffect } from "react";
import {
    parseTrail,
    TRAIL_EVENT,
    TRAIL_FROM_KEY,
    TRAIL_KEY,
    trailLeft,
    trailPush,
    trailReplace,
    trailTraverse,
} from "@/lib/nav/trail";

export function readTrail(): string[] {
    try {
        return parseTrail(window.sessionStorage.getItem(TRAIL_KEY));
    } catch {
        return [];
    }
}

/** The page the reader was on just before this one (null when unknown). */
export function readTrailFrom(): string | null {
    try {
        return window.sessionStorage.getItem(TRAIL_FROM_KEY);
    } catch {
        return null;
    }
}

function writeTrail(stack: string[], left: string | null = null) {
    try {
        if (left) window.sessionStorage.setItem(TRAIL_FROM_KEY, left);
        window.sessionStorage.setItem(TRAIL_KEY, JSON.stringify(stack));
    } catch {
        // Private mode / blocked storage: the trail is a convenience, never a requirement.
    }
    window.dispatchEvent(new Event(TRAIL_EVENT));
}

/** Move the trail and remember the page that was left. */
function moveTrail(step: (stack: string[]) => string[]) {
    const before = readTrail();
    const after = step(before);
    writeTrail(after, trailLeft(before, after));
}

const here = () => window.location.pathname + window.location.search;

export default function NavTrail() {
    useEffect(() => {
        moveTrail((s) => trailPush(s, here()));

        const { pushState, replaceState } = window.history;
        // The History API updates the URL synchronously; read it right after.
        window.history.pushState = function (...args: Parameters<History["pushState"]>) {
            const result = pushState.apply(this, args);
            moveTrail((s) => trailPush(s, here()));
            return result;
        };
        window.history.replaceState = function (...args: Parameters<History["replaceState"]>) {
            const result = replaceState.apply(this, args);
            writeTrail(trailReplace(readTrail(), here()));
            return result;
        };
        const onPop = () => moveTrail((s) => trailTraverse(s, here()));
        window.addEventListener("popstate", onPop);
        return () => {
            window.history.pushState = pushState;
            window.history.replaceState = replaceState;
            window.removeEventListener("popstate", onPop);
        };
    }, []);
    return null;
}
