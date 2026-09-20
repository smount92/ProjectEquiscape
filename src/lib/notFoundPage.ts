/** Set on <html> by components/NotFoundMarker while a not-found page is showing. */
export const NOT_FOUND_ATTR = "data-not-found";

/**
 * True while the app's not-found page is on screen. Layout-level code
 * that calls server actions on mount checks this: on a 404 route those
 * POSTs answer 404 and make Next hard-reload the page in a loop.
 */
export function onNotFoundPage(): boolean {
    return typeof document !== "undefined" && document.documentElement.hasAttribute(NOT_FOUND_ATTR);
}
