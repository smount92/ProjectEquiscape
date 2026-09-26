// Next 16 + Turbopack loads browser Sentry ONLY from
// instrumentation-client.ts — the old sentry.client.config.ts was
// never injected, so client errors silently went unreported.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,

    // Free tier: low sample rate to stay under 5K events/month
    tracesSampleRate: 0.05,

    // Only send errors in production
    enabled: process.env.NODE_ENV === "production",

    // Filter out common non-actionable errors
    ignoreErrors: [
        "ResizeObserver loop",
        "Network request failed",
        "Load failed",
        "AbortError",
        // Facebook in-app browser injects its own perf logger into every
        // page and throws when its Java bridge dies on navigation — their
        // script, not ours (first seen 2026-08-17, /signup via FB app).
        "Java object is gone",
        "Error invoking postMessage",
        // iOS in-app browsers (Instagram, Facebook) inject a script that
        // reads window.webkit.messageHandlers on every page — theirs.
        "window.webkit.messageHandlers",
        // A dropped connection mid-fetch; nothing in our code to fix.
        "Failed to fetch",
    ],
    // Tag events from machine-translated pages: Chrome/Edge translate
    // rewrites text nodes and React then cannot find them (see the
    // Node.prototype guard below). The tag keeps the cause visible.
    beforeSend(event) {
        if (typeof document !== "undefined") {
            const cls = document.documentElement.className;
            if (/translated-(ltr|rtl)/.test(cls)) {
                event.tags = { ...event.tags, "page.translated": "true" };
            }
        }
        return event;
    },
    // Third-party scripts injected by app WebViews report under app://
    // pseudo-URLs (e.g. app://navigation_performance_logger_android).
    // Our own chunks report as app:///_next/* — keep those.
    denyUrls: [/^app:\/\/(?!\/_next\/)/],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

/**
 * Browser auto-translate (Chrome, Edge) wraps text nodes in <font> tags
 * behind React's back. The next re-render then throws NotFoundError from
 * removeChild / insertBefore and the member lands on the crash page —
 * every event of that kind in Sentry so far was a Polish reader with
 * translation on (/market filters, /catalog search, 2026-09-26). The
 * long-standing mitigation (facebook/react#11538): make those two DOM
 * calls tolerant when the node has already been moved, and let React
 * carry on with the rest of the tree.
 */
if (typeof Node === "function" && Node.prototype) {
    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
        if (child.parentNode !== this) return child;
        return originalRemoveChild.call(this, child) as T;
    };
    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function <T extends Node>(this: Node, newNode: T, referenceNode: Node | null): T {
        if (referenceNode && referenceNode.parentNode !== this) return newNode;
        return originalInsertBefore.call(this, newNode, referenceNode) as T;
    };
}
