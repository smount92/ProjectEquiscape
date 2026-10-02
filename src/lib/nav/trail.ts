/**
 * The navigation trail — where this visit has actually been.
 *
 * The site grew up in a browser, where Back is free. Installed as an app
 * it has no Back at all, so pages grew their own: three dozen
 * hand-written "← Somewhere" links, each guessing where the reader came
 * from. A listing's guess was "/market", which dropped the search and
 * the scroll position the reader had (member report, 2026-10-01).
 *
 * This is the one model: a stack of in-app URLs for the session, kept by
 * NavTrail from the History API. BackLink asks it "did the reader come
 * from this page's logical parent?" and, if so, goes back through real
 * history — filters and scroll restored for free — instead of loading
 * the parent fresh. The installed app's back control asks it whether
 * there is anywhere to go back to.
 *
 * Pure functions here; the browser wiring lives in components/nav.
 */

export const TRAIL_KEY = "mhh:nav-trail";
export const TRAIL_EVENT = "mhh:nav-trail";
export const TRAIL_MAX = 40;

/** Path + query, the part of a URL that identifies an in-app page. */
export function trailUrl(href: string, base = "http://local"): string {
    try {
        const u = new URL(href, base);
        return u.pathname + u.search;
    } catch {
        return href;
    }
}

export function pathOf(url: string): string {
    const q = url.indexOf("?");
    const h = url.indexOf("#");
    const end = [q, h].filter((i) => i >= 0).sort((a, b) => a - b)[0];
    return end === undefined ? url : url.slice(0, end);
}

/** A forward navigation: new entry on top (a repeat of the top is ignored). */
export function trailPush(stack: readonly string[], url: string): string[] {
    if (stack[stack.length - 1] === url) return [...stack];
    return [...stack, url].slice(-TRAIL_MAX);
}

/** A replace (redirect, filter update done with replaceState): the top entry changes. */
export function trailReplace(stack: readonly string[], url: string): string[] {
    if (stack.length === 0) return [url];
    return [...stack.slice(0, -1), url];
}

/**
 * The browser moved through history to `url`. If that is the entry
 * under the top, it was Back: pop. Anything else (Forward, a jump) is
 * recorded as a new top so the trail never lies about the current page.
 */
export function trailTraverse(stack: readonly string[], url: string): string[] {
    if (stack.length >= 2 && stack[stack.length - 2] === url) return stack.slice(0, -1);
    return trailPush(stack, url);
}

/** The page the reader was on before this one, if any. */
export function trailPrevious(stack: readonly string[]): string | null {
    return stack.length >= 2 ? stack[stack.length - 2] : null;
}

/**
 * Should "← Parent" go back through history? Only when the previous
 * page IS that parent (same path, whatever its query): then history
 * back lands on the parent exactly as the reader left it.
 */
export function cameFrom(stack: readonly string[], parentHref: string): boolean {
    const prev = trailPrevious(stack);
    if (!prev) return false;
    return pathOf(prev) === pathOf(trailUrl(parentHref));
}

export function parseTrail(raw: string | null): string[] {
    if (!raw) return [];
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(-TRAIL_MAX) : [];
    } catch {
        return [];
    }
}
