"use client";
/**
 * Keeps the session's navigation trail (lib/nav/trail) in step with the
 * History API. Mounted once, in the header. It watches pushState /
 * replaceState (how the app router navigates) and popstate (Back and
 * Forward), so it needs no router hooks and never forces a page into
 * client rendering.
 */
import { useEffect } from "react";
import {
    parseTrail,
    TRAIL_EVENT,
    TRAIL_KEY,
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

function writeTrail(stack: string[]) {
    try {
        window.sessionStorage.setItem(TRAIL_KEY, JSON.stringify(stack));
    } catch {
        // Private mode / blocked storage: the trail is a convenience, never a requirement.
    }
    window.dispatchEvent(new Event(TRAIL_EVENT));
}

const here = () => window.location.pathname + window.location.search;

export default function NavTrail() {
    useEffect(() => {
        writeTrail(trailPush(readTrail(), here()));

        const { pushState, replaceState } = window.history;
        // The History API updates the URL synchronously; read it right after.
        window.history.pushState = function (...args: Parameters<History["pushState"]>) {
            const result = pushState.apply(this, args);
            writeTrail(trailPush(readTrail(), here()));
            return result;
        };
        window.history.replaceState = function (...args: Parameters<History["replaceState"]>) {
            const result = replaceState.apply(this, args);
            writeTrail(trailReplace(readTrail(), here()));
            return result;
        };
        const onPop = () => writeTrail(trailTraverse(readTrail(), here()));
        window.addEventListener("popstate", onPop);
        return () => {
            window.history.pushState = pushState;
            window.history.replaceState = replaceState;
            window.removeEventListener("popstate", onPop);
        };
    }, []);
    return null;
}
